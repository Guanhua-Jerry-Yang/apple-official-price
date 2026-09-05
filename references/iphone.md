# iPhone 定制页结构与价格抓取探路（2026-09-05 实测）

工具：ego-browser，task space `explore-iphone`。所有结论都来自页面 DOM / `window.PRODUCT_SELECTION_BOOTSTRAP` 实测，原始日志在本目录 `step*.log`。
对照对象：Mac 定制页方法见 `crawl-method.md` 与 `../scripts/crawl_lib.js`。

## 1. 入口（buy-iphone 列表页）

| 站点 | 列表页 | 卡片 data-part-number | 机型 | 定制页 URL | 卡片起价 |
|---|---|---|---|---|---|
| US | https://www.apple.com/shop/buy-iphone | IPHONE17PRO_MAIN | iPhone 17 Pro & iPhone 17 Pro Max | https://www.apple.com/shop/buy-iphone/iphone-17-pro | Buy from $1099 |
| US | 同上 | IPHONEAIR_MAIN | iPhone Air | https://www.apple.com/shop/buy-iphone/iphone-air | Buy from $999 |
| US | 同上 | IPHONE17_MAIN | iPhone 17 | https://www.apple.com/shop/buy-iphone/iphone-17 | Buy from $799（注意：这是绑运营商价，不绑运营商 $829） |
| US | 同上 | IPHONE17E_MAIN | iPhone 17e | https://www.apple.com/shop/buy-iphone/iphone-17e | Buy from $599 |
| US | 同上 | IPHONE16_MAIN | iPhone 16 & 16 Plus（上一代仍在售） | https://www.apple.com/shop/buy-iphone/iphone-16 | Buy from $699 |
| CN | https://www.apple.com.cn/shop/buy-iphone | MG034 | iPhone 17 Pro 和 iPhone 17 Pro Max | https://www.apple.com.cn/shop/buy-iphone/iphone-17-pro | （卡片价文本未抓，见 bootstrap） |
| CN | 同上 | MG314 | iPhone Air | https://www.apple.com.cn/shop/buy-iphone/iphone-air | |
| CN | 同上 | MG6W4 | iPhone 17 | https://www.apple.com.cn/shop/buy-iphone/iphone-17 | RMB 5999 起 |
| CN | 同上 | MHU44 | iPhone 17e | https://www.apple.com.cn/shop/buy-iphone/iphone-17e | |
| CN | 同上 | MXU93 | iPhone 16 和 iPhone 16 Plus | https://www.apple.com.cn/shop/buy-iphone/iphone-16 | |

- 抓入口的稳定选择器：`a[href*="/shop/buy-iphone/iphone"]`（两站相同）；US 卡片有 `data-part-number`，CN 卡片 `data-part-number` 是型号前缀（MG6W4）而不是 `IPHONE17_MAIN`。
- 列表页 **没有** `PRODUCT_SELECTION_BOOTSTRAP`；US 列表页卡片价在 `window.pageLevelData.slots[].cards` JSON 内（`fullPrice.raw.price`）。
- 最新一代 = iPhone 17 Pro / 17 Pro Max（同一定制页，用 dimensionScreensize 区分）、iPhone Air、iPhone 17、iPhone 17e。

## 2. 定制页维度（以 iPhone 17 为主，17 Pro 补充）

### 2a. US iPhone 17 全部 `input[type=radio]`（初始状态）
| name | value | label（初始/选中后） | 初始 disabled |
|---|---|---|---|
| dimensionColor | lavender / sage / mistblue / white / black | Lavender / Sage / Mist Blue / White / Black | false |
| dimensionCapacity | 256gb / 512gb | "256GB … Buy from $799 …" / "512GB … Buy from $999 …"（**注意 label 里的价是运营商价**） | true（选颜色后解锁） |
| tradeupinline | tradeIn / noTradeIn | Add a trade-in / No trade-in | true（选容量后解锁） |
| purchase_option_group | fullprice / finance / partnerowned | Buy / Finance（0% APR ACMI）/ Lease with Apple Upgrade（Klarna） | true（选 noTradeIn 后解锁） |
| carrierModel | ATT_IPHONE17 / TMOBILE_IPHONE17 / VERIZON_IPHONE17 / UNLOCKED/US | "AT&T $799.00 Includes $30 connectivity discount (requires carrier activation)" ×3 / "Connect to any carrier later $829.00" | true（选容量后解锁；与 tradeupinline 同时解锁） |
| applecare-options | on / on / on（**三个同 value，只能靠 id 或 label 区分**） | AppleCare+ with Theft and Loss / AppleCare One / No AppleCare coverage | true（选运营商后解锁） |
| dimensionPaymentType | SX3Y2LL/A-monthly / SX4L2LL/A-annually | AppleCare+ 月付 $11.99 / 年付 $119.99 | false |

`<select>`（3 个，全部属于以旧换新表单，不影响主价）：`name=model`（旧机型号 model_xxxx，含最高折抵额）、`name=memory`（memory_6=128GB…）、`name=product`（product_xxxx）。

### 2b. US iPhone 17 Pro 额外维度
- 多出 `dimensionScreensize`：`6_3inch`（iPhone 17 Pro）/ `6_9inch`（iPhone 17 Pro Max），是 Step 1；颜色 Step 2、容量 Step 3、运营商 Step 4。
- dimensionColor：silver / cosmicorange / deepblue；dimensionCapacity：256gb / 512gb / 1tb / 2tb（**2tb 只有 6_9inch 有**，bootstrap products 无 6_3inch+2tb 组合）。
- carrierModel value 带机型后缀：ATT_IPHONE17PRO 等；UNLOCKED/US 不变。Pro 的运营商 label 没有 "$30 connectivity discount" 字样，bootstrap 里 unlocked 价 = 卡片价（$1099），即 **$30 运营商折扣只出现在 iPhone 17（Pro 无）**，其他机型需逐一确认。

### 2c. CN iPhone 17 全部 radio
| name | value | label | 初始 disabled |
|---|---|---|---|
| dimensionColor | lavender / sage / mistblue / white / black | 薰衣草紫色 / 鼠尾草绿色 / 青雾蓝色 / 白色 / 黑色（value 与 US 相同，label 中文） | false |
| dimensionCapacity | 256gb / 512gb | "256GB 脚注 1 RMB 5999 起 或 RMB 250/月 (24 期) 起" | true |
| tradeupinline | tradeIn / noTradeIn | 选择智能手机 / 不折抵换购 | true |
| ad | 1 / 0 | Apple / 其他（以旧换新表单里"旧机品牌"，不影响价） | false |
| applecare-options | on / on | AppleCare+ 服务计划与 iPhone 年年焕新计划 / 不加 AppleCare+ 服务计划 | true |
- CN **没有** carrierModel、purchase_option_group、dimensionPaymentType；`<select>` 为 0 个。

### 2d. `window.PRODUCT_SELECTION_BOOTSTRAP`
两站都存在，结构 `{productSelectionData:{sections, displayValues, products, priceDisplayOrder, priceMessageFallback, imageDictionary, selectButtonText, labels, favoritesEnabled, energyComplianceDictionary}}`。原文已存 `iphone_bootstrap_us.json`（212 KB）/ `iphone_bootstrap_cn.json`（41 KB）。

与 Mac 页的差异：
- Mac 是 mainSections/configSections（芯片→内存→存储逐级解锁，价格靠差价累加）；iPhone 是 `sections`（US: dimensionColor, dimensionCapacity, carrierModel；CN: dimensionColor, dimensionCapacity），**每个成品 SKU 一条 `products` 记录**，直接带 partNumber 和价格 key。
- `products[i]`：`partNumber`（MG484LL/A / MG6W4CH/A）、`dimensionColor`、`dimensionCapacity`、（US）`carrierModel`、（Pro）`dimensionScreensize`、`fullPrice`（指向 `displayValues.prices` 的 key，如 `mg484ll_a_unlocked_us` / `mg734ch_a`）、`comingSoon`、`getReady`、`isCarrierDevice`。
- `displayValues.prices[key]`：`amountBeforeTradeIn`、`amountAfterTradeIn`（纯数字，**这就是最终售价**）、`currentDisplayPrice`（HTML）、`priceCurrency`（USD/CNY）、`carrierProduct`、`carrierFinancing`、`acmiPrice`。US iPhone 17：40 条 = 5 色 × 2 容量 × 4 carrierModel；CN：10 条 = 5 色 × 2 容量。
- 结论：**iPhone 全部 SKU 价格可以不点任何按钮、直接从 bootstrap 读出**（见 `us_bootstrap_price_table.txt`）。点选流程只作为核对手段。
- 其他内嵌变量（US）：PURCHASE_OPTIONS_BOOTSTRAP（api `/shop/api/purchase-options`）、summaryBootstrap、fulfillmentBootstrap、PRODUCT_AVAILABILITY_BOOTSTRAP、TRADEUP_INLINE_BOOTSTRAP（65 KB 以旧换新数据）、APPLECARE_BOOTSTRAP、BUYFLOW_MESSAGES_BOOTSTRAP。CN 少 PURCHASE_OPTIONS_BOOTSTRAP 与 BUYFLOW_MESSAGES_BOOTSTRAP。

## 3. 哪些维度影响价格

实测（页面总价 + bootstrap 双重证据）：
- **影响**：机型（页面/URL）、dimensionScreensize（Pro vs Pro Max：256GB $1099 vs $1199）、dimensionCapacity（iPhone 17: 256→512 +$200 / +RMB 2000）、**US 的 carrierModel**（iPhone 17 绑 AT&T/T-Mobile/Verizon $799，UNLOCKED/US $829，差 $30；17 Pro 无差）。
- **不影响**：dimensionColor（black 与 mistblue 同价，bootstrap 5 色同价）、tradeupinline（选 noTradeIn 只是解锁后续步骤）、purchase_option_group=fullprice（选后总价从 "Buy from $799 or $33.29/mo." 变为单一 "From $799.00"，数值不变）、AppleCare 选 "No AppleCare coverage" / "不加 AppleCare+ 服务计划"（总价不变；选 AppleCare+ 会加月费/年费，不进乘积）。
- US 拿「不绑运营商全价」的固定流程：`dimensionColor` → `dimensionCapacity` → `tradeupinline=noTradeIn` → `purchase_option_group=fullprice` → `carrierModel=UNLOCKED/US` → applecare-options 中 label 含 "No AppleCare" 的那个（按 id 点）。选完运营商后汇总区才出现 "One-time payment"、"Add to Bag"、"Ships: 3–5 business days"。
- 关键坑：切换颜色/容量后 **noTradeIn / fullprice / UNLOCKED/US 选择保持不变**（AFTERCAP 日志证实），不用每次重选；但首次进页面必须走一遍。
- CN 流程：`dimensionColor` → `dimensionCapacity` → `tradeupinline=noTradeIn` → applecare-options 中 label 含 "不加" 的那个。CN 无运营商步骤（页面 FAQ 就是"在 apple.com 购买不含 SIM 卡的 iPhone"），无付款方式单选（分期在结账），价格本身就是全价，无需绕。
- 注意 US 容量 label 上显示的 "Buy from $799" 是运营商价，不是 UNLOCKED 全价；bootstrap 用 `carrierModel=='UNLOCKED/US'` 过滤才是全价。

## 4. 汇总总价选择器

| 站点 | 选择器 | 说明 |
|---|---|---|
| US | `.rf-bfe-summary-price .as-price-currentprice` | 选完 carrierModel 后文本为纯 `$829.00`；之前是 "Buy from $799 or $33.29/mo. …" 复合文本。`.rc-prices-currentprice` 也可，页面有多处（sticky 头 + summary）但内容一致。 |
| CN | `.rc-prices-currentprice` （首个） | 文本 `RMB 5,999`；页面有 6 个（含 `RMB 250/月 (24 期)` 分期项），取第一个或过滤 `/^RMB [\d,]+$/`。US 的 `.rf-bfe-summary-price .as-price-currentprice` 在 CN 为 null；Mac 用的 `.rc-prices-fullprice .as-pricepoint-fullprice` 在 CN iPhone 页也为 null。 |
| 两站 | `.rf-bfe-summary` innerText | 含 "iPhone 17 256GB Black $829.00 One-time payment" / "iPhone 17 256GB 黑色 RMB 5,999 … 含增值税及其他法定税费：约 RMB 697"，适合做 row 的可读校验列。 |
| Mac 用的 `.rf-po-bfe-purchaseoptions-prices-content` | 两站 iPhone 页均为 null（Payment options 区块 class 为 `.rf-po-bfe-purchaseoptions-wrapper`，价格分散在各 radio label 里） |

- 延迟：点 label 后 ~2.2–2.5 s 再读即稳定（同 Mac）；未见需要更长等待。
- 是否要先点 Edit/编辑：**不需要**。US 页有 "EditPayment Options" / "Edit" 按钮、CN 有 "编辑"/"展开"，但所有 radio 在 DOM 中始终存在，`label[for]` 可直接 scrollIntoView+click；未遇到 Mac 那种折叠后 label 宽度为 0 的情况。

## 5. 小样本验证（见 `iphone_sample_rows.tsv`）
- US iPhone 17 UNLOCKED/US：black 256gb $829.00；black 512gb $1,029.00；mistblue 256gb $829.00；mistblue 512gb $1,029.00；对照 ATT 512gb $999.00（含 $30 折扣）。全部与 bootstrap `amountBeforeTradeIn` 一致。
- CN iPhone 17：black 256gb RMB 5,999；black 512gb RMB 7,999；mistblue 256gb RMB 5,999；mistblue 512gb RMB 7,999。与 bootstrap 一致。
- 方法：直接沿用 crawl_lib.js 的 `pick()`（scrollIntoView → click label → 校验 checked）+ `state()`，去掉 `expand()`；applecare 用 id 点。8 行全部一次点中（PICK … true）。

## 6. 预购 / 发售 / 限购提示文字（2026-09-05 页面原文）
- US 汇总区：`Ships: 3–5 business days` / `Free Shipping` / `Get delivery dates` / `Pickup: Check availability`；bootstrap 每个 product `comingSoon:false, getReady:false`（可作预购/未上市标志位）。
- US 脚注 ※：`Pricing for iPhone 17 includes a $30 AT&T, T-Mobile, or Verizon discount. Requires activation with carrier.`
- US 脚注 #：`Pricing for iPhone 17 includes a $30 connectivity discount that requires carrier activation with AT&T, T-Mobile, or Verizon. Financing available … Apple Card Monthly Installments (ACMI) … An iPhone purchased with ACMI is always unlocked …`
- US 列表页 ribbon：`Get up to $205–$720 in credit toward iPhone 17, iPhone Air, or iPhone 17 Pro when you trade in iPhone 13 or higher.`；`Introducing Apple Upgrade. Lease a new iPhone with low monthly payments for 12 or 24 months …`
- CN 汇总区：`预计发货日期： 3-5 个工作日` / `免费送货` / `取货： 查看供货情况`；`含增值税及其他法定税费：约 RMB 697`（256GB）/ `约 RMB 927`（512GB）脚注 ◊◊ "为近似值。金额可能随时间变动。"
- CN 列表页 ribbon：`用 iPhone 13 或后续机型来换购 iPhone 17、iPhone Air 或 iPhone 17 Pro，预计可享 RMB 950 至 RMB 5250 的折抵优惠`；`入手指定新款 iPhone 时加购 AppleCare+ 服务计划 … 购机后 3 至 15 个月内即可升级下一部 iPhone`（年年焕新）。
- CN 其他：`为预计时间，实际发货和送货时间可能根据你选择的付款方式、完成付款时间和产品存货状况而有所变化。`；脚注 8：`在中国大陆仅支持激活型号 A3518 和 A3635 (eSIM)`。
- **两站均未发现限购（每位顾客限购 N 台）文字**；未发现 "Pre-order/预购" 字样（iPhone 17 系列已正常发售）。

## 与 Mac 页面的差异点 / 坑 小结
1. 无逐级解锁的芯片/内存维度，价格不是差价累加，而是 SKU 表；bootstrap 直接给出全部 SKU 价格。
2. US 多了运营商步骤，且容量 label 与卡片"起价"都是绑运营商价；全价必须选 UNLOCKED/US（iPhone 17 差 $30，Pro 不差）。
3. US 多了 tradeupinline / purchase_option_group / applecare 三道门，不选完不出现最终 "One-time payment" 价；CN 只有 tradeupinline + applecare。
4. `applecare-options` 三个 radio 同 value="on"，`pick(name,value)` 会取到第一个，必须按 label/id 选。
5. 总价选择器与 Mac 不同：US `.rf-bfe-summary-price .as-price-currentprice`，CN `.rc-prices-currentprice`；Mac 的两个选择器在 iPhone 页都为 null。
6. 不需要 expand()/Edit。
7. 17 Pro 页面把 Pro 与 Pro Max 合并为 `dimensionScreensize`，2TB 仅 Pro Max。

## iPhone 抓取要点（可直接放进 skill 参考文档）
1. 入口：打开 `https://www.apple.com{,.cn}/shop/buy-iphone`，取 `a[href*="/shop/buy-iphone/iphone"]` 的 href 去重，得最新一代定制页（当前：iphone-17-pro、iphone-air、iphone-17、iphone-17e；iphone-16 为上代）。
2. 首选方案（零点击）：打开定制页，等 ~4 s，读 `JSON.stringify(window.PRODUCT_SELECTION_BOOTSTRAP)`；遍历 `productSelectionData.products`，US 只保留 `carrierModel==='UNLOCKED/US'`（CN 无此字段），价格 = `displayValues.prices[p.fullPrice].amountBeforeTradeIn`，货币 = `priceCurrency`。输出列：partNumber、dimensionScreensize（如有）、dimensionColor、dimensionCapacity、carrierModel、amount、comingSoon/getReady。
3. 校验方案（点选）：每个机型每个容量 × 1 个颜色走一遍流程读页面总价，与 bootstrap 对账。US：color → capacity → tradeupinline=noTradeIn → purchase_option_group=fullprice → carrierModel=UNLOCKED/US → applecare "No AppleCare"（按 label 找 id）；读 `.rf-bfe-summary-price .as-price-currentprice`。CN：color → capacity → noTradeIn → "不加 AppleCare+"；读第一个 `.rc-prices-currentprice`。切换颜色/容量后后续步骤保持，不需重选。
4. 颜色不影响价格：只需在 1 个机型上验证一次；主表以 bootstrap 为准仍然逐 SKU 输出（含颜色），便于对账。
5. 记录每页 `.rf-bfe-summary` innerText（发货时效、含税提示）与 `comingSoon/getReady` 标志到 notes。
6. 不要用 Mac 的 `.rf-po-bfe-purchaseoptions-prices-content` / `.rc-prices-fullprice .as-pricepoint-fullprice`（iPhone 页为 null）；不要用容量 label 上的 "Buy from $" 当全价。
