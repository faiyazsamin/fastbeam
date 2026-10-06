import { signal } from '@preact/signals'

export type Screen = 'home' | 'settings'

export const screen = signal<Screen>('home')

interface HistoryState {
  screen?: Screen
}

function stateScreen(state: unknown): Screen {
  const s = (state as HistoryState | null)?.screen
  return s === 'settings' ? 'settings' : 'home'
}

export function navigate(to: Screen): void {
  if (screen.value === to) return
  history.pushState({ screen: to } satisfies HistoryState, '', location.href)
  screen.value = to
}

/** Go back one screen. Uses real history so the Android back gesture behaves the same way. */
export function goBack(): void {
  if (screen.value === 'home') return
  if (stateScreen(history.state) !== 'home') history.back()
  else screen.value = 'home'
}

export function initRouter(): void {
  history.replaceState({ screen: 'home' } satisfies HistoryState, '', location.href)
  screen.value = 'home'
  window.addEventListener('popstate', (e) => {
    screen.value = stateScreen(e.state)
  })
}
