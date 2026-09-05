---
name: apple-official-price
description: 去 Apple 官网（美国 apple.com、中国大陆 apple.com.cn、新加坡 apple.com/sg，可扩展其他地区）的定制购买页，把指定机型（Mac mini / MacBook Air / MacBook Pro / iMac / Mac Studio / iPhone / iPad）所有影响价格的配置组合逐个点选或从页面内嵌数据读取，拿到每个组合的官网价，核对后写进一个持续追加的 Excel 总表（各地区价、含税价、折算 RMB、差额、溢价 %、附加项差价、说明与假设）。只要用户提到「苹果官网价格 / Apple 报价 / Mac mini、MacBook、iMac、iPhone、iPad 各配置多少钱 / 中美（新）差价 / 哪里买划算 / 更新 Apple 价格表 / 再加一个机型」，即使没说「Excel」「表格」「对比」，也用本 skill。不用于结账下单、教育商店、翻新机、第三方渠道价格。
---

# Apple Official Price

目的：用可复现的方式拿到 Apple 官网各机型**全部配置**的官方标价，跨地区对比，落成一份格式固定、公式联动的 Excel 总表。全程只用 ego-browser（独立 task space，不动用户的 Chrome），不下单、不加购物袋。

## 0. 三条底线

1. **价格只认页面汇总价或页面内嵌 bootstrap**，不用列表页「起价」、不用容量 label 上的运营商价、不推算。每行都要能回溯到一次页面读取。
2. **每个组合都核对**：Mac 类 总价 = 档基础价 + 各项差价；iPhone/iPad 类 点选值 = bootstrap 值。核对不过的行复测一次再定性（脏读 vs 真实定价特例）。
3. **口径写清楚**：美国不含税、中国含增值税、新加坡含 GST；汇率是占位值。都在「说明与假设」sheet 里，可改、全表联动。

## 1. 确认范围（不要为此反问，能默认就默认，交付时声明）

| 项 | 默认 | 用户可能改 |
|---|---|---|
| 机型 | 用户点名的；说「新款 / 最新」就以列表页为准 | 多个机型并行 |
| 地区 | 美国 + 中国大陆 + 新加坡 | 去掉某站、加 HK/JP/UK（`build_workbook.py` 已有默认口径，抓取方法同 SG） |
| 美国税 | MA 州 6.25% | 其他州：改「说明与假设」D4 并注明 |
| 汇率 | 占位 7.10 / 5.50 | 用户给实时值就填 E 列 |
| 输出 | 追加到 `~/Documents/CC/Apple_Official_Price/Apple_Official_Price.xlsx` | 用户指定其他文件 |
| 维度 | 尺寸/芯片/内存/存储/以太网进乘积；纳米纹理、电源、预装软件、底座、鼠标/触控板、键盘形态作附加项；颜色/键盘布局验证不改价后固定 | 「玻璃也要进表」→ `addonDefaults:false` + 显式 `addonDims` |

## 2. 流程

### 2.1 读结构，定计划
每个（机型 × 站点）先跑 planOnly（命令见 `references/crawl-method.md` §0）。看 `<out>_plan.json`：
- `iterate` 里是 尺寸→芯片→核心档→内存→存储 这一串 → Mac 路线（2.2）。
- `iterate` 为空或只有颜色/容量、`products[]` 每条带 `fullPrice` → SKU 路线（2.3）。
- `unknown` 非空 → 打开 `references/page-structure.md` 对照，必要时用 `dims` / `fix` / `skipDims` 手动指定。

### 2.2 Mac 路线：点选遍历
- 用 `scripts/run_crawl.sh cfg.json` 跑全量，行即时落盘，可 resume。>60 行或层级深的机型用 `run_in_background` 或 `only` 分块（Bash 单次 10 分钟上限）。
- **多个（机型 × 站点）并行**：每个一个子 agent（general-purpose），各自独立 `space`/`out`，prompt 给：URL、space 名、out 前缀、`references/crawl-method.md` 路径、要产出的文件；不要让子 agent 自己发明点选方法。子 agent ≤ 4 个同时跑。
- 跑完 `scripts/verify_additivity.py` 核对；MISMATCH 行按手册 §2 复测。
- `<out>_addons.tsv` 给附加项差价；`<out>_notes.md` 给预购/发售/限购/含税文案。

### 2.3 iPhone / iPad 路线：读 bootstrap
- `scripts/bootstrap_skus.py <out>_structure.json --out <out>_rows.tsv`：全部 SKU 及价格，US iPhone 自动只留 `UNLOCKED/US`（不绑运营商全价）。
- 再按 `references/iphone.md` / `references/ipad.md` 的固定流程点选 2～4 个 SKU 读页面总价核对（AppleCare 三个 radio 同 value，按 label 选「No AppleCare / 不加」）。
- 颜色不改价：sheet 维度用 尺寸×容量（×连接方式），说明里注明「各色同价」。

### 2.4 合表
- 写 spec.json（模板见 `references/workbook-spec.md`），`scripts/build_workbook.py spec.json`。`workbook` 默认总表路径，用户指定或测试运行时可换任意路径。同机型重抓会替换该 sheet，其他 sheet 不动，「说明与假设」追加一段记录。
- `keys[].map` 把 radio 值翻成可读名（`m5pro-15-16` → `M5 Pro（15核CPU/16核GPU）`；核数从 bootstrap `mainDisplayValues` 的 header 里取）。
- 定价异常、未抓到项（如 US 页未渲染预装软件）写进 spec 的 `anomalies` / `notes`。

### 2.5 交付
- 有人在场时 `open -a "Microsoft Excel" <xlsx>`；无人值守 / 评测运行不要 open（不要只 `open`：Quick Look 预览会显示缓存的旧版本且不一定显示所有 sheet，用户曾因此以为数据丢了）。
- 汇报：各机型组合数、价格区间、相对基准地区的溢价区间、定价异常、未抓到项、口径与汇率假设。数字用表格，不写进句子。

## 3. 文件

```
scripts/
  run_crawl.sh          cfg.json → ego-browser 跑 crawl_model.js（配置以 const CFG 前缀拼入，Node 收不到环境变量）
  crawl_lib.js          点选/读价/展开折叠卡/等待稳定/写文件 通用函数（三站通用）
  crawl_model.js        自动识别维度 → 笛卡尔遍历 → 附加项差价 → notes；支持 planOnly / only / limit / resume
  bootstrap_skus.py     从 <out>_structure.json 读全部 SKU 价（iPhone/iPad），或 Mac 各档基础价
  verify_additivity.py  加法核对，列出不符行
  build_workbook.py     新建/替换 sheet，多地区列、公式、说明与假设
references/
  crawl-method.md       抓取操作手册（给子 agent），含 12 条已踩过的坑
  page-structure.md     Mac 定制页 DOM/bootstrap 事实、radio 命名、总价选择器、各机型已知维度
  iphone.md             iPhone 页结构、US 运营商门控、SKU 定价、核对流程
  ipad.md               iPad 页结构与抓取要点
  storefront-singapore.md  新加坡站差异（选择器、GST、Edit 按钮）
  models.md             各机型 URL、维度、组合数、space/out 命名约定
  workbook-spec.md      Excel 列/公式/样式规范与 spec.json 模板
```

## 4. 常见判断

- 「找不到某维度 / 全 disabled」：先看是不是上游没选（颜色 → 核心档、芯片 → 内存），再看是不是折叠卡没展开，最后才怀疑页面改版。
- 页面改版（radio 命名变了、总价选择器失效）：用手册 §4 的手动 heredoc 打印 `getState()` 看现状，修 `crawl_lib.js` 的选择器列表，并把新事实写回 `page-structure.md`。
- 用户只要一个站：regions 只放一个，对比列自然不生成。
- 用户要教育价 / 翻新机：不在范围，说明后给官网对应入口即可。
