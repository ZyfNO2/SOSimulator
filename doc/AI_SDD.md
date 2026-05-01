# AI SDD：React 拖拽卡牌网页小游戏

## 1. 目标

实现一个 React 单页网页小游戏原型。核心玩法是玩家拖动卡牌，将卡牌放入动作框的合适槽位中，启动行动，等待倒计时完成，获得新卡牌、日志、剧情推进或结局。

本项目第一阶段只实现本地单机原型，不接后端。

## 2. 技术原则

- 使用 React 组件化 UI。
- 游戏状态集中管理，优先使用 `useReducer` 或等价 reducer/store。
- 游戏规则数据驱动：卡牌、动作框、槽位、配方、事件都来自配置对象。
- React 组件只负责展示和派发用户意图，不直接写复杂规则。
- 避免链式 `useEffect` 推导游戏状态；可由 state 推导的值用 selector 或渲染期计算。
- 副作用集中处理：存档、计时器 tick、音效、日志追加等要有清晰边界。

## 3. 建议目录结构

```text
src/
  app/
    App.tsx
    GameProvider.tsx
  components/
    CardView.tsx
    CardPile.tsx
    ActionBox.tsx
    ActionSlot.tsx
    LogPanel.tsx
    StatusBar.tsx
    EventModal.tsx
  data/
    cards.ts
    actions.ts
    recipes.ts
    events.ts
    initialState.ts
  game/
    types.ts
    reducer.ts
    selectors.ts
    rules.ts
    recipes.ts
    events.ts
    persistence.ts
  tests/
    game-rules.test.ts
    reducer.test.ts
```

如果项目已有结构，以已有结构为准，但保持“UI / data / game rules”分层。

## 4. 核心类型契约

### CardDefinition

```ts
type CardType =
  | 'resource'
  | 'clue'
  | 'knowledge'
  | 'state'
  | 'tool'
  | 'ritual'
  | 'ending';

interface CardDefinition {
  id: string;
  name: string;
  type: CardType;
  tags: string[];
  description: string;
  stackable: boolean;
  unique?: boolean;
  visibility?: 'visible' | 'locked' | 'hidden';
}
```

规则：

- `id` 使用稳定短横线命名，如 `strange-clue`。
- `tags` 用于规则匹配，不要用显示名称做逻辑判断。
- `unique` 卡牌全局最多一个有效实例。

### CardInstance

```ts
interface CardInstance {
  instanceId: string;
  definitionId: string;
  quantity: number;
  location:
    | { type: 'table' }
    | { type: 'slot'; actionId: string; slotId: string }
    | { type: 'locked'; actionRunId: string }
    | { type: 'discard' };
  status?: 'normal' | 'locked' | 'spent';
}
```

规则：

- UI 渲染卡牌实例，不直接渲染定义。
- 动作运行时输入卡牌应转为 locked 或记录在 action run 中。
- 被消耗卡牌移入 discard 或从实例表移除，两种方式选一种并保持一致。

### ActionDefinition

```ts
interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  slots: SlotDefinition[];
  defaultDurationMs: number;
  recipeIds: string[];
  unlockFlag?: string;
}
```

### SlotDefinition 与 SlotRequirement

```ts
interface SlotDefinition {
  id: string;
  label: string;
  required: boolean;
  accepts: SlotRequirement;
}

interface SlotRequirement {
  types?: CardType[];
  tagsAny?: string[];
  tagsAll?: string[];
  definitionIds?: string[];
  minQuantity?: number;
}
```

匹配规则：

- `definitionIds` 命中即可通过指定卡牌匹配。
- `types` 限制卡牌类型。
- `tagsAny` 表示至少有一个标签。
- `tagsAll` 表示必须包含所有标签。
- `minQuantity` 默认 1。

### RecipeDefinition

```ts
interface RecipeDefinition {
  id: string;
  actionId: string;
  name: string;
  inputs: RecipeInputRequirement[];
  durationMs?: number;
  consume: RecipeConsumeRule[];
  outputs: RecipeOutput[];
  setFlags?: Record<string, boolean | string | number>;
  triggerEventId?: string;
  log: string;
}

interface RecipeInputRequirement {
  slotId: string;
  types?: CardType[];
  tagsAny?: string[];
  tagsAll?: string[];
  definitionIds?: string[];
}

interface RecipeConsumeRule {
  slotId: string;
  mode: 'consume' | 'return' | 'transform';
  transformToDefinitionId?: string;
}

interface RecipeOutput {
  definitionId: string;
  quantity: number;
  location?: 'table';
}
```

规则：

- 配方匹配发生在动作开始前。
- 同一动作可能有多个配方，按 `recipeIds` 顺序匹配第一个合法配方。
- 没有配方时不能开始动作。
- MVP 暂不做随机产出。

### EventNode

```ts
interface EventNode {
  id: string;
  title: string;
  body: string;
  conditions?: Condition[];
  choices: EventChoice[];
  autoOpen?: boolean;
}

interface EventChoice {
  id: string;
  label: string;
  effects: EventEffect[];
  nextEventId?: string;
}
```

事件效果可包括：

- 设置 flag。
- 添加卡牌。
- 解锁动作。
- 添加日志。
- 触发结局。

### GameState

```ts
interface GameState {
  cardsById: Record<string, CardInstance>;
  actions: Record<string, ActionState>;
  unlockedActionIds: string[];
  flags: Record<string, boolean | string | number>;
  logs: GameLogEntry[];
  activeEventId?: string;
  ending?: EndingState;
  nowMs: number;
}

interface ActionState {
  actionId: string;
  slotCardIds: Record<string, string | null>;
  run?: ActionRun;
}

interface ActionRun {
  runId: string;
  recipeId: string;
  startedAtMs: number;
  durationMs: number;
  inputCardIds: string[];
}
```

## 5. Reducer 事件

建议 action union：

```ts
type GameAction =
  | { type: 'PLACE_CARD_IN_SLOT'; cardId: string; actionId: string; slotId: string }
  | { type: 'REMOVE_CARD_FROM_SLOT'; actionId: string; slotId: string }
  | { type: 'START_ACTION'; actionId: string }
  | { type: 'TICK'; nowMs: number }
  | { type: 'CLAIM_ACTION'; actionId: string }
  | { type: 'CHOOSE_EVENT'; eventId: string; choiceId: string }
  | { type: 'ADD_LOG'; message: string; level?: GameLogLevel }
  | { type: 'RESET_GAME' };
```

状态转移要求：

- reducer 必须保持不可变更新。
- 非法操作应返回原 state，并通过 UI selector 给出错误提示；不要让 reducer 抛异常影响界面。
- `TICK` 只更新时间和完成状态，不直接产出卡牌。
- `CLAIM_ACTION` 应结算配方输出、消耗输入、写日志、设置 flag、触发事件或结局。

## 6. 拖拽流程

推荐流程：

1. 用户开始拖动 `CardView`。
2. `ActionSlot` 根据 `canPlaceCardInSlot(state, cardId, actionId, slotId)` 显示合法/非法悬停反馈。
3. 用户释放卡牌。
4. UI 派发 `PLACE_CARD_IN_SLOT`。
5. reducer 再次校验，合法则更新卡牌 location 和槽位引用。
6. selector `selectMatchedRecipeForAction` 判断动作是否可开始。
7. 玩家点击开始，派发 `START_ACTION`。
8. 倒计时完成后玩家点击领取，派发 `CLAIM_ACTION`。

点击替代方案预留：

- 点击卡牌进入 selected 状态。
- 点击合法槽位完成放置。

## 7. 初始内容配置

MVP 至少包含这些卡牌：

| id | 类型 | 标签 | 说明 |
| --- | --- | --- | --- |
| `energy` | `resource` | `body`, `effort` | 执行动作的基础资源。 |
| `money` | `resource` | `money` | 日常工作产物。 |
| `poor-clue` | `clue` | `explore`, `mundane` | 初始线索。 |
| `strange-clue` | `clue` | `explore`, `occult` | 探索后出现的线索。 |
| `hidden-knowledge` | `knowledge` | `occult`, `forbidden` | 研究产物。 |
| `dream-echo` | `ritual` | `dream`, `ritual` | 休息或梦境产物。 |
| `will` | `state` | `mental`, `ritual` | 仪式所需状态。 |
| `morning-star-ending` | `ending` | `victory` | 胜利结局。 |

MVP 至少包含这些动作：

- `work`：将精力转为金钱或意志。
- `explore`：将贫瘠线索推进为奇怪线索。
- `research`：将奇怪线索推进为隐秘知识。
- `rest`：获得梦境残响或恢复精力。
- `ritual`：使用隐秘知识、梦境残响和意志触发胜利。

## 8. UI 组件职责

- `App`：应用入口，挂载 provider 和主布局。
- `GameProvider`：持有 reducer、dispatch 和 selectors。
- `StatusBar`：显示资源、当前目标、结局状态。
- `CardPile`：渲染桌面上未占用卡牌。
- `CardView`：显示单张卡牌并提供拖拽源。
- `ActionBox`：显示动作名称、槽位、进度、开始/领取按钮。
- `ActionSlot`：显示槽位需求和拖放反馈。
- `LogPanel`：显示最近日志。
- `EventModal`：显示剧情事件和选项。

组件边界：

- 组件不直接修改 state。
- 组件不直接读取数据配置以外的全局变量。
- 规则判断放入 `game/rules.ts` 和 `game/selectors.ts`。

## 9. Selectors 与规则函数

必须实现或等价实现：

```ts
getCardDefinition(cardIdOrDefinitionId)
selectVisibleCards(state)
selectActionState(state, actionId)
canPlaceCardInSlot(state, cardId, actionId, slotId)
selectMatchedRecipeForAction(state, actionId)
selectActionProgress(state, actionId)
selectCanStartAction(state, actionId)
selectCanClaimAction(state, actionId)
selectUnlockedActions(state)
selectEnding(state)
```

规则函数应为纯函数，便于单元测试。

## 10. 存档策略

MVP 可以使用 `localStorage`。

- 存档 key：`sos-card-game-save-v1`。
- 存档内容：`GameState` 中可序列化部分。
- 不存函数、组件状态、拖拽临时状态。
- 加载失败时回退到初始状态并写一条日志。

## 11. 测试要求

单元测试优先覆盖：

- 卡牌能否进入槽位。
- 配方匹配。
- 动作开始后卡牌锁定。
- 动作结算后产出、消耗和日志。
- 解锁研究、仪式和胜利结局。

UI/端到端测试后续使用 Playwright 覆盖：

- 拖拽合法卡牌到槽位。
- 非法拖拽被拒绝。
- 完整胜利路径。
- 结局弹层出现后不能继续启动动作。

## 12. 验收标准

- 玩家从初始状态不看开发者工具也能完成一条胜利路径。
- 每次非法操作都有反馈。
- 每次动作完成都有日志。
- 游戏规则只依赖配置和纯函数。
- React 组件没有承载核心规则分支。
- AI 后续开发不得引入后端依赖作为 MVP 必需项。

