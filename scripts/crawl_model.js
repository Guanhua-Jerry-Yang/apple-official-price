// crawl_model.js — enumerate every price-affecting configuration of one Apple Store configurator page
// and write one row per combination. Run via scripts/run_crawl.sh (which prepends `const CFG = {...}`).
//
// CFG fields (JSON):
//   url        configurator URL, e.g. https://www.apple.com/shop/buy-mac/mac-mini          (required)
//   space      ego-browser task-space name, one per (model, region)                          (required)
//   out        output path prefix, e.g. /path/macmini_us  -> macmini_us_rows.tsv etc.        (required)
//   dims       explicit ordered radio names to iterate (skip auto-detection)                 (optional)
//   addonDims  radio names measured as add-on deltas instead of multiplied into rows; ADDED to the
//              built-in defaults (power adapter, software, display finish, stand, mouse/keyboard) unless
//              addonDefaults:false                                                            (optional)
//   skipDims   radio names ignored entirely                                                   (optional)
//   fix        {radioName: value} forced before crawling (colour, finish, ...)               (optional)
//   only       {radioName: [values]} restrict a dimension's values — for chunking long runs  (optional)
//   limit      stop after N new rows                                                          (optional)
//   planOnly   true -> detect dimensions, write *_plan.json / *_structure.json, no crawl     (optional)
//   resume     default true: rows already in *_rows.tsv are not re-crawled
//   close      true -> completeTaskSpace at the end (leave false while chunking a long crawl)
//
// Outputs: <out>_rows.tsv, <out>_addons.tsv, <out>_plan.json, <out>_structure.json, <out>_notes.md, <out>_log.txt

const OUT = CFG.out
const ROWS = OUT + '_rows.tsv', ADDONS = OUT + '_addons.tsv', PLAN = OUT + '_plan.json'
const STRUCT = OUT + '_structure.json', NOTES = OUT + '_notes.md', LOGF = OUT + '_log.txt'
const DEFAULT_SKIP = /tradeupinline|purchase_option|dimensionPaymentType|applecare|carrier|financing|engrav|keyboard-localization|acc_|dimensionLanguage|smart_folio|pencil|^ad$/i
const DEFAULT_ADDON = /power_adapter|software|dimensionFinish|pencil|keyboard_accessory|StandType|pointingDevice|keyboardFormFactor|mouse_and_track_pad/i
const SKIP = new Set(CFG.skipDims || []); const ADDON = new Set(CFG.addonDims || [])
const FIX = CFG.fix || {}; const ONLY = CFG.only || {}; const LIMIT = CFG.limit || Infinity
const RESUME = CFG.resume !== false
function L(msg) { log(msg); appendLine(LOGF, new Date().toISOString() + ' ' + msg) }

appendLine(LOGF, '=== run start ' + new Date().toISOString() + (CFG.planOnly ? ' (planOnly)' : '') + ' ===')
const task = await useOrCreateTaskSpace(CFG.space)
L('task space ' + task.id + ' ' + CFG.space + ' -> ' + CFG.url)
await openOrReuseTab(CFG.url, { wait: true, timeout: 45 })
await wait(2)
const region = detectRegion(CFG.url)

// ---------- 1. structure ----------
const bootRaw = await readBootstrap()
const boot = bootRaw ? JSON.parse(bootRaw) : null
if (bootRaw) fs.writeFileSync(STRUCT, bootRaw)
let st = await getState()
const notes = await readNotes()
fs.writeFileSync(NOTES, `# ${CFG.url}\ncrawled: ${new Date().toISOString()}\nregion: ${region}\n\n## page notices\n` + notes.map(n => '- ' + n).join('\n') + '\n')

// Section order from bootstrap (mainSections then configSections, nested/grouped flattened).
function flattenSections(secs, acc = []) {
  for (const s of secs || []) {
    if (s.formFieldName && !/^(customizableSpecs|preSoftwareProgressive)$/.test(s.formFieldName)) acc.push(s)
    if (s.items) flattenSections(s.items, acc)
  }
  return acc
}
const sections = boot ? flattenSections(boot.mainSections).concat(flattenSections(boot.configSections)) : []
const childOf = {}; for (const s of sections) if (s.childDimension) childOf[s.formFieldName] = s.childDimension

// Which main dimensions change the priceKey? (colour usually does not; size / chip tier do.)
function priceAffecting(dim) {
  const prods = (boot && boot.products) || []
  if (!prods.length || !(dim in (prods[0].dimensions || {}))) return null // unknown -> decide from labels later
  const prices = (boot.mainDisplayValues && boot.mainDisplayValues.prices) || {}
  const amountOf = p => { const v = prices[p.priceKey]; return v ? (v.amount ?? v.seoPrice ?? (v.currentPrice && v.currentPrice.raw_amount)) : p.priceKey } // colour variants get their own priceKey but the same amount
  const groups = {}
  for (const p of prods) { const o = { ...p.dimensions }; delete o[dim]; const k = JSON.stringify(o); (groups[k] = groups[k] || new Set()).add(String(amountOf(p))) }
  return Object.values(groups).some(s => s.size > 1)
}

// Radio names present on the page right now (child tier radios are prefixed by the selected family value).
const radioNames = [...new Set(st.radios.map(r => r.name))]
function resolveName(field, stt) {
  const names = [...new Set(stt.radios.map(r => r.name))]
  if (names.includes(field)) return field
  const suffix = names.filter(n => n.endsWith('-' + field))
  if (suffix.length === 1) return suffix[0]
  if (suffix.length > 1) { const vis = suffix.filter(n => stt.radios.some(r => r.name === n && !r.disabled)); return vis[0] || suffix[0] }
  return null
}

let plan
if (CFG.dims) {
  plan = { iterate: CFG.dims, fixed: FIX, addons: [...ADDON], source: 'CFG.dims' }
} else {
  const iterate = [], fixed = { ...FIX }, addons = [], skipped = [], unknown = [], notRendered = []
  for (const s of sections) {
    const f = s.formFieldName
    if (SKIP.has(f) || DEFAULT_SKIP.test(f)) { skipped.push(f); continue }
    const isAddon = ADDON.has(f) || (CFG.addonDefaults !== false && DEFAULT_ADDON.test(f))
    const present = resolveName(f, st) || Object.values(childOf).includes(f) || (boot && boot.configDisplayValues && f in boot.configDisplayValues) // child tiers / collapsed config cards appear after earlier picks
    if (!present) { (isAddon ? notRendered : unknown).push(f); continue }
    if (isAddon) { addons.push(f); continue }
    if (f in fixed) continue
    if (s.sectionType === 'NESTED' && childOf[f]) { iterate.push(f); continue } // family gate (chip -> core tier): always iterate
    const pa = priceAffecting(f)
    if (pa === false) { const cur = checkedValue(st, f) || values(st, f, { enabledOnly: false })[0]; if (cur) fixed[f] = cur; else skipped.push(f); continue }
    iterate.push(f)
  }
  // config radios not described in bootstrap sections (rare) -> iterate if they show +price labels
  for (const n of radioNames) {
    const known = iterate.includes(n) || Object.keys(fixed).includes(n) || addons.includes(n) || skipped.some(x => n.endsWith(x)) || sections.some(s => n === s.formFieldName || n.endsWith('-' + s.formFieldName))
    if (!known && !DEFAULT_SKIP.test(n) && !SKIP.has(n)) { if (DEFAULT_ADDON.test(n)) addons.push(n); else unknown.push(n) }
  }
  plan = { iterate, fixed, addons, skipped, unknown, notRendered, selects: st.selects.map(s => s.name), region, source: 'auto' }
}
plan.basePrices = boot && boot.mainDisplayValues && boot.mainDisplayValues.prices
  ? Object.fromEntries(Object.entries(boot.mainDisplayValues.prices).map(([k, v]) => [k, v.amount ?? v.seoPrice ?? (v.currentPrice && v.currentPrice.raw_amount)])) : null
fs.writeFileSync(PLAN, JSON.stringify(plan, null, 1))
L('plan iterate=' + JSON.stringify(plan.iterate) + ' fixed=' + JSON.stringify(plan.fixed) + ' addons=' + JSON.stringify(plan.addons) + ' unknown=' + JSON.stringify(plan.unknown || []))
if (CFG.planOnly) { L('plan done (planOnly)'); await completeTaskSpace(CFG.space, { keep: false }); process.exit(0) }

// ---------- 2. crawl ----------
const DIMS = plan.iterate
const header = [...DIMS, 'total_raw', 'amount', 'drift', 'labels', 'url'].join('\t')
if (!fileExists(ROWS) || !RESUME) fs.writeFileSync(ROWS, header + '\n')
const done = new Set(readLines(ROWS).slice(1).map(l => l.split('\t').slice(0, DIMS.length).join('|')))
L('existing rows: ' + done.size)
let written = 0
const seenMissing = new Set(), seenUnavail = new Set()
const UNAVAIL = OUT + '_unavailable.tsv'

// Fixed dimensions (colour etc.) may sit behind an iterated one (MacBook Air: colour appears after size),
// so this is re-applied at every level; it only acts on radios that are present, enabled and not yet set.
async function applyFixed() {
  const s = await getState()
  for (const [n, v] of Object.entries(plan.fixed)) {
    const name = resolveName(n, s); if (!name) continue
    const opt = s.radios.find(r => r.name === name && r.value === v)
    if (!opt || opt.disabled || checkedValue(s, name) === v) continue
    const ok = await pick(name, v); if (!ok) L('WARN fixed pick failed ' + name + '=' + v)
  }
}
async function valuesWithRetry(name) {
  for (let k = 0; k < 4; k++) {
    await expandFor(name)
    const s = await getState(); let v = values(s, name)
    for (const r of s.radios) if (r.name === name && r.disabled && !seenUnavail.has(name + '=' + r.value)) { // e.g. 32GB "Currently unavailable"
      seenUnavail.add(name + '=' + r.value); if (!fileExists(UNAVAIL)) appendLine(UNAVAIL, 'dimension\tvalue\tlabel\tseen_at'); appendLine(UNAVAIL, [name, r.value, r.label, s.url].join('\t')) }
    if (ONLY[name] || ONLY[name.split('-').slice(1).join('-')]) { const allow = ONLY[name] || ONLY[name.split('-').slice(1).join('-')]; v = v.filter(x => allow.includes(x)) }
    if (v.length) return { s, v }
    await wait(1.5) // after a chip switch, memory radios are briefly all disabled
  }
  return { s: await getState(), v: [] }
}
async function ensurePath(path) { // re-assert upstream selections after an auto-switch
  for (const [field, v] of path) { const name = resolveName(field, await getState()); if (name && checkedValue(await getState(), name) !== v) { await pick(name, v); await wait(0.8) } }
}
async function writeRow(path, s, total, drift) {
  const actual = DIMS.map(f => { const n = resolveName(f, s); return n ? (checkedValue(s, n) ?? '') : '' })
  const key = actual.join('|')
  if (done.has(key)) { L('dup ' + key); return }
  const labels = DIMS.map(f => { const n = resolveName(f, s); const v = n ? checkedValue(s, n) : ''; return n && v ? labelOf(s, n, v).slice(0, 60) : '' }).join(' ; ')
  appendLine(ROWS, [...actual, total || '', parseAmount(total) ?? '', drift ? 1 : 0, labels, s.url].join('\t'))
  done.add(key); written++
  L('ROW ' + key + ' = ' + total + (drift ? ' (drift)' : ''))
}

async function crawl(level, path) {
  if (written >= LIMIT) return
  await applyFixed()
  const field = DIMS[level]
  const name = resolveName(field, await getState())
  if (!name) { const k = field + '@' + JSON.stringify(path.slice(0, 1)); if (!seenMissing.has(k)) { seenMissing.add(k); L('INFO dimension not rendered here (standard/fixed on this tier): ' + field + ' at ' + JSON.stringify(path)) } if (level === DIMS.length - 1) { const s = await getState(); await writeRow(path, s, await readTotal(), false) } else await crawl(level + 1, path); return }
  const { v: vals } = await valuesWithRetry(name)
  if (!vals.length) { L('WARN no enabled values for ' + name + ' at ' + JSON.stringify(path)); return }
  for (const val of vals) {
    if (written >= LIMIT) return
    const prospective = [...path, [field, val]]
    if (level === DIMS.length - 1 && RESUME) {
      const key = prospective.map(p => p[1]).join('|'); if (done.has(key)) continue
    }
    const { ok, total } = await pickPriced(name, val)
    if (!ok) { L('WARN pick failed ' + name + '=' + val); continue }
    let s = await getState()
    // upstream drift (e.g. MacBook Air 10-8 tier auto-upgrades to 10-10 when 24GB is chosen)
    let drift = path.some(([f, v]) => { const n = resolveName(f, s); return n && checkedValue(s, n) !== v })
    if (drift) { await ensurePath(path); const r = await pickPriced(name, val); s = await getState(); drift = path.some(([f, v]) => { const n = resolveName(f, s); return n && checkedValue(s, n) !== v }); if (drift) { L('DRIFT after ' + name + '=' + val + ' path=' + JSON.stringify(path)); await writeRow(prospective, s, r.total, true); continue } }
    if (level === DIMS.length - 1) await writeRow(prospective, s, total, false)
    else await crawl(level + 1, prospective)
  }
}

await applyFixed()
await crawl(0, [])
L('crawl finished, new rows: ' + written + ', total rows: ' + done.size)

// ---------- 3. add-ons (delta measured on the current configuration) ----------
if (plan.addons.length && written > 0) {
  if (!fileExists(ADDONS)) appendLine(ADDONS, ['context', 'addon_dimension', 'value', 'label', 'base_total', 'new_total', 'delta'].join('\t'))
  for (const f of plan.addons) {
    const s0 = await getState(); const name = resolveName(f, s0); if (!name) { L('addon not on page: ' + f); continue }
    await expandFor(name)
    const s = await getState()
    // default = checked value; when nothing is checked (iMac mouse/keyboard) use the "Included"/"No thanks" option, else the first
    const vals0 = values(s, name)
    const def = checkedValue(s, name) || vals0.find(v => /Included|已含|No,? thanks|不需要|none|standard|标准|已包含/i.test(labelOf(s, name, v) + ' ' + v)) || vals0[0]
    if (def && checkedValue(s, name) !== def) { await pickPriced(name, def) }
    const base = await readTotal(); const baseAmt = parseAmount(base)
    const ctx = DIMS.map(d => { const n = resolveName(d, s); return n ? checkedValue(s, n) : '' }).join('|')
    for (const v of values(s, name)) {
      if (v === def) continue
      const { ok, total } = await pickPriced(name, v)
      const d = ok && parseAmount(total) != null && baseAmt != null ? parseAmount(total) - baseAmt : ''
      appendLine(ADDONS, [ctx, name, v, labelOf(s, name, v), base, total, d].join('\t')); L('ADDON ' + name + '=' + v + ' delta ' + d)
      if (def) await pickPriced(name, def)
    }
  }
}
{ // values declared in bootstrap but never selected in any row (disabled / unavailable / gated)
  const seenVals = {}; for (const l of readLines(ROWS).slice(1)) l.split('\t').slice(0, DIMS.length).forEach((v, i) => (seenVals[DIMS[i]] = seenVals[DIMS[i]] || new Set()).add(v))
  const missing = []
  for (const f of DIMS) { const cdv = boot && ((boot.configDisplayValues || {})[f] || (boot.mainDisplayValues || {})[f]); const declared = cdv && cdv.variantOrder; if (declared) for (const v of declared) if (!(seenVals[f] || new Set()).has(v)) missing.push(f + '=' + v) }
  fs.appendFileSync(NOTES, `\n## run summary\nrows total ${done.size}, new this run ${written}, dims ${JSON.stringify(DIMS)}\n` + (missing.length ? `\n## declared in bootstrap but never selectable in this crawl (check ${UNAVAIL})\n` + missing.map(m => '- ' + m).join('\n') + '\n' : '')) }
if (CFG.close) { await completeTaskSpace(CFG.space, { keep: false }); L('task space closed') }
L('crawl done')
