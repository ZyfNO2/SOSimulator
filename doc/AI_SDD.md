# AI SDD：SOSimulator 当前实现说明

## 1. 文档目的

这份文档描述的是当前代码已经落地的前端原型结构，不再沿用早期“动作框 / 槽位 / 仪式”的旧设计稿口径。

当前版本的核心是：

- 全屏桌面式拖拽卡牌
- 卡牌上下吸附形成父子链
- 通过堆叠顺序自动匹配产出规则
- `精力 / 时间` 母牌常驻左下角并自动回充
- `蓝色雨伞` 发现后触发独立天气计时
- 详情弹窗、主线收纳栏、背景滑动文本共同承担叙事表达

---

## 2. 当前技术实现

- 前端框架：React + TypeScript
- 构建：Vite
- 状态管理：`App.tsx` 中的 `useState` + `useEffect`
- 规则来源：`src/data/*.json`
- 核心规则函数：`src/game/*.ts`
- 日志输出：浏览器控制台 + `/__log` 文件日志接口

当前实现并没有采用 `useReducer` 或全局 store，而是把主要运行状态集中在 `App.tsx` 内，由纯函数模块负责产出匹配、堆叠吸附、剧情解锁等逻辑。

---

## 3. 当前目录分工

```text
src/
  App.tsx
  App.css
  components/
    BackgroundSlideText.tsx
    CardBoard.tsx
    CardView.tsx
    EventCardDetail.tsx
    MainlineTray.tsx
    ProductionEffect.tsx
  data/
    Back_text.json
    CardKind.json
    CardOutput.json
    Event_Card.json
  game/
    cardData.ts
    constants.ts
    log.ts
    production.ts
    stacking.ts
    story.ts
    types.ts
```

分层职责：

- `data/`：卡牌定义、产出配方、背景文本、详情扩展文案
- `game/`：规则纯函数、类型、常量、剧情解锁、日志
- `components/`：桌面渲染、卡牌渲染、特效、详情、收纳栏
- `App.tsx`：状态汇总、tick、拖拽流程、天气时钟、剧情触发

---

## 4. 核心数据结构

### 4.1 TableCard

当前桌面上的卡牌实例类型见 `src/game/types.ts`。

关键字段：

- `id`：实例 id
- `definitionId`：卡牌定义 id
- `x / y`：桌面坐标
- `quantity`：堆叠数量
- `parentCardId / childCardId`：父子链关系
- `spawnedAtMs`：出生动画开始时间
- `decayAtMs`：自动分解时间
- `isMother`：是否资源母牌
- `refillStartedAtMs / refillDurationMs`：倒计时遮罩起点与时长

说明：

- 当前项目没有“卡槽 location”模型，卡牌始终存在于桌面平面上。
- 多输入配方依赖的是父子链顺序，而不是固定槽位。
- `refillStartedAtMs / refillDurationMs` 已被复用给资源回充和天气升级两类遮罩倒计时。

### 4.2 CardDefinitionRecord

卡牌定义来源于 `src/data/CardKind.json`，在运行时经过 `src/game/cardData.ts` 归一化。

当前定义字段：

- `id`
- `name`
- `kind`
- `kindLabel`
- `note`
- `details`
- `accent`

### 4.3 CardOutputRule

产出规则来源于 `src/data/CardOutput.json`。

关键字段：

- `inputDefinitionIds`
- `durationMs`
- `event`
- `outputDefinitionIds`
- `consumeInputIndexes`
- `outputCardOverrides`

当前匹配规则：

- 2 张牌配方支持正反两种顺序
- 3 张及以上配方中，第一个输入固定为父牌
- 从第二个输入开始，后续输入顺序可以互换

---

## 5. 当前运行循环

## 5.1 开场

- 页面先显示开始界面
- 点击“开始”后，初始 5 张起始牌按顺序显现
- 初始卡为：`精力 / 时间 / 春日0 / 商店 / 天气（晴）`

## 5.2 桌面拖拽

- 普通卡可直接拖动
- 牌与牌之间会在标题横线处吸附
- 吸附后形成父子链
- 拖动父牌时，整条链一起移动

## 5.3 自动产出

- 每次 `cards` 变化后，系统扫描可匹配的父子链
- 匹配成功会生成 `ProductionRun`
- 运行期间桌面显示环形倒计时
- 完成后按规则消耗输入并生成输出
- 若输入链中包含“保留项”，则原牌继续留在桌面

## 5.4 资源母牌

- `精力` 与 `时间` 固定在左下角
- 左键拖动母牌，会分离出一张子牌
- 母牌数量范围为 `0` 到 `2`
- 只有母牌会自动恢复数量
- 判断恢复时看“场上同类总量是否小于 2”
- 回充遮罩为黑色，自上向下消失

## 5.5 天气时钟

- 首次发现任意阶段的 `蓝色雨伞` 后，天气进入独立计时
- 每 3 分钟自动推进一级：
  `晴 -> 阴 -> 阵雨 -> 大雨 -> 暴雨 -> 特大暴雨`
- 天气卡使用与母牌相同的遮罩倒计时表现
- `特大暴雨` 倒计时结束后，强制清场，只保留 `虚构失主出现`

## 5.6 剧情解锁

当前 `story.ts` 中已落地的剧情解锁较轻量：

- `证词` 首次出现时，自动刷出 `长门0`
- 背景滑动文本会根据章节、执念等级、异常等级和卡牌条件变化

当前没有实现：

- 按天数推进
- 店铺关闭
- 每日刷新事件卡
- 选项式剧情树

---

## 6. 当前 UI 组件职责

### `CardBoard`

- 渲染桌面
- 负责当前拖拽组的渲染前置
- 挂载背景文本与产出特效

### `CardView`

- 渲染单张卡
- 显示名称、种类、小字说明、数量
- 负责出生动画与倒计时遮罩
- 母牌额外显示“左键拖出 1 张”

### `ProductionEffect`

- 渲染产出环形倒计时

### `EventCardDetail`

- 渲染详情弹窗
- 读取 `CardKind.json` 与 `Event_Card.json`
- 展示“卡片简介”
- 展示“它会把故事牵向哪边”
- 提示只在玩家已经见过相关卡，或相关卡当前就在桌面时才显示

### `MainlineTray`

- 固定在右上角
- 用于收纳主线卡
- 卡可从桌面拖入，也可再拖回桌面

### `BackgroundSlideText`

- 根据 `Back_text.json` 与剧情章节，在桌面背景播放滑动文字

---

## 7. 当前叙事数据来源

- `CardKind.json`：卡牌名称、颜色、简介正文
- `CardOutput.json`：产出链
- `Event_Card.json`：详情页额外文案与部分专属提示
- `Back_text.json`：背景漂浮句子
- `story.ts`：章节判断、长门解锁、天气开钟触发条件

---

## 8. 当前与旧设计稿的主要差异

当前代码已经明确不再是下列模式：

- 不是固定动作框 + 固定卡槽
- 不是“开始动作 / 领取结果”的按钮式流程
- 不是以 reducer 为中心的状态机
- 不是密教模拟器式探索/研究/仪式卡组

当前更接近：

- 自由桌面堆叠
- 牌与牌直接相互作用
- 连续时间流动
- 轻剧情解锁 + 强桌面可视表达

---

## 9. 当前已知限制

- 许多剧情推进仍依赖单条配方，没有独立事件系统
- `Event_Card.json` 仍保留少量旧版命名残留，更多详情提示主要靠自动生成模板
- 日志目前写入控制台和文件接口，但前端没有单独日志面板
- “第几天 / 店铺关闭 / 人物冷却 / 干扰事件”仍属于后续扩展

---

## 10. 后续建议

若继续沿当前代码推进，建议顺序是：

1. 继续把详情提示改成逐张手写文本，减少自动模板感
2. 引入轻量“已见卡 / 已完成节点”驱动的提示系统
3. 再决定是否补“按天推进 / 店铺关闭 / 干扰事件”
4. 若未来再做大改，再考虑把 `App.tsx` 状态拆成 reducer/store
