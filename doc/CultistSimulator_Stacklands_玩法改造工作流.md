# 《SOSimulator》剧情接入玩法改造工作流

## 1. 文档目的

这份文档只回答一个问题：

`如何把《失物招领室的神明》这个剧情，接进当前这套游戏原型里。`

这次不引入工作台机制，不把游戏改成《密教模拟器》的标准槽位玩法，而是基于你现在已经有的机制继续长：

- 桌面自由拖拽
- 卡牌父子吸附
- 二元配方产出
- 背景滑动文本 `BackgroundSlideText`
- 事件详情弹窗 `EventCardDetail`

可以借《密教模拟器》和 Stacklands 的灵感，但实现方式要尽量贴着当前代码走，避免推翻重做。

---

## 2. 先明确当前项目最适合承载剧情的地方

结合现有代码，当前项目其实已经有 3 个非常适合讲故事的层：

### 2.1 桌面卡牌层

对应代码：

- [App.tsx](D:\github\凉宫春日黑客松\SOSimulator\src\App.tsx)
- [stacking.ts](D:\github\凉宫春日黑客松\SOSimulator\src\game\stacking.ts)
- [production.ts](D:\github\凉宫春日黑客松\SOSimulator\src\game\production.ts)

这一层负责：

- 玩家做什么
- 卡牌如何组合
- 哪些资源被消耗
- 会产出什么新卡

这就是主线剧情真正推进的地方。

### 2.2 背景氛围层

对应代码：

- [BackgroundSlideText.tsx](D:\github\凉宫春日黑客松\SOSimulator\src\components\BackgroundSlideText.tsx)
- [Back_text.json](D:\github\凉宫春日黑客松\SOSimulator\src\data\Back_text.json)

这一层负责：

- 当前世界在“想什么”
- 春日的执念是否在渗出来
- 异常是轻微、明显，还是已经失控

它不负责直接讲完整剧情，而负责制造“气氛上的剧情推进感”。

### 2.3 事件说明层

对应代码：

- [EventCardDetail.tsx](D:\github\凉宫春日黑客松\SOSimulator\src\components\EventCardDetail.tsx)
- [Event_Card.json](D:\github\凉宫春日黑客松\SOSimulator\src\data\Event_Card.json)

这一层负责：

- 当前事件卡到底意味着什么
- 这张事件卡可以被哪些卡触发
- 不同投入会引向什么叙事结果

它不是百科，而应该变成“剧情节点说明器”。

---

## 3. 新的核心思路

不要把剧情理解成“写很多文本”，而要把剧情拆成下面三种东西：

### A. 可拖拽的剧情物件

例如：

- 蓝伞
- 贫瘠线索
- 模糊证词
- 雨中的背影
- 春日的执念
- 阿虚的反驳
- 虚构失主

这些东西都应该变成卡。

### B. 不断升级的背景异样感

例如：

- “只是没人认领的伞。”
- “有人说见过它。”
- “这把伞不该被丢下。”
- “雨好像在配合什么。”
- “世界开始替她补完答案。”

这些东西不一定要变成卡，可以主要交给 `BackgroundSlideText` 去说。

### C. 关键剧情节点

例如：

- 发现蓝伞不对劲
- 校园里出现矛盾证词
- 失主查无此人
- 春日执念加深
- 阿虚开始正面反驳
- 最终结局分歧

这些应该变成 `事件卡 + 事件详情`。

换句话说：

- 卡牌负责“做事”
- 背景文字负责“渗透感”
- 事件详情负责“节点解释”

---

## 4. 如何把《失物招领室的神明》拆成游戏里的东西

建议把这篇剧情拆成 4 类资源。

## 4.1 基础资源卡

这类卡维持当前原型能玩：

- 精力
- 时间
- 金钱

这部分可以沿用现在的数据结构，只新增数量堆叠。

## 4.2 线索卡

这类卡负责推进故事：

- 贫瘠线索
- 模糊证词
- 雨中的背影
- 矛盾记录
- 不存在的学籍

它们是剧情推进的“半成品”。

## 4.3 情绪/状态卡

这类卡是春日主题里最关键的东西：

- 春日的执念
- 阿虚的怀疑
- 现实阻力
- 世界异常
- 雨势加深

它们不是结局，但会改变后续产出方向。

## 4.4 事件卡

这类卡是剧情章节点：

- 失物招领室
- 过于一致的证词
- 不存在的失主
- 最后一场雨

事件卡本身不一定被消耗，但它们应该像“剧情容器”一样接受不同输入。

---

## 5. 现有玩法应该怎么改，才能接住剧情

## 5.1 保留当前主循环

保留现在这套最重要的事情：

1. 玩家拖动卡牌
2. 卡牌吸附
3. 命中规则
4. 倒计时
5. 产出新卡

这已经足够承载剧情，不需要另起炉灶。

## 5.2 新增“同类资源合并”

这部分可以吸收一点 Stacklands 的味道，但只加这一层就够了。

建议支持：

- 金钱 x2
- 时间 x3
- 精力 x2
- 贫瘠线索 x2

这样可以减少桌面拥挤，让剧情卡更突出。

## 5.3 不再把“事件卡”只当说明牌

现在 `event-card` 更像一个带说明的特殊配方卡。

改造后，事件卡应该是：

- 当前章节锚点
- 当前叙事状态入口
- 当前分支的解释面板

也就是说，事件卡要从“功能牌”变成“剧情容器牌”。

---

## 6. BackgroundSlideText 应该怎么改

这一块是这次改造里最有价值的部分，因为它非常适合做《凉宫春日》这种“现实慢慢不对劲”的气氛。

## 6.1 当前实现的问题

当前 [BackgroundSlideText.tsx](D:\github\凉宫春日黑客松\SOSimulator\src\components\BackgroundSlideText.tsx) 的逻辑是：

- 看桌面上有哪些卡
- 用卡的 `definitionId` 或 `name` 去匹配 `Back_text.json` 的 `Conditions`
- 命中后随机播放对应文本

这个机制可以用，但现在太平了，因为它只能表达：

- “有这张卡”

它还不能表达：

- “故事推进到哪一章了”
- “世界异常到什么程度了”
- “最近产出了什么类型的线索”

## 6.2 改造目标

让 `BackgroundSlideText` 不只是“卡牌在场时播放字”，而是“根据剧情状态播放不同层级的世界旁白”。

## 6.3 建议新增剧情状态变量

在 `App.tsx` 顶层状态里新增一个轻量剧情状态，例如：

```ts
type StoryState = {
  chapter: 'umbrella' | 'testimony' | 'missing-owner' | 'final-rain'
  obsessionLevel: number
  distortionLevel: number
  weatherLevel: number
  endingRoute?: 'normal' | 'ghost' | 'collapse' | null
}
```

它不需要很复杂，但足够让背景文本分层。

## 6.4 改造 `Back_text.json`

当前的结构太简单：

```json
{
  "Stage_1": {
    "Conditions": "金钱",
    "max_txt_num": 5,
    "Slide_txt": ["123", "123"]
  }
}
```

建议改成同时支持：

- 卡牌条件
- 章节条件
- 数值阈值条件

例如：

```json
{
  "umbrella_start": {
    "cardConditions": ["blue-umbrella"],
    "chapter": "umbrella",
    "max_txt_num": 4,
    "slideTexts": [
      "只是一把伞而已。",
      "它看起来太新了。",
      "没人认领，反而像故意留下。"
    ]
  },
  "obsession_mid": {
    "chapter": "testimony",
    "minObsession": 2,
    "max_txt_num": 5,
    "slideTexts": [
      "有人说见过它。",
      "每个人记得的都不一样。",
      "这把伞正在长出过去。"
    ]
  },
  "distortion_high": {
    "minDistortion": 4,
    "max_txt_num": 6,
    "slideTexts": [
      "雨正在替谁圆谎。",
      "世界开始配合她。",
      "答案不是被找到的。"
    ]
  }
}
```

## 6.5 `BackgroundSlideText.tsx` 要怎么改

函数签名建议从：

```ts
BackgroundSlideText({ cards })
```

改成：

```ts
BackgroundSlideText({ cards, storyState })
```

然后把 `getActiveBackgroundConfig(cards)` 改成：

```ts
getActiveBackgroundConfig(cards, storyState)
```

新的匹配规则建议支持：

- 桌面上是否存在某些卡
- 当前章节是否匹配
- `obsessionLevel` 是否达到阈值
- `distortionLevel` 是否达到阈值

## 6.6 背景文字在剧情里的具体作用

建议这么用：

### 第一章

背景文字偏日常：

- “只是失物。”
- “没人会在意这种东西。”
- “她停下来看了第二眼。”

### 第二章

背景文字偏传闻：

- “有人见过。”
- “也有人说没见过。”
- “每个人都记得一点点。”

### 第三章

背景文字偏异常：

- “这把伞不该被丢下。”
- “线索开始互相证明。”
- “它像在等一个主人。”

### 第四章以后

背景文字偏世界崩偏：

- “雨比天气预报更相信她。”
- “世界开始自动补证。”
- “有人要从故事里走出来了。”

这会让剧情不是只存在于弹窗里，而是整张桌子都在说话。

---

## 7. EventCardDetail 应该怎么改

这一块应该从“配方说明”升级成“剧情节点面板”。

## 7.1 当前实现的问题

当前 [EventCardDetail.tsx](D:\github\凉宫春日黑客松\SOSimulator\src\components\EventCardDetail.tsx) 主要做的是：

- 找到某张事件卡对应的规则
- 列出“投入什么子牌会产出什么”

这当然有用，但不够剧情化。

它缺少三件事：

- 这张事件卡目前处于哪个阶段
- 为什么会出现这张事件卡
- 玩家下一步应该往哪个方向试

## 7.2 目标改造

让事件详情面板分成 4 块：

### A. 当前节点说明

例如：

- “凉宫春日认定这把蓝伞不对劲，SOS 团开始调查失主。”

### B. 当前已知异常

例如：

- “登记信息有缺失。”
- “有人说见过失主，但说法互相矛盾。”
- “最近雨势开始异常频繁。”

### C. 可投入方向

例如：

- 投入 `精力`：继续查
- 投入 `时间`：扩大走访范围
- 投入 `金钱`：买到额外记录或情报
- 投入 `模糊证词`：推动失主形象成型

### D. 隐性剧情提示

例如：

- “她越确信，世界就越像在证明她。”

## 7.3 `Event_Card.json` 结构建议

建议把事件卡数据扩成下面这种：

```json
{
  "id": "event-card-umbrella",
  "title": "失物招领室",
  "note": "一把没人认领的蓝伞，突然显得不再普通。",
  "details": "凉宫春日认定这是一件值得调查的大事。",
  "storyHints": [
    "登记信息并不完整。",
    "有人说伞在这里待了很久。"
  ],
  "rules": [
    {
      "childDefinitionId": "energy",
      "title": "继续追查",
      "description": "保留事件卡，消耗精力，产出贫瘠线索或模糊证词。"
    },
    {
      "childDefinitionId": "time",
      "title": "扩大走访",
      "description": "保留事件卡，消耗时间，更容易获得矛盾证词。"
    }
  ],
  "chapter": "umbrella"
}
```

## 7.4 `EventCardDetail.tsx` 的具体改动

建议新增传参：

```ts
EventCardDetail({
  definition,
  storyState,
  onClose
})
```

面板中新增：

- 当前章节名
- 当前异常等级
- 当前执念等级
- 当前可触发方向

同时，说明文案不要只从“静态规则”里生成，也要根据 `storyState` 变化。

例如同一张“失主事件卡”：

- 早期会显示“继续调查”
- 中期会显示“矛盾证词正在增多”
- 后期会显示“世界正在替失主补完存在”

这样同一张卡才会像一个活的剧情节点。

---

## 8. 剧情到底如何通过现有卡牌玩法推进

这里给你一个最贴合当前机制的版本。

## 8.1 核心原则

不要让玩家“阅读剧情后点击继续”，而是：

`玩家通过不断把牌叠到事件卡或线索卡上，让剧情自己长出来。`

## 8.2 第一章推进示例

### 初始卡

- 精力
- 时间
- 蓝伞
- 失物招领室事件卡

### 可触发规则

- `失物招领室 + 精力 -> 贫瘠线索`
- `失物招领室 + 时间 -> 贫瘠线索 + 贫瘠线索`
- `蓝伞 + 贫瘠线索 -> 模糊证词`
- 首次获得 `模糊证词` 时，自动刷出 `春日`

### 推进结果

当玩家产出第一张 `模糊证词` 时：

- `storyState.chapter` 从 `umbrella` 切到 `testimony`
- 背景文字切到“传闻扩散”组
- 桌面刷新新的事件卡：`过于一致的证词`
- 桌面自动刷新角色卡：`春日`

## 8.3 第二章推进示例

### 新规则

- `过于一致的证词 + 时间 -> 矛盾记录`
- `过于一致的证词 + 金钱 -> 旧广播站照片`
- `模糊证词 + 春日 -> 春日的执念`
- `蓝伞 + 春日 -> 春日的执念`

### 推进结果

当 `春日的执念` 首次出现时：

- `obsessionLevel +1`
- 背景文字开始出现“她越相信，世界越配合”
- `EventCardDetail` 中新增一条异常提示

## 8.4 第三章推进示例

### 新规则

- `矛盾记录 + 时间 -> 不存在的学籍`
- `旧广播站照片 + 蓝伞 -> 雨中的背影`
- `春日的执念 + 模糊证词 -> 世界异常`
- 首次获得 `世界异常` 时，自动刷出 `阿虚`

### 推进结果

当 `世界异常` 出现时：

- `distortionLevel +1`
- 背景文字变得更具侵入感
- 新事件卡刷新：`不存在的失主`
- 桌面自动刷新角色卡：`阿虚`

## 8.5 最终章推进示例

### 新规则

- `阿虚 + 世界异常 -> 阿虚的怀疑`
- `阿虚的怀疑 + 不存在的失主 -> 现实阻力`
- `不存在的失主 + 春日的执念 -> 虚构失主`
- `世界异常 + 雨中的背影 -> 最后一场雨`

### 结局分歧

- `最后一场雨 + 现实阻力 -> 结局A`
- `最后一场雨 + 虚构失主 -> 结局B`
- `最后一场雨 + 春日的执念 + 世界异常 -> 结局C`

这样剧情就完全靠你当前的“配方产出 + 自动刷出关键角色卡”结构推进，不需要工作台。

---

## 9. 文件级改造建议

## 9.1 `src/game/types.ts`

建议新增一个轻量剧情状态：

```ts
export type StoryState = {
  chapter: 'umbrella' | 'testimony' | 'missing-owner' | 'final-rain'
  obsessionLevel: number
  distortionLevel: number
  weatherLevel: number
  unlockedEventDefinitionIds: string[]
  reachedEnding: boolean
  endingId?: string | null
}
```

同时建议给 `CardDefinitionRecord` 新增：

- `stackable?: boolean`
- `tags?: string[]`
- `storyRole?: string`

同时建议给 `TableCard` 增加“临时态 / 自动分解”字段。第一版可以这样扩：

```ts
export type TableCard = {
  id: string
  definitionId: string
  name: string
  kind: string
  kindLabel: string
  note: string
  accent: string
  x: number
  y: number
  quantity?: number
  parentCardId: string | null
  childCardId: string | null
  spawnedAtMs?: number
  spawnOriginX?: number
  spawnOriginY?: number
  decayAtMs?: number | null
  decayOutputDefinitionIds?: string[]
  detailMode?: 'normal' | 'temporary' | 'ending'
}
```

新增字段含义：

- `quantity`：同类资源合并后的数量
- `decayAtMs`：这张卡何时自动分解
- `decayOutputDefinitionIds`：分解时要产出的卡
- `detailMode`：详情面板里是否显示“临时态”提示

这套字段足够支持：

- `现实阻力` 一段时间后裂回前置卡
- 某些临时卡在没被继续使用时自动失稳
- 点开详情时显示“剩余稳定时间”

## 9.2 `src/App.tsx`

这里是最大改动点。

建议新增状态：

- `storyState`
- `gameLog`

当前 `cards` 变化后已经会跑 `getProductionMatches(cards)`，你可以在产出结算后顺手做两件事：

1. 检查是否命中剧情推进条件
2. 检查是否要解锁新的事件卡

例如：

```ts
setCards(...)
setStoryState((current) => advanceStoryState(current, nextCards))
```

同时可以把“自动分解”也接到现有 `nowMs` 更新节奏里。

建议新增一个卡牌衰变检查流程：

```ts
setCards((currentCards) => resolveCardDecay(currentCards, nowMs, boardWidth, boardHeight))
```

判断规则建议是：

- 某张卡有 `decayAtMs`
- 当前时间已超过 `decayAtMs`
- 这张卡没有正在参与新的产出关系

满足后：

- 移除当前卡
- 生成 `decayOutputDefinitionIds` 对应的产物卡

例如：

- `现实阻力`
- 10 秒内没有被继续用于结局分支
- 自动分解成 `阿虚的怀疑 + 不存在的失主`

再把：

```tsx
<BackgroundSlideText cards={cards} />
```

改成：

```tsx
<BackgroundSlideText cards={cards} storyState={storyState} />
```

打开事件详情时也传入：

```tsx
<EventCardDetail
  definition={selectedEventDefinition}
  storyState={storyState}
  onClose={...}
/>
```

## 9.3 `src/components/BackgroundSlideText.tsx`

要改的重点：

- 支持 `storyState`
- 区分卡牌条件和章节条件
- 支持异常等级阈值
- 支持更有方向感的文本组

建议把函数 `getActiveBackgroundConfig` 改成：

```ts
function getActiveBackgroundConfig(cards: TableCard[], storyState: StoryState)
```

## 9.4 `src/components/EventCardDetail.tsx`

要改的重点：

- 支持 `storyState`
- 读取事件卡的剧情提示
- 当前阶段不同，展示不同说明

建议面板结构从现在的：

- 标题
- note
- details
- 可触发结果

改成：

- 标题
- 当前节点说明
- 当前异常提示
- 可投入方向
- 当前阶段备注

## 9.5 `src/data/Back_text.json`

从“按单一卡匹配”升级成“按卡 + 章节 + 等级匹配”。

## 9.6 `src/data/Event_Card.json`

从“规则描述表”升级成“剧情节点表”。

建议至少补这些字段：

- `chapter`
- `storyHints`
- `stageNotes`
- `unlockCondition`

## 9.7 `src/data/CardKind.json`

把剧情核心物件补进去：

- blue-umbrella
- vague-testimony
- contradictory-record
- old-radio-photo
- haruhi-obsession
- kyon-doubt
- reality-resistance
- world-distortion
- imaginary-owner

## 9.8 `src/data/CardOutput.json`

这里仍然保留，但规则要从“演示型”改成“剧情型”。

建议首批规则围绕 4 条线：

- 线索增长线
- 春日执念线
- 世界异常线
- 结局分歧线

同时建议把规则结构从当前的“单输出”扩成“可多输出、可自动分解”的版本。

当前方向：

```ts
type CardOutputRule = {
  id: string
  parentDefinitionId: string
  childDefinitionId: string
  durationMs: number
  outputDefinitionId?: string | null
  consumeParent: boolean
  consumeChild: boolean
}
```

建议升级方向：

```ts
type CardOutputRule = {
  id: string
  inputDefinitionIds: string[]
  durationMs: number
  outputDefinitionIds: string[]
  consumeInputIndexes: boolean[]
  event?: string
  spawnOffsets?: 'scatter' | 'stack'
  outputCardOverrides?: Array<{
    definitionId: string
    decayMs?: number | null
    decayOutputDefinitionIds?: string[]
    detailMode?: 'normal' | 'temporary' | 'ending'
  }>
}
```

重点新增：

- `inputDefinitionIds`
- `outputDefinitionIds`
- `consumeInputIndexes`
- `outputCardOverrides`

有了这套结构后，就可以同时支持：

- `失物招领室 + 时间 -> 贫瘠线索 + 贫瘠线索`
- `最后一场雨 + 现实阻力 -> 阿虚认领蓝伞 + 晴天归还`
- `阿虚的怀疑 + 不存在的失主 -> 现实阻力`

以及：

- `现实阻力` 自带 `decayMs: 10000`
- `现实阻力` 自带 `decayOutputDefinitionIds: ['kyon-doubt', 'missing-owner']`

## 9.9 现在是否可以支持“多个输入 / 多个输出”

可以，但当前代码不是现成支持，需要做一次小到中等规模的数据结构升级。

当前 [types.ts](D:\github\凉宫春日黑客松\SOSimulator\src\game\types.ts) 和 [production.ts](D:\github\凉宫春日黑客松\SOSimulator\src\game\production.ts) 的规则是：

- 一张父牌
- 一张子牌
- 一个 `outputDefinitionId`

也就是当前只支持：

- `A + B -> C`

如果要支持下面这些：

- `A + B -> C + D`
- `A + B + C -> D`
- `A + B + C -> D + E`

建议把规则结构改成：

```ts
type CardOutputRule = {
  id: string
  inputDefinitionIds: string[]
  durationMs: number
  outputDefinitionIds: string[]
  consumeInputIndexes: boolean[]
  event?: string
}
```

再把匹配逻辑从“父子二元匹配”改成“堆叠链匹配”或“一组卡匹配”。

第一版不用一步做到“三张输入”，最稳的路线是：

1. 先支持 `两张输入 -> 多张输出`
2. 再支持 `三张输入 -> 一张或多张输出`

例如：

- `失物招领室 + 时间 -> 贫瘠线索 + 贫瘠线索`
- `最后一场雨 + 现实阻力 -> 阿虚认领蓝伞 + 晴天归还`

这完全可行，只是需要改：

- `src/game/types.ts`
- `src/game/production.ts`
- `src/game/cardData.ts`

如果你想先稳住复杂度，建议分 3 步做：

1. 先支持 `两张输入 -> 多张输出`
2. 再支持 `临时态卡 -> 自动分解回多张卡`
3. 最后再支持 `三张输入 -> 一张或多张输出`

## 9.10 现在是否可以让“所有卡都能点击并查看暗示”

完全可行，而且很适合这个项目现在的形态。

当前 [App.tsx](D:\github\凉宫春日黑客松\SOSimulator\src\App.tsx) 里只有：

- `kind === 'event'` 的卡才能点开

这意味着现在只是事件卡有详情。

建议改成：

- 所有卡都可点击
- 事件卡显示“剧情节点详情”
- 普通卡显示“卡牌详情与可合成暗示”

最顺的做法不是硬把 `EventCardDetail` 塞给所有卡，而是新增一个更通用的详情面板，比如：

- `CardDetail.tsx`

再由它根据卡牌类型分流：

- `event`：走事件详情视图
- `resource / clue / state`：走通用卡牌详情视图

通用卡牌详情里建议显示：

- 这张卡是什么
- 当前剧情里它代表什么
- 它可以和哪些卡发生产出
- 哪些方向是“明确规则”
- 哪些方向只给“模糊暗示”

例如点开 `蓝伞` 可以看到：

- “这是一把无人认领的蓝色折叠伞。”
- “它是整条主线的起点。”
- “也许可以和线索、照片、春日发生联系。”

例如点开 `模糊证词` 可以看到：

- “每个人都记得一点，但拼不成完整的人。”
- “它可能推动执念，也可能推动异常。”

实现上可以直接从规则表反查：

- 哪些规则把当前卡作为输入
- 哪些规则把当前卡作为输出

再决定是显示精确配方，还是显示模糊提示文案。

对于“临时态卡”，建议详情里额外显示：

- 这张卡为什么不稳定
- 它多久后会自动分解
- 它会分解成什么

例如点开 `现实阻力`：

- “阿虚暂时压住了故事继续补完自身的趋势。”
- “如果没有进一步行动，它会重新裂解成怀疑与失主问题。”
- “剩余稳定时间：8 秒”

这样玩家会自然理解，这不是普通资源卡，而是一种短暂成立的剧情状态。

## 9.11 自动分解机制建议

这个机制非常适合《失物招领室的神明》这种题材，因为很多状态本来就应该是“短暂稳定”的。

适合做成自动分解卡的对象：

- `现实阻力`
- `虚构失主`
- `世界异常`
- `最后一场雨`

不建议做自动分解的对象：

- 基础资源
- 普通线索
- 已经确认的结局卡

推荐规则：

- 某张卡在被合成出来时，带上 `decayAtMs`
- 它在倒计时结束前如果继续参与合成，就不分解
- 如果超时且仍闲置，就自动分解为预设卡牌

示例：

- `阿虚的怀疑 + 不存在的失主 -> 现实阻力`
- `现实阻力` 稳定 10 秒
- 若没被继续用于 `最后一场雨 + 现实阻力`
- 则自动分解回 `阿虚的怀疑 + 不存在的失主`

这个机制的玩法意义：

- 给玩家制造“机会窗口”
- 让某些剧情态更像临时压住而不是永久解决
- 防止中间态卡长期堵在桌面上
- 增强剧情的不稳定感

实现位置建议：

- 数据上：写进 `CardOutput.json` 或卡牌实例 override
- 运行时：写在 `App.tsx` 的 `nowMs` 驱动检查里
- UI 上：写进通用卡牌详情面板

---

## 10. 推荐的剧情接入开发顺序

## 第 1 步：先把故事状态接进顶层

目标：

- 让程序知道现在在第几章、执念多高、异常多高

完成标志：

- `storyState` 能跟着产物变化

## 第 2 步：重写 `Back_text.json` 和 `BackgroundSlideText`

目标：

- 背景文字不再只看“桌上有没有金钱”
- 而是会随着剧情升级改变语气

完成标志：

- 第一章、第二章、第三章的背景文字明显不同

## 第 3 步：重写 `Event_Card.json` 和 `EventCardDetail`

目标：

- 事件卡从说明牌变成剧情节点面板

完成标志：

- 点开同一事件卡时，能看见当前阶段的异常说明和投入方向

## 第 4 步：把主线卡牌补进 `CardKind.json`

目标：

- 让剧情要素都可被拖拽、合成、消费

完成标志：

- 蓝伞、模糊证词、执念、世界异常等核心卡可出现在桌面

## 第 5 步：把剧情规则补进 `CardOutput.json`

目标：

- 用你现有的合成机制推动故事

完成标志：

- 玩家可以不用弹出章节文本，只靠拖牌推进到第二章

## 第 6 步：做事件卡的动态刷新

目标：

- 不同章节自动出现不同事件卡

完成标志：

- 产出关键卡后，桌上会刷出新的剧情事件卡

## 第 7 步：补结局分支

目标：

- 把故事从“过程”闭合成“多结局”

完成标志：

- 至少能触发 3 个不同结局

---

## 11. 一个最小可玩版本应该长什么样

如果你想先做最小版本，我建议只做这些内容：

### 初始卡

- 精力
- 时间
- 蓝伞
- 失物招领室事件卡

### 中间卡

- 贫瘠线索
- 模糊证词
- 春日
- 春日的执念
- 矛盾记录
- 旧广播站照片
- 雨中的背影
- 世界异常
- 阿虚
- 阿虚的怀疑
- 现实阻力
- 不存在的失主
- 最后一场雨

### 结局卡

- 阿虚认领蓝伞
- 虚构失主出现
- 世界大乱

### 必做规则

- `失物招领室 + 精力 -> 贫瘠线索`
- `失物招领室 + 时间 -> 贫瘠线索 + 贫瘠线索`
- `蓝伞 + 贫瘠线索 -> 模糊证词`
- 首次获得 `模糊证词` 时自动刷出 `春日`
- `模糊证词 + 春日 -> 春日的执念`
- `蓝伞 + 春日 -> 春日的执念`
- `过于一致的证词 + 时间 -> 矛盾记录`
- `过于一致的证词 + 金钱 -> 旧广播站照片`
- `矛盾记录 + 时间 -> 不存在的学籍`
- `旧广播站照片 + 蓝伞 -> 雨中的背影`
- `春日的执念 + 模糊证词 -> 世界异常`
- 首次获得 `世界异常` 时自动刷出 `阿虚`
- `阿虚 + 世界异常 -> 阿虚的怀疑`
- `世界异常 + 雨中的背影 -> 最后一场雨`
- `阿虚的怀疑 + 不存在的失主 -> 现实阻力`
- `不存在的失主 + 春日的执念 -> 虚构失主`
- `最后一场雨 + 阿虚的怀疑 -> 阿虚认领蓝伞`
- `最后一场雨 + 虚构失主 -> 虚构失主出现`
- `最后一场雨 + 春日的执念 + 世界异常 -> 世界大乱`

### 必做临时态规则

- `阿虚的怀疑 + 不存在的失主 -> 现实阻力`
- `现实阻力` 若在一定时间内未继续参与合成，则自动分解为 `阿虚的怀疑 + 不存在的失主`

可选扩展：

- `世界异常` 若长时间闲置，可进一步恶化或裂回前置状态
- `虚构失主` 若未被用于结局，可能自动消散为 `不存在的失主 + 模糊证词`

### 角色卡获得规则

- `春日` 不作为初始卡出现
- 首次获得 `模糊证词` 时自动刷出 `春日`
- `阿虚` 不作为初始卡出现
- 首次获得 `世界异常` 时自动刷出 `阿虚`

这样角色的登场会更像剧情推进，而不是普通资源合成

### 事件卡获得规则

- `失物招领室` 作为初始事件卡存在
- 首次获得 `模糊证词` 时，自动刷出 `过于一致的证词`
- 首次获得 `世界异常` 时，自动刷出 `不存在的失主`
- 首次获得 `雨中的背影` 或 `现实阻力 / 虚构失主` 之一时，自动刷出 `最后一场雨`

### 必做背景文字阶段

- 蓝伞初现
- 传闻出现
- 失主成形
- 世界配合
- 结局前夜

### 必做事件详情

- 失物招领室
- 过于一致的证词
- 不存在的失主
- 最后一场雨

### 一条完整、不缺前置的最小获得链

1. 初始只有 `精力 / 时间 / 蓝伞 / 失物招领室事件卡`
2. `失物招领室 + 精力 -> 贫瘠线索`
3. `蓝伞 + 贫瘠线索 -> 模糊证词`
4. 首次获得 `模糊证词`，自动刷出 `春日` 和事件卡 `过于一致的证词`
5. `模糊证词 + 春日 -> 春日的执念`
6. `过于一致的证词 + 时间 -> 矛盾记录`
7. `过于一致的证词 + 金钱 -> 旧广播站照片`
8. `旧广播站照片 + 蓝伞 -> 雨中的背影`
9. `春日的执念 + 模糊证词 -> 世界异常`
10. 首次获得 `世界异常`，自动刷出 `阿虚` 和事件卡 `不存在的失主`
11. `阿虚 + 世界异常 -> 阿虚的怀疑`
12. `阿虚的怀疑 + 不存在的失主 -> 现实阻力`
13. `不存在的失主 + 春日的执念 -> 虚构失主`
14. `世界异常 + 雨中的背影 -> 最后一场雨`
15. 结局分歧：
16. `最后一场雨 + 阿虚的怀疑 -> 阿虚认领蓝伞`
17. `最后一场雨 + 虚构失主 -> 虚构失主出现`
18. `最后一场雨 + 春日的执念 + 世界异常 -> 世界大乱`

### 临时态获得链示例

1. `阿虚 + 世界异常 -> 阿虚的怀疑`
2. `阿虚的怀疑 + 不存在的失主 -> 现实阻力`
3. `现实阻力` 进入短暂稳定状态
4. 若玩家及时继续推进，它可以参与结局相关配方
5. 若玩家放着不管，它会自动分解回 `阿虚的怀疑 + 不存在的失主`

---

## 12. 最终建议

这次最值得做的，不是加工作台，而是把你已经有的两块很有味道的东西用起来：

- `BackgroundSlideText` 负责让世界自己开口说话
- `EventCardDetail` 负责让事件卡真正成为剧情节点

再配合你现有的：

- 拖拽
- 吸附
- 配方产出

其实已经足够把《失物招领室的神明》做成一个“越拖越不对劲”的剧情游戏原型了。

如果你下一步要继续，我最适合直接帮你的就是再写一份“数据表改造稿”，把：

- `CardKind.json`
- `CardOutput.json`
- `Back_text.json`
- `Event_Card.json`

都先按这个剧情填出第一版样例。这样你就可以直接往代码里接。 
