import { type CSSProperties, type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  CATEGORIES,
  CATEGORY_META,
  createSprint,
  daysThroughDueDate,
  formatDuration,
  isPastDue,
  makeId,
  minutesForPages,
  minutesPerDay,
  progressForItems,
  remainingForItem,
  totalForCategory,
  updateItemProgress,
} from './model'
import { activateUpdate, usePwa } from './pwa'
import { createIndexedDbRepository } from './storage'
import type { ActiveSprint, ArchivedSprint, Category, SprintData, SprintItem, SprintRepository } from './types'

interface AppProps {
  repository?: SprintRepository
}

function Icon({ name, size = 20 }: { name: Category | 'check' | 'lock' | 'calendar' | 'arrow' | 'archive' | 'spark'; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (name === 'book') return <svg {...common}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22Z"/></svg>
  if (name === 'youtube') return <svg {...common}><path d="M21 8.2a2.8 2.8 0 0 0-2-2C17.2 5.7 12 5.7 12 5.7s-5.2 0-7 .5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2.5 12 29 29 0 0 0 3 15.8a2.8 2.8 0 0 0 2 2c1.8.5 7 .5 7 .5s5.2 0 7-.5a2.8 2.8 0 0 0 2-2 29 29 0 0 0 .5-3.8 29 29 0 0 0-.5-3.8Z"/><path d="m10 9 5 3-5 3Z"/></svg>
  if (name === 'tv') return <svg {...common}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="m8 2 4 4 4-4"/><path d="M7 22h10"/></svg>
  if (name === 'check') return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>
  if (name === 'lock') return <svg {...common}><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
  if (name === 'calendar') return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
  if (name === 'archive') return <svg {...common}><path d="M4 7v13h16V7M2 3h20v4H2zM9 11h6"/></svg>
  if (name === 'spark') return <svg {...common}><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z"/></svg>
  return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
}

function localDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function displayDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function displayTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function sprintName(items: SprintItem[]) {
  const books = items.filter((item) => item.category === 'book')
  if (!books.length) return 'Book sprint'
  return books.length === 1 ? books[0].title : `${books[0].title} + ${books.length - 1} more`
}

function Header({ install }: { install?: () => void }) {
  return (
    <header className="app-header">
      <a className="brand" href="#top" aria-label="Book Sprint home">
        <span className="brand-mark"><Icon name="book" size={21} /></span>
        <span>Book Sprint</span>
      </a>
      <div className="header-actions">
        <span className="privacy-pill"><Icon name="lock" size={14} /> On-device only</span>
        {install && <button className="quiet-button" type="button" onClick={install}>Install app</button>}
      </div>
    </header>
  )
}

function ItemList({ items, onRemove }: { items: SprintItem[]; onRemove: (id: string) => void }) {
  return (
    <ul className="draft-list">
      {items.map((item) => (
        <li key={item.id}>
          <span className={`item-icon item-icon--${item.category}`}><Icon name={item.category} /></span>
          <span className="draft-list__copy"><strong>{item.title}</strong><small>{item.pages ? `${item.pages} pages · ` : ''}{formatDuration(item.totalMinutes)}</small></span>
          <button type="button" className="text-button text-button--danger" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.title}`}>Remove</button>
        </li>
      ))}
    </ul>
  )
}

function BookForm({ onAdd }: { onAdd: (item: SprintItem) => void }) {
  const [title, setTitle] = useState('')
  const [pages, setPages] = useState('')
  const numericPages = Number(pages)
  const duration = Number.isFinite(numericPages) ? minutesForPages(numericPages) : 0

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || numericPages <= 0) return
    onAdd({ id: makeId(), category: 'book', title: title.trim(), pages: Math.round(numericPages), totalMinutes: minutesForPages(Math.round(numericPages)), progress: 0 })
    setTitle('')
    setPages('')
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <label className="field field--wide"><span>Book title</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What do you want to read?" /></label>
      <label className="field"><span>Pages</span><input required type="number" min="1" step="1" inputMode="numeric" value={pages} onChange={(event) => setPages(event.target.value)} placeholder="320" /></label>
      <div className="duration-preview"><span>Reading time</span><strong>{duration ? formatDuration(duration) : '—'}</strong><small>2 min per page</small></div>
      <button className="add-button" type="submit">Add book</button>
    </form>
  )
}

function MediaForm({ onAdd }: { onAdd: (item: SprintItem) => void }) {
  const [category, setCategory] = useState<Category>('youtube')
  const [title, setTitle] = useState('')
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const duration = Math.max(0, Number(hours) || 0) * 60 + Math.max(0, Number(minutes) || 0)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || duration <= 0) return
    onAdd({ id: makeId(), category, title: title.trim(), totalMinutes: duration, progress: 0 })
    setTitle('')
    setHours('')
    setMinutes('')
  }

  return (
    <form className="media-form" onSubmit={submit}>
      <fieldset className="category-choice">
        <legend>Category</legend>
        {(['youtube', 'tv'] as Category[]).map((option) => (
          <label key={option} className={category === option ? 'selected' : ''}>
            <input type="radio" name="category" value={option} checked={category === option} onChange={() => setCategory(option)} />
            <Icon name={option} /> {CATEGORY_META[option].label}
          </label>
        ))}
      </fieldset>
      <label className="field field--wide"><span>Title</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder={category === 'youtube' ? 'Video or playlist' : 'Series, season, or film'} /></label>
      <div className="duration-fields">
        <label className="field"><span>Hours</span><input type="number" min="0" step="1" inputMode="numeric" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="1" /></label>
        <label className="field"><span>Minutes</span><input type="number" min="0" max="59" step="1" inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder="30" /></label>
      </div>
      <button className="add-button" type="submit">Add to sprint</button>
    </form>
  )
}

function BalanceMeter({ category, total, target }: { category: Category; total: number; target: number }) {
  const percentage = target ? Math.min(100, Math.round(total / target * 100)) : 0
  const atTarget = total === target
  const overTarget = total > target
  return (
    <div className={`balance-meter balance-meter--${category} ${atTarget ? 'is-met' : ''}`}>
      <div className="balance-meter__top"><span><Icon name={category} size={18} /> {CATEGORY_META[category].label}</span><strong>{formatDuration(total)}</strong></div>
      <div className="meter-track"><span style={{ width: `${percentage}%` }} /></div>
      <small>{atTarget
        ? <><Icon name="check" size={14} /> At the balance point</>
        : overTarget ? `${formatDuration(total - target)} over half` : `${formatDuration(target - total)} below half`}</small>
    </div>
  )
}

function Planner({ onStart, saving }: { onStart: (sprint: ActiveSprint) => Promise<void>; saving: boolean }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [dueDate, setDueDate] = useState('')
  const [items, setItems] = useState<SprintItem[]>([])
  const [error, setError] = useState('')
  const books = items.filter((item) => item.category === 'book')
  const media = items.filter((item) => item.category !== 'book')
  const bookTotal = totalForCategory(items, 'book')
  const planningDays = dueDate ? daysThroughDueDate(dueDate) : 0
  const initialBookPace = planningDays ? bookTotal / planningDays : 0
  const target = bookTotal / 2
  const youtubeTotal = totalForCategory(items, 'youtube')
  const tvTotal = totalForCategory(items, 'tv')
  const mediaTotal = youtubeTotal + tvTotal
  const allowance = bookTotal - mediaTotal
  const overLimit = allowance < 0
  const ready = target > 0 && youtubeTotal > 0 && tvTotal > 0 && !overLimit

  const remove = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
    setError('')
  }
  const addMedia = (item: SprintItem) => {
    if (item.totalMinutes > Math.max(0, allowance)) {
      setError(`That would put watching above reading. Only ${formatDuration(Math.max(0, allowance))} of media time remains.`)
      return
    }
    setError('')
    setItems((current) => [...current, item])
  }
  const continuePlanning = () => {
    if (!dueDate) return setError('Choose a due date for this sprint.')
    if (dueDate < localDateInputValue()) return setError('The due date cannot be in the past.')
    if (!books.length) return setError('Add at least one book to continue.')
    setError('')
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const start = async () => {
    if (!ready || saving) return
    await onStart(createSprint(dueDate, items))
  }

  return (
    <main id="main-content" className="planner" tabIndex={-1}>
      <section className="planner-hero">
        <p className="eyebrow">Plan less. Finish more.</p>
        <h1>A balanced sprint for your <em>reading life.</em></h1>
        <p>Pick the book. Balance it with things worth watching. We’ll turn what remains into a simple daily target.</p>
        <div className="privacy-note"><Icon name="lock" /><span><strong>Private by design.</strong> Titles and progress live in IndexedDB on this device—not in an account or cloud.</span></div>
      </section>

      <section className="planner-card" aria-labelledby="planner-title">
        <div className="stepper" aria-label={`Step ${step} of 2`}>
          <span className="is-active"><b>1</b> Book</span><i /><span className={step === 2 ? 'is-active' : ''}><b>2</b> Balance</span>
        </div>
        {step === 1 ? (
          <>
            <div className="section-heading">
              <div><p className="eyebrow">Step one</p><h2 id="planner-title">Set the finish line</h2></div>
              <label className="due-field"><span><Icon name="calendar" size={17} /> Due date</span><input aria-label="Due date" type="date" min={localDateInputValue()} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            </div>
            <p className="section-intro">Add the book—or books—you want to finish. Reading time is estimated at two minutes per page.</p>
            <BookForm onAdd={(item) => setItems((current) => [...current, item])} />
            {books.length > 0 && <ItemList items={books} onRemove={remove} />}
            <div className="pace-preview" aria-live="polite">
              <span className="pace-preview__icon"><Icon name="calendar" size={19} /></span>
              <span className="pace-preview__copy">
                <small>Initial reading pace</small>
                <strong>{dueDate && bookTotal ? formatDuration(initialBookPace) : '—'}</strong>
              </span>
              <span className="pace-preview__detail">{!dueDate ? 'Choose a due date' : !bookTotal ? 'Add a book' : `per day · ${planningDays} ${planningDays === 1 ? 'day' : 'days'}`}</span>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="planner-actions planner-actions--end">
              <span>{books.length ? `${books.length} ${books.length === 1 ? 'book' : 'books'} · ${formatDuration(bookTotal)}` : 'No books added yet'}</span>
              <button className="primary-button" type="button" onClick={continuePlanning}>Balance the sprint <Icon name="arrow" /></button>
            </div>
          </>
        ) : (
          <>
            <div className="section-heading">
              <div><p className="eyebrow">Step two</p><h2 id="planner-title">Make it 50 / 50</h2></div>
              <button className="text-button" type="button" onClick={() => setStep(1)}>Back to books</button>
            </div>
            <p className="section-intro">Your books total <strong>{formatDuration(bookTotal)}</strong>. YouTube and TV share that allowance, so watching can never exceed reading. Half each is a guide, not a requirement.</p>
            <div className="balance-grid">
              <BalanceMeter category="youtube" total={youtubeTotal} target={target} />
              <BalanceMeter category="tv" total={tvTotal} target={target} />
            </div>
            <MediaForm onAdd={addMedia} />
            {error && <p className="form-error" role="alert">{error}</p>}
            {media.length > 0 && <ItemList items={media} onRemove={remove} />}
            <div className="planner-actions">
              <span>{overLimit
                ? `Remove ${formatDuration(Math.abs(allowance))} of media to keep reading first.`
                : ready
                  ? `${formatDuration(allowance)} of optional media space remains. You can begin now.`
                  : 'Add at least one YouTube and one TV item. Their combined time must stay below reading.'}</span>
              <button className="primary-button" type="button" disabled={!ready || saving} onClick={start}>{saving ? 'Saving…' : 'Start sprint'} <Icon name="arrow" /></button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

function DailyCard({ category, sprint, today }: { category: Category; sprint: ActiveSprint; today: Date }) {
  const categoryItems = sprint.items.filter((item) => item.category === category)
  const progress = progressForItems(categoryItems)
  const perDay = minutesPerDay(sprint.items, category, sprint.dueDate, today)
  return (
    <article className={`daily-card daily-card--${category}`}>
      <div className="daily-card__head"><span className="item-icon"><Icon name={category} /></span><span>{CATEGORY_META[category].label}</span><strong>{progress}%</strong></div>
      <div className="daily-card__target"><strong>{formatDuration(perDay)}</strong><span>per day</span></div>
      <div className="meter-track"><span style={{ width: `${progress}%` }} /></div>
      <small>{categoryItems.length} {categoryItems.length === 1 ? 'item' : 'items'} in this sprint</small>
    </article>
  )
}

function ProgressControl({ item, onSave, saving }: { item: SprintItem; onSave: (progress: number) => Promise<void>; saving: boolean }) {
  const [value, setValue] = useState(String(item.progress))
  useEffect(() => setValue(String(item.progress)), [item.progress])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const progress = Number(value)
    if (Number.isFinite(progress)) await onSave(progress)
  }

  return (
    <form className="progress-control" onSubmit={submit}>
      <label><span className="sr-only">Progress for {item.title}</span><input aria-label={`Progress for ${item.title}`} type="number" min="0" max="100" step="1" inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value)} /><b>%</b></label>
      <button className="save-progress" type="submit" disabled={saving || Number(value) === item.progress}>Save</button>
      <button className="complete-button" type="button" disabled={saving || item.progress === 100} onClick={() => onSave(100)}><Icon name="check" size={16} /> Complete</button>
    </form>
  )
}

function ActiveDashboard({ sprint, today, onProgress, saving }: { sprint: ActiveSprint; today: Date; onProgress: (itemId: string, progress: number) => Promise<void>; saving: boolean }) {
  const days = daysThroughDueDate(sprint.dueDate, today)
  const overall = progressForItems(sprint.items)
  const overdue = isPastDue(sprint.dueDate, today)
  const circleStyle = { '--progress': `${overall * 3.6}deg` } as CSSProperties

  return (
    <main id="main-content" className="dashboard" tabIndex={-1}>
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Your active sprint</p>
          <h1>{sprintName(sprint.items)}</h1>
          <p className="due-copy"><Icon name="calendar" size={17} /> {overdue ? 'Due date passed' : `${days} ${days === 1 ? 'day' : 'days'} including today`} · Due {displayDate(sprint.dueDate)}</p>
        </div>
        <div className="overall-progress" style={circleStyle}><span><strong>{overall}%</strong><small>complete</small></span></div>
      </section>

      <section className="today-section" aria-labelledby="today-heading">
        <div className="today-heading"><div><p className="eyebrow">Based on what remains</p><h2 id="today-heading">Today’s pace</h2></div><p>Do this much each day to finish by your due date.</p></div>
        <div className="daily-grid">{CATEGORIES.map((category) => <DailyCard key={category} category={category} sprint={sprint} today={today} />)}</div>
      </section>

      <section className="progress-section" aria-labelledby="progress-heading">
        <div className="today-heading"><div><p className="eyebrow">Quick update</p><h2 id="progress-heading">Log your progress</h2></div><p>Enter the current total percentage—not what you did today.</p></div>
        {CATEGORIES.map((category) => {
          const categoryItems = sprint.items.filter((item) => item.category === category)
          return (
            <div className="category-group" key={category}>
              <h3><span className={`item-icon item-icon--${category}`}><Icon name={category} /></span>{CATEGORY_META[category].label}</h3>
              <div className="active-items">
                {categoryItems.map((item) => (
                  <article className="active-item" key={item.id}>
                    <div className="active-item__copy"><strong>{item.title}</strong><span>{item.pages ? `${item.pages} pages · ` : ''}{formatDuration(item.totalMinutes)} total</span><small>{formatDuration(remainingForItem(item))} remaining</small></div>
                    <ProgressControl item={item} saving={saving} onSave={(progress) => onProgress(item.id, progress)} />
                  </article>
                ))}
              </div>
            </div>
          )
        })}
        <p className="finish-note"><Icon name="archive" size={17} /> The sprint archives automatically when every item is complete.</p>
      </section>
    </main>
  )
}

function ArchiveList({ sprints }: { sprints: ArchivedSprint[] }) {
  if (!sprints.length) return null
  return (
    <section className="archive-section" id="history" aria-labelledby="archive-heading">
      <div className="archive-heading"><div><p className="eyebrow">Kept on this device</p><h2 id="archive-heading">Recent sprints</h2></div><span>Newest 5</span></div>
      <div className="archive-list">
        {sprints.map((sprint) => (
          <details key={sprint.id}>
            <summary><span className="archive-check"><Icon name="check" /></span><span><strong>{sprintName(sprint.items)}</strong><small>Finished {displayTimestamp(sprint.completedAt)}</small></span><span>{sprint.items.length} items</span></summary>
            <div className="archive-detail">
              {CATEGORIES.map((category) => <p key={category}><Icon name={category} size={17} /><span>{CATEGORY_META[category].label}</span><strong>{formatDuration(totalForCategory(sprint.items, category))}</strong></p>)}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}

export function App({ repository: providedRepository }: AppProps) {
  const repository = useMemo(() => providedRepository ?? createIndexedDbRepository(), [providedRepository])
  const [data, setData] = useState<SprintData | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const pwa = usePwa()

  useEffect(() => {
    let cancelled = false
    repository.load().then((value) => { if (!cancelled) setData(value) }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not open your local data.')
    })
    return () => { cancelled = true }
  }, [repository])

  const persist = async (next: SprintData) => {
    setSaving(true)
    setError('')
    try {
      await repository.save(next)
      setData(next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your changes.')
      throw reason
    } finally {
      setSaving(false)
    }
  }

  const startSprint = async (sprint: ActiveSprint) => {
    if (!data) return
    await persist({ ...data, active: sprint })
    setMessage('Sprint started. Your daily pace is ready.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveProgress = async (itemId: string, progress: number) => {
    if (!data) return
    const next = updateItemProgress(data, itemId, progress)
    const completed = Boolean(data.active && !next.active)
    await persist(next)
    setMessage(completed ? 'Sprint complete — nicely done. It is now in your recent sprints.' : 'Progress saved. Today’s pace has been recalculated.')
    if (completed) window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const install = pwa.install ? async () => { await pwa.install?.prompt() } : undefined

  return (
    <div className="app-shell" id="top">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header install={install} />
      {message && <div className="toast" role="status"><Icon name="spark" /><span>{message}</span><button type="button" onClick={() => setMessage('')} aria-label="Dismiss message">×</button></div>}
      {error && <div className="error-banner" role="alert">{error}</div>}
      {!data && !error && <main id="main-content" className="loading"><span className="loader" /><p>Opening your sprint…</p></main>}
      {!data && error && <main id="main-content" className="loading"><Icon name="lock" size={34} /><h1>Local storage couldn’t open</h1><p>Your browser may be blocking IndexedDB. Allow site storage and reload to use Book Sprint.</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button></main>}
      {data && (data.active
        ? <ActiveDashboard sprint={data.active} today={new Date()} onProgress={saveProgress} saving={saving} />
        : <Planner onStart={startSprint} saving={saving} />)}
      {data && <ArchiveList sprints={data.archived} />}
      <footer><span>Book Sprint</span><span><Icon name="lock" size={13} /> No login. No tracking. Local data only.</span></footer>
      {!pwa.online && <div className="offline-notice" role="status">Offline — your sprint still works.</div>}
      {pwa.update && <div className="update-notice" role="status"><span>A new version is ready.</span><button type="button" onClick={() => activateUpdate(pwa.update!)}>Update now</button></div>}
    </div>
  )
}
