import {
  archiveCompletedSprint,
  daysThroughDueDate,
  formatDuration,
  minutesForPages,
  minutesPerDay,
  progressForItems,
  updateItemProgress,
} from '../src/model'
import type { ArchivedSprint, SprintData, SprintItem } from '../src/types'

const items: SprintItem[] = [
  { id: 'book', category: 'book', title: 'The Book', pages: 120, totalMinutes: 240, progress: 50 },
  { id: 'video', category: 'youtube', title: 'The Video', totalMinutes: 120, progress: 0 },
  { id: 'tv', category: 'tv', title: 'The Show', totalMinutes: 120, progress: 25 },
]

describe('sprint calculations', () => {
  it('estimates reading at two minutes per page and formats useful units', () => {
    expect(minutesForPages(448)).toBe(896)
    expect(formatDuration(55)).toBe('55 min')
    expect(formatDuration(65)).toBe('1 hr 5 min')
    expect(formatDuration(120)).toBe('2 hr')
    expect(formatDuration(0)).toBe('Done')
  })

  it('counts today and the due date and recalculates pace from remaining time', () => {
    const today = new Date(2026, 8, 8, 20, 0)
    expect(daysThroughDueDate('2026-09-10', today)).toBe(3)
    expect(minutesPerDay(items, 'book', '2026-09-10', today)).toBe(40)
    expect(minutesPerDay(items, 'tv', '2026-09-10', today)).toBe(30)
  })

  it('uses one catch-up day after a due date has passed', () => {
    expect(daysThroughDueDate('2026-09-01', new Date(2026, 8, 8))).toBe(1)
  })

  it('uses duration-weighted progress', () => {
    expect(progressForItems(items)).toBe(31)
  })
})

describe('sprint completion', () => {
  it('keeps completed items active until the user archives and retains the newest five', () => {
    const oldArchives: ArchivedSprint[] = Array.from({ length: 5 }, (_, index) => ({
      id: `old-${index}`,
      createdAt: '2026-01-01T00:00:00.000Z',
      dueDate: '2026-01-02',
      status: 'archived',
      completedAt: `2026-01-0${index + 1}T00:00:00.000Z`,
      items: [],
    }))
    const data: SprintData = {
      active: {
        id: 'active',
        createdAt: '2026-09-01T00:00:00.000Z',
        dueDate: '2026-09-10',
        status: 'active',
        items: items.map((item) => ({ ...item, progress: item.id === 'book' ? 99 : 100 })),
      },
      archived: oldArchives,
    }

    const stillActive = updateItemProgress(data, 'book', 99)
    expect(stillActive.active).not.toBeNull()

    const completed = updateItemProgress(data, 'book', 100)
    expect(completed.active).not.toBeNull()
    expect(completed.active?.items[0]).toMatchObject({ progress: 100, progressBeforeCompletion: 99 })

    const restored = updateItemProgress(completed, 'book', 99)
    expect(restored.active?.items[0].progress).toBe(99)
    expect(restored.active?.items[0]).not.toHaveProperty('progressBeforeCompletion')

    const finished = archiveCompletedSprint(completed, '2026-09-08T18:00:00.000Z')
    expect(finished.active).toBeNull()
    expect(finished.archived).toHaveLength(5)
    expect(finished.archived[0].id).toBe('active')
    expect(finished.archived.some((sprint) => sprint.id === 'old-0')).toBe(false)
  })
})
