import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'

type ObservationEntry = {
  definitionId: string
  name: string
  kindLabel: string
  accent: string
  quantity?: number
  isAvailable: boolean
  statusLabel: string
}

export function MainlineTray({
  trayRef,
  isOpen,
  entries,
  onToggle,
  onObservationCardPointerDown,
}: {
  trayRef: RefObject<HTMLDivElement | null>
  isOpen: boolean
  entries: ObservationEntry[]
  onToggle: () => void
  onObservationCardPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    definitionId: string,
  ) => void
}) {
  return (
    <aside
      ref={trayRef}
      className={`mainline-tray${isOpen ? ' is-open' : ''}`}
      aria-label="观测点"
    >
      <button type="button" className="mainline-tray-toggle" onClick={onToggle}>
        <span>观测点</span>
        <strong>{entries.length}</strong>
      </button>

      {isOpen ? (
        <div className="mainline-tray-panel">
          <div className="mainline-tray-header">
            <h2>观测点</h2>
            <p>出现过的可观测卡都会留在这里。场上已有同名卡时不可再取，拖进来的实例会优先原样取回。</p>
          </div>

          <div className="mainline-tray-list">
            {entries.length > 0 ? (
              entries.map((card) => (
                <button
                  key={card.definitionId}
                  type="button"
                  className={`mainline-tray-card card-${card.accent}`}
                  onPointerDown={(event) =>
                    onObservationCardPointerDown(event, card.definitionId)
                  }
                  disabled={!card.isAvailable}
                >
                  <strong className="mainline-tray-card-name">
                    <span>{card.name}</span>
                    {(card.quantity ?? 1) > 1 ? (
                      <span className="mainline-tray-card-quantity">X{card.quantity}</span>
                    ) : null}
                  </strong>
                  <span className="mainline-tray-card-kind">{card.kindLabel}</span>
                  <span className="mainline-tray-card-status">{card.statusLabel}</span>
                </button>
              ))
            ) : (
              <div className="mainline-tray-empty">
                可观测的卡牌一旦真正出现，就会在这里留下记录。
              </div>
            )}
          </div>
        </div>
      ) : null}
    </aside>
  )
}
