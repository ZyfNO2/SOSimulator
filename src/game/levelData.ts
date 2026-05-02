import { cardDefinitionMap } from './cardData'
import type { TableCard, CardDefinitionRecord } from './types'

export interface LevelConfig {
  id: number
  name: string
  description: string
  initialCards: TableCard[]
  immovableCardIds: string[]
  victoryCondition: 'produce-card'
  victoryTargetDefinitionId: string
}

export function createLevel1Config(): LevelConfig {
  const haruhiDef = cardDefinitionMap.get('haruhi')
  const kyonDef = cardDefinitionMap.get('kyon')

  if (!haruhiDef || !kyonDef) {
    throw new Error('Missing required card definitions for level 1')
  }

  const haruhiCard: TableCard = {
    id: 'haruhi-level1',
    definitionId: haruhiDef.id,
    name: haruhiDef.name,
    kind: haruhiDef.kind,
    kindLabel: haruhiDef.kindLabel,
    note: haruhiDef.note,
    accent: haruhiDef.accent,
    x: 400,
    y: 250,
    parentCardId: null,
    childCardId: null,
  }

  const kyonCard: TableCard = {
    id: 'kyon-level1',
    definitionId: kyonDef.id,
    name: kyonDef.name,
    kind: kyonDef.kind,
    kindLabel: kyonDef.kindLabel,
    note: kyonDef.note,
    accent: kyonDef.accent,
    x: 400,
    y: 80,
    parentCardId: null,
    childCardId: null,
  }

  return {
    id: 1,
    name: '团长的召唤',
    description: '凉宫春日还没有发言……',
    initialCards: [haruhiCard, kyonCard],
    immovableCardIds: ['haruhi-level1'],
    victoryCondition: 'produce-card',
    victoryTargetDefinitionId: 'sos-declaration',
  }
}

export function createLevel2Config(): LevelConfig {
  const haruhiDef = cardDefinitionMap.get('haruhi')
  const kyonDef = cardDefinitionMap.get('kyon')
  const yukiDef = cardDefinitionMap.get('yuki')
  const mikuruDef = cardDefinitionMap.get('mikuru')
  const computerClubDef = cardDefinitionMap.get('computer-club')
  const presidentDef = cardDefinitionMap.get('computer-club-president')

  if (!haruhiDef || !kyonDef || !yukiDef || !mikuruDef || !computerClubDef || !presidentDef) {
    throw new Error('Missing required card definitions for level 2')
  }

  const createCard = (def: CardDefinitionRecord, id: string, x: number, y: number): TableCard => ({
    id,
    definitionId: def.id,
    name: def.name,
    kind: def.kind,
    kindLabel: def.kindLabel,
    note: def.note,
    accent: def.accent,
    x,
    y,
    parentCardId: null,
    childCardId: null,
  })

  return {
    id: 2,
    name: '电脑的获取',
    description: 'SOS团需要一台电脑。是使用非正常手段，还是老老实实打工赚钱？',
    initialCards: [
      createCard(haruhiDef, 'haruhi-level2', 100, 100),
      createCard(kyonDef, 'kyon-level2', 250, 100),
      createCard(yukiDef, 'yuki-level2', 400, 100),
      createCard(mikuruDef, 'mikuru-level2', 550, 100),
      createCard(computerClubDef, 'computer-club-level2', 100, 300),
      createCard(presidentDef, 'computer-club-president-level2', 300, 300),
    ],
    immovableCardIds: [],
    victoryCondition: 'produce-card',
    victoryTargetDefinitionId: 'computer',
  }
}
