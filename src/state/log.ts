import { signal } from '@preact/signals'
import { isBoolean, persisted } from './storage'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  id: number
  t: number
  level: LogLevel
  scope: string
  msg: string
  data?: string
}

const MAX_ENTRIES = 600
let nextId = 1

/** Ring buffer of status lines for the in-app console. */
export const logs = signal<readonly LogEntry[]>([])

/** Whether the console panel is open (desktop only; remembered). */
export const consoleOpen = persisted<boolean>('console', () => false, isBoolean)

function describe(data: unknown): string | undefined {
  if (data === undefined) return undefined
  if (typeof data === 'string') return data
  if (data instanceof Error) return data.message
  try {
    const s = JSON.stringify(data)
    return s.length > 300 ? `${s.slice(0, 300)}…` : s
  } catch {
    return String(data)
  }
}

export function log(level: LogLevel, scope: string, msg: string, data?: unknown): void {
  const entry: LogEntry = { id: nextId++, t: Date.now(), level, scope, msg }
  const d = describe(data)
  if (d !== undefined) entry.data = d
  const cur = logs.peek()
  logs.value = cur.length >= MAX_ENTRIES ? [...cur.slice(cur.length - MAX_ENTRIES + 1), entry] : [...cur, entry]
  if (import.meta.env.DEV) {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.debug
    fn(`[fastbeam:${scope}] ${msg}`, data ?? '')
  }
}

export function clearLogs(): void {
  logs.value = []
}

/** Scoped helpers so call sites stay short: `const L = logger('pair')` → `L.info('…')`. */
export function logger(scope: string) {
  return {
    debug: (msg: string, data?: unknown) => log('debug', scope, msg, data),
    info: (msg: string, data?: unknown) => log('info', scope, msg, data),
    warn: (msg: string, data?: unknown) => log('warn', scope, msg, data),
    error: (msg: string, data?: unknown) => log('error', scope, msg, data),
  }
}

export function formatLogLine(e: LogEntry): string {
  const d = new Date(e.t)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms} ${e.level.toUpperCase().padEnd(5)} ${e.scope.padEnd(8)} ${e.msg}${e.data ? `  ${e.data}` : ''}`
}
