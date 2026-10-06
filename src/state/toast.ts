import { signal } from '@preact/signals'

export interface Toast {
  id: number
  text: string
}

export const toasts = signal<readonly Toast[]>([])
let nextId = 1

/** Show a short, non-blocking message. Toasts, not dialogs, for joined / left / declined / cancelled. */
export function toast(text: string, durationMs = 3200): void {
  const id = nextId++
  toasts.value = [...toasts.value, { id, text }]
  window.setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, durationMs)
}
