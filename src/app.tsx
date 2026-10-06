import { screen } from './state/router'
import { Toasts } from './ui/components/Toasts'
import { Home } from './ui/screens/Home'
import { Settings } from './ui/screens/Settings'

export function App() {
  return (
    <>
      {screen.value === 'settings' ? <Settings /> : <Home />}
      <Toasts />
    </>
  )
}
