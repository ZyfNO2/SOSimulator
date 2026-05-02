import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { CARD_SPAWN_ANIMATION_MS } from '../game/constants'
import { getCardZIndex } from '../game/stacking'
import type { TableCard } from '../game/types'

export function CardView({
  card,
  cards,
  index,
  draggingId,
  nowMs,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClick,
}: {
  card: TableCard
  cards: TableCard[]
  index: number
  draggingId: string | null
  nowMs: number
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, cardId: string) => void
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onClick: (cardId: string) => void
}) {
  const isDragging = draggingId === card.id
  const isSpawning =
    typeof card.spawnedAtMs === 'number' &&
    nowMs - card.spawnedAtMs < CARD_SPAWN_ANIMATION_MS

  return (
    <button
      key={card.id}
      type="button"
      className={`card card-${card.accent}${isDragging ? ' is-dragging' : ''}${
        isSpawning ? ' is-spawning' : ''
      }`}
      style={
        {
          '--card-x': `${card.x}px`,
          '--card-y': `${card.y}px`,
          '--spawn-origin-x': `${card.spawnOriginX ?? card.x}px`,
          '--spawn-origin-y': `${card.spawnOriginY ?? card.y}px`,
          zIndex: getCardZIndex(cards, card.id, draggingId, index),
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
        {(card.quantity ?? 1) > 1 ? <span className="card-quantity">X{card.quantity}</span> : null}
      </strong>
      <span className="card-kind-band">
        <span className="card-kind">{card.kindLabel}</span>
      </span>
      <span className="card-note">{card.note}</span>
    </button>
  )
}
