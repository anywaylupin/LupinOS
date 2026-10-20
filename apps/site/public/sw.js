// LupinOS service worker. Pages are network-first so new builds show up; everything else
// (hashed scripts, styles, fonts, icons) is cache-first. After one visit the OS works offline.
const CACHE = "lupinos-v1";
const SHELL = ["/", "/plain", "/favicon.svg", "/resume.pdf"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const put = (res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  };
  if (req.mode === "navigate") {
    // Deep links all run the same OS, so the cached home page is a fine offline fallback.
    e.respondWith(
      fetch(req)
        .then(put)
        .catch(() => caches.match(req).then((r) => r || caches.match("/"))),
    );
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(put)));
});
