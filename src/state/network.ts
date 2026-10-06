import { signal } from '@preact/signals'

/** NAT pre-check result from the STUN probe (base spec, "NAT pre-check"). The probe itself lands in milestone 2. */
export type NatResult = 'checking' | 'open' | 'symmetric' | 'udp-blocked' | 'unknown'

export const nat = signal<NatResult>('checking')

export const NAT_LABEL: Record<NatResult, string> = {
  checking: 'Checking network',
  open: 'Direct OK',
  symmetric: 'Limited',
  'udp-blocked': 'Same Wi‑Fi only',
  unknown: 'Not checked',
}

export const NAT_DETAIL: Record<NatResult, string> = {
  checking: 'The network check runs when fastbeam opens.',
  open: 'Codes should work with most other networks. Same Wi‑Fi always works.',
  symmetric: 'Codes may not work with other networks unless theirs is open. Same Wi‑Fi always works.',
  'udp-blocked': 'This network blocks direct connections. Same Wi‑Fi still works.',
  unknown: 'The network check could not run. Same Wi‑Fi still works.',
}
