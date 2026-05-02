# 关卡2：电脑的获取 Spec

## Why
第一关已完成 SOS 团成立与全员集结。第二关需要围绕「获取电脑」这一原著经典情节展开，提供两条风格迥异的通关路线：凉宫式的"非正常手段"与常规打工赚钱路线，同时引入角色打工变灰、闭锁空间惩罚等新机制。

## What Changes
- 新增关卡2游戏组件 `Level2Game.tsx` 及其样式
- 新增关卡2配置 `createLevel2Config()` 在 `levelData.ts`
- 新增关卡2专用卡牌定义：电脑研究部、把柄、日元、电脑（通关卡）、电子城、便利店（打工地点）
- 新增关卡2专用合成规则（两条路线）
- 新增角色打工状态机制：打工中角色变灰、不可交互、不可拖动（地点+人物触发打工）
- 新增凉宫春日打工特殊惩罚：生成5个闭锁空间，6个直接失败
- 更新 `App.tsx` 支持 `level2` 路由
- 更新 `LevelSelect.tsx` 解锁关卡2入口
- **BREAKING**: `TableCard` 类型新增 `isWorking?: boolean` 字段标识打工状态
- **BREAKING**: `CardDefinitionRecord` 新增 `isStackable?: boolean` 支持日元堆叠

## Impact
- Affected specs: 卡牌系统、合成系统、关卡系统、UI状态
- Affected code: `App.tsx`, `LevelSelect.tsx`, `Level1Game.tsx`（参考）, `levelData.ts`, `types.ts`, `CardKind.json`, `CardOutput.json`

## ADDED Requirements

### Requirement: 关卡2初始桌面
The system SHALL 在关卡2开始时在桌面上生成以下卡牌：
- 凉宫春日（可拖动）
- 阿虚（可拖动）
- 长门有希（可拖动）
- 朝比奈实玖瑠（可拖动）
- 电脑研究部（地点卡，不可拖动，作为背景/目标地点）
- 电脑研究部部长（NPC卡，可拖动）

### Requirement: 路线A——非正常手段（原著路线）
The system SHALL 提供以下合成链：
1. `电脑研究部 + 凉宫春日` → 产出「把柄」（消耗：无，时长：4秒）
2. `把柄 + 电脑研究部部长` → 产出「电脑」（消耗：把柄，时长：3秒）
3. 产出「电脑」时触发胜利结局

#### Scenario: 路线A成功
- **WHEN** 玩家将凉宫春日拖入电脑研究部
- **THEN** 4秒后产出「把柄」卡牌
- **WHEN** 玩家将把柄拖入电脑研究部部长
- **THEN** 3秒后消耗把柄，产出「电脑」，触发胜利

### Requirement: 路线B——打工赚钱（常规路线）
The system SHALL 提供以下合成链：
1. `便利店 + 凉宫春日/阿虚/长门有希/朝比奈实玖瑠` → 产出「日元」（消耗：无，时长：5秒）
2. `电子城 + 日元` → 产出「电脑」（消耗：4个日元，时长：3秒）
3. 产出「电脑」时触发胜利结局

#### Scenario: 路线B成功
- **WHEN** 玩家将任意角色拖入便利店
- **THEN** 5秒后产出1个「日元」卡牌（可堆叠）
- **WHEN** 玩家收集4个日元并拖入电子城
- **THEN** 3秒后消耗4个日元，产出「电脑」，触发胜利

### Requirement: 角色打工状态
The system SHALL 在角色参与打工合成（路线B的便利店+人物组合）时：
- 该角色卡牌进入 `isWorking: true` 状态
- `isWorking` 状态下：卡牌变灰（grayscale）、不可拖动、不可作为其他合成的输入
- 打工合成完成后（产出日元），角色恢复 `isWorking: false`
- 打工期间角色仍显示在桌面上，但无法交互

#### Scenario: 角色打工变灰
- **WHEN** 玩家将长门有希拖入便利店开始打工
- **THEN** 长门有希卡牌变灰，无法拖动
- **THEN** 5秒后产出日元，长门有希恢复可交互状态

### Requirement: 凉宫春日打工特殊惩罚
The system SHALL 在凉宫春日进入打工状态（拖入便利店）时：
- 立即生成5个「闭锁空间」卡牌（随机位置）
- 桌面上每存在一个闭锁空间，凉宫春日的忧郁度持续累积
- 如果闭锁空间数量达到6个，立即触发失败结局「世界被闭锁空间吞噬」
- 凉宫春日打工期间无法被拖动、无法参与其他合成

#### Scenario: 凉宫打工惩罚
- **WHEN** 玩家将凉宫春日拖入便利店打工
- **THEN** 立即生成5个闭锁空间
- **THEN** 如果玩家未及时处理，闭锁空间达到6个时触发失败

### Requirement: 关卡2胜利与失败结局
The system SHALL 在以下情况触发结局：
- **胜利**：产出「电脑」卡牌时，显示「SOS团获得了新电脑！」
- **失败**：闭锁空间数量 ≥ 6 时，显示「闭锁空间吞噬了一切……」

## MODIFIED Requirements

### Requirement: TableCard 类型扩展
```typescript
export type TableCard = {
  // ... existing fields ...
  /** 是否正在打工（关卡2机制） */
  isWorking?: boolean
}
```

### Requirement: CardKind.json 新增定义
新增以下卡牌定义：
- `computer-club`：电脑研究部（地点）
- `computer-club-president`：电脑研究部部长（NPC）
- `blackmail`：把柄（线索）
- `yen`：日元（资源，可堆叠）
- `computer`：电脑（道具/通关卡）
- `electronics-store`：电子城（地点）
- `convenience-store`：便利店（打工地点）

## REMOVED Requirements
无移除需求。第一关机制（闭锁空间、忧郁度）在第二关中复用并扩展。
