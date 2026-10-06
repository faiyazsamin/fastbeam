import type { ComponentChildren } from 'preact'
import type { DeviceType } from '../../state/device'

export interface IconProps {
  size?: number
  strokeWidth?: number
  class?: string
}

/** The fastbeam mark: one device (the dot) sending a single beam outward. Never rotate it. */
export function Mark({ size = 32, class: cls, spark = true }: IconProps & { spark?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" class={cls}>
      <rect width="48" height="48" rx="11" fill="#12A1A6" />
      <circle cx="15" cy="33" r="5.5" fill="#FFFFFF" />
      <path d="M18.6 27.2 L35.4 10.6 L37.6 12.8 L21 29.4 Z" fill="#FFFFFF" />
      {spark && <circle cx="36.5" cy="11.7" r="2.2" fill="#FFFFFF" />}
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

function Stroke({ size = 22, strokeWidth = 1.8, class: cls, children }: IconProps & { children: ComponentChildren }) {
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

export const SlidersIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Stroke>
)
export const PencilIcon = (p: IconProps) => (
  <Stroke size={18} strokeWidth={2} {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </Stroke>
)
export const BackIcon = (p: IconProps) => (
  <Stroke strokeWidth={2} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Stroke>
)
export const CloseIcon = (p: IconProps) => (
  <Stroke size={20} strokeWidth={2} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Stroke>
)
export const CodeIcon = (p: IconProps) => (
  <Stroke size={20} {...p}>
    <path d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16" />
  </Stroke>
)
export const ScanIcon = (p: IconProps) => (
  <Stroke size={20} {...p}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
    <path d="M4 12h16" />
  </Stroke>
)
export const PhoneIcon = (p: IconProps) => (
  <Stroke size={24} strokeWidth={1.6} {...p}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </Stroke>
)
export const TabletIcon = (p: IconProps) => (
  <Stroke size={24} strokeWidth={1.6} {...p}>
    <rect x="4.5" y="3" width="15" height="18" rx="2.5" />
    <path d="M11 18h2" />
  </Stroke>
)
export const LaptopIcon = (p: IconProps) => (
  <Stroke size={24} strokeWidth={1.6} {...p}>
    <rect x="4" y="5" width="16" height="11" rx="1.5" />
    <path d="M2 19h20" />
  </Stroke>
)
export function DeviceIcon({ type, ...p }: { type: DeviceType } & IconProps) {
  if (type === 'phone') return <PhoneIcon {...p} />
  if (type === 'tablet') return <TabletIcon {...p} />
  return <LaptopIcon {...p} />
}
export const LockIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Stroke>
)
export const LockKeyholeIcon = (p: IconProps) => (
  <Stroke size={40} strokeWidth={1.7} {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    <path d="M12 15v2" />
  </Stroke>
)
export const ShieldIcon = (p: IconProps) => (
  <Stroke size={24} {...p}>
    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </Stroke>
)
export const ShieldPlainIcon = (p: IconProps) => (
  <Stroke size={14} strokeWidth={2.2} {...p}>
    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
  </Stroke>
)
export const CheckIcon = (p: IconProps) => (
  <Stroke size={16} strokeWidth={3} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Stroke>
)
export const CopyIcon = (p: IconProps) => (
  <Stroke size={18} {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </Stroke>
)
export const ShareIcon = (p: IconProps) => (
  <Stroke size={18} {...p}>
    <path d="M12 3v12M7 8l5-5 5 5" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </Stroke>
)
export const ImageIcon = (p: IconProps) => (
  <Stroke size={20} {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 16l-5-5-9 9" />
  </Stroke>
)
export const VideoIcon = (p: IconProps) => (
  <Stroke size={20} {...p}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10l5-3v10l-5-3" />
  </Stroke>
)
export const FileIcon = (p: IconProps) => (
  <Stroke size={20} {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Stroke>
)
export const FolderIcon = (p: IconProps) => (
  <Stroke size={20} {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Stroke>
)
export const TextIcon = (p: IconProps) => (
  <Stroke size={20} {...p}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </Stroke>
)
export const PasteIcon = (p: IconProps) => (
  <Stroke size={18} {...p}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4h6v3H9z" />
  </Stroke>
)
export const TorchIcon = (p: IconProps) => (
  <Stroke size={20} {...p}>
    <path d="M7 3h10l-2 6v12H9V9z" />
    <path d="M12 13v2" />
  </Stroke>
)
export const EyeIcon = (p: IconProps) => (
  <Stroke size={20} {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Stroke>
)
export const EyeOffIcon = (p: IconProps) => (
  <Stroke size={20} {...p}>
    <path d="M3 3l18 18" />
    <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
    <path d="M6.6 6.7C4 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.3-.4 4.6-1.1M9.9 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.6 3.5" />
  </Stroke>
)
export const DownloadIcon = (p: IconProps) => (
  <Stroke size={26} strokeWidth={2} {...p}>
    <path d="M12 4v12M7 11l5 5 5-5" />
    <path d="M5 20h14" />
  </Stroke>
)
export const LinkIcon = (p: IconProps) => (
  <Stroke size={18} {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Stroke>
)
export const ShuffleIcon = (p: IconProps) => (
  <Stroke size={18} {...p}>
    <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </Stroke>
)
