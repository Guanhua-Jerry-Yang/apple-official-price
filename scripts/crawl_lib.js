// crawl_lib.js — helpers for driving Apple Store configurator pages inside ego-browser.
// Loaded by concatenation:  { echo "const CFG=$(cat cfg.json);"; cat crawl_lib.js crawl_model.js; } | ego-browser nodejs
// Everything here runs in Node (ego-browser runtime); code inside js`...` runs in the page.
import fs from 'fs'

// ---------- file helpers ----------
function appendLine(file, line) { fs.appendFileSync(file, line + '\n') }
function fileExists(f) { try { fs.accessSync(f); return true } catch { return false } }
function readLines(f) { return fileExists(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean) : [] }
function log(msg) { cliLog(new Date().toISOString().slice(11, 19) + ' ' + msg) }

// ---------- region / price parsing ----------
function detectRegion(url) {
  try {
    const u = new URL(url)
    if (u.hostname.endsWith('apple.com.cn')) return 'cn'
    const m = u.pathname.match(/^\/([a-z]{2}(?:-[a-z]{2})?)\//)
    if (m && m[1] !== 'shop') return m[1]          // /sg/, /hk/, /uk/ ...
    return 'us'
  } catch { return 'us' }
}
// "$1,299.00" | "RMB 12,999" | "S$1,299.00" | "HK$7,999" -> number
function parseAmount(raw) {
  if (!raw) return null
  const m = String(raw).replace(/ /g, ' ').match(/(\d[\d,]*)(\.\d+)?/)
  if (!m) return null
  return Math.round(parseFloat(m[1].replace(/,/g, '') + (m[2] || '')))
}

// ---------- page readers (browser side) ----------
// Total price of the currently selected configuration. Selectors differ by region/state:
//   US:  .rf-po-bfe-purchaseoptions-prices-content   (Buy/Finance block)
//   CN/SG: .rc-prices-fullprice .as-pricepoint-fullprice ; after choosing preinstalled software the
//   element becomes .rc-prices-currentprice — so fall back through several selectors, then a regex scan.
const TOTAL_JS = String.raw`(() => {
  const sels = ['.rf-po-bfe-purchaseoptions-prices-content',        // US: Buy / Finance block
                '[data-autom="summaryPrice"]', '.rf-bfe-summary-price', // SG (and other storefronts without the US purchase-options block)
                '.rc-prices-fullprice .as-pricepoint-fullprice',        // CN
                '.rc-prices-fullprice', '.rc-prices-currentprice',      // CN after choosing preinstalled software
                '[data-autom="stickyPrice"]',                           // CN iPad (no .rc-prices-fullprice on that page)
                '[data-autom="full-price"]'];
  const clean = t => t.replace(/\s+/g,' ').trim().split(/\s(?:或|or|ou|oder)\s/)[0].trim(); // drop "or $74.91/mo." / "或 RMB 417/月" instalment tail
  for (const s of sels) { const e = document.querySelector(s); if (e && /\d/.test(e.textContent)) return clean(e.textContent); }
  const re = /^(?:[A-Z]{0,3}\$|RMB|¥|€|£)\s?[\d,]+(?:\.\d{2})?$/;
  const c = [...document.querySelectorAll('span,div')].find(e => e.children.length===0 && re.test(e.textContent.trim()) && e.closest('[class*="price"],[class*="summary"],[class*="rc-"]'));
  return c ? c.textContent.trim() : null;
})()`
async function readTotal() { return await js(TOTAL_JS) }

// Wait until the total differs from `prev` and is stable across two reads (price updates lag the click).
async function waitTotalStable(prev, timeoutSec = 6) {
  const t0 = Date.now(); let last = null, same = 0
  while ((Date.now() - t0) / 1000 < timeoutSec) {
    const t = await readTotal()
    if (t && t !== prev) { if (t === last) { same++; if (same >= 1) return t } else { same = 0 } }
    last = t
    await wait(0.4)
  }
  return last // timed out: either price legitimately unchanged or page slow — caller may re-verify
}

// All radios + selects with checked/disabled/label, plus total and url.
const STATE_JS = String.raw`(() => {
  const lab = i => { const l = document.querySelector('label[for="' + i.id + '"]'); return l ? l.innerText.replace(/\s+/g,' ').trim().slice(0,120) : '' };
  const radios = [...document.querySelectorAll('input[type=radio]')].map(i => {
    const l = document.querySelector('label[for="' + i.id + '"]'); const r = l ? l.getBoundingClientRect() : null;
    return { name: i.name, value: i.value, checked: i.checked, disabled: i.disabled, id: i.id, label: lab(i), visible: !!(r && r.width > 0 && r.height > 0) };
  });
  const selects = [...document.querySelectorAll('select')].map(s => ({ name: s.name || s.id, value: s.value, options: [...s.options].map(o => o.value).slice(0,40) }));
  return { radios, selects, total: ${TOTAL_JS}, url: location.href };
})()`
async function getState() { return await js(STATE_JS) }
function checkedValue(st, name) { const o = st.radios.find(r => r.name === name && r.checked); return o ? o.value : null }
function values(st, name, { enabledOnly = true } = {}) {
  const seen = new Set(); const out = []
  for (const r of st.radios) if (r.name === name && (!enabledOnly || !r.disabled) && !seen.has(r.value)) { seen.add(r.value); out.push(r.value) }
  return out
}
function labelOf(st, name, val) { const o = st.radios.find(r => r.name === name && r.value === val); return o ? o.label : '' }

// Bootstrap JSON embedded in the page (dimension hierarchy, priceKeys, base prices).
async function readBootstrap() {
  return await js(String.raw`(() => { const b = window.PRODUCT_SELECTION_BOOTSTRAP; return b ? JSON.stringify(b.productSelectionData || b) : null })()`)
}

// ---------- interaction ----------
// Collapsed "Customizations" cards keep their radios in the DOM with zero-size labels; clicking them silently
// does nothing. Expand by clicking the card's Edit/编辑 button (several markups seen across pages).
async function expandFor(name) {
  const vis = await js(String.raw`(() => { const i = document.querySelector('input[name="${name}"]'); if (!i) return 'noinput';
    const l = document.querySelector('label[for="' + i.id + '"]'); if (!l) return 'nolabel'; const r = l.getBoundingClientRect(); return r.width > 0 && r.height > 0 })()`)
  if (vis === true || vis === 'noinput') return vis
  const clicked = await js(String.raw`(() => {
    const i = document.querySelector('input[name="${name}"]');
    // "Edit Unified Memory" / "编辑 内存" style buttons only — never the bare summary-bar "Edit" link, which navigates.
    const pats = /^(Edit|Change|编辑|更改|變更|修改)\s*\S+/i;
    const isEdit = b => !/summary-view-edit/.test(b.className + ' ' + (b.getAttribute('data-autom') || '')) && (pats.test(b.innerText.trim()) || /^edit-/.test(b.getAttribute('data-autom') || '') || /change-button/.test(b.className));
    // 1) nearest enclosing section that owns an edit button
    let n = i; for (let k = 0; k < 8 && n; k++, n = n.parentElement) {
      const b = [...n.querySelectorAll('button')].find(isEdit);
      if (b) { b.scrollIntoView({block:'center'}); b.click(); return 'section:' + b.innerText.trim().slice(0,40) }
    }
    // 2) any edit button on page (expanding everything is harmless)
    const all = [...document.querySelectorAll('button')].filter(isEdit);
    all.forEach(b => b.click()); return all.length ? 'all:' + all.length : 'none';
  })()`)
  await wait(1.6)
  return clicked
}

// Select one radio value. Returns true when the input reports checked.
async function pick(name, val) {
  await expandFor(name)
  const id = await js(String.raw`document.querySelector('input[name="${name}"][value="${val}"]')?.id`)
  if (!id) throw new Error('no input ' + name + '=' + val)
  await js(String.raw`document.querySelector('label[for="${id}"]')?.scrollIntoView({block:'center'})`)
  await wait(0.5)
  try { await click('label[for="' + id + '"]') } catch (e) { /* fall through to input.click */ }
  await wait(1.2)
  let ok = await js(String.raw`!!document.querySelector('input[name="${name}"][value="${val}"]')?.checked`)
  if (!ok) { await js(String.raw`document.querySelector('input[name="${name}"][value="${val}"]')?.click()`); await wait(1.5)
    ok = await js(String.raw`!!document.querySelector('input[name="${name}"][value="${val}"]')?.checked`) }
  return ok
}
// pick + wait for the summary price to settle. Returns { ok, total }.
async function pickPriced(name, val, prevTotal) {
  const prev = prevTotal ?? await readTotal()
  const ok = await pick(name, val)
  const total = await waitTotalStable(prev, 6)
  return { ok, total }
}

// Availability / pre-order / purchase-limit sentences on the page.
async function readNotes() {
  return await js(String.raw`(() => {
    const t = (document.querySelector('main') || document.body).innerText.split('\n').map(s => s.trim()).filter(Boolean);
    const re = /(Available starting|Pre-?order|Coming soon|ships|delivery|发售|预购|预售|即将|限购|每位顾客|限购|Limit|per customer|GST|inclusive|含税|增值税)/i;
    return [...new Set(t.filter(l => re.test(l) && l.length < 200))].slice(0, 30);
  })()`)
}
