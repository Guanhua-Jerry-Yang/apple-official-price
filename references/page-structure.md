# Apple 官网定制购买页 — DOM 与数据结构事实（Mac 系列）

验证日期 2026-09-04/05，站点：apple.com（US）、apple.com.cn（CN）、apple.com/sg（SG）。三站是同一套 React 购买流，radio 的 `name`/`value` 完全一致，只有文案、货币和汇总价元素不同。iPhone 见 `iphone.md`，iPad 见 `ipad.md`，新加坡站差异见 `storefront-singapore.md`。

## 1. 内嵌配置数据 `window.PRODUCT_SELECTION_BOOTSTRAP`

每个定制页都有，`productSelectionData` 下：

| 字段 | 作用 |
|---|---|
| `mainSections[]` | 主维度顺序：尺寸、颜色、显示屏玻璃、芯片家族（`sectionType: NESTED`，`childDimension` 指向核心档）等。`priceDelta` 只表示「选项旁是否显示差价」，**不能**用来判断该维度是否影响价格（尺寸 priceDelta=false 但影响价格） |
| `configSections[]` | 定制项：`customizableSpecs`（GROUPED_COLLAPSED，items = 内存、存储、电源、键盘）、预装软件 |
| `products[]` | 每个「主维度组合」一条：`dimensions`（尺寸/颜色/芯片/核心档/玻璃）、`priceKey`、`productConfiguration`（各部件 065-xxxx 料号）、`isComingSoon` |
| `mainDisplayValues.prices[priceKey]` | 该主维度组合的**基础价**（`amount` / `currentPrice.raw_amount`）。颜色变体各有自己的 priceKey 但 amount 相同 → 判断某维度是否影响价格要比较 amount，不能比较 priceKey |
| `configDisplayValues[dim]` | 定制项各取值的显示名与 `variantOrder`（内存/存储差价**不在** bootstrap 里，只能点选后读 label） |

用途：开工先 dump 它，据此决定要遍历哪些维度、固定哪些、哪些作附加项；结束后用它的基础价核对加法。`scripts/crawl_model.js` 的 planOnly 模式就是做这件事。

## 2. Radio 命名（三站一致）

| 维度 | radio name | 说明 |
|---|---|---|
| 屏幕尺寸 | `chassis-dimensionScreensize` | 13inch/15inch（Air）、14inch/16inch（Pro）；同页 radio，不是独立 URL；选中配置会同步进 URL slug |
| 颜色 | `chassis-dimensionColor` | 不改价；MacBook Air 必须先选颜色核心档才出现 |
| 显示屏玻璃 | `display-dimensionFinish` | standard / nano_texture，MacBook Pro 有，+$150 / +¥1,125 恒定 → 作附加项 |
| 芯片家族 | `processor-dimensionChip` | m6 / m5pro / m5max…（Mac mini、MacBook Pro）；MacBook Air 没有这一级 |
| 核心档 | `<家族值>-processor-dimensionChip-cpuCoreCount-gpuCoreCount` | **name 带家族前缀**（如 `m5pro-processor-…`），选家族后才出现；单档家族（M6）自动勾选。MacBook Air 是 `processor-cpuCoreCount-gpuCoreCount`（无前缀） |
| 内存 | `memory-dimensionMemory` | 16gb/24gb/… 按芯片档解锁，不可选的 disabled；另有「See pricing and changes / 查看价格和变化」按钮表示需换芯片才可选，不是 radio |
| 存储 | `storage-dimensionCapacity` | 256gb/512gb/1tb/2tb/4tb/8tb |
| 以太网 | `ethernet_adapter-ethernetBandwidth` | 2_5gb_per_second / 10gb_per_second（Mac mini） |
| 电源适配器 | `power_adapter-wattage` | 40w/35w/70w（Air）、70w/96w（Pro 部分档），+$20 / +¥120 恒定 → 附加项；固定瓦数的档位没有 radio |
| 键盘 | `keyboard-localizationCode` | 是 `<select>` 不是 radio，不改价 → 跳过 |
| 预装软件 | `software_final-preInstalledSoftware` / `software_logic-…` | none / final_cut_pro / logic_pro；CN、SG 页渲染，US 部分页面不渲染（DOM 里没有）→ 附加项 |
| 流程门 | `tradeupinline`、`purchase_option_group`、`applecare-*` | 以旧换新 / 付款方式 / AppleCare，不改机器价 → 跳过 |

## 3. 逐级解锁与折叠卡片

- 顺序：尺寸 → 颜色 → 芯片家族 → 核心档 → 内存 → 存储 → 其他。上游未选时下游 radio `disabled=true`。
- 切换芯片档后，内存 radio 会**短暂全部 disabled**（约 1 s），立刻读会得到空列表，要重试等待。
- MacBook Air / Pro 的内存、存储、电源、键盘在「Customizations / 定制」折叠卡片里：radio 在 DOM 中存在但 label 宽高为 0，点它**静默无效**（第一次抓 MacBook Pro 就因此写出一堆重复基础价）。必须先点卡片的编辑按钮：`button[data-autom="edit-<radioName>"]`（最稳），文字 `Edit Unified Memory` / `Edit SSD Storage` / `Edit Power Adapter` / `编辑 内存`，class `re-configure-card-edit-button` / `.re-configure-card-change-button`。摘要栏另有一个泛用 `Edit`（`summary-view-edit-link`）会导航，不能用 `^Edit` 泛匹配。
- Mac mini 无折叠卡片；SG Mac mini 选芯片后内存/存储/以太网都是**未勾选**态，要显式点第一项。
- 自动跳档：MacBook Air 13" 10 核 CPU/8 核 GPU 档只有 16GB/512GB，点 24GB 或 1TB 会自动切到 10/10 档。脚本要在每次点选后校验上游选择是否还在，变了就记为 drift。

## 4. 汇总总价元素

| 站 | 选择器 | 文本 |
|---|---|---|
| US | `.rf-po-bfe-purchaseoptions-prices-content`（Buy/Finance 区块） | `$1,299.00` |
| SG | `[data-autom="summaryPrice"]` / `.rf-bfe-summary-price` | `S$1,299.00`；芯片未选时 `From S$1,299` 不是有效总价 |
| CN | `.rc-prices-fullprice .as-pricepoint-fullprice` | `RMB 12,999`；选了预装软件后元素变成 `.rc-prices-currentprice` |
| CN/SG 陷阱 | `.rc-prices-fullprice` 在 SG 页是芯片卡片的 From 价，不是汇总价 | |

`.rf-bfe-summary-price` 全文可能带分期尾巴（`RMB 9999 或 RMB 417/月 (24 期) 起`、`$899 or $74.91/mo.`），取金额时截掉「或/or」之后。`crawl_lib.js` 的 `readTotal()` 按上述顺序兜底并做了截断。

## 5. 差价标签与价格更新

- label 文本：`24GB + $200.00` / `+ RMB 1,500` / `+ S$300.00` / `Included` / `已含`；负差价的减号是 U+2212 `−`。差价是**相对当前已选项**，不是相对基础配置——换到高档后低档显示 `− $600.00`。加法核对以基础配置为基准重新推导。
- 点选后总价更新有 1～3 s 延迟；读早了会拿到上一配置的价（三次抓取各出现过 1 次脏读）。`pickPriced()` 轮询到总价变化且连续两次一致才返回。加法核对不过的行必须复测一次再定性。

## 6. 各机型已知维度（2026-09）

| 机型 | 主维度 | 内存档 | 存储档 | 附加项 | 组合数（每站） |
|---|---|---|---|---|---|
| Mac mini | 芯片 M6 / M5 Pro 15-16 / 18-20 | M6: 16/24/32；Pro: 24/48/64 | M6: 256G–2T；Pro: 512G–8T | 10Gb 以太网（进乘积，+$100/¥750/S$150）、预装软件 | 84 |
| MacBook Air | 13/15 英寸 × M5 10-8（仅 13"，仅 16/512）/ 10-10 | 16/24/32 | 512G–4T | 电源 35W/70W +$20；预装软件 | 25 |
| MacBook Pro | 14/16 英寸 × M5 / M5 Pro 15-16 / 18-20 / M5 Max 18-32 / 18-40（16" 无 M5、无 Pro 15-16） | 按档 16–128GB；Max 18-32 仅 36GB | Pro/M5: 1–4T；Max: 2–8T；无 512G | 纳米纹理 +$150/¥1,125；96W 电源 +$20（仅 14" 低档）；预装软件 | 57 |

定价异常（两站一致，已复测）：MacBook Air 13" 10-10 档只有 16GB/512GB 标配比 10-8 档贵（+$100 / +¥750），任何升配后该溢价消失。这是页面真实定价，进「定价异常」说明，不是抓取错误。
