const CACHE_NAME = 'book-sprint-shell-v1'
const scopeUrl = new URL(self.registration.scope)
const indexUrl = new URL('./index.html', scopeUrl)
const shellFiles = [
  './', './index.html', './manifest.webmanifest', './icons/icon.svg', './icons/maskable.svg',
].map((path) => new URL(path, scopeUrl).href)

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(shellFiles)
    const index = await cache.match(indexUrl)
    const markup = await index.clone().text()
    const assets = [...markup.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => new URL(match[1], indexUrl))
      .filter((url) => url.origin === scopeUrl.origin && url.href.startsWith(scopeUrl.href))
      .map((url) => url.href)
    await cache.addAll([...new Set(assets)])
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== scopeUrl.origin || !url.href.startsWith(scopeUrl.href)) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put(indexUrl, response.clone())
        }
        return response
      } catch {
        return (await caches.match(indexUrl, { ignoreVary: true })) ?? Response.error()
      }
    })())
    return
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreVary: true })
    if (cached) return cached
    try {
      const response = await fetch(request)
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME)
        await cache.put(request, response.clone())
      }
      return response
    } catch {
      return Response.error()
    }
  })())
})

