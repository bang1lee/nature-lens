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
  url: string | null;
};

export const taxonInfoEnabled = process.env.NEXT_PUBLIC_TAXON_INFO !== 'off';

const CACHE_KEY = 'nature-lens-taxon-info-v1';
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

async function wikipediaSummary(fetcher: Fetcher, title: string, signal?: AbortSignal) {
  const raw = await getJson(fetcher, `https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, signal) as { extract?: unknown; thumbnail?: { source?: unknown }; content_urls?: { mobile?: { page?: unknown } } };
  let image = text(raw?.thumbnail?.source);
  try { if (image && !IMAGE_HOSTS.has(new URL(image).hostname)) image = null; } catch { image = null; }
  let url = text(raw?.content_urls?.mobile?.page);
  try { if (url && !new URL(url).hostname.endsWith('.wikipedia.org')) url = null; } catch { url = null; }
  const extract = text(raw?.extract);
  return { description: extract ? shortDescription(extract) : null, image, url };
}

/** Network lookup without caching. Returns null when nothing usable is found. */
export async function fetchTaxonInfo(scientificName: string, fetcher: Fetcher = fetch, signal?: AbortSignal): Promise<TaxonInfo | null> {
  for (const candidate of nameCandidates(scientificName)) {
    const hit = await queryWikidata(fetcher, candidate.name, signal);
    if (!hit) continue;
    const title = hit.title && HANGUL.test(hit.title) ? hit.title : null;
    const koreanName = (title ?? (hit.label && HANGUL.test(hit.label) ? hit.label : null))?.replace(/\s*\([^)]*\)$/, '') ?? null;
    let summary: Awaited<ReturnType<typeof wikipediaSummary>> = { description: null, image: null, url: null };
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
