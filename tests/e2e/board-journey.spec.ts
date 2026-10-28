import {openRecordDetails} from './capture-helpers';
import { test, expect } from '@playwright/test';
import sharp from 'sharp';

test.use({ serviceWorkers: 'block' });

test('board preserves explicit reobservation, the selected month and detail caller focus', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) {
      return route.fulfill({ status: 503, json: { error: 'unavailable-in-local-journey-test' } });
    }
    return route.continue();
  });

  // In-memory test patterns: no photo files, camera, location or remote services.
  const [firstPhoto, secondPhoto] = await Promise.all([
    sharp({ create: { width: 64, height: 64, channels: 3, background: '#456e3b' } }).png().toBuffer(),
    sharp({ create: { width: 64, height: 64, channels: 3, background: '#a8b86d' } }).png().toBuffer(),
  ]);
  const firstTitle = '보드의 첫 관찰';
  const secondTitle = '보드의 두 번째 관찰';
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/board/');
  await expect(page.getByRole('heading', { name: '사진 한 장, 발견 하나', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '관찰 추가', exact: true }).click();
  await page.getByLabel('앨범 사진 선택').setInputFiles({ name: 'first-pattern.png', mimeType: 'image/png', buffer: firstPhoto });
  await openRecordDetails(page);await page.getByLabel('이름 선택').fill(firstTitle);
  await openRecordDetails(page);await page.getByLabel('관찰 날짜').fill('2026-09-12');
  await openRecordDetails(page);await page.getByLabel('한 줄 메모').fill('첫날의 잎을 기록했어요.');
  await page.getByRole('button', { name: '내 기록에 저장', exact: true }).click();
  await page.getByRole('button', { name: '방금 기록 보기' }).click();

  const firstDetail = page.getByRole('dialog', { name: firstTitle, exact: true });
  await expect(firstDetail).toBeVisible();
  await expect(firstDetail.getByRole('list', { name: '관찰 날짜순 기록' }).getByRole('listitem')).toHaveCount(1);
  const reobserve = firstDetail.getByRole('button', { name: '같은 대상 다시 관찰하기', exact: true });
  const capture = page.getByRole('region', { name: '빠른 촬영 기록' });

  // Cancelling before selecting a photo returns to the original detail and caller.
  await reobserve.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(capture).toBeVisible();
  await page.getByRole('button', { name: '촬영 닫기', exact: true }).click();
  await expect(firstDetail).toBeVisible();
  await expect(reobserve).toBeFocused();

  // With a draft, rejecting discard keeps it; accepting discard restores the same detail.
  await reobserve.click();
  await page.getByLabel('앨범 사진 선택').setInputFiles({ name: 'discard-pattern.png', mimeType: 'image/png', buffer: secondPhoto });
  await openRecordDetails(page);await page.getByLabel('한 줄 메모').fill('취소 흐름만 검증하는 저장 전 메모');
  await Promise.all([
    page.waitForEvent('dialog').then(dialog => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toContain('저장하지 않은 사진과 메모');
      return dialog.dismiss();
    }),
    page.getByRole('button', { name: '촬영 닫기', exact: true }).click(),
  ]);
  await expect(capture).toBeVisible();
  await expect(page.getByLabel('한 줄 메모')).toHaveValue('취소 흐름만 검증하는 저장 전 메모');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await Promise.all([
    page.waitForEvent('dialog').then(dialog => {
      expect(dialog.type()).toBe('confirm');
      return dialog.accept();
    }),
    page.getByRole('button', { name: '촬영 닫기', exact: true }).click(),
  ]);
  await expect(firstDetail).toBeVisible();
  await expect(reobserve).toBeFocused();
  await expect(firstDetail.getByRole('list', { name: '관찰 날짜순 기록' }).getByRole('listitem')).toHaveCount(1);

  await reobserve.click();
  // A stale open modal would make the capture form outside it inert.
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(capture).toBeVisible();
  await page.getByLabel('앨범 사진 선택').setInputFiles({ name: 'second-pattern.png', mimeType: 'image/png', buffer: secondPhoto });
  await expect(page.getByLabel('이름 선택')).toHaveValue('');
  await openRecordDetails(page);await page.getByLabel('이름 선택').fill(secondTitle);
  await openRecordDetails(page);await page.getByLabel('관찰 날짜').fill('2026-09-20');
  await openRecordDetails(page);await page.getByLabel('한 줄 메모').fill('같은 잎의 색이 달라졌어요.');
  const sameSubject = page.getByLabel('지난번과 같은 개체를 관찰했습니다');
  await expect(sameSubject).not.toBeChecked();
  await page.getByRole('button', { name: '내 기록에 저장', exact: true }).click();
  await expect(page.getByRole('region', { name: '빠른 촬영 기록' }).getByRole('alert')).toContainText('같은 개체');
  await sameSubject.check();
  await page.getByRole('button', { name: '내 기록에 저장', exact: true }).click();
  await page.getByRole('button', { name: '방금 기록 보기' }).click();

  const secondDetail = page.getByRole('dialog', { name: secondTitle, exact: true });
  await expect(secondDetail).toBeVisible();
  const timeline = secondDetail.getByRole('list', { name: '관찰 날짜순 기록' });
  await expect(timeline.getByRole('listitem')).toHaveCount(2);
  await expect(timeline).toContainText(firstTitle);
  await expect(timeline).toContainText(secondTitle);
  await secondDetail.getByRole('button', { name: '이 기록의 월간 도감 보기', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByLabel('도감 월')).toHaveValue('2026-09');
  await expect(page.getByRole('region', { name: '이번 달, 다시 만난 자연' })).toContainText('2개의 기록 · 1개의 관찰 대상 · 1번의 재관찰');
  await page.getByRole('button', { name: '내 기록으로 도감 펼치기', exact: true }).click();

  const journalCaller = page.getByRole('button', { name: `${secondTitle} 상세 · 다시 관찰하기`, exact: true });
  await journalCaller.click();
  await expect(secondDetail).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByLabel('도감 월')).toHaveValue('2026-09');
  await expect(journalCaller).toBeFocused();
});
