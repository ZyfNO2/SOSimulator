import './LevelSelect.css'

interface LevelSelectProps {
  onSelectLevel: (level: number) => void
}

export function LevelSelect({ onSelectLevel }: LevelSelectProps) {
  return (
    <main className="level-select">
      <div className="level-select-bg" aria-hidden="true" />
      <header className="level-select-header">
        <h1 className="level-select-title">SOS团活动室</h1>
        <p className="level-select-subtitle">— 凉宫春日的奇妙冒险 —</p>
      </header>

      <section className="level-grid">
        <button
          type="button"
          className="level-card level-card-unlocked"
          onClick={() => onSelectLevel(1)}
        >
          <span className="level-number">1</span>
          <span className="level-name">团长的召唤</span>
          <span className="level-desc">凉宫春日还没有发言……</span>
        </button>

        <div className="level-card level-card-locked">
          <span className="level-number">2</span>
          <span className="level-name">???</span>
          <span className="level-desc">通关关卡1后解锁</span>
        </div>

        <div className="level-card level-card-locked">
          <span className="level-number">3</span>
          <span className="level-name">???</span>
          <span className="level-desc">通关关卡2后解锁</span>
        </div>
      </section>

      <footer className="level-select-footer">
        <p>拖动卡牌 · 组合合成 · 探索故事</p>
      </footer>
    </main>
  )
}
