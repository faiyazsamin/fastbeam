/// <reference lib="webworker" />
// fastbeam service worker. Milestone 1: precache the app shell so it opens with no network.
// Later milestones add streaming downloads (receiver sink 2) and the Android Share Target POST.

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Any navigation (including /#K7QX4M pairing links) is served from the cached shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') void self.skipWaiting()
})

void self.skipWaiting()
clientsClaim()
