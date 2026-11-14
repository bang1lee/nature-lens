import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';

// The optional root argument makes the same check usable with isolated fixtures.
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('..', import.meta.url)));
const frontend = path.join(root, 'src');
const server = realpathSync(path.join(root, 'server'));
const { compilerOptions = {} } = JSON.parse(readFileSync(path.join(root, 'tsconfig.json'), 'utf8'));
const aliasBase = path.resolve(root, compilerOptions.baseUrl || '.');
const aliases = Object.entries(compilerOptions.paths || {});
const extensions = /\.[cm]?[jt]sx?$/;

function canonical(candidate) {
  const tail = [];
  while (!existsSync(candidate)) {
    const parent = path.dirname(candidate);
    if (parent === candidate) break;
    tail.unshift(path.basename(candidate));
    candidate = parent;
  }
  return path.join(realpathSync(candidate), ...tail);
}

function destinations(specifier, file) {
  if (specifier.startsWith('.') || path.isAbsolute(specifier)) {
    return [path.resolve(path.dirname(file), specifier)];
  }
  return aliases.flatMap(([pattern, mappings]) => {
    const [prefix, suffix] = pattern.split('*');
    const match = suffix === undefined ? specifier === prefix :
      specifier.startsWith(prefix) && specifier.endsWith(suffix) && specifier.length >= prefix.length + suffix.length;
    if (!match) return [];
    const captured = suffix === undefined ? '' : specifier.slice(prefix.length, specifier.length - suffix.length);
    return mappings.map(mapping => path.resolve(aliasBase, mapping.replace('*', captured)));
  });
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(file);
    return entry.isFile() && extensions.test(entry.name) ? [file] : [];
  });
}

const files = listFiles(frontend);
let violations = 0;
for (const file of files) {
  const ast = parse(readFileSync(file, 'utf8'), {
    sourceType: 'unambiguous', plugins: ['typescript', 'jsx'], createImportExpressions: true,
  });
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    let specifier;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)) {
      specifier = node.source;
    } else if (node.type === 'TSImportType') {
      specifier = node.argument;
    } else if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') {
      specifier = node.arguments[0];
    }
    const literal = specifier?.type === 'StringLiteral' ? specifier.value :
      specifier?.type === 'TemplateLiteral' && specifier.expressions.length === 0 ? specifier.quasis[0].value.cooked : undefined;
    if (typeof literal === 'string' && destinations(literal, file).some(candidate => {
      const target = canonical(candidate);
      return target === server || target.startsWith(server + path.sep);
    })) {
      console.error(`${path.relative(root, file)}:${specifier.loc.start.line}: frontend import into server/: ${literal}`);
      violations++;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object' && value.type) visit(value);
    }
  }
  visit(ast);
}
if (violations) process.exitCode = 1;
else console.log(`Boundary check passed: ${files.length} frontend files do not import server/.`);
