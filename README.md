# apple-official-price

A [Claude Code](https://claude.com/claude-code) skill that reads **every configuration price** of a Mac, iPhone or iPad from Apple's own online store in several countries and writes them into one comparison workbook.

一个 Claude Code skill：去 Apple 官网（美国 / 中国大陆 / 新加坡，可扩展）的定制购买页，把某个机型**所有配置组合**的官方标价抓下来、逐行核对，写进一份持续追加的 Excel 对比总表。

> Built from a real session on 2026-09-04/05: Mac mini (84 combos), MacBook Pro (57), MacBook Air (25) across apple.com and apple.com.cn, then generalised to Singapore, iPhone and iPad. Everything in `references/` was verified against live pages, not guessed.

## What it does · 做什么

1. Opens the configurator page in an isolated [ego-browser](https://github.com/cheng-zhongliang/ego) task space (your own Chrome is untouched, nothing is added to a bag).
2. Reads the page's embedded `PRODUCT_SELECTION_BOOTSTRAP` to learn the dimensions (size → chip → core tier → memory → storage → …) and base prices.
3. **Mac**: clicks through the full Cartesian product of price-affecting options and records the summary price of each combination, expanding collapsed "Customizations" cards, waiting for the price to settle, detecting auto tier switches.
   **iPhone / iPad**: prices are per-SKU in the bootstrap, so it reads them directly and clicks a handful of SKUs to cross-check (US iPhone: SIM-free `UNLOCKED/US` price, not the carrier-discounted one).
4. Verifies every row: `total = tier base + Σ option deltas`; mismatches are re-read once before being called a pricing quirk.
5. Writes one `<model> 对比` sheet per model into a master workbook: local price, tax-inclusive price (US: MA 6.25% by default), RMB conversion, difference and premium vs. China, add-on deltas (nano-texture glass, power adapter, preinstalled Final Cut / Logic), plus an assumptions sheet where tax rates and FX rates are yellow editable cells that drive every formula.

## Install · 安装

```bash
git clone https://github.com/Guanhua-Jerry-Yang/apple-official-price ~/.claude/skills/apple-official-price
```

Requirements: Claude Code, [ego-browser](https://github.com/cheng-zhongliang/ego) (`ego-browser nodejs` on PATH), Python 3 with `openpyxl`. Excel/Numbers to view the workbook (formulas are computed on open; LibreOffice is not needed).

## Use · 用法

Just ask in Claude Code, e.g.

- 「帮我看看 iMac 各配置美国和中国的价格，做成 Excel」
- 「把 Mac Studio 加进 Apple 价格总表，美中新三站」
- "iPhone 17 Pro SIM-free prices US vs China, tax at California rate"

The skill triggers on Apple pricing questions even without the words "Excel" or "table".

### Manual pipeline · 手动跑

```bash
S=~/.claude/skills/apple-official-price/scripts
# 1. detect dimensions (writes <out>_plan.json, _structure.json, _notes.md)
echo '{"url":"https://www.apple.com/shop/buy-mac/mac-mini","space":"aop-macmini-us","out":"/tmp/aop/macmini_us","planOnly":true}' > cfg.json
$S/run_crawl.sh cfg.json
# 2. crawl every combination (resumable; use "only"/"limit" to chunk, run in background for big models)
echo '{"url":"https://www.apple.com/shop/buy-mac/mac-mini","space":"aop-macmini-us","out":"/tmp/aop/macmini_us","close":true}' > cfg.json
$S/run_crawl.sh cfg.json
# 3. verify
python3 $S/verify_additivity.py /tmp/aop/macmini_us_rows.tsv
# 4. iPhone/iPad: read SKUs straight from the bootstrap instead of clicking
python3 $S/bootstrap_skus.py /tmp/aop/iphone17_us_structure.json --out /tmp/aop/iphone17_us_rows.tsv
# 5. build / update the workbook
python3 $S/build_workbook.py spec.json      # see references/workbook-spec.md for the spec
```

## Layout · 结构

```
SKILL.md                 workflow Claude follows (Chinese)
scripts/
  run_crawl.sh           wrapper: cfg.json → ego-browser nodejs (config is prepended as a const; env vars don't reach the runtime)
  crawl_lib.js           page helpers: pick / expand collapsed cards / read total / wait for price to settle
  crawl_model.js         auto-detect dimensions → Cartesian crawl → add-on deltas → notes; planOnly / only / limit / resume
  bootstrap_skus.py      SKU price table from PRODUCT_SELECTION_BOOTSTRAP (iPhone/iPad), tier base prices (Mac)
  verify_additivity.py   base + deltas check, lists mismatching rows
  build_workbook.py      multi-region comparison sheet with formulas + assumptions sheet
references/
  crawl-method.md        operator handbook for (sub)agents, incl. 12 pitfalls that actually happened
  page-structure.md      verified DOM / bootstrap facts for Mac configurators, price selectors per storefront
  iphone.md  ipad.md     product-specific structure and gating (carrier, trade-in, AppleCare)
  storefront-singapore.md  what differs on apple.com/sg
  models.md              URLs, known dimensions and combo counts per model
  workbook-spec.md       Excel columns, formulas, styling, spec.json template
evals/evals.json         test prompts
```

## Known limits · 已知边界

- Prices are list prices from the configurator; no education store, refurbished, carrier or reseller prices.
- FX rates are placeholders in the assumptions sheet — edit them; the skill deliberately does not pull live rates.
- Apple's buy-flow markup changes occasionally. If a selector stops matching, `references/crawl-method.md §4` shows how to inspect the page with the same helpers and where to record the new fact.
- The US MacBook Pro / Air pages do not render the preinstalled-software option in the DOM, so that add-on is captured on CN/SG only.

## License

MIT
