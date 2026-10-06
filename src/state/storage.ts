import { effect, signal, type Signal } from '@preact/signals'

const PREFIX = 'fastbeam:'

function read<T>(key: string, init: () => T, validate?: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return init()
    const parsed: unknown = JSON.parse(raw)
    if (validate && !validate(parsed)) return init()
    return parsed as T
  } catch {
    return init()
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode, quota): keep the value in memory only.
  }
}

/**
 * A signal mirrored to localStorage under the `fastbeam:` prefix.
 * Reads once at creation (calling `init` when nothing valid is stored) and writes on every change.
 */
export function persisted<T>(key: string, init: () => T, validate?: (v: unknown) => v is T): Signal<T> {
  const s = signal<T>(read(key, init, validate))
  effect(() => write(key, s.value))
  return s
}

export const isString = (v: unknown): v is string => typeof v === 'string'
export const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'
