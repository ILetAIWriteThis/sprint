import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'
import type { SprintData, SprintRepository } from '../src/types'

function memoryRepository(initial: SprintData) {
  let value = structuredClone(initial)
  const repository: SprintRepository = {
    load: async () => structuredClone(value),
    save: async (next) => { value = structuredClone(next) },
  }
  return { repository, read: () => value }
}

describe('Book Sprint UI', () => {
  it('plans a balanced sprint and persists it locally', async () => {
    const user = userEvent.setup()
    const memory = memoryRepository({ active: null, archived: [] })
    render(<App repository={memory.repository} />)

    await screen.findByRole('heading', { name: /balanced sprint/i })
    await user.type(screen.getByLabelText('Due date'), '2099-09-30')
    await user.type(screen.getByLabelText('Book title'), 'A Great Book')
    await user.type(screen.getByLabelText('Pages'), '60')
    await user.click(screen.getByRole('button', { name: 'Add book' }))
    expect(screen.getByText(/60 pages · 2 hr/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Balance the sprint/ }))

    await user.type(screen.getByLabelText('Title'), 'Good videos')
    await user.type(screen.getByLabelText('Hours'), '1')
    await user.click(screen.getByRole('button', { name: 'Add to sprint' }))
    await user.click(screen.getByLabelText('TV & film'))
    await user.type(screen.getByLabelText('Title'), 'A good film')
    await user.type(screen.getByLabelText('Hours'), '1')
    await user.click(screen.getByRole('button', { name: 'Add to sprint' }))

    await user.click(screen.getByRole('button', { name: /Start sprint/ }))
    await screen.findByRole('heading', { name: 'Today’s pace' })
    expect(memory.read().active?.items).toHaveLength(3)
    expect(memory.read().active?.items[0]).toMatchObject({ title: 'A Great Book', totalMinutes: 120 })
  })

  it('saves percentage progress and updates remaining time', async () => {
    const user = userEvent.setup()
    const memory = memoryRepository({
      active: {
        id: 'sprint', createdAt: '2026-09-01T00:00:00.000Z', dueDate: '2099-09-30', status: 'active',
        items: [
          { id: 'book', category: 'book', title: 'A Great Book', pages: 100, totalMinutes: 200, progress: 0 },
          { id: 'youtube', category: 'youtube', title: 'Videos', totalMinutes: 100, progress: 0 },
          { id: 'tv', category: 'tv', title: 'Show', totalMinutes: 100, progress: 0 },
        ],
      },
      archived: [],
    })
    render(<App repository={memory.repository} />)
    const input = await screen.findByLabelText('Progress for A Great Book')
    await user.clear(input)
    await user.type(input, '40')
    const item = input.closest('article')!
    await user.click(within(item).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(memory.read().active?.items[0].progress).toBe(40))
    expect(within(item).getByText('2 hr remaining')).toBeInTheDocument()
  })
})
