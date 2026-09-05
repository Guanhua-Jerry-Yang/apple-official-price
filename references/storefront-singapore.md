# Apple 新加坡官网（apple.com/sg）定制购买页 探路记录

日期：2026-09-05（ego-browser task space `explore-sg`，页面证据见同目录 explore_step*.log）
对照基线：crawl-method.md（美国站 apple.com / 中国站 apple.com.cn，2026-09-04 验证）

## 1. 事实清单（Mac mini：https://www.apple.com/sg/shop/buy-mac/mac-mini）

| 项目 | 新加坡站实测 |
|---|---|
| 页面标题 | `Buy Mac mini - Apple (SG)`；H1 = `Pre-order Mac mini` |
| radio name 集合 | `processor-dimensionChip`(m6 / m5pro)、`m5pro-processor-dimensionChip-cpuCoreCount-gpuCoreCount`(m5pro-15-16 / m5pro-18-20)、`m6-...`(m6-12-12，选 M6 后自动勾上)、`memory-dimensionMemory`(16gb/24gb/32gb/48gb/64gb)、`storage-dimensionCapacity`(256gb/512gb/1tb/2tb/4tb/8tb)、`ethernet_adapter-ethernetBandwidth`(2_5gb_per_second / 10gb_per_second)、`software_final-preInstalledSoftware`、`software_logic-preInstalledSoftware` |
| 与美国站 name/value 是否一致 | **一致**（同一套 React 购买流，仅文案/货币本地化） |
| `window.PRODUCT_SELECTION_BOOTSTRAP` | **存在**，键 `productSelectionData` → preSelectBTRDefaults / globalNamedAssets / mainSections / configSections / products / mainDisplayValues / configDisplayValues / priceDisplayOrder / selectButtonText。原文已存 `sg_bootstrap_macmini.json`（12.7 KB） |
| 基础价（bootstrap `mainDisplayValues.prices`） | m6-12-12 = S$1,299；m5pro-15-16 = S$2,499；m5pro-18-20 = S$2,799（`currentPrice.amount` 形如 `"S$1,299.00"`，`raw_amount` = `"1299.00"`） |
| 汇总总价选择器 | `.rf-bfe-summary-price`（内层 `.as-price-currentprice[data-autom="summaryPrice"]`）。选芯片前显示 `From S$1,299`（无小数），选芯片后显示 `S$1,299.00` |
| 美国站选择器 `.rf-po-bfe-purchaseoptions-prices-content` | 在 SG 页 **取不到（null）** |
| 中国站选择器 `.rc-prices-fullprice .as-pricepoint-fullprice` | SG 页有 `.rc-prices-fullprice`，但内层是 `.price-point.price-point-fullPrice-comparative > span.nowrap`，且它属于芯片卡片的「From S$…」，不是汇总总价，**不要用** |
| 价格文字格式 | 汇总总价 `S$1,299.00`（千分位逗号 + 两位小数）；差价标签 `+ S$300.00` / `− S$900.00`（注意减号是 U+2212 而非 ASCII `-`）/ `Included`；卡片起价 `From S$1,299` |
| 差价基准 | 差价相对于**当前已选项**而非基础配置（换到 18-20 档后 24GB 显示 `− S$900.00`、当前 48GB 无标签）。算加法时以 bootstrap 基础价 + 相对基础档的差价为准 |
| 是否含 GST | **含**。页脚原文：`Prices are inclusive of GST. Free delivery for all orders.`（`<li>` 元素，无 class） |
| 预购 / 发售 / 限购原文 | `Pre-order Mac mini`；`Available starting 22 September`；`Limit of two Mac mini per customer`；`0% instalments available` |
| 折叠卡片 / Edit 按钮 | Mac mini SG 页 **无折叠卡片**，选芯片后 memory/storage/ethernet 直接展开，无 `Edit*` 按钮（与美国站 Mac mini 一致；`crawl_lib.js` 的 expand() 走 no-op 路径） |
| 初始态 | 选芯片后 memory/storage/ethernet 均为未勾选状态（checked=false），必须显式点选第一项，否则 `checked()` 返回空串 |

## 2. Mac mini 抓取结果（sg_macmini_rows.tsv，30 行）

- M6 (m6-12-12)：内存 3 × 存储 4 × 以太网 2 = **24 行全部抓到**，耗时 131 s。
- M5 Pro 样本 6 行：15-16 档 3 行、18-20 档 3 行（含 64GB/8TB/10GbE 顶配 S$10,149.00）。
- 差价表（相对各档基础配置）：
  - M6：内存 16→24 +300、→32 +600；存储 256→512 +300、→1TB +750、→2TB +1,500
  - M5 Pro（两档相同）：内存 24→48 +900、→64 +1,500；存储 512→1TB +450、→2TB +1,200、→4TB +2,700、→8TB +5,700
  - 以太网 2.5G→10G +150（全部芯片一致）
- 加法核对：30/30 行满足 总价 = 基础价 + Σ差价，0 例外。

## 3. MacBook Air（https://www.apple.com/sg/shop/buy-mac/macbook-air）

- 结构与美国站一致：mainSections = `chassis-dimensionScreensize`(13inch/15inch) → `chassis-dimensionColor`(skyblue/silver/starlight/midnight) → `processor-cpuCoreCount-gpuCoreCount`(10-8 / 10-10；**注意 MBA 没有 processor-dimensionChip 这一级**)；configSections = `customizableSpecs/GROUPED_COLLAPSED`（折叠卡片：memory / storage / power_adapter-wattage(40w/35w/70w) / keyboard-localizationCode）+ 预装软件。
- 解锁顺序：尺寸 → 颜色 → 处理器，三步都选完才出现 memory/storage 等 radio；颜色不选处理器不解锁。
- 折叠卡片「Edit」按钮文字 **与美国站相同**：`Edit Unified Memory` / `Edit SSD Storage` / `Edit Power Adapter` / `Edit Keyboard`，`data-autom="edit-<fieldName>"`（如 `edit-memory-dimensionMemory`），class `re-configure-card-edit-button`，`aria-expanded` 标记展开态。→ crawl_lib.js 的 `EDITBTN` 映射可直接复用；更稳的做法是改用 `button[data-autom="edit-<name>"]`。
- 另有一个无关的 `Edit`（`data-autom="summary-view-edit-link"`）在摘要栏，写 expand() 时必须按完整文字/data-autom 匹配，不要用 `^Edit` 泛匹配（本次误点了它，无副作用但浪费一轮）。
- 总价选择器同 Mac mini：`.rf-bfe-summary-price`；选完处理器后 `S$1,899.00`。
- 基础价：13-inch 10-8 = **S$1,899**；13-inch 10-10 = S$2,049；15-inch 10-10 = S$2,199（bootstrap `prices` 键形如 `13inch-starlight-10-8`）。
- 折叠态 label 宽度为 0 且 innerText 无空格（`16GBIncluded`），展开后为 `16GB Included`——沿用 METHOD 的「label 宽度 >0 才可点」判据有效。

## 4. iPhone（https://www.apple.com/sg/shop/buy-iphone → /iphone-17-pro）

- 列表页机型链接：iphone-17-pro / iphone-air / iphone-17 / iphone-17e / iphone-16。
- 购买页 radio name：`dimensionScreensize`(6_3inch/6_9inch) → `dimensionColor` → `dimensionCapacity`(256gb/512gb/1tb/2tb) → `applecare-options`。**没有运营商 / connectivity 步骤**（美国站有 carrier 步骤）；页面 FAQ 明示 `Why should I buy a SIM-free iPhone on apple.com?`。
- 存储卡片直接带起价：`256GB From S$1,749`、`512GB From S$2,049`、`1TB From S$2,349`、`2TB From S$3,099`；Pro Max 起价 S$1,899。总价选择器同 `.rf-bfe-summary-price`。
- `PRODUCT_SELECTION_BOOTSTRAP` 存在但 `productSelectionData.mainSections/configSections` 为空（iPhone 页用另一套 step 结构 `rf-bfe-step rf-bfe-dimension-dimension*`）。

## 5. URL 规律

- 前缀 `https://www.apple.com/sg/shop/...`，与美国站 `/shop/...`、中国站 `apple.com.cn/shop/...` 同构。实测均 200 且含 BOOTSTRAP：`/sg/shop/buy-mac/macbook-pro`、`/imac`、`/mac-studio`、`/sg/shop/buy-ipad/ipad-pro`、`/sg/shop/buy-watch/apple-watch`、`/sg/shop/buy-iphone/iphone-17`。
- 深链接（预配置）格式：`/sg/shop/buy-mac/mac-mini/m6-chip-12-core-cpu-12-core-gpu-16gb-memory-512gb-storage`（200，title 含完整配置名）。
- 家族列表页 `/sg/shop/buy-mac` 无 BOOTSTRAP（不是购买流页）。
- 教育站：`https://www.apple.com/sg-edu/shop/buy-mac`；订单/账户走 `secure.store.apple.com/sg/shop/...`。

## 6. 与美国 / 中国站的差异汇总

| 维度 | 美国站 | 中国站 | 新加坡站 |
|---|---|---|---|
| URL 前缀 | apple.com/shop | apple.com.cn/shop | apple.com/sg/shop |
| radio name/value | 基线 | 相同 | **相同** |
| 汇总总价选择器 | `.rf-po-bfe-purchaseoptions-prices-content` | `.rc-prices-fullprice .as-pricepoint-fullprice` | **`.rf-bfe-summary-price`**（`[data-autom="summaryPrice"]`） |
| 价格格式 | `$1,299.00` | `RMB 1,299` | `S$1,299.00`；差价 `+ S$300.00`，负差价用 U+2212 `−` |
| 「已含」字样 | Included | 已含 | Included |
| 税 | 不含 sales tax | 含增值税 | **含 GST**（页脚 `Prices are inclusive of GST`） |
| iPhone 运营商步骤 | 有 | 无 | **无**（SIM-free） |
| Edit 按钮文字 | Edit Unified Memory 等 | 中文 | **同美国站英文** |
| Mac mini 芯片 | — | — | M6 / M5 Pro（15-16、18-20），预购中，9 月 22 日发售，限购 2 台 |

## 7. 新加坡站抓取要点

1. 复用 `crawl_lib.js` 骨架，只改 `state()` 的总价取法：`document.querySelector('.rf-bfe-summary-price')?.innerText`；金额解析 `/S\$([\d,]+(?:\.\d{2})?)/`。若文本以 `From` 开头说明芯片还没选，不是有效总价。
2. 解析差价标签时把 U+2212 `−` 归一为 `-`，`Included` 视为 0。
3. Edit 按钮：优先用 `button[data-autom="edit-<fieldName>"]`；文字匹配时用完整前缀（`Edit Unified Memory`），不要 `^Edit`，避免命中摘要栏的 `summary-view-edit-link`。
4. 选芯片后 memory/storage/ethernet 处于未勾选态，遍历前先显式点第一项；点选后校验 `checked`。
5. bootstrap 用 `JSON.stringify(window.PRODUCT_SELECTION_BOOTSTRAP)` 经 cliLog 落盘（heredoc 内不能用 `require('fs')`，与 top-level await 冲突）。
6. 所有价格含 GST，跨站比价时美国站需另加税或标注口径。
7. 24 行 Mac mini 遍历约 130 s；单 heredoc 保持 ≤ 6 min，按内存档分批可稀释风险。
8. 页头 `Pre-order` / `Available starting <date>` / `Limit of two ... per customer` 用 `document.body.innerText` 正则即可抓到，写进 notes。
