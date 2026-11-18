// Korean name, short description and reference photo for a scientific name.
// Source: Wikidata (exact scientific-name match) and Korean Wikipedia. Only the scientific name is sent.
// These are encyclopedia names, not the national standard plant list, and are shown with their source.

export type TaxonInfo = {
  scientificName: string;
  matchedName: string;
  level: 'species' | 'genus';
  koreanName: string | null;
  description: string | null;
  image: string | null;
  imageCredit: {author:string; license:string; licenseUrl:string; sourceUrl:string} | null;
  url: string | null;
};

export const taxonInfoEnabled = process.env.NEXT_PUBLIC_TAXON_INFO !== 'off';

const CACHE_KEY = 'nature-lens-taxon-info-v2';
const FOUND_TTL = 30 * 24 * 60 * 60 * 1000;
const MISSING_TTL = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;
const SAFE_NAME = /^[A-Za-z][A-Za-z×.\- ]{1,139}$/;
const HANGUL = /[가-힣]/;
const IMAGE_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);

/** Names to try in order: the full name, its binomial, then the genus. */
export function nameCandidates(scientific: string): { name: string; level: 'species' | 'genus' }[] {
  const clean = scientific.replace(/\s+/g, ' ').trim();
  if (!SAFE_NAME.test(clean)) return [];
  const words = clean.split(' ');
  const out: { name: string; level: 'species' | 'genus' }[] = [];
  const add = (name: string, level: 'species' | 'genus') => { if (!out.some(item => item.name === name)) out.push({ name, level }); };
  const epithet = words[1];
  const binomial = epithet && /^[a-z-]+$/.test(epithet) ? `${words[0]} ${epithet}` : null;
  if (words.length > 1 && !clean.includes('.')) add(clean, 'species');
  if (binomial) add(binomial, 'species');
  add(words[0], 'genus');
  return out;
}

/** At most two sentences, without the bracketed scientific-name aside. */
export function shortDescription(extract: string): string | null {
  const text = extract.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const sentences = text.match(/[^.。]+[.。]/g) ?? [text];
  let result = '';
  for (const sentence of sentences.slice(0, 2)) {
    if (result && (result + sentence).length > 150) break;
    result += sentence;
  }
  return (result || text).trim().slice(0, 200);
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

async function getJson(fetcher: Fetcher, url: string, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(8000);
  const response = await fetcher(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout, credentials: 'omit' });
  if (!response.ok) throw new Error('taxon-info-unavailable');
  return response.json();
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

type NameHit = { title: string | null; label: string | null };
// Fast path: Wikispecies page titles are scientific names, so the regular Wikidata API resolves them exactly.
async function queryByTitle(fetcher: Fetcher, name: string, signal?: AbortSignal): Promise<NameHit | null> {
  const raw = await getJson(fetcher, `https://www.wikidata.org/w/api.php?action=wbgetentities&sites=specieswiki&titles=${encodeURIComponent(name)}&props=sitelinks%7Clabels&sitefilter=kowiki&languages=ko&format=json&origin=*`, signal) as { entities?: Record<string, { missing?: unknown; sitelinks?: { kowiki?: { title?: unknown } }; labels?: { ko?: { value?: unknown } } }> };
  const entity = Object.values(raw?.entities ?? {})[0];
  if (!entity || 'missing' in entity) return null;
  return { title: text(entity.sitelinks?.kowiki?.title), label: text(entity.labels?.ko?.value) };
}
// Slower exact match on the taxon-name property, for names Wikispecies does not have.
async function queryByTaxonName(fetcher: Fetcher, name: string, signal?: AbortSignal): Promise<NameHit | null> {
  const query = `SELECT ?title ?label WHERE { ?item wdt:P225 "${name}". OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://ko.wikipedia.org/>; schema:name ?title. } OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label)="ko") } } LIMIT 1`;
  const raw = await getJson(fetcher, `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, signal) as { results?: { bindings?: Record<string, { value?: unknown }>[] } };
  const row = raw?.results?.bindings?.[0];
  return row ? { title: text(row.title?.value), label: text(row.label?.value) } : null;
}
const usable = (hit: NameHit | null) => Boolean(hit && ((hit.title && HANGUL.test(hit.title)) || (hit.label && HANGUL.test(hit.label))));
async function queryWikidata(fetcher: Fetcher, name: string, signal?: AbortSignal): Promise<NameHit | null> {
  let first: NameHit | null = null, failed = false;
  try { first = await queryByTitle(fetcher, name, signal); } catch { failed = true; }
  if (usable(first)) return first;
  try { const second = await queryByTaxonName(fetcher, name, signal); if (usable(second)) return second; }
  catch { if (failed) throw new Error('taxon-info-unavailable'); }
  return null;
}

// Commons metadata contains HTML. Extract text only; never insert metadata markup into the DOM.
function metadataText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const plain = value.replace(/<[^>]*>/g, ' ').replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, n: string) => {
    const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : parseInt(n, 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }).replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
  return plain && plain.length <= 500 ? plain : null;
}
function safeHttps(value: unknown, hosts: Set<string>): string | null {
  const input = text(value);
  try { const url = new URL(input ?? ''); return url.protocol === 'https:' && !url.username && !url.password && hosts.has(url.hostname) ? url.href : null; } catch { return null; }
}
async function commonsCredit(fetcher: Fetcher, thumbnail: string, signal?: AbortSignal): Promise<TaxonInfo['imageCredit']> {
  const url = new URL(thumbnail);
  // Wikimedia thumbnail paths contain the original Commons filename before the size component.
  const match = url.pathname.match(/^\/wikipedia\/commons\/thumb\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)\/[^/]+$/i);
  if (!match) return null;
  let filename: string;
  try { filename = decodeURIComponent(match[3]); } catch { return null; }
  if (!filename || filename.includes('/') || filename.includes('\\')) return null;
  const api = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url%7Cextmetadata&titles=${encodeURIComponent(`File:${filename}`)}&format=json&origin=*`;
  const raw = await getJson(fetcher, api, signal) as {query?:{pages?:Record<string,{missing?:unknown;imageinfo?:{url?:unknown;descriptionurl?:unknown;extmetadata?:Record<string,{value?:unknown}>}[]}>}};
  const page = Object.values(raw.query?.pages ?? {})[0];
  const info = page && !('missing' in page) ? page.imageinfo?.[0] : undefined;
  const original = safeHttps(info?.url, IMAGE_HOSTS);
  const expectedPath = `/wikipedia/commons/${match[1]}/${match[2]}/${match[3]}`;
  if (!original || new URL(original).pathname !== expectedPath) return null;
  const sourceUrl = safeHttps(info?.descriptionurl, new Set(['commons.wikimedia.org']));
  const author = metadataText(info?.extmetadata?.Artist?.value);
  const license = metadataText(info?.extmetadata?.LicenseShortName?.value);
  const licenseUrl = safeHttps(info?.extmetadata?.LicenseUrl?.value, new Set(['creativecommons.org']));
  if (!sourceUrl || !author || !license || !licenseUrl || !/^https:\/\/creativecommons\.org\/(licenses|publicdomain)\//.test(licenseUrl)) return null;
  return {author, license, licenseUrl, sourceUrl};
}
async function wikipediaSummary(fetcher: Fetcher, title: string, signal?: AbortSignal) {
  const raw = await getJson(fetcher, `https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, signal) as { extract?: unknown; thumbnail?: { source?: unknown }; content_urls?: { mobile?: { page?: unknown } } };
  let image = safeHttps(raw?.thumbnail?.source, IMAGE_HOSTS);
  let imageCredit:TaxonInfo['imageCredit'] = null;
  if (image) { try { imageCredit = await commonsCredit(fetcher, image, signal); } catch { /* Text and name remain available. */ } }
  if (!imageCredit) image = null;
  let url = text(raw?.content_urls?.mobile?.page);
  try { const parsed = new URL(url ?? ''); if (parsed.protocol !== 'https:' || !['ko.wikipedia.org','ko.m.wikipedia.org'].includes(parsed.hostname)) url = null; } catch { url = null; }
  const extract = text(raw?.extract);
  // A reused extract needs its attribution link; never show uncredited text.
  return { description: extract && url ? shortDescription(extract) : null, image, imageCredit, url };
}

/** Network lookup without caching. Returns null when nothing usable is found. */
export async function fetchTaxonInfo(scientificName: string, fetcher: Fetcher = fetch, signal?: AbortSignal): Promise<TaxonInfo | null> {
  for (const candidate of nameCandidates(scientificName)) {
    const hit = await queryWikidata(fetcher, candidate.name, signal);
    if (!hit) continue;
    const title = hit.title && HANGUL.test(hit.title) ? hit.title : null;
    const koreanName = (title ?? (hit.label && HANGUL.test(hit.label) ? hit.label : null))?.replace(/\s*\([^)]*\)$/, '') ?? null;
    let summary: Awaited<ReturnType<typeof wikipediaSummary>> = { description: null, image: null, imageCredit: null, url: null };
    if (title) { try { summary = await wikipediaSummary(fetcher, title, signal); } catch { /* The name alone is still useful. */ } }
    if (!koreanName && !summary.description) continue;
    return { scientificName, matchedName: candidate.name, level: candidate.level, koreanName, ...summary };
  }
  return null;
}

type CacheEntry = { at: number; info: TaxonInfo | null };
function readCache(): Record<string, CacheEntry> {
  try { const value = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; }
}
function writeCache(name: string, info: TaxonInfo | null) {
  try {
    const entries = Object.entries({ ...readCache(), [name]: { at: Date.now(), info } }).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ENTRIES);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* Cache is a convenience only. */ }
}

const pending = new Map<string, Promise<TaxonInfo | null>>();

/** Cached lookup. Never throws: failures resolve to null and are not cached. */
export function lookupTaxonInfo(scientificName: string): Promise<TaxonInfo | null> {
  const name = scientificName.replace(/\s+/g, ' ').trim();
  if (!taxonInfoEnabled || !name) return Promise.resolve(null);
  const cached = readCache()[name];
  if (cached && Date.now() - cached.at < (cached.info ? FOUND_TTL : MISSING_TTL)) return Promise.resolve(cached.info);
  const running = pending.get(name);
  if (running) return running;
  const request = fetchTaxonInfo(name).then(info => { writeCache(name, info); return info; }).catch(() => null).finally(() => pending.delete(name));
  pending.set(name, request);
  return request;
}
