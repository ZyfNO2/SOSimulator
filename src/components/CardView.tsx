import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { CARD_SPAWN_ANIMATION_MS, RESOURCE_MOTHER_REFILL_MS } from '../game/constants'
import { getCardZIndex } from '../game/stacking'
import type { TableCard } from '../game/types'

export function CardView({
  card,
  cards,
  index,
  draggingStackIds,
  nowMs,
  hasStarted,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClick,
}: {
  card: TableCard
  cards: TableCard[]
  index: number
  draggingStackIds: string[] | null
  nowMs: number
  hasStarted: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, cardId: string) => void
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onClick: (cardId: string) => void
}) {
  const isDragging = draggingStackIds?.[0] === card.id
  const isWaitingToSpawn =
    typeof card.spawnedAtMs === 'number' && nowMs < card.spawnedAtMs
  const isSpawning =
    typeof card.spawnedAtMs === 'number' &&
    nowMs >= card.spawnedAtMs &&
    nowMs - card.spawnedAtMs < CARD_SPAWN_ANIMATION_MS
  const isMother = card.isMother === true

  return (
    <button
      key={card.id}
      type="button"
      className={`card card-${card.accent}${isDragging ? ' is-dragging' : ''}${
        isSpawning ? ' is-spawning' : ''
      }${!hasStarted ? ' is-hidden-before-start' : ''}${
        isWaitingToSpawn ? ' is-waiting-spawn' : ''
      }${isMother ? ' is-mother-card' : ''}${
        typeof card.refillStartedAtMs === 'number' ? ' is-refilling' : ''
      }`}
      style={
        {
          '--card-x': `${card.x}px`,
          '--card-y': `${card.y}px`,
          '--spawn-origin-x': `${card.spawnOriginX ?? card.x}px`,
          '--spawn-origin-y': `${card.spawnOriginY ?? card.y}px`,
          '--refill-progress':
            typeof card.refillStartedAtMs === 'number'
              ? `${Math.min(
                  Math.max((nowMs - card.refillStartedAtMs) / RESOURCE_MOTHER_REFILL_MS, 0),
                  1,
                )}`
              : '0',
          zIndex: getCardZIndex(cards, card.id, draggingStackIds, index),
        } as CSSProperties
      }
      onPointerDown={(event) => onPointerDown(event, card.id)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={() => onClick(card.id)}
    >
      <strong className="card-name">
        <span>{card.name}</span>
        {(card.quantity ?? 1) > 1 || isMother ? (
          <span className="card-quantity">X{card.quantity ?? 0}</span>
        ) : null}
      </strong>
      <span className="card-kind-band">
        <span className="card-kind">{card.kindLabel}</span>
      </span>
      <span className="card-note">{card.note}</span>
      {isMother ? <span className="card-mother-hint">左键拖出 1 张</span> : null}
    </button>
  )
}
