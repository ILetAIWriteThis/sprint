import { EMPTY_DATA } from './model'
import type { SprintData, SprintRepository } from './types'

const DATABASE_NAME = 'book-sprint'
const STORE_NAME = 'app-state'
const ROOT_KEY = 'root'

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open local storage.'))
    request.onblocked = () => reject(new Error('Local storage is blocked by another open tab.'))
  })
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Local storage request failed.'))
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save local data.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Local save was cancelled.'))
  })
}

export function createIndexedDbRepository(): SprintRepository {
  return {
    async load() {
      const database = await openDatabase()
      try {
        const transaction = database.transaction(STORE_NAME, 'readonly')
        const value = await requestResult(transaction.objectStore(STORE_NAME).get(ROOT_KEY))
        return value ? value as SprintData : structuredClone(EMPTY_DATA)
      } finally {
        database.close()
      }
    },
    async save(data) {
      const database = await openDatabase()
      try {
        const transaction = database.transaction(STORE_NAME, 'readwrite')
        transaction.objectStore(STORE_NAME).put(data, ROOT_KEY)
        await transactionDone(transaction)
      } finally {
        database.close()
      }
    },
  }
}

