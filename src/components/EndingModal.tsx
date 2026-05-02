export function EndingModal({
  type,
  onReset,
}: {
  type: 'victory' | 'failure'
  onReset: () => void
}) {
  const isVictory = type === 'victory'

  return (
    <div className="ending-backdrop" role="presentation">
      <section
        className={`ending-modal${isVictory ? ' ending-victory' : ' ending-failure'}`}
        aria-label={isVictory ? '胜利' : '失败'}
      >
        <div className="ending-icon">{isVictory ? '✨' : '\u{1F300}'}</div>
        <h2 className="ending-title">
          {isVictory ? '你知道得太多了' : '世界被闭锁空间吞噬'}
        </h2>
        <p className="ending-body">
          {isVictory
            ? '凉宫春日就是这个世界的神。而你，阿虚，是唯一知道真相的人。\n\nSOS团的活动还会继续下去——因为凉宫这样希望着。'
            : '闭锁空间不断扩张，灰色的雾气吞没了社团活动室。\n\n凉宫的情绪失控了。也许下一次，会出现一个更美好的世界吧。'}
        </p>
        <button type="button" className="ending-reset-btn" onClick={onReset}>
          {isVictory ? '再来一次' : '重置世界'}
        </button>
      </section>
    </div>
  )
}
