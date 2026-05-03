import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react'
import { BackgroundSlideText } from './BackgroundSlideText'
import { BackgroundCharacterPortraits } from './BackgroundCharacterPortraits'
import { CardView } from './CardView'
import { ProductionEffect } from './ProductionEffect'
import type { LevelId } from '../game/levels'
import type { ProductionRun, TableCard } from '../game/types'

type StoryState = {
  chapter: 'umbrella' | 'testimony' | 'missing-owner' | 'final-rain'
  obsessionLevel: number
  distortionLevel: number
  unlockedDefinitionIds: string[]
}

export function CardBoard({
  currentLevelId,
  boardRef,
  cards,
  productions,
  draggingStackIds,
  nowMs,
  portraitFlashUntilByDefinitionId,
  storyState,
  hasStarted,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onCardClick,
}: {
  currentLevelId: LevelId
  boardRef: MutableRefObject<HTMLDivElement | null>
  cards: TableCard[]
  productions: ProductionRun[]
  draggingStackIds: string[] | null
  nowMs: number
  portraitFlashUntilByDefinitionId: Partial<
    Record<'kyon' | 'haruhi' | 'asahina' | 'nagato' | 'koizumi', number>
  >
  storyState: StoryState
  hasStarted: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, cardId: string) => void
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onCardClick: (cardId: string) => void
}) {
  const orderedCards = (() => {
    if (!draggingStackIds || draggingStackIds.length === 0) {
      return cards
    }

    const draggingIdSet = new Set(draggingStackIds)
    const draggingCards = draggingStackIds
      .map((cardId) => cards.find((card) => card.id === cardId) ?? null)
      .filter((card): card is TableCard => card !== null)
    const remainingCards = cards.filter((card) => !draggingIdSet.has(card.id))

    return [...remainingCards, ...draggingCards]
  })()

  return (
    <section ref={boardRef} className="table" aria-label="游戏桌面空地">
      <div className="table-noise" aria-hidden="true" />
      <BackgroundSlideText
        currentLevelId={currentLevelId}
        cards={cards}
        storyState={storyState}
      />
      <BackgroundCharacterPortraits
        portraitFlashUntilByDefinitionId={portraitFlashUntilByDefinitionId}
      />

      {productions.map((run) => (
        <ProductionEffect key={run.id} run={run} nowMs={nowMs} cards={cards} />
      ))}

      {orderedCards.map((card, index) => (
        <CardView
          key={card.id}
          card={card}
          cards={cards}
          index={index}
          draggingStackIds={draggingStackIds}
          nowMs={nowMs}
          hasStarted={hasStarted}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={onCardClick}
        />
      ))}
    </section>
  )
}
