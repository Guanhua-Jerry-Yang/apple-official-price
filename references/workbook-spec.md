# Excel 输出规范

一个总表持续追加：默认 `~/Documents/CC/Apple_Official_Price/Apple_Official_Price.xlsx`。每个机型一个 sheet；重抓同机型时**替换**该 sheet（`build_workbook.py` 自动删旧建新），「说明与假设」sheet 追加一段抓取记录。

## Sheet 结构

| Sheet | 内容 |
|---|---|
| `<机型> 对比` | 每个价格组合一行，见下 |
| `说明与假设` | 固定在最后。第 3–9 行是地区表（US/CN/SG/HK/JP/UK）：货币、官网价是否含税、税率、汇率（黄色可编辑）。第 11 行起是每次抓取的来源 URL、日期、说明、定价异常、方法 |

## 「对比」sheet 列

`序号 | 维度列… | 每个地区一组 | 差额与溢价`

- 维度列：尺寸、芯片、内存、存储、（以太网）——显示名由 spec 的 `keys[].map` 决定，未映射的原值直接显示（16gb、1tb）。
- 每个地区一组：`<地区>官网价 (货币)`；不含税地区（US）多一列 `<地区>含税价`；非 CN 地区多一列 `<地区>折算 (RMB)`。
- 对比列：以 `reference` 地区（默认 CN）为基准，对其他每个地区各两列：`差额 中国大陆−<地区> (RMB)`、`中国大陆相对<地区>溢价 %`。
- 某地区没有该组合：官网价格单元格写「<地区>无此配置」，对比列留空。
- 表下方「附加项差价」小表：附加项名 + 各地区差价 + 备注；没取到的写「未取到」。

## 公式（全部引用「说明与假设」地区表，不写死）

| 列 | 公式 |
|---|---|
| 含税价 | `= 官网价 × (1 + '说明与假设'!$D$<地区行>)` |
| 折算 RMB | `= 含税价（或含税地区的官网价）× '说明与假设'!$E$<地区行>` |
| 差额 | `= 基准地区 RMB − 该地区折算 RMB` |
| 溢价 % | `= IF(该地区折算=0, 0, 差额 / 该地区折算)` |

地区行固定：US=4、CN=5、SG=6、HK=7、JP=8、UK=9。工作簿以 `fullCalcOnLoad` 保存，Excel 打开即算（本机无 LibreOffice 不能预算值，不要为此装软件）。

## 口径默认值（可在地区表改）

| 地区 | 含税 | 税率 | 汇率占位 |
|---|---|---|---|
| US | 否 | 6.25%（MA 州，州统一税率，电脑应税） | 7.10 |
| CN | 是（13% 增值税） | — | 1 |
| SG | 是（9% GST） | — | 5.50 |

汇率是占位估算，不抓实时汇率；交付时提醒用户改 E 列。

## 样式

Arial；表头深蓝底白字、冻结首行与维度列、自动筛选；按前两个维度取值交替底色；金额格式 `"$"#,##0` / `¥#,##0` / `"S$"#,##0`，差额负数加括号，溢价 `0.0%`。表头批注写明每列口径。

## spec.json 示例

```json
{
  "workbook": "/Users/gyang/Documents/CC/Apple_Official_Price/Apple_Official_Price.xlsx",
  "sheet": "MacBook Pro 对比", "model": "MacBook Pro", "crawl_date": "2026-09-05",
  "keys": [
    {"col": "chassis-dimensionScreensize", "name": "尺寸", "map": {"14inch": "14 英寸", "16inch": "16 英寸"}, "width": 10},
    {"col": "processor-dimensionChip-cpuCoreCount-gpuCoreCount", "name": "芯片",
     "map": {"m5-10-10": "M5（10核CPU/10核GPU）", "m5pro-15-16": "M5 Pro（15核CPU/16核GPU）"}, "width": 26},
    {"col": "memory-dimensionMemory", "name": "内存", "width": 8},
    {"col": "storage-dimensionCapacity", "name": "存储", "width": 8}
  ],
  "regions": [
    {"code": "US", "tsv": ".../mbp_us_rows.tsv", "url": "https://www.apple.com/shop/buy-mac/macbook-pro"},
    {"code": "CN", "tsv": ".../mbp_cn_rows.tsv", "url": "https://www.apple.com.cn/shop/buy-mac/macbook-pro"},
    {"code": "SG", "tsv": ".../mbp_sg_rows.tsv", "url": "https://www.apple.com/sg/shop/buy-mac/macbook-pro"}
  ],
  "reference": "CN",
  "addons": [{"name": "Nano-texture 纳米纹理显示屏", "US": 150, "CN": 1125, "SG": 225, "note": "各站在 3 个基础配置上验证恒定"}],
  "notes": ["在售现货，页面无预购/发售日期文案"],
  "anomalies": []
}
```

`keys[].col` 可以是 `{"US": "core", "CN": "tier"}` 形式，用于各站 TSV 列名不一致的情况；用 `crawl_model.js` 产出的 TSV 列名就是 radio name，各站一致，直接写字符串。
