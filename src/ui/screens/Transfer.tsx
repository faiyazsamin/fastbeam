import { useEffect, useState } from 'preact/hooks'
import { getPeer } from '../../state/peers'
import { openSendSheet } from '../../state/ui'
import { clearIncoming, clearOutgoing, incoming, outgoing } from '../../transfer/manager'
import { formatBytes, formatDuration, formatEta } from '../../transfer/protocol'
import { Button, IconButton } from '../components/Controls'
import { CheckIcon, CloseIcon, ShieldPlainIcon } from '../components/Icons'

interface Row {
  key: string
  name: string
  size: number
  done: number
  complete: boolean
}

interface View {
  kind: 'send' | 'receive'
  peerName: string
  peerId: string
  total: number
  done: number
  speed: number
  eta: number | null
  rows: Row[]
  cancel: () => void
}

function currentView(): View | null {
  const o = outgoing.value?.snap.value
  if (o && o.state === 'sending') {
    return {
      kind: 'send',
      peerName: o.peerName,
      peerId: o.peerId,
      total: o.totalSize,
      done: o.sentBytes,
      speed: o.speed,
      eta: o.etaSeconds,
      rows: o.files.map((f) => ({ key: f.fileId, name: f.name, size: f.size, done: f.sent, complete: f.sent >= f.size })),
      cancel: () => outgoing.value?.cancel(),
    }
  }
  const i = incoming.value?.snap.value
  if (i && i.state === 'receiving') {
    return {
      kind: 'receive',
      peerName: i.peerName,
      peerId: i.peerId,
      total: i.totalSize,
      done: i.receivedBytes,
      speed: i.speed,
      eta: i.etaSeconds,
      rows: i.files.map((f) => ({ key: f.fileId, name: f.name, size: f.size, done: f.received, complete: f.complete })),
      cancel: () => incoming.value?.cancel(),
    }
  }
  return null
}

const R = 104
const CIRC = 2 * Math.PI * R

/** Screen 5. The file list is a polite live region refreshed at most once per second. */
export function Progress() {
  const v = currentView()
  const [liveRows, setLiveRows] = useState<Row[]>(v?.rows ?? [])
  useEffect(() => {
    const t = window.setInterval(() => {
      const cur = currentView()
      if (cur) setLiveRows(cur.rows)
    }, 1000)
    return () => window.clearInterval(t)
  }, [])
  if (!v) return null
  const pct = v.total > 0 ? Math.min(100, Math.floor((v.done / v.total) * 100)) : 0
  const dash = (pct / 100) * CIRC
  return (
    <div class="screen">
      <header class="screen-head">
        <span class="muted" style={{ fontWeight: 600, fontSize: 15 }}>
          {v.kind === 'send' ? 'Sending to ' : 'Receiving from '}
          <span class="ink">{v.peerName}</span>
        </span>
        <span class="secure">
          <ShieldPlainIcon /> Direct · encrypted
        </span>
      </header>

      <div class="ring" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Overall progress">
        <svg width="240" height="240" viewBox="0 0 240 240" aria-hidden="true">
          <circle cx="120" cy="120" r={R} class="ring-track" />
          <circle cx="120" cy="120" r={R} class="ring-fill" stroke-dasharray={`${dash} ${CIRC}`} />
        </svg>
        <div class="ring-center">
          <div class="ring-pct">
            {pct}
            <span>%</span>
          </div>
          <div class="muted">
            {formatBytes(v.done)} of {formatBytes(v.total)}
          </div>
        </div>
      </div>

      <div class="two-up">
        <div class="stat">
          <div class="row-sub">Speed</div>
          <div class="mono stat-value">{v.speed > 0 ? `${formatBytes(v.speed)}/s` : '—'}</div>
        </div>
        <div class="stat">
          <div class="row-sub">Time left</div>
          <div class="mono stat-value">{v.eta !== null ? formatEta(v.eta) : '—'}</div>
        </div>
      </div>

      <div class="card card--list filelist" aria-live="polite">
        {liveRows.map((r) => {
          const p = r.size > 0 ? Math.min(100, Math.floor((r.done / r.size) * 100)) : r.complete ? 100 : 0
          const waiting = r.done === 0 && !r.complete
          return (
            <div key={r.key} class="filerow">
              <div class="filerow-head">
                <span class={waiting ? 'muted' : ''} style={{ fontWeight: 600 }}>
                  {r.name}
                </span>
                <span class="muted">{r.complete ? 'Done' : waiting ? 'Waiting' : `${p}%`}</span>
              </div>
              <div class="bar">
                <div style={{ width: `${r.complete ? 100 : p}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      <div class="stack-10 screen-cta">
        <div class="row-sub" style={{ textAlign: 'center' }}>
          Keep this tab open until it finishes.
        </div>
        <Button variant="secondary" onClick={v.cancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

/** Screen 6, both directions. */
export function Done() {
  const o = outgoing.value?.snap.value
  const i = incoming.value?.snap.value
  const isSend = !!o && o.state === 'done'
  const snap = isSend ? o : i
  if (!snap || snap.state !== 'done') return null
  const count = snap.files.length
  const dur = snap.startedAt && snap.finishedAt ? formatDuration(snap.finishedAt - snap.startedAt) : null
  const peer = getPeer(snap.peerId)
  const close = () => (isSend ? clearOutgoing() : clearIncoming())
  const again = () => {
    close()
    if (peer) openSendSheet(peer.deviceId)
  }
  const saved = !isSend && i ? i.saved : []
  const dest = !isSend && i ? i.destinationLabel : ''

  return (
    <div class="screen">
      <header class="screen-head">
        <span class="muted" style={{ fontWeight: 600, fontSize: 15 }}>
          {isSend ? 'To ' : 'From '}
          <span class="ink">{snap.peerName}</span>
        </span>
        <IconButton label="Close" class="iconbtn--round" onClick={close}>
          <CloseIcon />
        </IconButton>
      </header>
      <div class="done-hero">
        <span class="done-check">
          <CheckIcon size={56} strokeWidth={2.4} />
        </span>
        <div>
          <h1 class="done-title">
            {isSend ? 'Sent' : 'Got'} {count === 1 ? snap.files[0]?.name ?? '1 file' : `${count} files`}
          </h1>
          <div class="muted">
            {formatBytes(snap.totalSize)}
            {dur ? ` in ${dur}` : ''}
            {dest ? ` · ${dest}` : ''}
          </div>
        </div>
      </div>
      <div class="done-list">
        {snap.files.map((f, idx) => {
          const sv = saved[idx]
          return (
            <div key={f.fileId} class="done-item">
              <span class="selected-text">
                <span class="selected-name">{f.name}</span>
                <span class="row-sub">{formatBytes(f.size)}</span>
              </span>
              {sv?.open && (
                <Button variant="link" onClick={() => void sv.open?.()}>
                  Open
                </Button>
              )}
              {sv?.save && (
                <Button variant="link" onClick={() => sv.save?.()}>
                  Save
                </Button>
              )}
            </div>
          )
        })}
      </div>
      <div class="two-up screen-cta">
        <Button variant="secondary" class="btn--lg" disabled={!peer} onClick={again}>
          {isSend ? 'Send more' : 'Send back'}
        </Button>
        <Button variant="primary" class="btn--lg" onClick={close}>
          Done
        </Button>
      </div>
    </div>
  )
}
