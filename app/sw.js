// hosa27 service worker: caches the app (and the voice pack) so it keeps working with no Wi-Fi.
// Bump CACHE (and the ?v= numbers in index.html) when you change any app file, so iPads pick up the new version.
const CACHE = "hosa27-v0.10.4";
const FILES = [
  "./", "./index.html", "./styles.css", "./tasks.js", "./app.js", "./manifest.webmanifest",
  "./audio/audio_manifest.js",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // cache: "reload" = always download fresh from the server. Without it, the browser could hand back its own
    // copy of a file from the PREVIOUS version (GitHub Pages lets browsers keep files for 10 minutes), and that
    // old file would then be stuck in the new cache. (Bug seen when v0.10.2 and v0.10.3 went out 10 min apart.)
    const fresh = (u) => new Request(u, { cache: "reload" });
    await c.addAll(FILES.map(fresh));
    // pre-cache every voice-pack file listed by tools/make_voice_audio.py
    try {
      const list = await (await fetch("./audio/audio_files.json", { cache: "no-store" })).json();
      await c.addAll(list.map((f) => fresh("./audio/" + f)));
    } catch (_) { /* no voice pack yet */ }
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
