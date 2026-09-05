# Apple 官网 iPad 定制页 — 结构与价格抓取探路（2026-09-05）

范围：美国 https://www.apple.com/shop/buy-ipad 与中国大陆 https://www.apple.com.cn/shop/buy-ipad；以 iPad Pro 为主、iPad Air 为辅，iPad / iPad mini 只扫了维度。全部结论来自 ego-browser 实测（日志见本目录 step*.log）。样本行见 `ipad_sample_rows.tsv`，内嵌配置原文见 `ipad_bootstrap_us.json` / `ipad_bootstrap_cn.json`（iPad Pro 页）。

## 1. 入口与定制页 URL

buy-ipad 列表页上 4 个在售机型（US/CN 相同 slug，另有 us-edu / cn-edu 教育店链接不在范围内）：

| 机型 | 美国 | 中国大陆 |
|---|---|---|
| iPad Pro (M5, 2025) | https://www.apple.com/shop/buy-ipad/ipad-pro | https://www.apple.com.cn/shop/buy-ipad/ipad-pro |
| iPad Air (M4, 2026) | https://www.apple.com/shop/buy-ipad/ipad-air | https://www.apple.com.cn/shop/buy-ipad/ipad-air |
| iPad (A16) | https://www.apple.com/shop/buy-ipad/ipad | https://www.apple.com.cn/shop/buy-ipad/ipad |
| iPad mini (A17 Pro) | https://www.apple.com/shop/buy-ipad/ipad-mini | https://www.apple.com.cn/shop/buy-ipad/ipad-mini |

选完全部步骤后 URL 会跟随变化：美国站变成语义路径（如 `/ipad-pro/11-inch-display-256gb-space-black-wifi-standard-glass`，**更新有滞后，不可当即时状态用**）；中国站变成 **零件号路径**（如 `/ipad-pro/mdwk4ch/a` = MDWK4CH/A），可直接反查 bootstrap 里的 partNumber。

## 2. 表单结构（iPad Pro 为主）

### 2.1 radio 维度（US 与 CN 的 name/value 完全一致）
与 Mac 页最大差别：**name 没有前缀**（Mac 是 `processor-dimensionChip`、`memory-dimensionMemory`），iPad 直接叫 `dimensionXxx`；而且**没有独立的芯片/内存/核心档维度**——存储档同时决定内存和芯片。

iPad Pro（US 与 CN 相同）：

| name | values | 说明 |
|---|---|---|
| dimensionScreensize | 11inch / 13inch | Step 1，初始都未选，必须先点 |
| dimensionColor | spaceblack / silver | Step 2，选完尺寸才解锁；**不影响价格**（US/CN 实测+bootstrap 96/48 个 product 全部核对） |
| dimensionCapacity | 256gb / 512gb / 1tb / 2tb | Step 3，label 内写明 256/512=12GB 内存 M5 9核CPU；1TB/2TB=16GB 内存 M5 10核CPU。**影响价格** |
| dimensionFinish | glossy（标准玻璃）/ matte（纳米纹理玻璃） | Step 4，matte 仅 1TB/2TB 可选（选 256/512 时 matte 不可点）。**影响价格**（US +$100，CN +RMB 800） |
| dimensionConnection | wifi / wificell | 最后一步，**影响价格**（US 11" +$200，CN 11" +RMB 1,700） |
| carrierModel（仅美国） | on（默认已勾）/ ATT_IPADPRO2025 / VERIZON_IPADPRO2025 / UNLOCKED_IPAD_US | 见 §3 |

iPad Air（US/CN 相同）：dimensionScreensize(11inch/13inch) → dimensionColor(space_gray/blue/purple/starlight) → dimensionCapacity(128gb/256gb/512gb/1tb) → dimensionConnection(wifi/wificell)；美国另有 carrierModel(on/ATT_IPADAIR2026/VERIZON_IPADAIR2026/UNLOCKED_IPAD_US)。无 dimensionFinish。颜色不影响价格（bootstrap 128/64 个 product 核对）。

iPad (A16)：dimensionColor(blue/silver/pink/yellow) → dimensionCapacity(128gb/256gb/512gb) → dimensionConnection；无尺寸维度；配件 radio 名为 `acc_pencil_first`、`acc_magic_keyboard`。
iPad mini (A17 Pro)：dimensionColor(purple/starlight/space_gray/blue) → dimensionCapacity(128gb/256gb/512gb) → dimensionConnection；配件 `acc_pencil`、`smart_folio`、`smart_folioGroup_dimensionColor`。

### 2.2 非价格步骤的 radio / select（抓价时全部忽略，用正则过滤 name）
- 刻字：`engraving-option-select-*`（addEngraving/noEngraving，免费）
- Apple Pencil：`acc_pencil`（acc_pencil_grp_pro / acc_pencil_grp_usbc / acc_pencil_section_noaccessory），Pencil 自带子刻字 radio
- 键盘：`acc_keyboard_11inch` / `acc_keyboard_13inch`（默认 `*_section_noaccessory`，即"不加键盘"），键盘颜色 `acc_magickeyboard_1Xinch_dimensionColor`，键盘语言 `<select name="acc_magickeyboard_1Xinch_dimensionLanguage">`（页面上仅有的两个 select）
- 以旧换新：`tradeupinline`（tradeIn/noTradeIn）+ 序列号文本框
- AppleCare：`applecare-options`、`dimensionPaymentType`（美国月付/年付）
- 美国支付方式：`purchase_option_group`（fullprice/finance/partnerowned）
过滤正则（已验证）：`/tradeupinline|purchase_option|applecare|dimensionPaymentType|engraving|acc_|dimensionLanguage|smart_folio/`
这些步骤**不需要操作**：不点它们，汇总价就是裸机价（US `$1,199.00`，CN `RMB 10,799`）。不存在必须"跳过"的门槛，直接读价即可。

### 2.3 内嵌配置 `window.PRODUCT_SELECTION_BOOTSTRAP`
US/CN 都存在，顶层只有 `productSelectionData`，其下 keys：`sections, displayValues, products, priceDisplayOrder, priceMessageFallback, imageDictionary, selectButtonText, labels, favoritesEnabled, energyComplianceDictionary`。
- `sections[]`：维度顺序与依赖（formFieldName / dependsOn / stepCount），US Pro 6 段（含 carrierModel），CN Pro 5 段。
- `products[]`：**每个 SKU 一条**，字段含 partNumber、fullPrice（价格表 key）、dimensionScreensize/Color/Capacity/Finish/Connection、isCarrierDevice、carrierPolicyType、comingSoon、getReady、productMessage。US Pro 96 条（24 个价格配置 × 2 色，蜂窝款再 × 3 运营商），CN Pro 48 条；US Air 128、CN Air 64；iPad/mini US 48、CN 24。
- `displayValues.prices{}`：key = fullPrice（形如 `mdwk4ll_a`，美国蜂窝款带运营商后缀 `me2n4ll_a_att_ipadpro2025`），值里 `currentPrice.raw_amount`（"1199.00"）、`amountBeforeTradeIn`、`partNumber`、`priceCurrency`（USD/CNY）；CN 还有 `priceFeeDisclaimer`（含税说明）、`installments`。
- **与 Mac 页差异**：Mac 的 bootstrap 是"基础价 + 各维度差价"（mainSections/configSections），iPad 是**扁平 SKU 表**——不需要做加法核对，直接从 bootstrap 就能拿到全部机型的全部价格，页面点选只是对账用。实测 9 行 US + 9 行 CN 页面总价与 bootstrap 全部一致（见 tsv 的 match 列）。
- 仅美国有 `PURCHASE_OPTIONS_BOOTSTRAP`、`BUYFLOW_MESSAGES_BOOTSTRAP`；两站都有 PRODUCT_AVAILABILITY / LOCATION / TRADEUP_INLINE / ENGRAVING / APPLECARE_BOOTSTRAP。

## 3. 价格维度与运营商

影响价格：尺寸、存储档（=内存+芯片）、Wi-Fi/蜂窝、纳米纹理玻璃（仅 Pro）。
不影响价格：颜色（Pro/Air 两站均验证）。键盘/Pencil/AppleCare 是加购项，不点则不计入。

**美国蜂窝版不需要选运营商即可读价**：选 wificell 后汇总价立刻变为蜂窝价（如 $1,399.00），`carrierModel=on` 是默认勾选的隐藏值。Carrier 段（"Carrier. Choose how you'll get connected."）在 DOM 里但 `hidden`（label 宽高为 0），用 label 点击 UNLOCKED/ATT 都失败（ok=false），但**不影响**：bootstrap 中 ATT / VERIZON / UNLOCKED 三个 key 的价格完全相同（如 ME2N4LL/A 三者均 1399.00）。抓价时忽略 carrierModel。
中国站无 carrierModel 维度，蜂窝款 eSIM 相关说明为"请联系中国联通"。

iPad Pro 11" 差价（实测）：US：256→512 +$200，512→1TB +$400，1TB→2TB +$500；蜂窝 +$200；纳米 +$100。CN：+1,700 / +3,400 / +4,200；蜂窝 +1,700；纳米 +800。

## 4. 汇总总价选择器与延迟

| 站 | 首选 | 备选 | 备注 |
|---|---|---|---|
| 美国 | `.rf-po-bfe-purchaseoptions-prices-content` → `$1,199.00`（纯价格，与 Mac 相同） | `[data-autom="stickyPrice"]`（含 "Buy for $1,199.00 or $99.91/mo..." 长文本，需正则 `\$[\d,]+\.\d{2}`） | 未选完时也显示当前最低价（"Buy from $1199"） |
| 中国 | `[data-autom="stickyPrice"]` → 选完后 `RMB 12,499或RMB 521/月 (24 期)`，正则 `RMB\s*([\d,]+)` 取第一个 | `[data-autom="headerPrice"]`（同文本）、`[data-autom="full-price"]`（`RMB 12,499`，但选完前带"起"）| **Mac 用的 `.rc-prices-fullprice .as-pricepoint-fullprice` 在 iPad 页不存在**；`[data-autom="summaryPrice"]` 在选完最后一步后会消失（变 null），不要依赖 |

判定"已选完"：CN 看 stickyPrice 文本不含"起"，或 URL 已变为 `/ipad-pro/<part>/a`；US 看 stickyPrice 以 "Buy for" 而非 "Buy from" 开头。
价格更新延迟：点击后 0.4～3.2 s 汇总价才变（实测 415～3234 ms，多数 1.2～2 s）。建议点后轮询汇总价 ≤4 s，再等 1 s 校验 `input.checked`。
**不需要点 Edit/编辑展开**：iPad 页所有维度的 radio 一直在 DOM 且可点（Mac 的 "Edit Unified Memory" 折叠机制在 iPad 页不存在）；页面上的 "Edit" 按钮只属于 Payment Options / AppleCare。

## 5. 小样本验证（iPad Pro 11 英寸，容量 × 连接 + 1 行纳米纹理）
见 `ipad_sample_rows.tsv`：US 9 行、CN 9 行，页面总价与 bootstrap 全部 OK。
坑：CN 站在首次选完最后一步时页面重渲染，紧接着的下一次点击可能不生效（256gb→wificell 一次 ok=false，重点后成功）；`pick()` 里的"没勾上就再点一次"必须保留，且重点前再 scrollIntoView。

## 6. 预购 / 发售 / 限购提示
- 两站 iPad Pro/Air/iPad/mini bootstrap 里 `comingSoon`、`getReady` 全为 false，`productMessage` 全空 → 目前无预购/即将发售机型。
- 页面正文未出现 "pre-order / Coming soon / 预购 / 限购 / 每位顾客" 之类的 iPad 限购文字；唯一命中的 "Limit of one (1) Apple Vision Pro can be covered under AppleCare One" 与 iPad 无关。
- CN 供货文案在 `.rf-bfe-stickybar-fulfillment` / `[data-autom="deliveryQuotes"]`："有现货 免费送货 零售店取货 不提供 3 小时快送服务"；US 为 "Free shipping Pick up from Store"。
- CN 促销脚注："本次促销期限为 2026 年 7 月 16 日至 2026 年 9 月 24 日……"（教育/返校类，非限购）；US 列表页 "LIMITED TIME Buy iPad or Mac with education savings, get a gift card from $100 to $150"。

## 7. iPad 抓取要点（供 skill 参考文档直接引用）
1. **优先走 bootstrap，不必逐个点选**：打开定制页 → `JSON.stringify(window.PRODUCT_SELECTION_BOOTSTRAP)` → `products[]` 每条 join `displayValues.prices[p.fullPrice].currentPrice.raw_amount`，即得全部 SKU（含 partNumber）。美国蜂窝款同一 part 有 3 个运营商 key，按 partNumber 去重后取一条。页面点选只做抽样对账（每机型每站抽 3～5 行）。
2. 维度 name 无前缀：`dimensionScreensize / dimensionColor / dimensionCapacity / dimensionFinish(仅 Pro) / dimensionConnection`；点选顺序按此从上到下，尺寸未选时后面全 disabled。iPad/mini 没有 dimensionScreensize。
3. 忽略并过滤：`/tradeupinline|purchase_option|applecare|dimensionPaymentType|engraving|acc_|dimensionLanguage|smart_folio|carrierModel/`。不点任何加购项。
4. 颜色不进乘积（只固定第一个颜色）；纳米纹理玻璃是 Pro 专属价格维度，仅 1TB/2TB 有效，遍历时在 finish=glossy 上跑全部容量×连接，再在 1TB/2TB 上补 matte。
5. 总价选择器：US `.rf-po-bfe-purchaseoptions-prices-content`；CN `[data-autom="stickyPrice"]` 正则取首个 `RMB [\d,]+`（`.rc-prices-fullprice` 不存在）。点后轮询最多 4 s。
6. 对账辅助：CN 选完后 URL 尾段就是 part（`/mdwk4ch/a` → MDWK4CH/A）；US URL 是语义 slug 且滞后，不要用它判断状态。
7. 复用 crawl_lib.js 时：删掉 EDITBTN/expand 逻辑（iPad 无折叠），`state()` 的 total 改为双选择器；`pick()` 保留"失败重点"。
