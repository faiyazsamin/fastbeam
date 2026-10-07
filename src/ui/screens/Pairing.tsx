import { useEffect, useState } from 'preact/hooks'
import { cancelJoin, dismissSorry, formatCode, joinWithCode, joining, sorry, submitJoinPassword } from '../../net/pairing'
import { device } from '../../state/identity'
import { hasPending, openPairSheet } from '../../state/ui'
import { Button, IconButton } from '../components/Controls'
import { BackIcon, CheckIcon, CloseIcon, DeviceIcon, EyeIcon, EyeOffIcon, LaptopIcon, LockKeyholeIcon } from '../components/Icons'
import { onPairedDefault } from '../sheets/PairSheet'

function useElapsed(since: number): string {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const s = Math.max(0, Math.floor((now - since) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Screen 10. */
export function Connecting() {
  const j = joining.value
  const elapsed = useElapsed(j?.startedAt ?? Date.now())
  if (!j) return null
  const found = j.step !== 'finding'
  const who = j.hostName ?? 'the other device'
  return (
    <div class="screen">
      <header class="screen-head">
        <span class="mono codechip">{formatCode(j.code)}</span>
        <span class="mono muted" aria-label={`Elapsed ${elapsed}`}>
          {elapsed}
        </span>
      </header>
      <div class="connect-art" aria-hidden="true">
        <span class="connect-node">
          <DeviceIcon type={device.deviceType} size={30} />
        </span>
        <span class="connect-track">
          <i class="connect-beam" />
        </span>
        <span class="connect-node">
          <LaptopIcon size={30} />
        </span>
      </div>
      <h1 class="screen-title">Connecting to {who}</h1>
      <ol class="checklist" aria-live="polite">
        <li class={found ? 'is-done' : 'is-active'}>
          <span class="check">{found ? <CheckIcon /> : <i class="spin" />}</span>
          Found the other device
        </li>
        {j.locked && (
          <li class={j.passwordChecked ? 'is-done' : 'is-active'}>
            <span class="check">{j.passwordChecked ? <CheckIcon /> : <i class="spin" />}</span>
            Password checked
          </li>
        )}
        <li class={found && (!j.locked || j.passwordChecked) ? 'is-active' : ''}>
          <span class="check">{found && (!j.locked || j.passwordChecked) ? <i class="spin" /> : null}</span>
          Opening a direct link…
        </li>
      </ol>
      <Button variant="secondary" class="screen-cta" onClick={cancelJoin}>
        Cancel
      </Button>
    </div>
  )
}

/** Screen 9. Shown only once `auth-required` has arrived, so a host is really there. */
export function Password() {
  const j = joining.value
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  if (!j) return null
  const submit = () => {
    if (pw.trim().length < 4 || j.checking) return
    submitJoinPassword(pw)
  }
  return (
    <div class="screen">
      <header class="screen-head screen-head--left">
        <IconButton label="Back" onClick={cancelJoin}>
          <BackIcon />
        </IconButton>
        <span class="mono codechip">{formatCode(j.code)}</span>
      </header>
      <div class="pw-hero">
        <span class="pw-lock">
          <LockKeyholeIcon />
        </span>
        <h1 class="screen-title">{j.hostName ?? 'The other device'} set a password</h1>
        <p class="screen-copy">Ask them for it. It&rsquo;s checked on this device and never sent over the internet.</p>
      </div>
      <div class="field">
        <label class="field-label field-label--ink" for="join-pw">
          Password
        </label>
        <div class={`input-row input-row--tall${j.wrong ? ' input-row--warn' : ''}`}>
          <input
            id="join-pw"
            class="mono-input"
            type={show ? 'text' : 'password'}
            value={pw}
            autofocus
            autocomplete="off"
            autocapitalize="off"
            spellcheck={false}
            enterkeyhint="go"
            disabled={j.checking}
            onInput={(e) => setPw((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <IconButton label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </IconButton>
        </div>
        {j.wrong && (
          <div class="alert alert--warn" role="alert">
            That didn&rsquo;t match.{' '}
            {j.triesLeft !== null ? `${j.triesLeft} ${j.triesLeft === 1 ? 'try' : 'tries'} left before the code resets.` : ''}
          </div>
        )}
      </div>
      <Button variant="primary" class="screen-cta btn--lg" disabled={pw.trim().length < 4 || j.checking} onClick={submit}>
        {j.checking ? 'Checking…' : 'Unlock and connect'}
      </Button>
    </div>
  )
}

/** Screen 11. */
export function Sorry() {
  const s = sorry.value
  if (!s) return null
  const cause =
    s.cause === 'symmetric'
      ? 'Your network limits direct connections'
      : s.cause === 'udp-blocked'
        ? 'Your network blocks direct connections'
        : null
  const title =
    s.reason === 'auth'
      ? 'Couldn’t verify the other device'
      : s.reason === 'rotated'
        ? 'That code has been reset'
        : s.reason === 'expired'
          ? 'That code has already been used'
          : 'Couldn’t connect directly'
  const copy =
    s.reason === 'auth'
      ? 'The password check failed in a way that suggests something sat between the two devices. Get a fresh code and try again on the same Wi‑Fi.'
      : s.reason === 'rotated'
        ? 'Too many wrong passwords, so the other device made a new code. Ask for the new one.'
        : s.reason === 'expired'
          ? 'Codes and links work once. Another device already connected with this one, so the other device is showing a new code now. Ask for that one.'
          : 'fastbeam only sends files device‑to‑device, and these two networks won’t allow a direct link.'
  return (
    <div class="screen">
      <header class="screen-head screen-head--right">
        <IconButton label="Close" class="iconbtn--round" onClick={dismissSorry}>
          <CloseIcon />
        </IconButton>
      </header>
      <div class="sorry-art" aria-hidden="true">
        <span class="sorry-node">
          <DeviceIcon type={device.deviceType} size={28} />
        </span>
        <span class="sorry-track">
          <i class="ok" />
          <i class="x">
            <CloseIcon size={16} strokeWidth={2.6} />
          </i>
          <i class="dash" />
        </span>
        <span class="sorry-node">
          <LaptopIcon size={28} />
        </span>
      </div>
      <div class="stack-10">
        <h1 class="screen-title screen-title--left">{title}</h1>
        <p class="screen-copy screen-copy--left">{copy}</p>
        {cause && s.reason === 'timeout' && <span class="badge badge--warn">{cause}</span>}
      </div>
      {s.reason !== 'expired' && (
      <section class="card card--pad steps">
        <div class="eyebrow-caps eyebrow-caps--link">This always works</div>
        <div class="step">
          <span class="step-n">1</span>
          <span>
            Put both devices on the same Wi‑Fi, <strong>or</strong> turn on one phone&rsquo;s hotspot and join it from the other.
          </span>
        </div>
        <div class="step">
          <span class="step-n">2</span>
          <span>Reopen fastbeam on both. They&rsquo;ll find each other on their own — no code needed.</span>
        </div>
      </section>
      )}
      <div class="screen-cta stack-10">
        {s.reason !== 'expired' && (
        <Button
          variant="primary"
          class="btn--lg"
          onClick={() => {
            dismissSorry()
            joinWithCode(s.code, { intent: hasPending(), onPaired: onPairedDefault })
          }}
        >
          Try again
        </Button>
        )}
        {s.reason === 'expired' && (
          <Button
            variant="primary"
            class="btn--lg"
            onClick={() => {
              dismissSorry()
              openPairSheet('scan')
            }}
          >
            Enter the new code
          </Button>
        )}
        <Button
          variant="link"
          class="btn--center"
          onClick={() => {
            dismissSorry()
            openPairSheet('scan', s.code)
          }}
        >
          Check the code
        </Button>
      </div>
    </div>
  )
}
