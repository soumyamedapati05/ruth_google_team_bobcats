// Checks that every evidence quote on a real listing actually appears on its source page (spec §7.3).
// Downloads each page with curl, strips HTML, normalizes quotes/dashes/whitespace, then searches for the quote.
//
//   node data/scripts/verify-quotes.mjs
//
// Writes data/test-results/quotes.md. Pages built with JavaScript (or that block scripts) are reported as
// "not checkable", not as errors: open those in a browser during the human spot-check.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = f => JSON.parse(readFileSync(join(DATA, f), 'utf8'));
const listings = [...load('scholarships.json'), ...load('opportunities.json')].filter(l => !l.is_sample);

const ENTITIES = { amp: '&', nbsp: ' ', quot: '"', apos: "'", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', ndash: '-', mdash: '-', hellip: '...', middot: '·' };

function normalize(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const pages = new Map();
function page(url) {
  if (!pages.has(url)) {
    let text = null, note = '';
    try {
      const html = execFileSync('curl', ['-sL', '--compressed', '-m', '25', '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36', '-w', '\n%{http_code}', url],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
      const status = html.slice(html.lastIndexOf('\n') + 1);
      text = normalize(html.slice(0, html.lastIndexOf('\n')));
      if (status !== '200') { note = `HTTP ${status}`; text = null; }
      else if (text.length < 1500) { note = 'page is mostly JavaScript'; text = null; }
    } catch (e) { note = 'download failed'; }
    pages.set(url, { text, note });
  }
  return pages.get(url);
}

let found = 0, missing = 0, unchecked = 0;
const rows = [];
for (const l of listings) {
  for (const e of l.evidence) {
    const url = e.page || l.source_url;
    const p = page(url);
    // Match on the quote's distinctive core: drop trailing punctuation the page may format differently.
    const q = normalize(e.quote).replace(/[.!"']+$/, '').trim();
    let result;
    if (!p.text) { result = `not checkable (${p.note})`; unchecked++; }
    else if (p.text.includes(q)) { result = 'found'; found++; }
    else { result = 'NOT FOUND'; missing++; }
    rows.push({ id: l.id, field: e.field, quote: e.quote, url, result });
  }
}

const total = found + missing + unchecked;
const lines = [
  '# Evidence quote check',
  '',
  `Run: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by \`node data/scripts/verify-quotes.mjs\``,
  '',
  `**${found} of ${total} quotes found word-for-word on the live source page.** ${missing} not found, ${unchecked} on pages a script can't read (JavaScript-only, login redirect or blocked); those are checked by a person in a browser.`,
  '',
  '| Listing | Field | Result | Quote |',
  '|---|---|---|---|',
  ...rows.map(r => `| ${r.id} | ${r.field} | ${r.result} | ${r.quote.replace(/\|/g, '\\|')} |`),
  ''
];
mkdirSync(join(DATA, 'test-results'), { recursive: true });
writeFileSync(join(DATA, 'test-results', 'quotes.md'), lines.join('\n'));

for (const r of rows) if (r.result !== 'found') console.log(`${r.result.padEnd(40)} ${r.id} [${r.field}] ${r.quote.slice(0, 70)}`);
console.log(`\n${found}/${total} found, ${missing} not found, ${unchecked} not checkable. Wrote data/test-results/quotes.md`);
process.exit(missing ? 1 : 0);
