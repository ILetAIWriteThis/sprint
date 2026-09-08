import { useEffect, useState } from 'react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePwa() {
  const [install, setInstall] = useState<InstallPromptEvent | null>(null)
  const [update, setUpdate] = useState<ServiceWorkerRegistration | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    const captureInstall = (event: Event) => {
      event.preventDefault()
      setInstall(event as InstallPromptEvent)
    }
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    window.addEventListener('beforeinstallprompt', captureInstall)

    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((registration) => {
        if (registration.waiting) setUpdate(registration)
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) setUpdate(registration)
          })
        })
      }).catch(() => undefined)
    }

    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
      window.removeEventListener('beforeinstallprompt', captureInstall)
    }
  }, [])

  return { install, update, online }
}

export function activateUpdate(registration: ServiceWorkerRegistration) {
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
}

