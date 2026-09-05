# 抓取操作手册（给执行抓取的 agent / 子 agent）

目标：拿到一个机型在一个站点上**所有影响价格的配置组合**的页面汇总价，写成 TSV，并核对无误。工具只用 ego-browser（`ego-browser nodejs`），每个（机型 × 站点）一个独立 task space。

## 0. 先读结构，再决定怎么抓

```bash
S=~/.claude/skills/apple-official-price/scripts
cat > cfg.json <<EOF
{"url":"https://www.apple.com/shop/buy-mac/macbook-pro","space":"aop-mbp-us","out":"$OUT/mbp_us","planOnly":true}
EOF
$S/run_crawl.sh cfg.json
```

产出 `<out>_plan.json`（自动识别：`iterate` 要遍历的维度、`fixed` 固定值、`addons` 附加项、`unknown` 没认出来的、`notRendered` bootstrap 声明但页面没渲染的）、`<out>_structure.json`（bootstrap 原文）、`<out>_notes.md`（页面上的预购/发售/限购/含税文案）。

看一眼 plan 是否合理：
- `iterate` 应是 尺寸 → 芯片家族 → 核心档 → 内存 → 存储 →（以太网）这一串。颜色应在 `fixed`。
- 纳米纹理玻璃、电源适配器、预装软件、底座、鼠标/触控板、键盘形态默认在 `addons`（只测差价，不进乘积）。`addonDims` 是**追加**到默认列表；要把某个默认附加项放进乘积（如「玻璃也进表」）用 `"addonDefaults": false` 再显式写全 `addonDims`。
- 某档不渲染的维度（iMac 10 核档标配千兆网口，没有以太网 radio）会记 INFO 并把该列留空；合表时用 `"map": {"": "标配"}` 翻成可读值。
- `<out>_unavailable.tsv` 记录见过但 disabled 的选项（如 32GB「暂无供应」），`<out>_notes.md` 末尾列出 bootstrap 声明过却从未出现在行里的取值。
- iPhone / iPad 这类 SKU 定价页 `iterate` 会是空或只有颜色/容量：不要点选遍历，改用 `bootstrap_skus.py <out>_structure.json` 直接读全部 SKU 价（见 `iphone.md`、`ipad.md`），再挑 2～4 个 SKU 点选核对。

## 1. 全量遍历

```bash
cat > cfg.json <<EOF
{"url":"...","space":"aop-mbp-us","out":"$OUT/mbp_us","close":true}
EOF
$S/run_crawl.sh cfg.json 2>&1 | tail -3      # 单次 Bash 上限 10 分钟：>60 行的机型用 run_in_background，或按下面分块
```

- 每读到一行就追加进 `<out>_rows.tsv`，重跑自动跳过已有行（resume）。
- 分块：`"only":{"chassis-dimensionScreensize":["14inch"]}` 只跑 14 英寸；`"limit":30` 跑 30 行就停。分块时 `close` 留 false，最后一块再 true。
- 速度约 3～5 s 一行：Mac mini 84 行 ≈ 6 min，MacBook Pro 57 行 ≈ 8 min（层级多）。
- 日志 `<out>_log.txt`：每次运行以 `=== run start ===` 分隔，结束行是 `plan done (planOnly)` 或 `crawl done`；`WARN` 是点选失败，`INFO dimension not rendered` 是该档无此维度（正常），`DRIFT` 是点选后上游自动跳档（如 MacBook Air 10-8 档点 24GB 跳到 10-10，该行按实际配置记录并标 drift=1，合表时忽略）。
- 多个机型/站点并行：每个 cfg 不同 `space` 与 `out`，可同时起多个 `run_crawl.sh`（共用一个 ego-browser，互不干扰）。子 agent 也是这样分：一个子 agent 管一个（机型 × 站点），prompt 里给 URL、space 名、out 前缀、本手册路径即可，不要让它自己发明点选方法。

## 2. 核对

```bash
python3 $S/verify_additivity.py $OUT/mbp_us_rows.tsv --out $OUT/mbp_us_check.md
```

- 规则：总价 = 该档基础价 + 内存差价 + 存储差价（+ 以太网差价）。基础价应等于 `<out>_plan.json` 里 `basePrices` 对应 priceKey 的数。
- 报 MISMATCH 的行：用 `only` 限定到该组合重跑一次（先删掉 rows.tsv 里那行）。复测仍不符 → 是真实定价特例，写进「定价异常」；复测变了 → 原来是脏读，以复测为准。
- 组合数应与 bootstrap 推算一致：Σ各档（可选内存数 × 可选存储数 × 其他维度数）。

## 3. 附加项与不改价维度

- 脚本在遍历结束后自动在最后一个配置上逐个点 `addons` 里的每个值、记录差价到 `<out>_addons.tsv`；差价理论上恒定，若要更稳可在第一个基础配置上再点一遍对照。
- 颜色、键盘：plan 自动固定；如需证据，在一个配置上切换一次颜色、确认总价不变即可，不必遍历。

## 4. 手动 heredoc 兜底

脚本搞不定的页面（新结构、特殊门控），直接写 heredoc 调用同一套函数：

```bash
{ echo 'const CFG={};'; cat $S/crawl_lib.js; cat <<'EOF'
const task = await useOrCreateTaskSpace('aop-debug')
await openOrReuseTab('https://www.apple.com/shop/buy-mac/mac-studio', { wait: true, timeout: 45 })
const st = await getState()
cliLog(JSON.stringify(st.radios.map(r => [r.name, r.value, r.disabled, r.label.slice(0, 40)]), null, 0))
cliLog(await readTotal())
await pick('processor-dimensionChip', 'm5max'); cliLog(await waitTotalStable(null))
EOF
} | ego-browser nodejs
```

可用函数：`getState()`、`values(st,name)`、`checkedValue(st,name)`、`labelOf(st,name,val)`、`expandFor(name)`、`pick(name,val)`、`pickPriced(name,val)`、`readTotal()`、`waitTotalStable(prev)`、`readBootstrap()`、`readNotes()`、`parseAmount(raw)`、`detectRegion(url)`、`appendLine(file,line)`。

## 5. 已踩过的坑（每条都真实发生过）

1. 折叠卡片里的 label 宽度为 0，点了没反应也不报错 → `pick()` 前自动 `expandFor()`；手写时先点 `button[data-autom="edit-<name>"]`。
2. 切芯片后内存 radio 短暂全 disabled → 读值前重试等待（脚本已做）。
3. 总价更新延迟导致脏读 → 轮询到变化并稳定再读；核对不过必复测。
4. 三个 AppleCare radio 同 `value="on"`（iPhone）→ 按 label 找 id 点，不能按 value。
5. US iPhone 容量 label 与卡片「Buy from」价是绑运营商价，全价要选 `carrierModel=UNLOCKED/US`。
6. 摘要栏泛用「Edit」链接会导航离开 → 只匹配「Edit <名词>」/`data-autom^=edit-`。
7. CN 选了预装软件后总价元素 class 变化 → `readTotal()` 多选择器兜底。
8. heredoc 内 `require()` 与 top-level await 冲突 → 用 `import fs from 'fs'`（crawl_lib.js 已 import）。
9. ego-browser 的 Node 进程收不到环境变量 → 配置以 `const CFG = {...}` 前缀拼进脚本（run_crawl.sh 已处理）。
10. 页面会记住上次选择（同 task space 复用 tab）→ 每次遍历都显式点选全部维度，不依赖初始态。
11. 单个 Bash 调用最长 10 分钟 → 大机型用 `run_in_background` 或 `only`/`limit` 分块，靠 resume 续跑。
12. web-access 的 CDP proxy 需要 Chrome 授权弹窗，无人值守会卡死 → 本 skill 只用 ego-browser。
