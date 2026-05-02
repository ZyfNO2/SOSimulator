# Checklist

## 数据层
- [x] `CardKind.json` 包含关卡2所需全部卡牌定义（computer-club, computer-club-president, blackmail, yen, computer, electronics-store, convenience-store）
- [x] `CardOutput.json` 包含关卡2全部合成规则（路线A、路线B、打工产出）
- [x] `types.ts` 的 `TableCard` 类型包含 `isWorking?: boolean` 字段
- [x] `levelData.ts` 包含 `createLevel2Config()` 函数，返回正确的初始桌面配置

## 组件与样式
- [x] `Level2Game.tsx` 组件存在且能正确渲染关卡2初始桌面
- [x] `Level2Game.css` 包含 `.is-working` 灰度样式
- [x] 打工中卡牌显示为灰色、不可拖动、不可作为合成输入

## 路线A——非正常手段
- [x] `电脑研究部 + 凉宫春日` 合成产出「把柄」
- [x] `把柄 + 电脑研究部部长` 合成产出「电脑」并触发胜利
- [x] 路线A胜利弹窗显示正确文案

## 路线B——打工赚钱
- [x] `便利店 + 角色` 合成产出「日元」
- [x] 日元卡牌支持堆叠
- [x] `电子城 + 日元×4` 合成产出「电脑」并触发胜利
- [x] 路线B胜利弹窗显示正确文案

## 打工状态机制
- [x] 角色进入打工合成时 `isWorking` 设为 true
- [x] `isWorking` 状态下角色灰度显示
- [x] `isWorking` 状态下角色不可拖动
- [x] `isWorking` 状态下角色不可被其他卡牌吸附合成
- [x] 打工合成完成后角色恢复 `isWorking: false`

## 凉宫春日打工惩罚
- [x] 凉宫春日进入打工时立即生成5个闭锁空间
- [x] 闭锁空间数量 ≥ 6 时触发失败结局
- [x] 凉宫打工期间保持不可交互状态

## 集成
- [x] `App.tsx` 支持切换到 `level2` 屏幕
- [x] `LevelSelect.tsx` 显示关卡2为可点击状态
- [x] 从选关页面点击关卡2能正确进入游戏

## 质量检查
- [x] `npm run lint` 无错误
- [x] `npm run build` 编译成功
