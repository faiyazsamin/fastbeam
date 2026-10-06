import '@fontsource/bricolage-grotesque/700.css'
import '@fontsource/bricolage-grotesque/800.css'
import '@fontsource/figtree/400.css'
import '@fontsource/figtree/500.css'
import '@fontsource/figtree/600.css'
import '@fontsource/figtree/700.css'
import '@fontsource/jetbrains-mono/700.css'
import './ui/tokens.css'
import './ui/base.css'
import './ui/components.css'
import './ui/screens.css'

import { render } from 'preact'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app'
import { initRouter } from './state/router'
import { initTheme } from './state/settings'

initTheme()
initRouter()

const root = document.getElementById('app')
if (!root) throw new Error('fastbeam: #app missing')
render(<App />, root)

if (import.meta.env.PROD) {
  registerSW({ immediate: true })
}
