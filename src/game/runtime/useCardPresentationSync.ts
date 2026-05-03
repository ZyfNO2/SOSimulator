import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { getCardDefinitionMapForLevel } from '../cardData'
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  RESOURCE_MOTHER_GAP,
  RESOURCE_MOTHER_PADDING_BOTTOM,
  RESOURCE_MOTHER_PADDING_LEFT,
} from '../constants'
import type { LevelId } from '../levels'
import { clamp } from '../stacking'
import type { TableCard } from '../types'

const MOTHER_CARD_DEFINITION_IDS = ['energy', 'time'] as const

function getMotherCardPosition(
  definitionId: (typeof MOTHER_CARD_DEFINITION_IDS)[number],
  boardWidth: number,
  boardHeight: number,
) {
  const index = MOTHER_CARD_DEFINITION_IDS.indexOf(definitionId)
  const x = RESOURCE_MOTHER_PADDING_LEFT + index * (CARD_WIDTH + RESOURCE_MOTHER_GAP)
  const y = Math.max(boardHeight - CARD_HEIGHT - RESOURCE_MOTHER_PADDING_BOTTOM, 0)

  return {
    x: clamp(x, 0, Math.max(boardWidth - CARD_WIDTH, 0)),
    y,
  }
}

function syncMotherCardsToBoard(
  currentCards: TableCard[],
  boardWidth: number,
  boardHeight: number,
) {
  let hasChanges = false

  const nextCards = currentCards.map((card) => {
    if (!card.isMother || (card.definitionId !== 'energy' && card.definitionId !== 'time')) {
      return card
    }

    const nextPosition = getMotherCardPosition(
      card.definitionId,
      boardWidth,
      boardHeight,
    )

    if (card.x === nextPosition.x && card.y === nextPosition.y) {
      return card
    }

    hasChanges = true
    return {
      ...card,
      x: nextPosition.x,
      y: nextPosition.y,
      parentCardId: null,
      childCardId: null,
    }
  })

  return hasChanges ? nextCards : currentCards
}

type UseCardPresentationSyncArgs = {
  currentLevelId: LevelId | null
  boardRef: MutableRefObject<HTMLDivElement | null>
  cards: TableCard[]
  hasStarted: boolean
  setCards: Dispatch<SetStateAction<TableCard[]>>
  setSeenDefinitionIds: Dispatch<SetStateAction<string[]>>
}

export function useCardPresentationSync({
  currentLevelId,
  boardRef,
  cards,
  hasStarted,
  setCards,
  setSeenDefinitionIds,
}: UseCardPresentationSyncArgs) {
  useEffect(() => {
    const presentDefinitionIds = cards.map((card) => card.definitionId)

    setSeenDefinitionIds((currentIds) => {
      const nextIds = [...currentIds]
      let hasChanges = false

      for (const definitionId of presentDefinitionIds) {
        if (nextIds.includes(definitionId)) {
          continue
        }

        nextIds.push(definitionId)
        hasChanges = true
      }

      return hasChanges ? nextIds : currentIds
    })
  }, [cards, setSeenDefinitionIds])

  useEffect(() => {
    const boardBounds = boardRef.current?.getBoundingClientRect()

    if (!boardBounds) {
      return
    }

    setCards((currentCards) =>
      syncMotherCardsToBoard(currentCards, boardBounds.width, boardBounds.height),
    )
  }, [boardRef, hasStarted, setCards])

  useEffect(() => {
    const handleResize = () => {
      const boardBounds = boardRef.current?.getBoundingClientRect()

      if (!boardBounds) {
        return
      }

      setCards((currentCards) =>
        syncMotherCardsToBoard(currentCards, boardBounds.width, boardBounds.height),
      )
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [boardRef, setCards])

  useEffect(() => {
    const activeCardDefinitionMap = getCardDefinitionMapForLevel(currentLevelId)

    setCards((currentCards) => {
      let hasChanges = false

      const nextCards = currentCards.map((card) => {
        const definition = activeCardDefinitionMap.get(card.definitionId)

        if (!definition) {
          return card
        }

        if (
          card.name === definition.name &&
          card.kind === definition.kind &&
          card.kindLabel === definition.kindLabel &&
          card.note === definition.note &&
          card.accent === definition.accent
        ) {
          return card
        }

        hasChanges = true
        return {
          ...card,
          name: definition.name,
          kind: definition.kind,
          kindLabel: definition.kindLabel,
          note: definition.note,
          accent: definition.accent,
        }
      })

      return hasChanges ? nextCards : currentCards
    })
  }, [currentLevelId, setCards])
}
