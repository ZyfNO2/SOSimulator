import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react'
import { BackgroundSlideText } from './BackgroundSlideText'
import { CardView } from './CardView'
import { ProductionEffect } from './ProductionEffect'
import type { ProductionRun, TableCard } from '../game/types'

type StoryState = {
  chapter: 'umbrella' | 'testimony' | 'missing-owner' | 'final-rain'
  obsessionLevel: number
  distortionLevel: number
  unlockedDefinitionIds: string[]
}

export function CardBoard({
  boardRef,
  cards,
  productions,
  draggingId,
  nowMs,
  storyState,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onCardClick,
}: {
  boardRef: MutableRefObject<HTMLDivElement | null>
  cards: TableCard[]
  productions: ProductionRun[]
  draggingId: string | null
  nowMs: number
  storyState: StoryState
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, cardId: string) => void
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onCardClick: (cardId: string) => void
}) {
  return (
    <section ref={boardRef} className="table" aria-label="游戏桌面空地">
      <div className="table-noise" aria-hidden="true" />
      <BackgroundSlideText cards={cards} storyState={storyState} />

      {productions.map((run) => (
        <ProductionEffect key={run.id} run={run} nowMs={nowMs} cards={cards} />
      ))}

      {cards.map((card, index) => (
        <CardView
          key={card.id}
          card={card}
          cards={cards}
          index={index}
          draggingId={draggingId}
          nowMs={nowMs}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={onCardClick}
        />
      ))}
    </section>
  )
}
