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



## 工作完成截至 5.2 3.50am --芬奇

- 启动 npm run dev
- 初始界面
- 卡牌种类[CardKind](.\src\data\CardKind.json)
- 卡牌吸附,对应吸附后有产出动画
- 事件卡牌能点开
- 事件有不同的产出线[CardOutput](.\src\data\CardOutput.json)
- 我的codex蹬限额了，先睡了

## 后续想更改的

- 根据游戏开始时间刷新时间和精力，有持有上限
- 牌相同情况下可以叠加比如：金钱 X2
- 感觉手牌区可以不用做
