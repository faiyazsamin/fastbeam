import { useState } from 'preact/hooks'
import { PROTOCOL } from '../../config'
import { peerSubtitle, type Peer } from '../../state/peers'
import { DeviceIcon, DownloadIcon, InfoIcon, LockIcon } from './Icons'

export function Tile({
  peer,
  onSelect,
  onInfo,
  onDrop,
}: {
  peer: Peer
  onSelect: (peer: Peer) => void
  onInfo: (peer: Peer) => void
  onDrop: (peer: Peer, files: File[]) => void
}) {
  const [over, setOver] = useState<number>(0)
  const outdated = peer.protocol !== PROTOCOL
  const away = !peer.online
  const label = `Send to ${peer.name}, ${peer.platform}, ${peer.browser}${peer.paired ? ', paired' : ''}${outdated ? ', update needed' : ''}${away ? ', reconnecting' : ''}`

  return (
    <div class={`tile-wrap${over ? ' tile-wrap--over' : ''}`}>
      <button
        type="button"
        class={`tile${over ? ' tile--over' : ''}${peer.flash ? ' tile--flash' : ''}${away ? ' tile--away' : ''}`}
        aria-label={label}
        disabled={outdated || away}
        onClick={() => onSelect(peer)}
        onDragOver={(e) => {
          if (!e.dataTransfer?.types.includes('Files')) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          setOver(Math.max(1, e.dataTransfer.items.length))
        }}
        onDragLeave={() => setOver(0)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(0)
          const files = Array.from(e.dataTransfer?.files ?? [])
          if (files.length) onDrop(peer, files)
        }}
      >
        {peer.paired && !over && (
          <span class="tile-chip">
            <LockIcon size={12} strokeWidth={2.4} />
            {peer.passwordVerified ? 'Paired · locked' : 'Paired'}
          </span>
        )}
        <span class="tile-icon">{over ? <DownloadIcon /> : <DeviceIcon type={peer.deviceType} />}</span>
        <span class="tile-text">
          <span class="tile-name">{over ? `Drop to send ${over} ${over === 1 ? 'file' : 'files'}` : peer.name}</span>
          <span class="tile-sub">
            {over ? `to ${peer.name} · ${peer.platform}` : outdated ? 'Update needed' : away ? 'Reconnecting…' : peerSubtitle(peer)}
          </span>
        </span>
      </button>
      {!over && (
        <button type="button" class="tile-info" aria-label={`About ${peer.name}`} title="Device details" onClick={() => onInfo(peer)}>
          <InfoIcon />
        </button>
      )}
    </div>
  )
}
