# fastbeam

Browser-only, peer-to-peer file and text sharing PWA. Static build on GitHub Pages at https://fastbeam.app. No backend, no TURN, no accounts.

## Source of truth
The handoff lives in `fastbeam-handoff/` (gitignored, local only). Read in this order:
1. `fastbeam-handoff/docs/spec-original.md`: architecture, discovery, transfer protocol (calls the app "Beam").
2. `fastbeam-handoff/docs/build-notes.md`: rename, tokens, UX rules, password pairing, per-screen behaviour. **Wins over the spec.**
3. `fastbeam-handoff/design/*.dc.html`: one mockup per screen; the visual reference. Build Preact components, don't copy the markup.

## Conventions
- Commits are authored as `Anam Ahmed <anam.ahmed.a@gmail.com>` (set repo-locally; do not use the global identity).
- Dev server: `npm run dev` on port **5179** (strictPort). Preview uses the same port.
- Work milestone by milestone (spec "Milestones and acceptance" as amended by build-notes §7). Plan, get an OK, build, ship to Pages, stop for two-device testing.
- Product name is always lowercase `fastbeam`. `APP_SALT = "fastbeam/v1"`, Trystero `appId: "fastbeam.app"`.
- Fonts are self-hosted via `@fontsource`; nothing is requested from Google or any third party at runtime.

## Commands
- `npm run dev` / `npm run build` / `npm run preview`
- `npm run typecheck` (tsc strict), `npm test` (Vitest, jsdom)
- `npm run icons` regenerates `public/icons` from the mark (needs `@resvg/resvg-js`)
- `npm run check` runs typecheck, tests and build (what CI runs before deploying)

## Layout
```
src/
  main.tsx            fonts, CSS, theme + router init, SW registration, boot()
  boot.ts             startup: discovery, pairing links (#CODE), share-target pickup, drag/paste capture, wake lock
  app.tsx             screen priority: Sorry > Password > Connecting > Progress > Done > Settings/Home, plus overlays
  config.ts           salts, STUN list, limits, timeouts
  sw.ts               service worker: precache, streamed downloads (/fb-download/<id>), Share Target POST /share
  net/
    hash.ts           sha256, base32, base64url, roomId(kind, key)
    stunProbe.ts      public IPv4 / IPv6 prefix / NAT kind
    signaling.ts      Signaling interface + Trystero (Nostr) adapter
    peerLink.ts       negotiated data channel id 42: control JSON + binary frames, fingerprints
    session.ts        hello/ping, peer registry wiring, control routing to transfer manager
    discovery.ts      probe → rooms → join; re-discovery on online/connection/visibility
    pairing.ts        host codes (rotate, retire rooms), joiner state machine, timeouts → sorry
    pairAuth.ts       PBKDF2/HKDF/HMAC password handshake (+ .worker.ts), AuthLimiter
    qr.worker.ts      jsQR fallback for the scanner
    wordlist.ts       2,048 words for suggested passwords
  transfer/
    protocol.ts       messages, chunk framing, sanitising, formatting, verification code
    sender.ts         offer → stream files with backpressure + 32 MiB ack window
    receiver.ts       offer dialog state → sink pipeline → done
    manager.ts        one incoming + one outgoing at a time, busy/decline, wake lock, beforeunload
    sinks/            fsAccess (Chromium desktop), swStream (Chrome Android, Firefox), blob (iOS)
  state/              signals: storage, identity, settings, names, device, network, router, toast, peers, ui
  ui/                 tokens.css, base.css, components.css, screens.css, overlays.css
  ui/components/      Icons, Controls, Header, EditableName, Toasts, Sheet+Tabs, Tile, CodeBoxes, QrCode,
                      Scanner, IncomingDialog, TextReceivedDialog, PairPanel (desktop)
  ui/sheets/          SendSheet (3), PairSheet (7 + 8)
  ui/screens/         Home (1, 2, 13), Settings (12), Pairing (9, 10, 11), Transfer (5, 6)
e2e/                  Playwright: smoke.spec (UI), network.spec (two tabs discover, transfer, password pairing)
scripts/icons.mjs     icon generator
public/               CNAME, icons, robots.txt
.github/workflows/    Pages deploy on push to main
```

## Status
All five milestones are built in one pass (user's call on Oct 7, 2026). Remaining known gaps:
- Resume after disconnect, remembered devices, and PAKE-based password auth are v2 (per spec).
- One incoming and one outgoing transfer at a time globally (spec said per peer); extras get `busy`.
- `auth-required` carries the host's device name so the Password screen can say who set it.
- The Nearby grid, Send sheet, Incoming dialog, Progress and Done screens were verified in headless Chrome
  through `e2e/network.spec.ts`; real two-device, cross-network runs are still worth doing.

## Testing
- `npm test`: unit tests incl. PBKDF2/HKDF/HMAC known-answer vectors, handshake, STUN parsing, framing.
- `npm run e2e`: Playwright against the dev server using local Chrome (`channel: 'chrome'`). The network spec
  needs internet (STUN + Nostr relays). `localStorage['fastbeam:sink']='"blob"'` forces the Blob sink so
  headless runs can complete a transfer without a file picker.

## Connection resilience (iOS Safari drops ICE briefly all the time)
- `net/patientPc.ts` is passed to Trystero as `rtcPolyfill`; it reports "connected" for up to 30 s while the
  real ICE state is "disconnected" so Trystero's 5 s teardown never fires. `PeerLink` watches the real state,
  asks for `restartIce()` after 3 s (only the side with the smaller device ID, to avoid glare) and gives up at 30 s.
- Missed pings (15 s) mark a peer `online: false` ("Reconnecting…", tile disabled) but keep the link; a link
  closes only on real ICE failure or 60 s of silence. When the last link closes the peer stays listed for 90 s
  and a fresh link merges back in. Sheets and dialogs therefore survive a blip.
- The first control frame in each direction is repeated every second until answered (`sendUntil`), because a
  negotiated channel is created independently per side and an early frame can arrive before the other side's
  channel exists.
- Chrome can deliver frames queued for a late-created negotiated channel *before* its "open" event. `PeerLink`
  therefore buffers control frames until the first `onControl` handler is attached and flushes them into it.
  Rule: the first handler attached to a fresh link must be the real waiter (`waitForControl`), never a debug tap.
- Status console (desktop header button, Ctrl/⌘ + `): `state/log.ts` ring buffer; `logger('scope')` in net,
  pairing, transfer and boot code. Use it first when discovery or pairing misbehaves.
- Browsers cannot dial a peer by IP: every new WebRTC connection needs an SDP exchange through signaling.
  ICE restart on the existing connection is the closest thing and keeps the direct LAN path.
- Dev server only: `fastbeam.killConnections()` / `fastbeam.dropLinks()` in the console simulate drops.

## Trystero notes (verified against 0.26.0)
- `getPeers()` returns `{ [peerId]: RTCPeerConnection }`; Trystero opens one non-negotiated channel labelled `"data"`, so a negotiated channel with `id: 42` is free.
- `rtcConfig.iceServers` replaces Trystero's default STUN list entirely.
- `onJoinError` fires when WebRTC cannot connect (useful for the sorry screen); `onPeerHandshake` exists but pending peers are not in `getPeers()`, so the password handshake runs on our own channel as build-notes §4 describes.
