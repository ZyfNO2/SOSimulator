import {
  PRODUCTION_AUTO_REQUEUE_LEAD_MS,
  PRODUCTION_RING_DIAMETER,
  PRODUCTION_RING_GROW_MS,
  PRODUCTION_RING_SHRINK_MS,
} from '../game/constants'
import { getProductionAnchor } from '../game/production'
import { clamp } from '../game/stacking'
import type { ProductionRun, TableCard } from '../game/types'

export function ProductionEffect({
  run,
  nowMs,
  cards,
}: {
  run: ProductionRun
  nowMs: number
  cards: TableCard[]
}) {
  const anchor = getProductionAnchor(cards, run)
  const elapsedMs = Math.max(0, nowMs - run.startedAtMs)
  const growScale = clamp(elapsedMs / PRODUCTION_RING_GROW_MS, 0, 1)
  const shrinkProgress =
    run.status === 'shrinking' && typeof run.shrinkStartedAtMs === 'number'
      ? clamp((nowMs - run.shrinkStartedAtMs) / PRODUCTION_RING_SHRINK_MS, 0, 1)
      : 0
  const ringScale = growScale * (1 - shrinkProgress)
  const activeProgress = clamp(elapsedMs / run.durationMs, 0, 1)
  const queuedFloorProgress = clamp(
    (run.durationMs - PRODUCTION_AUTO_REQUEUE_LEAD_MS) / run.durationMs,
    0,
    1,
  )
  const orbitProgress =
    run.status === 'shrinking'
      ? run.cancelProgress ?? activeProgress
      : run.nextQueued
        ? Math.max(activeProgress, queuedFloorProgress)
        : activeProgress
  const ringRadius = PRODUCTION_RING_DIAMETER / 2 - 3
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringOffset = ringCircumference * (1 - orbitProgress)

  return (
    <div
      className="production"
      style={{
        left: `${anchor.centerX}px`,
        top: `${anchor.centerY}px`,
        opacity: 1 - shrinkProgress * 0.55,
      }}
    >
      <div
        className="production-ring"
        style={{
          width: `${PRODUCTION_RING_DIAMETER}px`,
          height: `${PRODUCTION_RING_DIAMETER}px`,
          transform: `translate(-50%, -50%) scale(${ringScale})`,
        }}
      />
      <svg
        className="production-progress"
        viewBox={`0 0 ${PRODUCTION_RING_DIAMETER} ${PRODUCTION_RING_DIAMETER}`}
        style={{
          width: `${PRODUCTION_RING_DIAMETER}px`,
          height: `${PRODUCTION_RING_DIAMETER}px`,
          transform: `translate(-50%, -50%) scale(${ringScale}) rotate(-90deg)`,
        }}
      >
        <circle
          className="production-progress-circle"
          cx={PRODUCTION_RING_DIAMETER / 2}
          cy={PRODUCTION_RING_DIAMETER / 2}
          r={ringRadius}
          pathLength={ringCircumference}
          strokeDasharray={ringCircumference}
          strokeDashoffset={ringOffset}
        />
      </svg>
    </div>
  )
}
