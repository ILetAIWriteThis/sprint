export type Category = 'book' | 'youtube' | 'tv'

export interface SprintItem {
  id: string
  category: Category
  title: string
  totalMinutes: number
  progress: number
  pages?: number
}

export interface ActiveSprint {
  id: string
  createdAt: string
  dueDate: string
  status: 'active'
  items: SprintItem[]
}

export interface ArchivedSprint {
  id: string
  createdAt: string
  dueDate: string
  status: 'archived'
  completedAt: string
  items: SprintItem[]
}

export interface SprintData {
  active: ActiveSprint | null
  archived: ArchivedSprint[]
}

export interface SprintRepository {
  load: () => Promise<SprintData>
  save: (data: SprintData) => Promise<void>
}

