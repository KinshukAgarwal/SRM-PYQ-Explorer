import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError, getHealth, listCourses } from '../lib/api'
import type { Course, PageMeta } from '../types/api'
import { SearchBar } from '../components/SearchBar'
import { Button } from '../components/Button'
import { LinkButton } from '../components/LinkButton'
import { cn } from '../lib/utils'

const PAGE_LIMIT = 20
const QUICK_SUGGESTIONS = [
  'Data Structures',
  'Microprocessors',
  'Operating Systems',
  'Calculus',
  'Software Engineering',
]

function getFriendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'No data found.'
    if (error.status === 422) return 'Invalid request. Please refine your input.'
    if (error.status >= 500) return 'Server issue. Please retry in a moment.'
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

export default function CoursesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlQuery = searchParams.get('q')?.trim() ?? ''

  const [courses, setCourses] = useState<Course[]>([])
  const [page, setPage] = useState<PageMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getHealth().catch(() => console.error("API health check failed"))
  }, [])

  useEffect(() => {
    let active = true

    async function fetchCourses() {
      setLoading(true)
      setError(null)

      try {
        const response = await listCourses({ q: urlQuery || undefined, limit: PAGE_LIMIT })
        if (!active) return
        setCourses(response.data)
        setPage(response.page)
      } catch (requestError) {
        if (!active) return
        setError(getFriendlyError(requestError))
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchCourses()

    return () => {
      active = false
    }
  }, [urlQuery])

  async function onLoadMore() {
    if (!page?.has_more || !page.next_cursor || loadingMore) return

    setLoadingMore(true)
    setError(null)

    try {
      const response = await listCourses({
        q: urlQuery || undefined,
        cursor: page.next_cursor,
        limit: PAGE_LIMIT,
      })
      setCourses((previous) => [...previous, ...response.data])
      setPage(response.page)
    } catch (requestError) {
      setError(getFriendlyError(requestError))
    } finally {
      setLoadingMore(false)
    }
  }

  function onPickQuickSuggestion(value: string) {
    setSearchParams({ q: value })
  }

  return (
    <section className="space-y-12 pb-12 w-full px-6 sm:px-8 lg:px-10 mt-8 max-w-screen-2xl mx-auto">
      <div className="w-full bg-gradient-to-b from-white via-slate-50 to-slate-100 rounded-3xl p-8 sm:p-16 lg:p-20 mb-8 border border-slate-200/60 shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-6">
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Find your study materials easily.
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mt-4 leading-relaxed font-medium">
            Access a curated collection of previous year question papers across all departments. Minimal, focused, and designed for your academic success.
          </p>

          <SearchBar 
            className="h-14 w-full rounded-xl bg-white shadow-sm border border-slate-200/80 px-5 focus-within:ring-4 focus-within:ring-blue-600/10 focus-within:bg-white focus-within:border-blue-500 mt-8" 
            inputClassName="text-base font-medium text-slate-800 placeholder:text-slate-400"
            placeholder="Search by course code, title or semester..."
            showShortcut={true}
          />

          <div className="flex flex-wrap items-center gap-3 pt-4">
            <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
              SUGGESTIONS:
            </span>
            {QUICK_SUGGESTIONS.slice(0, 3).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onPickQuickSuggestion(suggestion)}
                className="bg-white rounded-full text-xs font-medium text-slate-600 px-3.5 py-1.5 shadow-sm border border-slate-200 hover:border-slate-300 hover:text-slate-900 transition-all duration-200"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      {urlQuery ? (
        <p className="px-2 text-sm text-slate-700">
          Showing results for: <span className="font-medium text-slate-900">{urlQuery}</span>
        </p>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-600">Loading courses...</div>
      ) : null}

      {!loading && courses.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
          No courses found for this search.
        </div>
      ) : null}

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {courses.map((course, idx) => {
          const colors = ['bg-blue-600', 'bg-slate-800', 'bg-indigo-600', 'bg-sky-600', 'bg-cyan-600']
          const barColor = colors[idx % colors.length]
          return (
            <li key={course.id} className="bg-white rounded-xl shadow-sm border border-slate-200/80 flex min-h-[220px] flex-col p-6 transition-all duration-300 hover:shadow-md hover:border-slate-300 hover:-translate-y-1">
              <div className="flex flex-1 flex-col">
                <div className={cn("h-1.5 w-10 rounded-full", barColor)} />
                <h2 className="mt-5 text-lg font-bold text-slate-900 line-clamp-2 leading-snug">
                  {course.course_name}
                </h2>
                <p className="mt-1.5 text-sm font-medium text-slate-500">
                  {course.course_code} <span className="text-slate-300 mx-0.5">&bull;</span> Papers available
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-100">
                  FALL 2023
                </span>
                <LinkButton
                  variant="primary"
                  to={`/courses/${encodeURIComponent(course.course_code)}`}
                  className="px-4 py-2 text-xs shadow-sm"
                >
                  View Papers &rarr;
                </LinkButton>
              </div>
            </li>
          )
        })}
        {!urlQuery && !loading ? (
          <li className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center hover:bg-slate-50 hover:border-slate-300 transition-colors duration-200">
            <p className="font-semibold text-slate-800">Browse All Courses</p>
            <p className="mt-1 text-xs font-medium text-slate-500">24 additional departments available</p>
          </li>
        ) : null}
      </ul>

      {page?.has_more ? (
        <div className="pt-4 flex justify-center">
          <Button
            variant="secondary"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load More Courses'}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
