import { useEffect, useState } from 'preact/hooks'
import { SHARED_NETWORK_PEERS, STILL_LOOKING_MS } from '../../config'
import { device } from '../../state/identity'
import { visiblePeers, type Peer } from '../../state/peers'
import { addPendingFiles, clearPending, dragging, openPairSheet, openSendSheet, pendingFiles, pendingText } from '../../state/ui'
import { Button, IconButton } from '../components/Controls'
import { EditableName } from '../components/EditableName'
import { Header } from '../components/Header'
import { CloseIcon, CodeIcon, DeviceIcon, ScanIcon } from '../components/Icons'
import { PairPanel } from '../components/PairPanel'
import { Tile } from '../components/Tile'

function useIsDesktop(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

/** Screen 1. */
function Looking() {
  const [stillLooking, setStillLooking] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setStillLooking(true), STILL_LOOKING_MS)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <main class="home-main">
      <div class="pulse" aria-hidden="true">
        <div class="pulse-ring" />
        <div class="pulse-ring" />
        <div class="pulse-ring" />
        <div class="pulse-core" />
        <div class="pulse-self">
          <DeviceIcon type={device.deviceType} size={36} />
        </div>
      </div>
      <div class="home-identity">
        <div class="eyebrow">You're visible as</div>
        <EditableName />
        <p class="home-hint" aria-live="polite">
          {stillLooking ? (
            <>Still looking. Different Wi‑Fi? Use a code.</>
          ) : (
            <>
              Looking for devices on this Wi‑Fi. Open <strong>fastbeam.app</strong> on the other one.
            </>
          )}
        </p>
      </div>
    </main>
  )
}

function PendingBanner() {
  const files = pendingFiles.value
  const text = pendingText.value
  if (!files.length && !text) return null
  const what = files.length ? `${files.length} ${files.length === 1 ? 'file' : 'files'}` : 'Text'
  return (
    <div class="pending" role="status">
      <span>
        <strong>{what} ready.</strong> Tap a device to send {files.length ? 'them' : 'it'}.
      </span>
      <IconButton label="Clear" onClick={clearPending}>
        <CloseIcon size={18} />
      </IconButton>
    </div>
  )
}

/** Screen 2. */
function Nearby({ peers, desktop }: { peers: Peer[]; desktop: boolean }) {
  const [showAll, setShowAll] = useState(false)
  const crowded = peers.length > SHARED_NETWORK_PEERS
  const shown = crowded && !showAll ? peers.slice(0, 6) : peers
  const select = (p: Peer) => openSendSheet(p.deviceId)
  const drop = (p: Peer, files: File[]) => {
    addPendingFiles(files)
    openSendSheet(p.deviceId)
  }
  return (
    <main class="home-main home-main--grid">
      <section class="home-identity home-identity--left">
        <div class="eyebrow">You're visible as</div>
        <EditableName />
      </section>
      <PendingBanner />
      <div class="grid-head">
        <div class="eyebrow-caps live">
          <span class="dot-live" aria-hidden="true" />
          {desktop ? 'Drop files on a device, or click one' : 'Tap a device to send'}
        </div>
        <div class="row-sub">{peers.length} found</div>
      </div>
      {crowded && (
        <div class="alert alert--warn" role="note">
          You may be on a shared network. Only accept from devices you recognise.
        </div>
      )}
      <div class="tiles">
        {shown.map((p) => (
          <Tile key={p.deviceId} peer={p} onSelect={select} onDrop={drop} />
        ))}
      </div>
      {crowded && !showAll && (
        <Button variant="link" onClick={() => setShowAll(true)}>
          Show all {peers.length}
        </Button>
      )}
      {desktop && (
        <div class="row-sub">
          Tip: press <kbd class="kbd">{navigator.platform.includes('Mac') ? '⌘ V' : 'Ctrl V'}</kbd> anywhere to send what&rsquo;s on
          your clipboard.
        </div>
      )}
    </main>
  )
}

/** Mobile bottom bar: both pairing entry points whenever "Not on the same Wi‑Fi?" is visible. */
function PairEntry() {
  return (
    <aside class="pair-entry" aria-label="Pair with a code">
      <div class="pair-entry-title">Not on the same Wi‑Fi?</div>
      <div class="pair-entry-actions">
        <Button variant="secondary" onClick={() => openPairSheet('show')}>
          <CodeIcon />
          Show my code
        </Button>
        <Button variant="primary" onClick={() => openPairSheet('scan')}>
          <ScanIcon />
          Scan or enter
        </Button>
      </div>
    </aside>
  )
}

export function Home() {
  const peers = visiblePeers.value
  const desktop = useIsDesktop()
  return (
    <div class={`shell${dragging.value ? ' shell--dragging' : ''}`}>
      <Header />
      <div class="home">
        {peers.length === 0 ? (
          <>
            <Looking />
            <PendingBanner />
          </>
        ) : (
          <Nearby peers={peers} desktop={desktop} />
        )}
        {desktop ? <PairPanel /> : <PairEntry />}
      </div>
    </div>
  )
}
