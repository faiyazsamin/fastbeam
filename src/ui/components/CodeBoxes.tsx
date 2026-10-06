import { useEffect, useRef, useState } from 'preact/hooks'
import { CODE_LENGTH } from '../../config'
import { codeFromText, isCodeChar, normalizeCodeInput } from '../../net/pairing'

/**
 * Six boxes backed by one real input so paste, autofill and screen readers all work.
 * Auto-uppercases, ignores spaces and dashes, shakes on characters outside the alphabet,
 * and submits on the sixth character.
 */
export function CodeBoxes({
  value,
  onChange,
  onSubmit,
  autoFocus = false,
  disabled = false,
}: {
  value: string
  onChange: (code: string) => void
  onSubmit: (code: string) => void
  autoFocus?: boolean
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [shake, setShake] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (autoFocus) input.current?.focus()
  }, [autoFocus])

  const apply = (raw: string) => {
    const fromLink = codeFromText(raw)
    if (fromLink) {
      setError(null)
      onChange(fromLink)
      onSubmit(fromLink)
      return
    }
    const cleaned = normalizeCodeInput(raw)
    let next = ''
    let bad = false
    for (const ch of cleaned) {
      if (isCodeChar(ch)) next += ch
      else bad = true
      if (next.length === CODE_LENGTH) break
    }
    if (bad) {
      setError('Codes never use 0, O, 1, I or L')
      setShake(true)
      window.setTimeout(() => setShake(false), 400)
    } else setError(null)
    onChange(next)
    if (next.length === CODE_LENGTH) onSubmit(next)
  }

  const active = Math.min(value.length, CODE_LENGTH - 1)

  return (
    <div class="codeboxes-wrap">
      <div class={`codeboxes${shake ? ' codeboxes--shake' : ''}`} onClick={() => input.current?.focus()}>
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const ch = value[i] ?? ''
          const isActive = focused && i === active && value.length < CODE_LENGTH
          return (
            <div key={i} class={`codebox${isActive ? ' codebox--active' : ''}${ch ? ' codebox--filled' : ''}`} aria-hidden="true">
              {ch || (isActive ? <span class="codebox-caret" /> : null)}
            </div>
          )
        })}
        <input
          ref={input}
          class="codeboxes-input"
          type="text"
          inputMode="text"
          autocapitalize="characters"
          autocomplete="one-time-code"
          autocorrect="off"
          spellcheck={false}
          aria-label="6-character code"
          aria-describedby="codeboxes-help"
          value={value}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onInput={(e) => apply((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.length === CODE_LENGTH) onSubmit(value)
          }}
        />
      </div>
      <div id="codeboxes-help" class={`codeboxes-help${error ? ' codeboxes-help--error' : ''}`} role={error ? 'alert' : undefined}>
        {error ?? 'Connects as soon as all 6 are in. Case doesn’t matter.'}
      </div>
    </div>
  )
}
