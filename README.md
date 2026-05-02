# 文档索引

本目录用于沉淀 React 拖拽卡牌网页小游戏的设计骨架与 AI 实现规范。人看的文档保持方向性，AI/Vibe Coding 文档提供可执行的开发约束。

## 推荐阅读顺序

1. [GDD](./doc/GDD.md)：理解游戏目标、核心循环与原型边界。
2. [CardSystem](./doc/CardSystem.md)：理解卡牌、槽位与配方的基本规则。
3. [UIUXLayout](./doc/UIUXLayout.md)：理解桌面布局与交互反馈。
4. [EventStoryTree](./doc/EventStoryTree.md)：理解剧情阶段与结局路径。
5. [PrototypeRequirements](./doc/PrototypeRequirements.md)：确认 MVP 验收标准。
6. [Glossary](./doc/Glossary.md)：统一术语。
7. [AI_SDD](./doc/AI_SDD.md)：给 AI/同伴开发者看的详细软件设计。
8. [AI_Rules](./doc/AI_Rules.md)：给 AI/同伴开发者看的开发规则。

## 文档定位

- 人看文档：只列大致骨架、关键方向和后续可扩展点。
- AI 文档：明确组件边界、数据契约、状态转移、测试标准和禁止事项。



## 当前实现状态

- 已有完整桌面拖拽与吸附链
- 已支持多输入 / 多输出规则
- 已支持资源堆叠与按数量消耗，例如 `时间 X3`
- 已支持左下角 `精力 / 时间` 母牌：场上总量最多 `2`，少于 `2` 时母牌自动补回，满 `2` 时不显示回充遮罩
- 已支持自动分解卡，例如 `现实阻力`
- 所有卡都可点击查看说明、来源和用途
- 已接入故事版数据：
  - [CardKind](.\src\data\CardKind.json)
  - [CardOutput](.\src\data\CardOutput.json)
  - [Back_text](.\src\data\Back_text.json)
  - [Event_Card](.\src\data\Event_Card.json)
- 已有轻量 `storyState`
- 已支持关键角色 / 事件自动解锁
- 已有右侧主线卡牌收纳栏
- 已有文件日志输出到项目根目录 `app.log`（dev / preview 环境）

## 当前更值得继续做的

- 验证三条结局链是否都能稳定走通
- 把 `BackgroundSlideText` 进一步完全数据化
- 继续拆分 [App.tsx](./src/App.tsx)
- 把通用详情面板从 `EventCardDetail` 改名
