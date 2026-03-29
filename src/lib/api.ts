import type {
  CourseResponse,
  CoursesResponse,
  DownloadResponse,
  FilesResponse,
  PaperResponse,
  PapersResponse,
} from '../types/api'

const PRODUCTION_API_BASE_URL = 'https://srm-pyq-api.onrender.com'
const API_BASE_URL = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_BASE_URL ?? PRODUCTION_API_BASE_URL)
const REQUEST_TIMEOUT_MS = 15000
const MAX_RETRY_ATTEMPTS = 2

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>) {
  const base = API_BASE_URL.replace(/\/$/, '')
  const url = new URL(`${base}${path}`, window.location.origin)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
  }

  return url.toString()
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function requestJson<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = buildUrl(path, params)

  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(url, { signal: controller.signal })
      window.clearTimeout(timeoutId)

      if (!response.ok) {
        let message = `Request failed with status ${response.status}`
        try {
          const body = (await response.json()) as { detail?: string; message?: string }
          if (body.detail) {
            message = body.detail
          } else if (body.message) {
            message = body.message
          }
        } catch {
          // Ignore JSON parse failure for error body.
        }

        const shouldRetry = (response.status >= 500 || response.status === 429) && attempt < MAX_RETRY_ATTEMPTS
        if (shouldRetry) {
          await delay(250 * (attempt + 1))
          continue
        }

        throw new ApiError(message, response.status)
      }

      return (await response.json()) as T
    } catch (error) {
      window.clearTimeout(timeoutId)

      const timedOut = error instanceof DOMException && error.name === 'AbortError'
      const canRetry = attempt < MAX_RETRY_ATTEMPTS

      if (canRetry) {
        await delay(250 * (attempt + 1))
        continue
      }

      if (timedOut) {
        throw new ApiError('Request timed out. Please try again.', 408)
      }

      if (error instanceof ApiError) {
        throw error
      }

      throw new ApiError('Network request failed. Please try again.', 0)
    }
  }

  throw new ApiError('Unexpected API request failure.', 0)
}

export function getHealth() {
  return requestJson<{ ok: boolean }>('/health')
}

export function listCourses(options?: { q?: string; cursor?: string | null; limit?: number }) {
  return requestJson<CoursesResponse>('/v1/courses', {
    q: options?.q,
    cursor: options?.cursor ?? undefined,
    limit: options?.limit,
  })
}

export function getCourse(courseCode: string) {
  return requestJson<CourseResponse>(`/v1/courses/${encodeURIComponent(courseCode)}`)
}

export function listCoursePapers(
  courseCode: string,
  options?: { year?: number; term?: string; cursor?: string | null; limit?: number },
) {
  return requestJson<PapersResponse>(`/v1/courses/${encodeURIComponent(courseCode)}/papers`, {
    year: options?.year,
    term: options?.term,
    cursor: options?.cursor ?? undefined,
    limit: options?.limit,
  })
}

export function getPaper(paperId: string) {
  return requestJson<PaperResponse>(`/v1/papers/${paperId}`)
}

export function listPaperFiles(paperId: string) {
  return requestJson<FilesResponse>(`/v1/papers/${paperId}/files`)
}

export function getFileDownloadUrl(fileId: string, ttlSeconds = 900) {
  return requestJson<DownloadResponse>(`/v1/files/${fileId}/download`, {
    ttl_seconds: ttlSeconds,
  })
}
