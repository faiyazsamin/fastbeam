# fastbeam

Files to the next device, straight across. No app, no account, no cloud.

fastbeam is a browser-only, peer-to-peer file and text sharing PWA. Devices on the same Wi‑Fi find each other automatically; devices on different networks pair with a six-character code, link or QR. Every byte travels over a direct WebRTC data channel. Public STUN and Nostr relays only help devices find each other.

Live at **https://fastbeam.app**.

## Develop

```sh
npm install
npm run dev        # http://localhost:5179
npm run check      # typecheck + tests + production build
```

Pushing to `main` builds and deploys to GitHub Pages.
