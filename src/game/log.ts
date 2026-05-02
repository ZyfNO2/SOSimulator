type LogLevel = 'info' | 'warn' | 'error'

type LogPayload = {
  level: LogLevel
  scope: string
  message: string
  data?: unknown
}

function formatConsolePrefix(level: LogLevel, scope: string) {
  return `[${level.toUpperCase()}][${scope}]`
}

export async function logGameEvent(
  scope: string,
  message: string,
  data?: unknown,
  level: LogLevel = 'info',
) {
  const payload: LogPayload = {
    level,
    scope,
    message,
    data,
  }

  const consolePrefix = formatConsolePrefix(level, scope)

  if (typeof data === 'undefined') {
    console.log(consolePrefix, message)
  } else {
    console.log(consolePrefix, message, data)
  }

  try {
    await fetch('/__log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true,
    })
  } catch {
    // Frontend should stay resilient when file logging is unavailable.
  }
}
