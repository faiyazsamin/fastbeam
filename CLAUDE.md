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
  main.tsx            fonts, CSS, theme + router init, SW registration
  app.tsx             screen switch
  sw.ts               service worker (precache now; streaming + share target later)
  state/              signals: storage, identity, settings, names, device, network, router, toast
  ui/tokens.css       design tokens (light, dark, [data-theme])
  ui/components/      Icons, Controls (Button, IconButton, Switch, Segmented), Header, EditableName, Toasts
  ui/screens/         Home, Settings
scripts/icons.mjs     icon generator
public/               CNAME, icons, robots.txt
.github/workflows/    Pages deploy on push to main
```

## Milestone status
- [x] M1 Skeleton: shell, tokens, fonts, icons, CNAME, identity, settings, PWA precache, deploy workflow.
- [ ] M2 Discovery: STUN probe, room derivation, Trystero join, hello/ping presence, Nearby grid.
- [ ] M3 Transfer: PeerLink (negotiated channel id 42), offer/accept, chunked send, three sinks, progress, text.
- [ ] M4 Pairing and failure: code/link/QR, in-app scanner, paste chip, `pairAuth.ts`, NAT badge, timeouts, sorry.
- [ ] M5 Polish: Share Target, drag-and-drop, wake lock, paste-to-send, reduced-motion pass, Playwright.

## Trystero notes (verified against 0.26.0)
- `getPeers()` returns `{ [peerId]: RTCPeerConnection }`; Trystero opens one non-negotiated channel labelled `"data"`, so a negotiated channel with `id: 42` is free.
- `rtcConfig.iceServers` replaces Trystero's default STUN list entirely.
- `onJoinError` fires when WebRTC cannot connect (useful for the sorry screen); `onPeerHandshake` exists but pending peers are not in `getPeers()`, so the password handshake runs on our own channel as build-notes §4 describes.
