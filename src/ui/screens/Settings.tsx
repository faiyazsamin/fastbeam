import { NAT_DETAIL, nat } from '../../state/network'
import { goBack } from '../../state/router'
import { deviceName, discoverable, NAME_MAX, setDeviceName, shuffleName, theme, type Theme } from '../../state/settings'
import { Button, IconButton, Segmented, Switch } from '../components/Controls'
import { NetworkBadge } from '../components/Header'
import { BackIcon } from '../components/Icons'

const THEMES: readonly { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function Settings() {
  const commitName = (e: Event) => {
    const el = e.currentTarget as HTMLInputElement
    if (!setDeviceName(el.value)) el.value = deviceName.value
    else el.value = deviceName.value
  }

  return (
    <div class="settings">
      <header class="settings-header">
        <IconButton label="Back" onClick={goBack}>
          <BackIcon />
        </IconButton>
        <h1 class="settings-title" style={{ margin: 0 }}>
          Settings
        </h1>
      </header>

      <section class="field">
        <label class="field-label" for="device-name">
          Device name
        </label>
        <div class="input-row">
          <input
            id="device-name"
            type="text"
            value={deviceName.value}
            maxLength={NAME_MAX}
            autocomplete="off"
            autocapitalize="words"
            enterkeyhint="done"
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
            }}
          />
          <Button variant="link" onClick={shuffleName}>
            Shuffle
          </Button>
        </div>
      </section>

      <section class="card card--list">
        <div class="row">
          <div class="row-text">
            <span class="row-title">Visible to nearby devices</span>
            <span class="row-sub">Codes still work when this is off</span>
          </div>
          <Switch checked={discoverable.value} onChange={(v) => (discoverable.value = v)} label="Visible to nearby devices" />
        </div>
        <div class="row row--stack">
          <span class="row-title">Theme</span>
          <Segmented options={THEMES} value={theme.value} onChange={(v) => (theme.value = v)} label="Theme" />
        </div>
      </section>

      <section class="card card--pad">
        <div class="netcheck-head">
          <span class="row-title">Network check</span>
          <NetworkBadge />
        </div>
        <p class="settings-note">{NAT_DETAIL[nat.value]}</p>
        <Button variant="link" disabled={nat.value === 'checking'} title="Available in the next update">
          Run again
        </Button>
      </section>

      <section class="settings-section">
        <h2>What leaves this device</h2>
        <p class="settings-note">
          Files and text go straight to the other device, encrypted. To find each other, devices post a scrambled network
          ID and connection details (which include your IP address) to public relays. Devices you connect to can see
          your IP address. No accounts, no analytics.
        </p>
      </section>

      <footer class="settings-footer">
        <span>fastbeam {__APP_VERSION__}</span>
        <a href="https://fastbeam.app">fastbeam.app</a>
      </footer>
    </div>
  )
}
