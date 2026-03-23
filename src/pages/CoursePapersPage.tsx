import { FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, listCoursePapers } from '../lib/api'
import type { CourseSummary, PageMeta, Paper } from '../types/api'
import { Button } from '../components/Button'
import { LinkButton } from '../components/LinkButton'
import { Input } from '../components/Input'

const PAGE_LIMIT = 20

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizeSession(value: string | null) {
  if (!value) return ''

  return value
    .toLowerCase()
    .replace(/november/g, 'nov')
    .replace(/december/g, 'dec')
    .replace(/january/g, 'jan')
    .replace(/february/g, 'feb')
    .replace(/march/g, 'mar')
    .replace(/april/g, 'apr')
    .replace(/june/g, 'jun')
    .replace(/july/g, 'jul')
    .replace(/august/g, 'aug')
    .replace(/september/g, 'sep')
    .replace(/october/g, 'oct')
    .replace(/[^a-z0-9]/g, '')
}

function getPaperKey(paper: Paper) {
  const titleKey = normalizeTitle(paper.title)
  const yearKey = String(paper.exam_year ?? 'na')
  const termKey = normalizeSession(paper.session_label ?? paper.exam_term)
  return `${titleKey}|${yearKey}|${termKey}`
}

function dedupePapers(items: Paper[]) {
  const uniquePapers = new Map<string, Paper>()

  items.forEach((paper) => {
    const key = getPaperKey(paper)
    if (!uniquePapers.has(key)) {
      uniquePapers.set(key, paper)
      return
    }

    const existing = uniquePapers.get(key)
    if (!existing) return

    if (existing.created_at < paper.created_at) {
      uniquePapers.set(key, paper)
    }
  })

  return Array.from(uniquePapers.values())
}

function getFriendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Course not found.'
    if (error.status === 422) return 'Invalid filter values.'
    if (error.status >= 500) return 'Server issue. Please retry in a moment.'
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

export default function CoursePapersPage() {
  const params = useParams<{ courseCode: string }>()
  const courseCode = decodeURIComponent(params.courseCode ?? '')

  const [yearInput, setYearInput] = useState('')
  const [termInput, setTermInput] = useState('')
  const [year, setYear] = useState<number | undefined>(undefined)
  const [term, setTerm] = useState<string | undefined>(undefined)

  const [papers, setPapers] = useState<Paper[]>([])
  const [course, setCourse] = useState<CourseSummary | null>(null)
  const [page, setPage] = useState<PageMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseCode) return

    let active = true

    async function fetchPapers() {
      setLoading(true)
      setError(null)

      try {
        const response = await listCoursePapers(courseCode, {
          year,
          term,
          limit: PAGE_LIMIT,
        })

        if (!active) return
        setPapers(dedupePapers(response.data))
        setCourse(response.course)
        setPage(response.page)
      } catch (requestError) {
        if (!active) return
        setError(getFriendlyError(requestError))
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchPapers()

    return () => {
      active = false
    }
  }, [courseCode, year, term])

  async function onLoadMore() {
    if (!page?.has_more || !page.next_cursor || loadingMore) return

    setLoadingMore(true)
    setError(null)

    try {
      const response = await listCoursePapers(courseCode, {
        year,
        term,
        cursor: page.next_cursor,
        limit: PAGE_LIMIT,
      })
      setPapers((previous) => dedupePapers([...previous, ...response.data]))
      setCourse(response.course)
      setPage(response.page)
    } catch (requestError) {
      setError(getFriendlyError(requestError))
    } finally {
      setLoadingMore(false)
    }
  }

  function onApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedYear = Number.parseInt(yearInput.trim(), 10)
    setYear(Number.isFinite(parsedYear) ? parsedYear : undefined)

    const cleanedTerm = termInput.trim()
    setTerm(cleanedTerm.length > 0 ? cleanedTerm : undefined)
  }

  return (
    <section className="space-y-6 w-full px-6 sm:px-8 lg:px-10 py-8 md:py-10 max-w-screen-2xl mx-auto">
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 sm:p-7 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Course Papers</h1>
          <Link to="/" className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5">
            &larr; Back to Courses
          </Link>
        </div>
        <p className="mt-2 text-sm font-medium text-slate-500 relative z-10">
          {course ? `${course.course_code} — ${course.course_name}` : courseCode}
        </p>
      </div>

      <form onSubmit={onApplyFilters} className="bg-white border border-slate-200/80 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            type="number"
            value={yearInput}
            onChange={(event) => setYearInput(event.target.value)}
            placeholder="Year (e.g. 2024)"
          />
          <Input
            value={termInput}
            onChange={(event) => setTermInput(event.target.value)}
            placeholder="Term (e.g. nov_dec)"
          />
          <Button
            type="submit"
            variant="primary"
            className="w-full sm:w-auto mt-auto"
          >
            Apply Filters
          </Button>
        </div>
      </form>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 shadow-sm">{error}</div>
      ) : null}

      {loading ? (
        <div className="bg-white border border-slate-200/80 rounded-xl p-8 text-center text-sm font-medium text-slate-500 shadow-sm">Loading papers...</div>
      ) : null}

      {!loading && papers.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-xl p-8 text-center text-sm font-medium text-slate-500 shadow-sm">
          No papers found for these filters.
        </div>
      ) : null}

      <ul className="space-y-4">
        {papers.map((paper) => (
          <li key={paper.id} className="bg-white border border-slate-200/80 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5 transition-all duration-300 hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5">
            <div className="space-y-2.5">
              <p className="text-base font-bold text-slate-900 leading-snug">{paper.title}</p>
              <div className="inline-flex items-center rounded-md border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500 tracking-wide">
                {paper.exam_year ?? 'NA'} <span className="mx-2 text-slate-300">•</span> {paper.session_label ?? paper.exam_term ?? 'Unknown term'}
              </div>
            </div>
            <LinkButton
              to={`/papers/${paper.id}`}
              variant="secondary"
              className="shrink-0 whitespace-nowrap"
            >
              View Paper
            </LinkButton>
          </li>
        ))}
      </ul>

      {page?.has_more ? (
        <div className="pt-4 flex justify-center">
          <Button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            variant="secondary"
          >
            {loadingMore ? 'Loading...' : 'Load More Papers'}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
