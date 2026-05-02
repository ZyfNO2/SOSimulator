import eventCardData from '../data/Event_Card.json'
import { cardDefinitionMap, cardOutputRules } from '../game/cardData'
import type { CardDefinitionRecord, TableCard } from '../game/types'

type EventCardRuleRecord = {
  childDefinitionId: string
  title?: string
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

export function EventCardDetail({
  card,
  definition,
  nowMs,
  onClose,
}: {
  card: TableCard
  definition: CardDefinitionRecord
  nowMs: number
  onClose: () => void
}) {
  const usableRules = cardOutputRules.filter(
    (rule) => rule.inputDefinitionIds.includes(definition.id),
  )
  const producedByRules = cardOutputRules.filter((rule) =>
    rule.outputDefinitionIds.includes(definition.id),
  )
  const eventCardDefinition = eventCardMap.get(definition.id)
  const note = eventCardDefinition?.note ?? definition.note
  const details = eventCardDefinition?.details ?? definition.details
  const configuredRules = eventCardDefinition?.rules ?? []
  const usageRules =
    configuredRules.length > 0
      ? configuredRules.map((rule) => ({
          key: `${definition.id}-${rule.childDefinitionId}`,
          title:
            rule.title ??
            cardDefinitionMap.get(rule.childDefinitionId)?.name ??
            rule.childDefinitionId,
          description: rule.description,
        }))
      : usableRules.map((rule) => {
          const inputDefinitionIds = rule.inputDefinitionIds.filter(
            (inputId) => inputId !== definition.id,
          )
          const inputNames = inputDefinitionIds.map(
            (inputId) => cardDefinitionMap.get(inputId)?.name ?? inputId,
          )
          const outputNames = rule.outputDefinitionIds.map(
            (outputId) => cardDefinitionMap.get(outputId)?.name ?? outputId,
          )

          return {
            key: rule.id,
            title: inputNames.length > 0 ? inputNames.join(' + ') : '直接触发',
            description: `${inputNames.length > 0 ? `投入 ${inputNames.join(' + ')}，` : ''}${
              outputNames.length > 0 ? `产出 ${outputNames.join(' + ')}` : '不产出任何卡牌'
            }`,
          }
        })
  const sourceRules = producedByRules.map((rule) => {
    const inputNames = rule.inputDefinitionIds.map(
      (inputId) => cardDefinitionMap.get(inputId)?.name ?? inputId,
    )

    return {
      key: `source-${rule.id}`,
      title: inputNames.join(' + '),
      description: '可以通过这组组合得到这张卡。',
    }
  })
  const decaySeconds =
    typeof card.decayAtMs === 'number' ? Math.max(0, Math.ceil((card.decayAtMs - nowMs) / 1000)) : null
  const decayOutputNames = (card.decayOutputDefinitionIds ?? []).map(
    (definitionId) => cardDefinitionMap.get(definitionId)?.name ?? definitionId,
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

        <p className="event-detail-note">{note}</p>
        {details ? <p className="event-detail-copy">{details}</p> : null}
        {decaySeconds !== null ? (
          <p className="event-detail-copy">
            这是一个临时状态。若未继续使用，约 {decaySeconds} 秒后会自动分解
            {decayOutputNames.length > 0 ? `为 ${decayOutputNames.join(' + ')}` : ''}。
          </p>
        ) : null}

        <div className="event-detail-rules">
          <h3>这张卡可以做什么</h3>
          <ul>
            {usageRules.length > 0 ? usageRules.map((rule) => (
              <li key={rule.key}>
                <strong>{rule.title}</strong>
                <span>{rule.description}</span>
              </li>
            )) : (
              <li>
                <strong>当前暂无明确用途</strong>
                <span>它更像一个阶段性的剧情物件，后续也许会有新的联系。</span>
              </li>
            )}
          </ul>
        </div>

        <div className="event-detail-rules">
          <h3>这张卡从哪里来</h3>
          <ul>
            {sourceRules.length > 0 ? sourceRules.map((rule) => (
              <li key={rule.key}>
                <strong>{rule.title}</strong>
                <span>{rule.description}</span>
              </li>
            )) : (
              <li>
                <strong>初始或剧情出现</strong>
                <span>这张卡可能来自开局配置、剧情刷新，或尚未写入的隐藏规则。</span>
              </li>
            )}
          </ul>
        </div>
      </section>
    </div>
  )
}
