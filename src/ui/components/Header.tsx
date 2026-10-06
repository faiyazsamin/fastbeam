import { REPO_URL } from '../../config'
import { NAT_LABEL, nat, type NatResult } from '../../state/network'
import { navigate } from '../../state/router'
import { IconButton } from './Controls'
import { GithubIcon, Mark, SlidersIcon, Wordmark } from './Icons'

const TONE: Record<NatResult, string> = {
  checking: '',
  open: 'badge--ok',
  symmetric: 'badge--warn',
  'udp-blocked': 'badge--warn',
  unknown: '',
}

export function NetworkBadge() {
  const r = nat.value
  const tone = TONE[r]
  return (
    <span class={tone ? `badge ${tone}` : 'badge'} role="status" aria-label={`Network: ${NAT_LABEL[r]}`}>
      <span class="badge-dot" />
      {NAT_LABEL[r]}
    </span>
  )
}

export function Header() {
  return (
    <header class="header">
      <div class="brand">
        <Mark class="brand-mark" />
        <Wordmark />
      </div>
      <div class="header-right">
        <NetworkBadge />
        <a
          class="iconbtn header-gh"
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="fastbeam on GitHub"
          title="Source on GitHub"
        >
          <GithubIcon />
        </a>
        <IconButton label="Settings" onClick={() => navigate('settings')}>
          <SlidersIcon />
        </IconButton>
      </div>
    </header>
  )
}
