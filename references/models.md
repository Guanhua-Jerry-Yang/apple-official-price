# 机型入口与已知规模（2026-09-05）

URL 规律：美国 `https://www.apple.com/shop/…`，中国大陆 `https://www.apple.com.cn/shop/…`，新加坡 `https://www.apple.com/sg/shop/…`（其他地区同理：`/hk/`、`/jp/`、`/uk/`；教育站 `/sg-edu/shop/`）。列表页 `/shop/buy-mac`、`/shop/buy-iphone`、`/shop/buy-ipad` 没有 bootstrap，只有定制页有。最新一代机型以列表页为准：`a[href*="/shop/buy-iphone/iphone"]` 之类取 href 去重。

## Mac（差价累加定价 → `crawl_model.js` 点选遍历）

| 机型 | 路径 | 主维度 | 2026-09 组合数/站 | 附加项 | 备注 |
|---|---|---|---|---|---|
| Mac mini | `buy-mac/mac-mini` | 芯片 M6 / M5 Pro 15-16 / 18-20 → 内存 → 存储 → 以太网 | 84 | 预装软件 | 2026-09 预购，9/22 发售，CN/SG 限购 2 台 |
| MacBook Air | `buy-mac/macbook-air` | 13/15 英寸 → 颜色（不改价）→ M5 10-8 / 10-10 → 内存 → 存储 | 25 | 电源 35W/70W、预装软件 | 10-8 档仅 16GB/512GB；定价异常见 page-structure.md |
| MacBook Pro | `buy-mac/macbook-pro` | 14/16 英寸 → 颜色 → 玻璃 → M5 / M5 Pro ×2 / M5 Max ×2 → 内存 → 存储 | 57 | 纳米纹理、96W 电源、预装软件 | 16" 无 M5 与 Pro 15-16；无 512GB |
| iMac | `buy-mac/imac` | 未抓过；预计 颜色 → 芯片档 → 内存 → 存储 → 以太网/配件 | — | 纳米纹理?、鼠标/触控板 | 先 planOnly 看结构 |
| Mac Studio | `buy-mac/mac-studio` | 未抓过；预计 芯片 Max/Ultra 档 → 内存 → 存储 | — | — | 先 planOnly |
| Mac Pro | `buy-mac/mac-pro` | 未抓过 | — | — | 在售状态先确认 |

## iPhone（SKU 定价 → `bootstrap_skus.py` 直接读，点选只校验）

| 机型 | 路径 | 维度 | 备注 |
|---|---|---|---|
| iPhone 17 Pro / Pro Max | `buy-iphone/iphone-17-pro` | `dimensionScreensize` 6_3inch/6_9inch → 颜色 → 容量 256g–2T（2T 仅 Pro Max） | US 无运营商折扣 |
| iPhone Air | `buy-iphone/iphone-air` | 颜色 → 容量 | 未验证折扣 |
| iPhone 17 | `buy-iphone/iphone-17` | 颜色 → 容量 256g/512g | US 绑运营商 −$30；全价选 `carrierModel=UNLOCKED/US` |
| iPhone 17e | `buy-iphone/iphone-17e` | 颜色 → 容量 | 未验证折扣 |
| iPhone 16 / 16 Plus | `buy-iphone/iphone-16` | 上代仍在售 | |

US 页 bootstrap 每 SKU × 4 个 carrierModel 各一条，只保留 UNLOCKED/US；CN、SG 无运营商维度。详见 `iphone.md`。

## iPad（SKU 定价 → `bootstrap_skus.py` 直接读，点选只校验）

| 机型 | 路径 | 维度 | 备注 |
|---|---|---|---|
| iPad Pro (M5) | `buy-ipad/ipad-pro` | `dimensionScreensize` 11inch/13inch → 颜色 → 容量 256g–2T（容量档同时决定内存 12/16GB）→ `dimensionFinish` glossy/matte（纳米纹理仅 1T/2T）→ `dimensionConnection` wifi/wificell | US 96 SKU（含 3 个 carrier key 同价）→ 保留 unlocked 48；CN 48 |
| iPad Air | `buy-ipad/ipad-air` | 尺寸 → 颜色 → 容量 → 连接 | |
| iPad | `buy-ipad/ipad` | 颜色 → 容量 → 连接 | |
| iPad mini | `buy-ipad/ipad-mini` | 颜色 → 容量 → 连接 | |

radio name 无前缀（`dimensionCapacity` 等）、无折叠卡片、US 蜂窝版不必选运营商（三家同价）。CN 总价选择器是 `[data-autom="stickyPrice"]`。详见 `ipad.md`。

## 每站每机型的 space / out 命名约定

`space = aop-<机型缩写>-<站>`，`out = <工作目录>/<机型缩写>_<站>`，机型缩写：macmini、mba、mbp、imac、macstudio、macpro、iphone17、iphone17pro、iphoneair、iphone17e、ipadpro、ipadair、ipad、ipadmini；站：us、cn、sg。
