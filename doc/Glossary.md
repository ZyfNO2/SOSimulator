# 术语表

| 术语 | 英文/代码名 | 含义 |
| --- | --- | --- |
| 卡牌 | Card | 游戏中的基础单位，可能是资源、角色、地点、线索、状态、天气或结局。 |
| 卡牌定义 | `CardDefinitionRecord` | 一种卡牌的静态配置，来源于 `CardKind.json`。 |
| 卡牌实例 | `TableCard` | 桌面上一张具体卡牌，带坐标、数量和父子链关系。 |
| 父牌 | parent card | 一条堆叠链中位于上方、负责承接子牌的那张牌。 |
| 子牌 | child card | 吸附在父牌标题横线下方的牌。 |
| 堆叠链 | stack | 由 `parentCardId / childCardId` 串起来的一条卡牌链。 |
| 母牌 | mother card | 固定在左下角的 `精力` 或 `时间` 资源源头。 |
| 子牌分离 | split | 从母牌左键拖出 1 张资源子牌的操作。 |
| 回充遮罩 | refill overlay | 资源母牌或天气卡上的黑色倒计时遮罩，自上向下消失。 |
| 产出规则 | `CardOutputRule` | 一组输入卡在倒计时结束后会得到什么结果。 |
| 产出运行 | `ProductionRun` | 一条当前正在进行中的倒计时合成。 |
| 产出匹配 | production match | 当前桌面上某条父子链命中了一条规则。 |
| 保留项 | consume false | 合成完成后不会被消耗、会继续留在桌面的输入牌。 |
| 自动分解 | decay | 某些临时状态牌在一定时间后自动变回别的牌。 |
| 主线卡 | mainline card | 被 `story.ts` 视为主线链上的卡，可拖入右上角收纳栏。 |
| 主线收纳栏 | Mainline Tray | 右上角的归档区域，用于暂存主线卡并随时拖回桌面。 |
| 详情弹窗 | `EventCardDetail` | 点击卡牌后展开的说明面板，展示简介和当前可见提示。 |
| 已见卡 | seen cards | 这局里玩家已经在桌面或收纳栏中见过的卡，用于控制提示是否提前剧透。 |
| 背景滑动文字 | `BackgroundSlideText` | 根据剧情章节和卡牌条件变化的漂浮背景文本。 |
| 章节 | `StoryChapter` | 当前故事的大段状态：`umbrella / testimony / missing-owner / final-rain`。 |
| 剧情解锁 | story unlock | 例如 `证词` 首次出现后自动刷出 `长门0`。 |
| 天气时钟 | weather timer | 发现蓝伞后启动的独立天气升级倒计时。 |
| 强制结局 | forced ending | `天气（特大暴雨）` 倒计时结束后清场并只留下 `虚构失主出现`。 |
| Accent | `accent` | 决定卡牌视觉配色的分类字段。 |
