# 报告结构与排版

## 一、章节结构（逻辑）

按六层顺序，层数不可省略；页数随场次与数据可得性浮动，不写死页码。

| 顺序 | 章节 | 必含内容 |
|---|---|---|
| 1 | 封面 | 标题、在售场次数、玩法覆盖数、统一 margin、数据源数、快照时间、免责 |
| 2 | 执行摘要 | 五条结论，每条带数字；末尾给六层目录 |
| 3 | 第一层 定价引擎 | margin 分布表、去水公式、λ/w 拟合表（焦点场）、比分矩阵、总进球逐桶 EV |
| 4 | 第二层 基本面 | 伤停表（含“对盘口的实际影响”列）、动机与赛程、xG 与进球背离 |
| 5 | 第三层 市场情报 | 初盘到现价表、人气税热冷两端对照、为什么不做反向 |
| 6 | 第四层 细分市场 | 让球盘 EV 表、深度让球单列、比分与半全场原则、混合过关乘方损耗 |
| 7 | 焦点卡片 | 每张：赔率 / 去水 / 模型 / λ 与 w / 大球与双方进球 / 高概率比分 / 判断 |
| 8 | 全量总表 | 每行含「判断」列，行数 = 在售场次数 |
| 9 | 逐场判断清单 | 每场一行：级别｜选项｜赔率｜理由（含数字） |
| 10 | 数据源与数据卫生 | 八条检查项逐条给状态；**源清单表**（层｜源｜地址｜取用的字段｜访问时间｜是否可信）；缺失字段清单；风险披露 |

## 二、全量表列定义

`编号 | 联赛 | 对阵 | 开赛 | 让 | 赔率 主/平/客 | 去水概率% | 支持率% | margin | 判断`

- 「判断」= `level + pick`，与 `verdictOne` 输出逐字一致
- 焦点行加浅绿底
- 未开售胜平负的场次，赔率列标「让」，判断基于让球盘
- 表格字号 8.2–8.5px，数字等宽 + `tabular-nums`

## 三、逐场判断的写法

每行必须同时具备：级别、选项、赔率、理由（至少一个数字）。

正例：

```
示例A｜关注｜主胜 2.10｜缺口 −19pp，需基本面无反向佐证；让球盘各侧 EV 均负
示例B｜回避｜主胜 1.60｜人气溢价 +25pp，价格不含补偿
示例C｜观望｜不参与｜定价有效，模型偏差 0.9pp，让球盘最好一侧仍为 −6.1%
```

反例（禁用）：

```
示例A 主队实力强，看主胜
示例B 双方都有机会，谨慎
（留空）
```

## 四、排版 token

```
纸面 #F7F4EE   墨 #17202A   次级文字 #6B6355
绿 #14532D / #2FA36B   红 #9F1D1D   琥珀 #92600A
细线 #D9D2C4   封面底 #101820   封面字 #E8E3D8
```

字体族：标题 `serif`、正文 `sans-serif`、数字 `monospace`。不写具体字体名，靠通用族保证跨环境一致。

字号层级：

| 元素 | 字号 |
|---|---|
| 封面主标题 | 42–46px |
| 章节标题 | 20–21px |
| 小节标题 | 12.5–13px |
| 正文 | 10.5px |
| 表格 | 8.2–8.5px |
| 表注 / 脚注 | 8px |

## 五、排版硬约束

- 不用 kicker / eyebrow 小标签；章节直接给标题
- 不做渐变文字；不用零偏移阴影；彩色边线不超过 1px
- 正文对比度 ≥ 4.5:1；表格不用斑马纹，只用细横线
- 章节标题上边 2px 实线，标题与线之间留 7px
- 数据说明放在表格下方，8px，颜色次级
- 页边距：内容页 `14mm 14mm 12mm`；封面高 296mm，避免 297mm 溢出成两页
- 每个 `.sec` 设 `page-break-after: always`，最后一节取消
- 卡片、表格行设 `page-break-inside: avoid`，避免跨页断行

## 六、HTML 骨架与渲染

```html
<style>
@page{size:A4;margin:0}
body{background:#F7F4EE;color:#17202A;font-family:sans-serif;font-size:10.5px;line-height:1.75}
.cover{width:210mm;height:296mm;background:#101820;color:#E8E3D8;padding:26mm 20mm;display:flex;flex-direction:column;justify-content:space-between}
.sec{width:210mm;padding:14mm 14mm 12mm;page-break-after:always}
h2{font-family:serif;font-size:21px;padding-top:7px;border-top:2px solid #17202A}
table.t{width:100%;border-collapse:collapse;font-size:8.4px}
table.t th{border-bottom:1.5px solid #17202A}
table.t td{border-bottom:1px solid #E2DACA}
.mono{font-family:monospace;font-variant-numeric:tabular-nums}
</style>
```

比分矩阵：6×6 表格，单元格背景 `rgba(47,163,107, α)`，α 与概率成正比（`α = p / maxP × 0.72`）。

渲染参数：`format: A4`、`printBackground: true`、`margin` 四边 `0px`。

下载：`Invoke-WebRequest` 先存 ASCII 文件名，再 `Rename-Item` 改中文名，避免编码导致失败。
