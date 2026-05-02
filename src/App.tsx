import { useState } from 'react'
import './App.css'
import { LevelSelect } from './components/LevelSelect'
import { Level1Game } from './components/Level1Game'

type GameScreen = 'level-select' | 'level1'

function App() {
  const [screen, setScreen] = useState<GameScreen>('level-select')

  const handleSelectLevel = (level: number) => {
    if (level === 1) {
      setScreen('level1')
    }
  }

  const handleBackToMenu = () => {
    setScreen('level-select')
  }

  return (
    <>
      {screen === 'level-select' && <LevelSelect onSelectLevel={handleSelectLevel} />}
      {screen === 'level1' && <Level1Game onBackToMenu={handleBackToMenu} />}
    </>
  )
}

export default App
