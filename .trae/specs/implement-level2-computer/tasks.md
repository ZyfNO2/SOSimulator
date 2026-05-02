# Tasks

- [ ] Task 1: 扩展数据层——新增关卡2卡牌定义与合成规则
  - [ ] SubTask 1.1: 在 `CardKind.json` 新增关卡2所需卡牌（computer-club, computer-club-president, blackmail, yen, computer, electronics-store, convenience-store）
  - [ ] SubTask 1.2: 在 `CardOutput.json` 新增关卡2合成规则（路线A：把柄→电脑；路线B：日元×4→电脑；角色打工产出日元）
  - [ ] SubTask 1.3: 在 `types.ts` 的 `TableCard` 新增 `isWorking?: boolean` 字段
  - [ ] SubTask 1.4: 在 `levelData.ts` 新增 `createLevel2Config()` 函数，定义初始桌面布局

- [ ] Task 2: 构建关卡2游戏组件核心框架
  - [ ] SubTask 2.1: 创建 `Level2Game.tsx`，复制 `Level1Game.tsx` 基础结构并适配关卡2
  - [ ] SubTask 2.2: 创建 `Level2Game.css`，添加打工状态灰度样式 `is-working`
  - [ ] SubTask 2.3: 实现关卡2初始卡牌渲染与基础拖拽逻辑

- [ ] Task 3: 实现路线A——非正常手段（原著路线）
  - [ ] SubTask 3.1: 实现 `电脑研究部 + 凉宫春日` → 「把柄」合成规则与产出
  - [ ] SubTask 3.2: 实现 `把柄 + 电脑研究部部长` → 「电脑」合成规则与产出
  - [ ] SubTask 3.3: 产出电脑时触发胜利结局弹窗

- [ ] Task 4: 实现路线B——打工赚钱路线
  - [ ] SubTask 4.1: 实现 `便利店 + 角色` → 「日元」合成规则（时长5秒）
  - [ ] SubTask 4.2: 实现 `电子城 + 日元×4` → 「电脑」合成规则（消耗4个日元）
  - [ ] SubTask 4.3: 日元卡牌支持堆叠显示（复用 `isStackable` 机制）
  - [ ] SubTask 4.4: 产出电脑时触发胜利结局弹窗

- [ ] Task 5: 实现角色打工状态机制
  - [ ] SubTask 5.1: 角色进入打工合成时设置 `isWorking: true`
  - [ ] SubTask 5.2: `isWorking` 状态下卡牌添加灰度滤镜、禁止拖动、禁止作为其他合成输入
  - [ ] SubTask 5.3: 打工合成完成后（产出日元）恢复 `isWorking: false`
  - [ ] SubTask 5.4: 在 `stacking.ts` 的吸附检测中排除 `isWorking` 卡牌作为有效输入

- [ ] Task 6: 实现凉宫春日打工特殊惩罚
  - [ ] SubTask 6.1: 凉宫春日进入便利店打工时立即生成5个闭锁空间（随机位置）
  - [ ] SubTask 6.2: 复用 Level1 的闭锁空间计数与失败判定逻辑（≥6个失败）
  - [ ] SubTask 6.3: 凉宫打工期间保持 `isWorking` 状态，无法交互

- [ ] Task 7: 集成与路由
  - [ ] SubTask 7.1: 更新 `App.tsx` 添加 `level2` 屏幕状态与路由
  - [ ] SubTask 7.2: 更新 `LevelSelect.tsx` 解锁关卡2入口（通关关卡1后可进入，或暂时直接解锁）
  - [ ] SubTask 7.3: 验证关卡2从选关页面可正常进入

- [ ] Task 8: 验证与测试
  - [ ] SubTask 8.1: 运行 `npm run lint` 检查代码规范
  - [ ] SubTask 8.2: 运行 `npm run build` 检查 TypeScript 编译
  - [ ] SubTask 8.3: 手动验证路线A通关流程
  - [ ] SubTask 8.4: 手动验证路线B通关流程
  - [ ] SubTask 8.5: 手动验证凉宫打工惩罚机制（5个闭锁空间+失败判定）

# Task Dependencies
- Task 1 必须在 Task 2 之前完成（数据层先定义）
- Task 2 必须在 Task 3/4/5/6 之前完成（组件框架先搭建）
- Task 3 和 Task 4 可以并行开发（两条独立路线）
- Task 5 必须在 Task 4 之前完成（打工状态是路线B的基础）
- Task 6 依赖 Task 5（凉宫打工是角色打工的特例）
- Task 7 可以在 Task 2 之后随时进行（路由集成相对独立）
- Task 8 必须在所有功能任务完成后进行
