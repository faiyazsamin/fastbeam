import type { ComponentChildren, JSX } from 'preact'

type ButtonAttrs = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'class' | 'className'>

export function Button({
  variant = 'secondary',
  class: cls,
  children,
  ...rest
}: { variant?: 'primary' | 'secondary' | 'link'; class?: string; children: ComponentChildren } & ButtonAttrs) {
  return (
    <button type="button" class={`btn btn--${variant}${cls ? ` ${cls}` : ''}`} {...rest}>
      {children}
    </button>
  )
}

export function IconButton({
  label,
  children,
  class: cls,
  ...rest
}: { label: string; children: ComponentChildren; class?: string } & ButtonAttrs) {
  return (
    <button type="button" class={cls ? `iconbtn ${cls}` : 'iconbtn'} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      class="switch"
      onClick={() => onChange(!checked)}
    >
      <span class="switch-track">
        <span class="switch-knob" />
      </span>
    </button>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (next: T) => void
  label: string
}) {
  const onKey = (e: KeyboardEvent, index: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = options[(index + delta + options.length) % options.length]
    if (!next) return
    onChange(next.value)
    const group = (e.currentTarget as HTMLElement).parentElement
    const btn = group?.querySelectorAll<HTMLButtonElement>('button')[(index + delta + options.length) % options.length]
    btn?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} class="seg">
      {options.map((o, i) => {
        const selected = o.value === value
        return (
          <button
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            key={o.value}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
