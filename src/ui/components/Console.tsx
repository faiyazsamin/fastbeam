import { useEffect, useRef, useState } from 'preact/hooks'
import { lastProbe } from '../../net/discovery'
import { deviceId, device } from '../../state/identity'
import { clearLogs, consoleOpen, formatLogLine, logs, type LogLevel } from '../../state/log'
import { NAT_LABEL, nat } from '../../state/network'
import { peers } from '../../state/peers'
import { deviceName } from '../../state/settings'
import { toast } from '../../state/toast'
import { IconButton } from './Controls'
import { CloseIcon } from './Icons'

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']

/** Docked status console for the curious: every discovery, link, pairing and transfer event, live. */
export function Console() {
  const open = consoleOpen.value
  const [filter, setFilter] = useState('')
  const [minLevel, setMinLevel] = useState<LogLevel>('debug')
  const [paused, setPaused] = useState(false)
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault()
        consoleOpen.value = !consoleOpen.value
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const entries = logs.value
  useEffect(() => {
    if (!open || paused) return
    const el = body.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries.length, open, paused])

  if (!open) return null

  const threshold = LEVELS.indexOf(minLevel)
  const q = filter.trim().toLowerCase()
  const shown = entries.filter(
    (e) => LEVELS.indexOf(e.level) >= threshold && (!q || `${e.scope} ${e.msg} ${e.data ?? ''}`.toLowerCase().includes(q)),
  )
  const peerList = [...peers.value.values()]
  const probe = lastProbe.value

  const copy = async () => {
    const header = [
      `fastbeam ${__APP_VERSION__} · ${device.platform} · ${device.browser}`,
      `device ${deviceId.value} "${deviceName.value}" · nat ${nat.value} · ipv4 ${probe?.ipv4 ?? '-'} · ipv6/64 ${probe?.ipv6Prefix ?? '-'}`,
      `peers ${peerList.map((p) => `${p.name}(${p.online ? 'on' : 'off'},${p.links.length})`).join(' ') || 'none'}`,
      '',
    ].join('\n')
    try {
      await navigator.clipboard.writeText(header + shown.map(formatLogLine).join('\n'))
      toast(`Copied ${shown.length} lines`)
    } catch {
      toast('Couldn’t copy')
    }
  }

  return (
    <section class="console" aria-label="Status console">
      <header class="console-head">
        <span class="console-title mono">fastbeam console</span>
        <span class="console-status">
          <b>{deviceName.value}</b> · {deviceId.value.slice(0, 8)} · nat {NAT_LABEL[nat.value].toLowerCase()} · v4 {probe?.ipv4 ?? '–'} · v6/64{' '}
          {probe?.ipv6Prefix ?? '–'} · peers {peerList.length} ({peerList.filter((p) => p.online).length} online)
        </span>
        <div class="console-tools">
          <input
            class="console-filter mono"
            type="search"
            placeholder="filter"
            value={filter}
            aria-label="Filter log lines"
            onInput={(e) => setFilter((e.currentTarget as HTMLInputElement).value)}
          />
          <select
            class="console-select mono"
            aria-label="Minimum level"
            value={minLevel}
            onChange={(e) => setMinLevel((e.currentTarget as HTMLSelectElement).value as LogLevel)}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}+
              </option>
            ))}
          </select>
          <button type="button" class="console-btn" aria-pressed={paused} onClick={() => setPaused(!paused)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" class="console-btn" onClick={() => void copy()}>
            Copy
          </button>
          <button type="button" class="console-btn" onClick={clearLogs}>
            Clear
          </button>
          <IconButton label="Close console" class="console-close" onClick={() => (consoleOpen.value = false)}>
            <CloseIcon size={18} />
          </IconButton>
        </div>
      </header>
      <div ref={body} class="console-body mono" role="log" aria-live="off">
        {shown.length === 0 ? (
          <div class="console-empty">Nothing yet{q ? ' for that filter' : ''}. Events show up here as they happen.</div>
        ) : (
          shown.map((e) => (
            <div key={e.id} class={`console-line is-${e.level}`}>
              <span class="console-t">{formatLogLine(e).slice(0, 12)}</span>
              <span class="console-lvl">{e.level}</span>
              <span class="console-scope">{e.scope}</span>
              <span class="console-msg">
                {e.msg}
                {e.data && <span class="console-data"> {e.data}</span>}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
