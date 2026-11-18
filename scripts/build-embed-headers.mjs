import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const value = process.env.NEWLEAF_EMBED_ORIGIN ?? 'https://newleaf.or.kr';
const parent = new URL(value);
const local = ['localhost', '127.0.0.1', '[::1]'].includes(parent.hostname);
if (
  ![parent.origin, parent.origin + '/'].includes(value) ||
  parent.hostname.includes('*') ||
  !(parent.protocol === 'https:' || (local && parent.protocol === 'http:'))
) {
  throw new Error('NEWLEAF_EMBED_ORIGIN must be a single HTTPS origin or a loopback HTTP origin.');
}

const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const output = process.env.NATURE_LENS_DIST_DIR || 'out';
const defaults = await readFile('public/_headers', 'utf8');
const embedRule = [
  base + '/embed/',
  '  Content-Security-Policy: frame-ancestors ' + parent.origin,
  '  ! X-Frame-Options',
].join('\n');
await writeFile(join(output, '_headers'), defaults.trimEnd() + '\n\n' + embedRule + '\n');
