import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { TableCard } from '../game/types'

export function MainlineTray({
  trayRef,
  isOpen,
  archivedCards,
  onToggle,
  onStoredCardPointerDown,
}: {
  trayRef: RefObject<HTMLDivElement | null>
  isOpen: boolean
  archivedCards: TableCard[]
  onToggle: () => void
  onStoredCardPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    cardId: string,
  ) => void
}) {
  return (
    <aside
      ref={trayRef}
      className={`mainline-tray${isOpen ? ' is-open' : ''}`}
      aria-label="主线卡牌收纳栏"
    >
      <button type="button" className="mainline-tray-toggle" onClick={onToggle}>
        <span>主线</span>
        <strong>{archivedCards.length}</strong>
      </button>

      {isOpen ? (
        <div className="mainline-tray-panel">
          <div className="mainline-tray-header">
            <h2>主线卡牌</h2>
            <p>拖入收纳，按住拖回桌面。</p>
          </div>

          <div className="mainline-tray-list">
            {archivedCards.length > 0 ? (
              archivedCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={`mainline-tray-card card-${card.accent}`}
                  onPointerDown={(event) => onStoredCardPointerDown(event, card.id)}
                >
                  <strong className="mainline-tray-card-name">
                    <span>{card.name}</span>
                    {(card.quantity ?? 1) > 1 ? (
                      <span className="mainline-tray-card-quantity">X{card.quantity}</span>
                    ) : null}
                  </strong>
                  <span className="mainline-tray-card-kind">{card.kindLabel}</span>
                </button>
              ))
            ) : (
              <div className="mainline-tray-empty">
                把主线卡拖到这里统一归档。需要时展开后再拖回桌面。
              </div>
            )}
          </div>
        </div>
      ) : null}
    </aside>
  )
}
