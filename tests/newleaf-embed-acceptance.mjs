// Against a running Cloudflare Pages local server:
//   NEWLEAF_EMBED_ORIGIN=http://127.0.0.1:4398 npm run build
//   npx wrangler pages dev out --ip 127.0.0.1 --port 8798
//   node tests/newleaf-embed-acceptance.mjs
// APP_BASE_URL can point at another local Pages server built with the same
// allowed origin. No live photo, account, or external service is used.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium, expect } from '@playwright/test';

const allowedOrigin = 'http://127.0.0.1:4398';
const deniedOrigin = 'http://127.0.0.1:4399';
const appOrigin = new URL(process.env.APP_BASE_URL || 'http://127.0.0.1:8798').origin;
const allowedPaths = new Set(['/embed/', '/mobile/', '/board/', '/transfer/']);

function hostServer() {
  return createServer((request, response) => {
    const path = new URL(request.url || '/', allowedOrigin).searchParams.get('path') || '/embed/';
    if (!allowedPaths.has(path)) {
      response.writeHead(400).end('Unsupported test route');
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(`<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;height:100%}iframe{display:block;border:0;width:100%;height:100dvh}</style></head><body><iframe title="Nature Lens" src="${appOrigin}${path}" allow="camera; geolocation"></iframe></body></html>`);
  });
}

async function listen(server, port) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
}

async function close(server) {
  if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function headers(path) {
  const response = await fetch(new URL(path, appOrigin), { redirect: 'manual' });
  assert.equal(response.status, 200, `${path} must return the actual page (HTTP ${response.status})`);
  return response.headers;
}

async function frameFor(page, origin, path) {
  await page.goto(`${origin}/?path=${encodeURIComponent(path)}`, { waitUntil: 'load' });
  const handle = await page.locator('iframe').elementHandle();
  assert.ok(handle, 'Host iframe must exist');
  const frame = await handle.contentFrame();
  assert.ok(frame, 'Browser must expose the child frame');
  return frame;
}

async function blockedInBrowser(page, origin, path) {
  const messages = [];
  const collect = message => messages.push(message.text());
  page.on('console', collect);
  try {
    const frame = await frameFor(page, origin, path);
    assert.ok(messages.some(message => /refused to (frame|display)|framing .*violates.*frame-ancestors/i.test(message)),
      `${origin} framing ${path} must be refused by the browser; got ${JSON.stringify(messages)}`);
    assert.notEqual(new URL(frame.url()).origin, appOrigin, `Blocked frame ${path} must not render the app origin`);
  } finally {
    page.off('console', collect);
  }
}

async function checkPhoneGeometry(frame, width) {
  const metrics = await frame.evaluate(() => ({
    width: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  assert.equal(metrics.width, width, 'Iframe should match the phone width');
  assert.ok(metrics.documentWidth <= width + 1 && metrics.bodyWidth <= width + 1,
    `No horizontal overflow at ${width}px: ${JSON.stringify(metrics)}`);
}

const allowedHost = hostServer();
const deniedHost = hostServer();
let browser;
try {
  await listen(allowedHost, 4398);
  await listen(deniedHost, 4399);

  const embedHeaders = await headers('/embed/');
  assert.equal(embedHeaders.get('x-frame-options'), null, '/embed/ cannot also send X-Frame-Options');
  assert.match(embedHeaders.get('content-security-policy') || '', /(?:^|;)\s*frame-ancestors\s+[^;]+/i);
  assert.ok((embedHeaders.get('content-security-policy') || '').includes(allowedOrigin), 'Allowlisted host must be present in frame-ancestors');
  for (const path of ['/mobile/', '/board/', '/transfer/']) {
    const responseHeaders = await headers(path);
    assert.match(responseHeaders.get('x-frame-options') || '', /^DENY$/i, `${path} must retain frame denial`);
    if (path === '/transfer/') assert.match(responseHeaders.get('content-security-policy') || '', /frame-ancestors\s+'none'/i);
  }
  console.log('PASS: local Pages sends scoped embedding and protected-route headers');

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // Keep the test deterministic and prevent live requests or photo submission.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === appOrigin || url.origin === allowedOrigin || url.origin === deniedOrigin) return route.continue();
    if (url.origin === 'https://newleaf.or.kr') return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Newleaf test destination</title>' });
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let frame = await frameFor(page, allowedOrigin, '/embed/');
  assert.equal(new URL(frame.url()).origin, appOrigin, 'Allowed frame must render from the app origin');

  const homeLink = frame.getByRole('link', { name: '사단법인 뉴리프 홈페이지', exact: true });
  const observe = frame.getByRole('button', { name: /^사진으로 관찰하기/ });
  const community = frame.getByRole('button', { name: /^다른 사람의 관찰 보기/ });
  await expect(homeLink).toBeVisible();
  await expect(observe).toBeVisible();
  await expect(community).toBeVisible();
  const [linkBox, observeBox, communityBox] = await Promise.all([homeLink.boundingBox(), observe.boundingBox(), community.boundingBox()]);
  assert.ok(linkBox && observeBox && communityBox && linkBox.y < Math.min(observeBox.y, communityBox.y), 'Homepage link precedes both actions');
  assert.equal(await homeLink.getAttribute('href'), 'https://newleaf.or.kr/');
  assert.equal(await homeLink.getAttribute('target'), '_blank');
  const styles = await Promise.all([observe, community].map(locator => locator.evaluate(element => {
    const css = getComputedStyle(element);
    return { color: css.color, background: css.backgroundColor, fontSize: css.fontSize, fontWeight: css.fontWeight };
  })));
  assert.deepEqual(styles[0], styles[1], 'Both actions should have equal visual weight');

  const popupPromise = page.waitForEvent('popup');
  await homeLink.click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  assert.equal(popup.url(), 'https://newleaf.or.kr/');
  await popup.close();
  await expect(observe).toBeVisible();

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await checkPhoneGeometry(frame, width);
    await observe.click();
    await expect(frame.getByRole('button', { name: '촬영 닫기' })).toBeVisible();
    await expect(frame.getByRole('button', { name: '사진 선택', exact: true })).toBeVisible();
    await checkPhoneGeometry(frame, width);
    await frame.getByRole('button', { name: '촬영 닫기' }).click();
    await expect(observe).toBeVisible();
    await community.click();
    await expect(frame.getByRole('heading', { name: '함께 남긴 사진', exact: true })).toBeVisible();
    await expect(frame.getByRole('button', { name: '홈으로', exact: true })).toBeVisible();
    await checkPhoneGeometry(frame, width);
    await frame.getByRole('button', { name: '홈으로', exact: true }).click();
    await expect(community).toBeVisible();
  }
  assert.deepEqual(errors, [], `No uncaught application errors: ${errors.join('; ')}`);
  console.log('PASS: allowed cross-origin iframe, homepage link, both actions and return at 320px and 390px');

  await blockedInBrowser(page, deniedOrigin, '/embed/');
  for (const path of ['/mobile/', '/board/', '/transfer/']) await blockedInBrowser(page, allowedOrigin, path);
  console.log('PASS: disallowed origin and standalone/transfer frames are blocked in Chromium');
  await context.close();
} finally {
  if (browser) await browser.close();
  await close(allowedHost);
  await close(deniedHost);
}
