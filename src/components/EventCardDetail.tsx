import { cardDefinitionMap, cardOutputRules } from '../game/cardData'
import type { CardDefinitionRecord } from '../game/types'

export function EventCardDetail({
  definition,
  onClose,
}: {
  definition: CardDefinitionRecord
  onClose: () => void
}) {
  const relatedRules = cardOutputRules.filter(
    (rule) => rule.parentDefinitionId === definition.id,
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

        <p className="event-detail-note">{definition.note}</p>
        {definition.details ? (
          <p className="event-detail-copy">{definition.details}</p>
        ) : null}

        <div className="event-detail-rules">
          <h3>可触发结果</h3>
          <ul>
            {relatedRules.map((rule) => {
              const childDefinition = rule.childDefinitionId
                ? cardDefinitionMap.get(rule.childDefinitionId)
                : null
              const outputDefinition = rule.outputDefinitionId
                ? cardDefinitionMap.get(rule.outputDefinitionId)
                : null

              return (
                <li key={rule.id}>
                  <strong>{childDefinition?.name ?? rule.childDefinitionId}</strong>
                  <span>
                    {rule.consumeChild ? '消耗' : '保留'}
                    {childDefinition?.name ?? rule.childDefinitionId}
                    ，
                    {outputDefinition ? `产出 ${outputDefinition.name}` : '不产出任何卡牌'}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}
