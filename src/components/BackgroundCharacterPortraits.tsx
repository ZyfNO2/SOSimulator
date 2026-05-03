import { useEffect, useMemo, useState } from 'react'

const PORTRAIT_FLASH_DURATION_MS = 5000

const PORTRAIT_SRC_BY_DEFINITION_ID: Record<
  'kyon' | 'haruhi' | 'asahina' | 'nagato' | 'koizumi',
  string
> = {
  kyon: '/pic/阿虚.png',
  haruhi: '/pic/凉宫.png',
  asahina: '/pic/朝比奈.png',
  nagato: '/pic/长门.png',
  koizumi: '/pic/古泉.png',
}

const SLOT_CLASS_BY_DEFINITION_ID: Record<
  'kyon' | 'haruhi' | 'asahina' | 'nagato' | 'koizumi',
  string
> = {
  kyon: 'slot-kyon',
  haruhi: 'slot-haruhi',
  asahina: 'slot-asahina',
  nagato: 'slot-nagato',
  koizumi: 'slot-koizumi',
}

type PortraitDefinitionId = keyof typeof PORTRAIT_SRC_BY_DEFINITION_ID

export function BackgroundCharacterPortraits({
  portraitFlashUntilByDefinitionId,
}: {
  portraitFlashUntilByDefinitionId: Partial<Record<PortraitDefinitionId, number>>
}) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const activePortraitEntries = useMemo(
    () =>
      (Object.keys(PORTRAIT_SRC_BY_DEFINITION_ID) as PortraitDefinitionId[])
        .map((definitionId) => ({
          definitionId,
          flashUntilMs: portraitFlashUntilByDefinitionId[definitionId] ?? 0,
        }))
        .filter((entry) => entry.flashUntilMs > nowMs),
    [nowMs, portraitFlashUntilByDefinitionId],
  )

  useEffect(() => {
    if (activePortraitEntries.length === 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 100)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [activePortraitEntries.length])

  if (activePortraitEntries.length === 0) {
    return null
  }

  return (
    <div className="background-portrait-layer" aria-hidden="true">
      {activePortraitEntries.map(({ definitionId, flashUntilMs }) => (
        <img
          key={`${definitionId}-${flashUntilMs}`}
          src={PORTRAIT_SRC_BY_DEFINITION_ID[definitionId]}
          className={`background-portrait ${SLOT_CLASS_BY_DEFINITION_ID[definitionId]}`}
          style={{
            animationDuration: `${PORTRAIT_FLASH_DURATION_MS}ms`,
          }}
          alt=""
        />
      ))}
    </div>
  )
}
