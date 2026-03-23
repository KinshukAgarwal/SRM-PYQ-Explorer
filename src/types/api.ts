export interface PageMeta {
  has_more: boolean
  next_cursor: string | null
  limit: number
}

export interface Course {
  id: string
  course_code: string
  course_name: string
  department: string | null
  program: string | null
  semester: number | null
  is_active: boolean
}

export interface CourseSummary {
  id: string
  course_code: string
  course_name: string
}

export interface Paper {
  id: string
  course_id: string
  title: string
  exam_year: number | null
  exam_month: number | null
  exam_term: string | null
  session_label: string | null
  source_subject_url: string | null
  source_item_url: string
  publisher: string | null
  created_at: string
}

export interface PaperDetails extends Paper {
  metadata_json: Record<string, string | null> | null
  course: CourseSummary
}

export interface FileRecord {
  id: string
  paper_id: string
  storage_provider: string
  bucket: string
  object_key: string
  source_pdf_url: string | null
  public_url: string | null
  mime_type: string
  size_bytes: number | null
  sha256: string | null
  is_primary: boolean
  created_at: string
}

export interface DownloadInfo {
  file_id: string
  download_url: string
  url_type: 'signed' | 'public'
  expires_in: number | null
}

export interface CoursesResponse {
  data: Course[]
  page: PageMeta
}

export interface CourseResponse {
  data: Course
}

export interface PapersResponse {
  data: Paper[]
  course: CourseSummary
  page: PageMeta
}

export interface PaperResponse {
  data: PaperDetails
}

export interface FilesResponse {
  data: FileRecord[]
}

export interface DownloadResponse {
  data: DownloadInfo
}
