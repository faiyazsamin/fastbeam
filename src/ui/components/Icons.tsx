import type { DeviceType } from '../../state/device'

export interface IconProps {
  size?: number
  strokeWidth?: number
  class?: string
}

/** The fastbeam mark: one device (the dot) sending a single beam outward. Never rotate it. */
export function Mark({ size = 32, class: cls }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" class={cls}>
      <rect width="48" height="48" rx="11" fill="#12A1A6" />
      <circle cx="15" cy="33" r="5.5" fill="#FFFFFF" />
      <path d="M18.6 27.2 L35.4 10.6 L37.6 12.8 L21 29.4 Z" fill="#FFFFFF" />
      <circle cx="36.5" cy="11.7" r="2.2" fill="#FFFFFF" />
    </svg>
  )
}

export function Wordmark({ class: cls }: { class?: string }) {
  return (
    <span class={cls ? `wordmark ${cls}` : 'wordmark'} aria-label="fastbeam">
      fast<b>beam</b>
    </span>
  )
}

function Stroke({
  size = 22,
  strokeWidth = 1.8,
  class: cls,
  children,
}: IconProps & { children: preact.ComponentChildren }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={cls}
    >
      {children}
    </svg>
  )
}

export function SlidersIcon(p: IconProps) {
  return (
    <Stroke {...p}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </Stroke>
  )
}

export function PencilIcon(p: IconProps) {
  return (
    <Stroke size={18} strokeWidth={2} {...p}>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </Stroke>
  )
}

export function BackIcon(p: IconProps) {
  return (
    <Stroke strokeWidth={2} {...p}>
      <path d="M15 5l-7 7 7 7" />
    </Stroke>
  )
}

export function CodeIcon(p: IconProps) {
  return (
    <Stroke size={20} {...p}>
      <path d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16" />
    </Stroke>
  )
}

export function ScanIcon(p: IconProps) {
  return (
    <Stroke size={20} {...p}>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <path d="M4 12h16" />
    </Stroke>
  )
}

export function PhoneIcon(p: IconProps) {
  return (
    <Stroke size={24} strokeWidth={1.6} {...p}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </Stroke>
  )
}

export function TabletIcon(p: IconProps) {
  return (
    <Stroke size={24} strokeWidth={1.6} {...p}>
      <rect x="4.5" y="3" width="15" height="18" rx="2.5" />
      <path d="M11 18h2" />
    </Stroke>
  )
}

export function LaptopIcon(p: IconProps) {
  return (
    <Stroke size={24} strokeWidth={1.6} {...p}>
      <rect x="4" y="5" width="16" height="11" rx="1.5" />
      <path d="M2 19h20" />
    </Stroke>
  )
}

export function DeviceIcon({ type, ...p }: { type: DeviceType } & IconProps) {
  if (type === 'phone') return <PhoneIcon {...p} />
  if (type === 'tablet') return <TabletIcon {...p} />
  return <LaptopIcon {...p} />
}
