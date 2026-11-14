import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const check = fileURLToPath(new URL('../scripts/check-boundaries.mjs', import.meta.url));

function fixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'nature-lens-boundaries-'));
  writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { moduleResolution: 'bundler', module: 'esnext', allowJs: true, paths: { '@/*': ['./src/*'] } },
  }));
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(root, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  const result = spawnSync(process.execPath, [check, root], { encoding: 'utf8' });
  rmSync(root, { recursive: true, force: true });
  return result;
}

test('allows browser imports and ignores import-like text', () => {
  const result = fixture({
    'src/page.ts': "import {value} from '@/shared'; const text = \"import '../server/gateway.mjs'\"; // require('../server/gateway.mjs')\nexport {value, text};",
    'src/shared.ts': 'export const value = 1;',
    'server/gateway.mjs': 'export const secret = 1;',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('rejects static, alias, re-export, dynamic, type and require imports into server', () => {
  const result = fixture({
    'src/static.ts': "import '../server/gateway.mjs';",
    'src/alias.ts': "import '@/../server/gateway.mjs';",
    'src/export.ts': "export * from '../server/gateway.mjs';",
    'src/dynamic.ts': "void import('../server/gateway.mjs');",
    'src/template.ts': 'void import(`../server/gateway.mjs`);',
    'src/type.ts': "type Gateway = import('../server/gateway.mjs').Gateway;",
    'src/require.js': "require('../server/gateway.mjs');",
    'server/gateway.mjs': 'export const secret = 1;',
  });
  assert.equal(result.status, 1, result.stderr);
  for (const file of ['static.ts', 'alias.ts', 'export.ts', 'dynamic.ts', 'template.ts', 'type.ts', 'require.js']) {
    assert.match(result.stderr, new RegExp(file.replace('.', '\\.')));
  }
});
