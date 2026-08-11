// frontend/scripts/audit-i18n.js
// Audits src/lib/i18n.js for FR/EN key-coverage drift.
// Usage: node scripts/audit-i18n.js   (or: npm run i18n:audit)
//
// Detects:
//   - keys present in one language but missing in the other
//   - interpolation placeholders ({var}) that differ between fr/en
//   - array leaves (e.g. datepicker.weekdays) with mismatched length/type
//   - leaves with the exact same value in both languages (likely untranslated —
//     advisory only, false positives expected for codes/Latin names/units)
//
// Exit code is 1 only for structural issues (missing keys, placeholder mismatch,
// array mismatch). "Possibly untranslated" is a warning for human review.

// i18n.js uses extension-less relative imports (fine for Vite, not for Node's
// strict ESM resolver) and transitively imports languageStore.js, which reads
// localStorage at module-eval time. Rather than fighting module resolution,
// extract the `translations` object literal straight from the source text —
// it's plain string/array literals with no external references.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nPath = path.join(__dirname, '../src/lib/i18n.js');
const source = readFileSync(i18nPath, 'utf8');

function extractObjectLiteral(src, marker) {
  const markerIdx = src.indexOf(marker);
  if (markerIdx === -1) throw new Error(`Marker not found in i18n.js: ${marker}`);
  const braceStart = src.indexOf('{', markerIdx);
  let depth = 0;
  let inString = null; // "'" | '"' | '`'
  let i = braceStart;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (ch === '\\') { i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inString = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  if (depth !== 0) throw new Error('Unbalanced braces while parsing translations object — i18n.js may have changed shape.');
  return src.slice(braceStart, i);
}

const literal = extractObjectLiteral(source, 'export const translations');
const translations = new Function(`return (${literal});`)();

const PLACEHOLDER_RE = /\{[a-zA-Z0-9_]+\}/g;

function flatten(obj, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      out.set(path, { type: 'array', value });
    } else if (value !== null && typeof value === 'object') {
      flatten(value, path, out);
    } else {
      out.set(path, { type: typeof value, value });
    }
  }
  return out;
}

// Heuristic: strings that are plausibly identical by design across languages
// (codes, acronyms, short units, numbers/symbols) — skip the untranslated check.
function looksLikeCode(str) {
  if (!str || str.length <= 4) return true;
  if (/^[A-Z0-9_<>.\-/]+$/.test(str)) return true;       // ALLCAPS codes / format placeholders
  if (/^\(?[\d.,\s%°A-Za-z\-/]{1,6}\)?$/.test(str)) return true; // short units like "(%)", "(pb)"
  return false;
}

const fr = flatten(translations.fr);
const en = flatten(translations.en);

const missingInEn = [];
const missingInFr = [];
const placeholderMismatch = [];
const arrayMismatch = [];
const possiblyUntranslated = [];

for (const [path, frEntry] of fr) {
  const enEntry = en.get(path);
  if (!enEntry) { missingInEn.push(path); continue; }

  if (frEntry.type === 'array' || enEntry.type === 'array') {
    if (frEntry.type !== enEntry.type) {
      arrayMismatch.push(`${path} (type mismatch: fr=${frEntry.type}, en=${enEntry.type})`);
    } else if (frEntry.value.length !== enEntry.value.length) {
      arrayMismatch.push(`${path} (fr: ${frEntry.value.length} items, en: ${enEntry.value.length} items)`);
    }
    continue;
  }

  const frPh = (String(frEntry.value).match(PLACEHOLDER_RE) || []).sort().join(',');
  const enPh = (String(enEntry.value).match(PLACEHOLDER_RE) || []).sort().join(',');
  if (frPh !== enPh) {
    placeholderMismatch.push(`${path}\n      fr: "${frEntry.value}"\n      en: "${enEntry.value}"`);
  }

  if (frEntry.value === enEntry.value && !looksLikeCode(String(frEntry.value))) {
    possiblyUntranslated.push(`${path}: "${frEntry.value}"`);
  }
}

for (const path of en.keys()) {
  if (!fr.has(path)) missingInFr.push(path);
}

function section(title, items, hint) {
  console.log(`\n${title} (${items.length})`);
  if (items.length === 0) { console.log('  ✓ none'); return; }
  console.log(`  ${hint}`);
  for (const item of items) console.log(`  - ${item}`);
}

console.log(`i18n audit — ${fr.size} keys in fr, ${en.size} keys in en`);

section('Missing in EN', missingInEn, 'Keys defined in fr but absent from en:');
section('Missing in FR', missingInFr, 'Keys defined in en but absent from fr:');
section('Placeholder mismatch', placeholderMismatch, 'Interpolation vars differ between fr/en:');
section('Array length/type mismatch', arrayMismatch, 'e.g. datepicker.weekdays must have matching shape in both langs:');
section('Possibly untranslated', possiblyUntranslated, 'Same value in fr and en — review manually (false positives expected for codes, Latin names, units):');

const hardFailures = missingInEn.length + missingInFr.length + placeholderMismatch.length + arrayMismatch.length;
if (hardFailures > 0) {
  console.log(`\n✗ ${hardFailures} structural issue(s) found.`);
  process.exit(1);
}
console.log('\n✓ No structural issues (missing keys / placeholder / array mismatches).');
