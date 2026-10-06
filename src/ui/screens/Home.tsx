import { useEffect, useState } from 'preact/hooks'
import { device } from '../../state/identity'
import { Button } from '../components/Controls'
import { EditableName } from '../components/EditableName'
import { Header } from '../components/Header'
import { CodeIcon, DeviceIcon, ScanIcon } from '../components/Icons'

/** After this long with nobody found, the hint points at codes (build-notes §5, screen 1). */
const STILL_LOOKING_MS = 8000

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

/** "Not on the same Wi‑Fi?" The pairing sheet arrives in milestone 4; the entry points are in place now. */
function PairEntry() {
  return (
    <aside class="pair-entry" aria-label="Pair with a code">
      <div class="pair-entry-title">Not on the same Wi‑Fi?</div>
      <div class="pair-entry-actions">
        <Button variant="secondary" disabled title="Available in the next update">
          <CodeIcon />
          Show my code
        </Button>
        <Button variant="primary" disabled title="Available in the next update">
          <ScanIcon />
          Scan or enter
        </Button>
      </div>
    </aside>
  )
}

export function Home() {
  return (
    <div class="shell">
      <Header />
      <div class="home">
        <Looking />
        <PairEntry />
      </div>
    </div>
  )
}
