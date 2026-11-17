// Offline support for Daily Practice.
// The page and scripts are fetched network-first (cached copy when offline); fonts and icons come from the cache
// first and refresh in the background. Voice recordings are cached the first time they play (or are prefetched for a
// session) and kept across app updates, since a recording never changes: a changed sentence gets a new file name.
// Bump VERSION when the list of files below changes.
const VERSION = "v3";
const CACHE = `daily-practice-${VERSION}`;
const VOICE = "daily-practice-voice";
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "js/poses.js",
  "js/speech.js",
  "js/modes/movement.js",
  "js/modes/pilates.js",
  "js/modes/yoga.js",
  "js/modes/strength.js",
  "js/engine.js",
  "voice/manifest.json",
  "fonts/fonts.css",
  "fonts/bricolage-600.woff2",
  "fonts/bricolage-800.woff2",
  "fonts/figtree-400.woff2",
  "fonts/figtree-500.woff2",
  "fonts/figtree-700.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("daily-practice-v") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // voice recordings: cache first, forever
  if (/\/voice\/[0-9a-f]{8}\.mp3$/.test(url.pathname)) {
    event.respondWith(
      caches.open(VOICE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  const navigate = req.mode === "navigate";
  const fresh = navigate || /\.(js|json|webmanifest)$/.test(url.pathname);
  const key = navigate ? "./" : req;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(key, { ignoreSearch: true });
      // Fetch by URL: a navigate-mode Request can't be re-fetched with extra options.
      const network = fetch(req.url, { cache: "no-cache" }).then((res) => {
        if (res.ok) cache.put(key, res.clone());
        return res;
      });

      // The page and its code: network first, so a new version shows up on the next open.
      // Fall back to the cached copy when offline or when the network is too slow.
      if (fresh) {
        const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 3500));
        const res = await Promise.race([network.catch(() => null), timeout]);
        if (res && res.ok) return res;
        if (cached) {
          event.waitUntil(network.catch(() => {}));
          return cached;
        }
        return network.catch(() => Response.error());
      }

      // Fonts and icons: cache first, refreshed in the background.
      if (cached) {
        event.waitUntil(network.catch(() => {}));
        return cached;
      }
      return network.catch(() => Response.error());
    })
  );
});
