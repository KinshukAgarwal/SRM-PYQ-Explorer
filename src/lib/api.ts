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
  const response = await fetch(buildUrl(path, params))

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
    throw new ApiError(message, response.status)
  }

  return (await response.json()) as T
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
