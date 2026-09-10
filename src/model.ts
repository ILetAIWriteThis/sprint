import type { ActiveSprint, ArchivedSprint, Category, SprintData, SprintItem } from './types'

export const CATEGORIES: Category[] = ['book', 'youtube', 'tv']

export const CATEGORY_META: Record<Category, { label: string; shortLabel: string }> = {
  book: { label: 'Books', shortLabel: 'Book' },
  youtube: { label: 'YouTube', shortLabel: 'YouTube' },
  tv: { label: 'TV & film', shortLabel: 'TV' },
}

export const EMPTY_DATA: SprintData = { active: null, archived: [] }

export function makeId(prefix = 'item') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function minutesForPages(pages: number) {
  return Math.max(0, pages) * 2
}

export function totalForCategory(items: SprintItem[], category: Category) {
  return items.filter((item) => item.category === category).reduce((sum, item) => sum + item.totalMinutes, 0)
}

export function remainingForItem(item: SprintItem) {
  return item.totalMinutes * (1 - Math.min(100, Math.max(0, item.progress)) / 100)
}

export function remainingForCategory(items: SprintItem[], category: Category) {
  return items.filter((item) => item.category === category).reduce((sum, item) => sum + remainingForItem(item), 0)
}

export function progressForItems(items: SprintItem[]) {
  const total = items.reduce((sum, item) => sum + item.totalMinutes, 0)
  if (!total) return 0
  const remaining = items.reduce((sum, item) => sum + remainingForItem(item), 0)
  return Math.round((1 - remaining / total) * 100)
}

function dateAsUtcDay(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

function dueDateAsUtcDay(dueDate: string) {
  const [year, month, day] = dueDate.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

export function daysThroughDueDate(dueDate: string, today = new Date()) {
  const difference = Math.round((dueDateAsUtcDay(dueDate) - dateAsUtcDay(today)) / 86_400_000)
  return Math.max(1, difference + 1)
}

export function minutesPerDay(items: SprintItem[], category: Category, dueDate: string, today = new Date()) {
  return remainingForCategory(items, category) / daysThroughDueDate(dueDate, today)
}

export function formatDuration(minutes: number) {
  const rounded = Math.max(0, Math.ceil(minutes))
  if (rounded === 0) return 'Done'
  if (rounded < 60) return `${rounded} min`
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`
}

export function isPastDue(dueDate: string, today = new Date()) {
  return dueDateAsUtcDay(dueDate) < dateAsUtcDay(today)
}

export function updateItemProgress(data: SprintData, itemId: string, progress: number): SprintData {
  if (!data.active) return data
  const normalized = Math.min(100, Math.max(0, Math.round(progress)))
  const items = data.active.items.map((item) => {
    if (item.id !== itemId) return item
    if (normalized === 100) {
      return {
        ...item,
        progress: normalized,
        progressBeforeCompletion: item.progress === 100 ? item.progressBeforeCompletion : item.progress,
      }
    }
    const { progressBeforeCompletion: _previousProgress, ...rest } = item
    return { ...rest, progress: normalized }
  })
  return { ...data, active: { ...data.active, items } }
}

export function archiveCompletedSprint(data: SprintData, completedAt = new Date().toISOString()): SprintData {
  if (!data.active || !data.active.items.length || !data.active.items.every((item) => item.progress === 100)) return data
  const active = data.active
  const archived: ArchivedSprint = { ...active, status: 'archived', completedAt }
  return {
    active: null,
    archived: [archived, ...data.archived]
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, 5),
  }
}

export function createSprint(dueDate: string, items: SprintItem[], createdAt = new Date().toISOString()): ActiveSprint {
  return { id: makeId('sprint'), createdAt, dueDate, status: 'active', items }
}
