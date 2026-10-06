import { toasts } from '../../state/toast'

export function Toasts() {
  return (
    <div class="toasts" aria-live="polite" aria-atomic="false">
      {toasts.value.map((t) => (
        <div class="toast" key={t.id}>
          {t.text}
        </div>
      ))}
    </div>
  )
}
