import { useEffect, useRef } from 'react'

export type LogEntry = {
  id: number
  message: string
  timestampMs: number
}

export function LogPanel({ logs }: { logs: LogEntry[] }) {
  const listRef = useRef<HTMLOListElement | null>(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [logs.length])

  if (logs.length === 0) {
    return (
      <aside className="log-panel" aria-label="活动日志">
        <p className="log-empty">等待SOS团的活动开始……</p>
      </aside>
    )
  }

  return (
    <aside className="log-panel" aria-label="活动日志" aria-live="polite">
      <ol ref={listRef} className="log-list">
        {logs.map((entry) => (
          <li key={entry.id} className="log-entry">
            {entry.message}
          </li>
        ))}
      </ol>
    </aside>
  )
}
