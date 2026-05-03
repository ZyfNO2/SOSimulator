import eventCardData from '../data/Event_Card.json'
import {
  getCardDefinitionMapForLevel,
  getCardOutputRulesForLevel,
} from '../game/cardData'
import type { LevelId } from '../game/levels'
import type { CardDefinitionRecord, TableCard } from '../game/types'

type EventCardRuleRecord = {
  childDefinitionId: string
  description: string
}

type EventCardRecord = {
  id: string
  note?: string
  details?: string
  rules?: EventCardRuleRecord[]
}

const eventCardMap = new Map(
  (eventCardData as EventCardRecord[]).map((card) => [card.id, card]),
)

function formatCardNameList(names: string[]) {
  if (names.length === 0) {
    return ''
  }

  if (names.length === 1) {
    return names[0]
  }

  return `${names.slice(0, -1).join('、')} 和 ${names[names.length - 1]}`
}

function buildUsageHint(inputNames: string[]) {
  if (inputNames.length === 0) {
    return '它眼下还安静地停在这里，像一句没说完的话，只等别的东西过来把后半句接上。'
  }

  if (inputNames.length === 1) {
    const [onlyName] = inputNames

    if (onlyName === '时间') {
      return '只要再往它身上压一点放学后的时间，原本模糊的走向往往就会自己显影。'
    }

    if (onlyName === '精力') {
      return '肯为它再分出一点精力，它就不会继续安静下去，底下压着的变化迟早会露头。'
    }

    if (onlyName.startsWith('春日')) {
      return `只要春日的目光真正落到它身上，这件事就很难再按普通的方式结束。`
    }

    if (onlyName.startsWith('长门')) {
      return '一旦长门介入，原本只剩气氛支撑的异样，就会慢慢长出一条能被解释的线。'
    }

    if (onlyName.includes('商店')) {
      return '只要把它带回那条最现实的路线上，很多看似无关的边角就会重新接到一起。'
    }

    if (onlyName.includes('天气')) {
      return '当天色也被卷进来之后，这件事通常就不会再只停留在传闻那么简单。'
    }

    return `一旦 ${onlyName} 靠近，它就像忽然想起了什么，后面的事多半会顺着这点牵扯慢慢长出来。`
  }

  const [firstName, ...restNames] = inputNames

  if (firstName === '时间' || firstName === '精力') {
    return `若先替它分出一点${firstName}，再把 ${formatCardNameList(restNames)} 带过来，原本只是日常里的小事，往往会在这里悄悄拐进另一条路。`
  }

  if (firstName.startsWith('春日')) {
    return `只要先让春日把这件事认下来，再把 ${formatCardNameList(restNames)} 一并压上去，世界通常就会很给面子地替她补出下一段。`
  }

  if (firstName.includes('蓝色雨伞')) {
    return `一旦那把蓝伞先被牵进来，再叠上 ${formatCardNameList(restNames)}，空气里的许多巧合都会开始变得像是早有预谋。`
  }

  if (firstName.includes('天气')) {
    return `等天色先一步沉到底，再把 ${formatCardNameList(restNames)} 放上来，结局往往就离桌面不远了。`
  }

  return `若先让 ${firstName} 挨上来，再把 ${formatCardNameList(restNames)} 一并压过去，故事多半会在这里忽然换一种更像命运的说法继续往下走。`
}

export function EventCardDetail({
  currentLevelId,
  card,
  cards,
  definition,
  seenDefinitionIds,
  nowMs,
  onClose,
}: {
  currentLevelId: LevelId
  card: TableCard
  cards: TableCard[]
  definition: CardDefinitionRecord
  seenDefinitionIds: string[]
  nowMs: number
  onClose: () => void
}) {
  const activeCardDefinitionMap = getCardDefinitionMapForLevel(currentLevelId)
  const visibleDefinitionIdSet = new Set(cards.map((tableCard) => tableCard.definitionId))
  const seenDefinitionIdSet = new Set(seenDefinitionIds)
  const usableRules = getCardOutputRulesForLevel(currentLevelId).filter(
    (rule) => rule.inputDefinitionIds.includes(definition.id),
  )
  const eventCardDefinition = eventCardMap.get(definition.id)
  const note = eventCardDefinition?.note ?? definition.note
  const details = eventCardDefinition?.details ?? definition.details
  const configuredRules = eventCardDefinition?.rules ?? []
  const usageRules =
    configuredRules.length > 0
      ? configuredRules
          .filter(
            (rule) =>
              visibleDefinitionIdSet.has(rule.childDefinitionId) ||
              seenDefinitionIdSet.has(rule.childDefinitionId),
          )
          .map((rule) => ({
            key: `${definition.id}-${rule.childDefinitionId}`,
            description: rule.description,
          }))
      : usableRules.map((rule) => {
          const inputDefinitionIds = rule.inputDefinitionIds.filter(
            (inputId) => inputId !== definition.id,
          )
          const inputNames = inputDefinitionIds.map(
            (inputId) => activeCardDefinitionMap.get(inputId)?.name ?? inputId,
          )

          return {
            key: rule.id,
            inputDefinitionIds,
            description: buildUsageHint(inputNames),
          }
        }).filter((rule) =>
          rule.inputDefinitionIds.every(
            (inputId) =>
              visibleDefinitionIdSet.has(inputId) ||
              seenDefinitionIdSet.has(inputId),
          ),
        )
  const decaySeconds =
    typeof card.decayAtMs === 'number' ? Math.max(0, Math.ceil((card.decayAtMs - nowMs) / 1000)) : null
  const decayOutputNames = (card.decayOutputDefinitionIds ?? []).map(
    (definitionId) => activeCardDefinitionMap.get(definitionId)?.name ?? definitionId,
  )

  return (
    <div className="event-detail-backdrop" onClick={onClose} role="presentation">
      <section
        className="event-detail"
        onClick={(event) => event.stopPropagation()}
        aria-label={`${definition.name}详情`}
      >
        <div className="event-detail-head">
          <div>
            <p className="event-detail-kind">{definition.kindLabel}</p>
            <h2>{definition.name}</h2>
          </div>
          <button type="button" className="event-detail-close" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="event-detail-intro">
          <h3>卡片简介</h3>
          <p className="event-detail-note">{note}</p>
          {details ? <p className="event-detail-copy">{details}</p> : null}
        </div>
        {decaySeconds !== null ? (
          <p className="event-detail-copy">
            这是一个临时状态。若未继续使用，约 {decaySeconds} 秒后会自动分解
            {decayOutputNames.length > 0 ? `为 ${decayOutputNames.join(' + ')}` : ''}。
          </p>
        ) : null}

        <div className="event-detail-rules">
          <h3>它会把故事牵向哪边</h3>
          <ul>
            {usageRules.length > 0 ? usageRules.map((rule) => (
              <li key={rule.key}>
                <p>{rule.description}</p>
              </li>
            )) : (
              <li>
                <p>它现在还没有等来能回应它的东西，先别急着催它，故事会自己把下一根线头送过来。</p>
              </li>
            )}
          </ul>
        </div>
      </section>
    </div>
  )
}
