import { useEffect, useRef, useState } from 'preact/hooks'
import { deviceName, NAME_MAX, setDeviceName } from '../../state/settings'
import { PencilIcon } from './Icons'

/** The device name as a tap-to-edit heading (screens 1 and 2). */
export function EditableName() {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const committed = useRef(false)

  useEffect(() => {
    if (!editing) return
    committed.current = false
    const el = inputRef.current
    el?.focus()
    el?.select()
  }, [editing])

  const start = () => {
    setDraft(deviceName.value)
    setEditing(true)
  }

  const commit = () => {
    if (committed.current) return
    committed.current = true
    setDeviceName(draft) // empty input keeps the old name
    setEditing(false)
  }

  const cancel = () => {
    committed.current = true
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        class="name-input"
        type="text"
        aria-label="Device name"
        value={draft}
        maxLength={NAME_MAX}
        autocomplete="off"
        autocapitalize="words"
        enterkeyhint="done"
        onInput={(e) => setDraft((e.currentTarget as HTMLInputElement).value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          else if (e.key === 'Escape') cancel()
        }}
      />
    )
  }

  return (
    <button type="button" class="name-btn" onClick={start} aria-label={`Device name: ${deviceName.value}. Tap to edit`}>
      <span>{deviceName.value}</span>
      <PencilIcon />
    </button>
  )
}
