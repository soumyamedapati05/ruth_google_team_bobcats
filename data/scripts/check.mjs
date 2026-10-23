// Automatic checks for data/scholarships.json and data/opportunities.json (spec §7.3 step 4).
// Failures are printed with the reason, never silently dropped.
//
//   node data/scripts/check.mjs                  run every check against today's date
//   node data/scripts/check.mjs --today=2026-11-14   rehearse demo day (what will have expired?)
//   node data/scripts/check.mjs --links          also request every real url / source_url
//   node data/scripts/check.mjs --export         also write data/contract/*.sample5.json and data/spot-check.csv
//
// Exit code is 1 if any listing FAILS (warnings don't fail).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const TODAY = args.today || new Date().toISOString().slice(0, 10);

const load = f => JSON.parse(readFileSync(join(DATA, f), 'utf8'));
const scholarships = load('scholarships.json');
const opportunities = load('opportunities.json');
const schSchema = load('schema/scholarship.schema.json');
const oppSchema = load('schema/opportunity.schema.json');

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const BOROUGHS = ['Bronx', 'Brooklyn', 'Manhattan', 'Queens', 'Staten Island'];
const CLASS_YEARS = schSchema.$defs.class_year.enum;
const BADGES = schSchema.$defs.trust.properties.badge.enum;
const OPP_TYPES = oppSchema.properties.type.enum;

const results = [];   // { list, id, title, fails: [], warns: [] }

function missing(obj, keys) {
  return keys.filter(k => !(k in obj));
}

function checkShared(l, r, schema) {
  for (const k of missing(l, schema.required)) r.fails.push(`missing field "${k}"`);
  for (const k of missing(l.eligibility || {}, schSchema.$defs.eligibility.required)) r.fails.push(`missing eligibility.${k}`);
  for (const k of missing(l.trust || {}, schSchema.$defs.trust.required)) r.fails.push(`missing trust.${k}`);

  const prefix = schema === schSchema ? 'sch-' : 'opp-';
  if (l.is_sample && !l.id.startsWith('smp-' + prefix)) r.fails.push(`sample listing id must start with smp-${prefix}`);
  if (!l.is_sample && !l.id.startsWith(prefix)) r.fails.push(`real listing id must start with ${prefix}`);

  if (!Array.isArray(l.school_levels) || !l.school_levels.length || l.school_levels.some(s => !['HS', 'college'].includes(s)))
    r.fails.push('school_levels must be a non-empty list of HS / college');
  for (const y of l.eligibility?.class_years || []) if (!CLASS_YEARS.includes(y)) r.fails.push(`unknown class year "${y}"`);
  if (!BADGES.includes(l.trust?.badge)) r.fails.push(`unknown trust badge "${l.trust?.badge}"`);
  if (l.summary && l.summary.length > 400) r.warns.push('summary over 400 characters');

  if (l.is_sample) {
    if (!String(l.url).startsWith('/sample-listing')) r.fails.push('sample listings must link to the /sample-listing placeholder, not a real site');
    if (l.source_url !== null) r.fails.push('sample listings must have source_url = null');
    if (l.trust?.badge !== 'unverified') r.warns.push('sample listing carries a verified-looking badge');
  } else {
    if (!/^https:\/\//.test(l.url)) r.fails.push('url must be https');
    if (!l.source_url) r.fails.push('real listings need source_url');
    if (!l.evidence?.length) r.fails.push('real listing has no evidence quotes');
    if (!l.trust?.checked_at) r.warns.push('real listing has no trust.checked_at');
  }
}

function needsQuote(l, r, field, hasValue, { warnOnly = false } = {}) {
  if (l.is_sample || !hasValue) return;
  if (l.evidence.some(e => e.field === field)) return;
  if (warnOnly) r.warns.push(`no evidence quote for "${field}": confirm on the page during spot-check`);
  else r.fails.push(`"${field}" has a value but no evidence quote (spec: no quote → leave the field empty)`);
}

function checkDate(r, label, v, { mustBeFuture = true } = {}) {
  if (v === null || v === undefined || v === 'rolling') return;
  if (!ISO.test(v)) return r.fails.push(`${label} "${v}" is not YYYY-MM-DD`);
  if (mustBeFuture && v < TODAY) r.fails.push(`${label} ${v} has passed (today ${TODAY})`);
}

for (const l of scholarships) {
  const r = { list: 'scholarships', id: l.id, title: l.title, fails: [], warns: [] };
  checkShared(l, r, schSchema);
  for (const k of missing(l.requirements || {}, schSchema.properties.requirements.required)) r.fails.push(`missing requirements.${k}`);

  if (l.deadline === null) r.fails.push('no deadline: scholarships need a current or rolling deadline (§7.4)');
  checkDate(r, 'deadline', l.deadline);
  if (l.requirements?.application_fee > 0) r.fails.push(`application fee $${l.requirements.application_fee}: excluded as a scam signal (§7.4)`);
  if (l.amount_min != null && l.amount_max != null && l.amount_min > l.amount_max) r.fails.push('amount_min > amount_max');
  if (l.is_sweepstakes) r.warns.push('sweepstakes: hidden by default in results');
  if (l.selection !== 'entitlement' && !l.est_pool) r.warns.push('no est_pool: the odds formula will fall back to scope defaults');
  if (l.est_pool && !l.est_pool_basis) r.fails.push('est_pool without est_pool_basis');
  const geo = l.eligibility?.geo_areas || [];
  if (!l.is_sample && !l.eligibility?.nyc_only && !geo.some(g => ['NYC', 'NYS', ...BOROUGHS].includes(g)) && !/New York, NY/.test(l.provider))
    r.warns.push('not limited to NYC/NY and provider not marked as NYC-based: confirm it meets §7.4');

  needsQuote(l, r, 'deadline', l.deadline && l.deadline !== 'rolling');
  needsQuote(l, r, 'amount', l.amount_max != null);
  needsQuote(l, r, 'eligibility', true);
  results.push(r);
}

for (const l of opportunities) {
  const r = { list: 'opportunities', id: l.id, title: l.title, fails: [], warns: [] };
  checkShared(l, r, oppSchema);

  if (!OPP_TYPES.includes(l.type)) r.fails.push(`unknown type "${l.type}"`);
  if (l.cost !== 0) r.fails.push(`cost is ${l.cost}: only free opportunities are allowed (§7.4)`);
  if (!l.is_online && !BOROUGHS.includes(l.location?.borough)) r.fails.push('must be in one of the five boroughs or online');
  checkDate(r, 'start_date', l.start_date, { mustBeFuture: false });
  checkDate(r, 'end_date', l.end_date);
  checkDate(r, 'application_deadline', l.application_deadline);
  if (l.start_date && l.end_date && l.end_date < l.start_date) r.fails.push('end_date is before start_date');
  if (!l.end_date && !l.application_deadline) r.fails.push('needs an end_date or application_deadline after today');
  if (l.covers?.includes('stipend') && !l.stipend_amount) r.warns.push('covers stipend but no stipend_amount');

  needsQuote(l, r, 'deadline', l.application_deadline && l.application_deadline !== 'rolling');
  needsQuote(l, r, 'cost', true, { warnOnly: true });
  results.push(r);
}

// Duplicates: same id, or same url + title, in either list.
const seenKeys = new Map();
const seenIds = new Set();
results.forEach((r, i) => {
  const l = [...scholarships, ...opportunities][i];
  if (seenIds.has(l.id)) r.fails.push('duplicate id');
  seenIds.add(l.id);
  const key = `${l.url}|${l.title}`.toLowerCase();
  if (seenKeys.has(key)) r.fails.push(`duplicate of ${seenKeys.get(key)}`);
  else seenKeys.set(key, l.id);
});

// "Almost eligible" links must resolve to a scholarship that has prerequisites.
const byId = new Map(scholarships.map(s => [s.id, s]));
const unlockTotals = [];
for (const o of opportunities) {
  const r = results.find(x => x.id === o.id);
  let total = 0;
  for (const u of o.unlocks || []) {
    const s = byId.get(u.scholarship_id);
    if (!s) { r.fails.push(`unlocks unknown scholarship "${u.scholarship_id}"`); continue; }
    if (!s.eligibility.prerequisites.length) r.warns.push(`unlocks ${s.id}, which lists no prerequisites`);
    total += s.amount_max || 0;
  }
  if (o.unlocks?.length) unlockTotals.push(`${o.id} → ${o.unlocks.length} scholarship(s) worth $${total.toLocaleString()}`);
}

if (args.links) {
  const urls = new Map();
  for (const l of [...scholarships, ...opportunities]) {
    if (l.is_sample) continue;
    for (const u of new Set([l.url, l.source_url, ...l.evidence.map(e => e.page).filter(Boolean)])) urls.set(u, l.id);
  }
  for (const [u, id] of urls) {
    let status;
    try {
      const res = await fetch(u, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Scout data check)' }, signal: AbortSignal.timeout(20000) });
      status = res.status;
    } catch (e) { status = `${e.name}: ${e.cause?.code || e.message}`; }
    const r = results.find(x => x.id === id);
    if (status === 404 || status === 410) r.fails.push(`link ${u} → ${status}`);
    else if (typeof status === 'string') r.warns.push(`link ${u} → ${status} (network/TLS/login redirect; open it in a browser)`);
    else if (status >= 400) r.warns.push(`link ${u} → ${status} (site may block scripts; open it in a browser)`);
  }
}

// Report.
const failing = results.filter(r => r.fails.length);
console.log(`Scout data check, today = ${TODAY}`);
console.log(`${scholarships.length} scholarships (${scholarships.filter(s => !s.is_sample).length} real), ${opportunities.length} opportunities (${opportunities.filter(o => !o.is_sample).length} real)\n`);
for (const r of results) {
  if (!r.fails.length && !r.warns.length) continue;
  console.log(`${r.fails.length ? 'FAIL' : 'warn'}  ${r.list}/${r.id}`);
  for (const f of r.fails) console.log(`        ✗ ${f}`);
  for (const w of r.warns) console.log(`        · ${w}`);
}
console.log(`\nAlmost-eligible links:\n  ${unlockTotals.join('\n  ') || '(none)'}`);
console.log(`\n${results.length - failing.length} passed, ${failing.length} failed.`);

if (args.export) {
  // Contract (spec §10): 5 sample listings of each kind, mixing real and made-up.
  const pick = (list, ids) => ids.map(id => list.find(l => l.id === id));
  mkdirSync(join(DATA, 'contract'), { recursive: true });
  writeFileSync(join(DATA, 'contract', 'scholarships.sample5.json'), JSON.stringify(pick(scholarships, [
    'sch-jackie-robinson-foundation', 'sch-belle-zeller', 'sch-nys-tap', 'smp-sch-riverside-robotics', 'smp-sch-riverside-young-engineers'
  ]), null, 2) + '\n');
  writeFileSync(join(DATA, 'contract', 'opportunities.sample5.json'), JSON.stringify(pick(opportunities, [
    'opp-nasa-space-apps-nyc', 'opp-regeneron-sts', 'opp-msk-summer-student-program', 'opp-cooper-union-saturday-program', 'smp-opp-riverside-engineering-day'
  ]), null, 2) + '\n');

  // Spot-check sheet (spec §7.3 step 7): every real listing (fewer than 15 so far) for a second teammate.
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['list', 'id', 'title', 'url', 'deadline_or_dates', 'amount_or_cost', 'quotes_to_check', 'checker', 'deadline_ok', 'eligibility_ok', 'amount_ok', 'link_ok', 'errors_found', 'notes']];
  for (const l of [...scholarships, ...opportunities].filter(l => !l.is_sample)) {
    const isSch = 'deadline' in l;
    rows.push([
      isSch ? 'scholarships' : 'opportunities', l.id, l.title, l.url,
      isSch ? l.deadline : [l.start_date, l.end_date, l.application_deadline && `apply by ${l.application_deadline}`].filter(Boolean).join(' / '),
      isSch ? `${l.amount_min ?? ''}–${l.amount_max ?? ''} (${l.amount_period})` : `cost ${l.cost}`,
      l.evidence.map(e => `[${e.field}] ${e.quote}`).join('  |  '),
      '', '', '', '', '', '', ''
    ]);
  }
  writeFileSync(join(DATA, 'spot-check.csv'), rows.map(r => r.map(esc).join(',')).join('\n') + '\n');
  console.log('\nWrote data/contract/*.sample5.json and data/spot-check.csv');
}

process.exit(failing.length ? 1 : 0);
