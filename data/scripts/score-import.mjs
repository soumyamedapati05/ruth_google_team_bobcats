// Grades a Gemini Scout import of the demo flyer against data/demo/flyer.expected.json.
//
//   node data/scripts/score-import.mjs path/to/gemini-output.json
//
// The output file can be { "scholarships": [...], "opportunities": [...] } or one flat array of listings.
// Reports: listings found / missed / extra, field accuracy, values Gemini filled in that the flyer never
// states (possible hallucinations), and evidence quotes that don't appear on the flyer.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2];
if (!file) { console.error('usage: node data/scripts/score-import.mjs <gemini-output.json>'); process.exit(2); }

const expected = JSON.parse(readFileSync(join(DATA, 'demo', 'flyer.expected.json'), 'utf8'));
const raw = JSON.parse(readFileSync(file, 'utf8'));
const got = Array.isArray(raw) ? raw : [...(raw.scholarships || []), ...(raw.opportunities || [])];
const want = [...expected.scholarships, ...expected.opportunities];

const norm = s => String(s ?? '').toLowerCase()
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
  .replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const flyerText = norm(readFileSync(join(DATA, 'demo', 'flyer.html'), 'utf8')
  .replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&middot;/g, '·'));

// Fields that carry the meaning of a listing. Paths are dotted.
const SCH = ['amount_max', 'num_awards', 'deadline', 'eligibility.min_gpa', 'eligibility.class_years', 'eligibility.geo_areas',
  'requirements.essay', 'requirements.recommendations', 'requirements.application_fee'];
const OPP = ['type', 'start_date', 'end_date', 'application_deadline', 'cost', 'capacity', 'covers', 'location.borough', 'location.address',
  'eligibility.class_years', 'eligibility.geo_areas'];
const get = (o, p) => p.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);
const same = (a, b) => JSON.stringify(Array.isArray(a) ? [...a].sort() : a ?? null) === JSON.stringify(Array.isArray(b) ? [...b].sort() : b ?? null);
const empty = v => v == null || (Array.isArray(v) && !v.length) || v === '';

let right = 0, total = 0;
const problems = [];
const used = new Set();

for (const w of want) {
  const key = norm(w.title).replace(/[^a-z0-9 ]/g, '');
  const g = got.find((x, i) => !used.has(i) && (norm(x.title).replace(/[^a-z0-9 ]/g, '').includes(key) || key.includes(norm(x.title).replace(/[^a-z0-9 ]/g, '')))
    && used.add(got.indexOf(x)));
  const fields = 'deadline' in w ? SCH : OPP;
  if (!g) { total += fields.length; problems.push(`MISSED listing: ${w.title}`); continue; }
  for (const f of fields) {
    total++;
    const a = get(g, f), b = get(w, f);
    if (same(a, b)) right++;
    else if (empty(b) && !empty(a)) problems.push(`${w.title}: ${f} = ${JSON.stringify(a)} but the flyer doesn't say (possible hallucination)`);
    else problems.push(`${w.title}: ${f} = ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
  }
  if (!('deadline' in w) && w.unlocks.length && !(g.unlocks || []).length) problems.push(`${w.title}: missed the "almost eligible" link to the mini-grant`);
  for (const e of g.evidence || []) {
    if (!flyerText.includes(norm(e.quote).replace(/[.!]+$/, ''))) problems.push(`${w.title}: quote not on the flyer: "${e.quote}"`);
  }
}
got.forEach((x, i) => { if (!used.has(i)) problems.push(`EXTRA listing not on the flyer: ${x.title}`); });

const found = want.length - problems.filter(p => p.startsWith('MISSED')).length;
console.log(`Listings: ${found}/${want.length} found, ${got.length - used.size} extra`);
console.log(`Fields:   ${right}/${total} correct (${Math.round(100 * right / total)}%)`);
console.log(problems.length ? '\n' + problems.map(p => '  • ' + p).join('\n') : '\nNo problems: every field matches and every quote is on the flyer.');
process.exit(problems.length ? 1 : 0);
