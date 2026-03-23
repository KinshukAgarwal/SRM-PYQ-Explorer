import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, getFileDownloadUrl, getPaper, listPaperFiles } from '../lib/api'
import type { FileRecord, PaperDetails } from '../types/api'
import { Button } from '../components/Button'

const R2_PUBLIC_BASE_URL = (import.meta.env.VITE_R2_PUBLIC_BASE_URL ?? '').replace(/\/$/, '')

function getFriendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Paper or file not found.'
    if (error.status === 422) return 'Invalid request sent to API.'
    if (error.status >= 500) return 'Server issue. Please retry in a moment.'
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

function formatBytes(bytes: number | null) {
  if (!bytes || bytes < 1) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function pickDefaultFile(files: FileRecord[]) {
  return files.find((file) => file.is_primary) ?? files[0] ?? null
}

function encodeObjectKey(objectKey: string) {
  return objectKey
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
}

function getPermanentFileUrl(file: FileRecord) {
  if (file.public_url) return file.public_url
  if (!R2_PUBLIC_BASE_URL) return null
  return `${R2_PUBLIC_BASE_URL}/${encodeObjectKey(file.object_key)}`
}

function toViewerEmbedUrl(sourceUrl: string) {
  return `${sourceUrl}#toolbar=1&navpanes=0&view=FitH`
}

export default function PaperFilesPage() {
  const params = useParams<{ paperId: string }>()
  const paperId = params.paperId ?? ''

  const [paper, setPaper] = useState<PaperDetails | null>(null)
  const [files, setFiles] = useState<FileRecord[]>([])
  const [viewerSourceUrl, setViewerSourceUrl] = useState<string | null>(null)
  const [viewerLoadedInMemory, setViewerLoadedInMemory] = useState(false)
  const [viewerUsingPermanentUrl, setViewerUsingPermanentUrl] = useState(false)
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingViewer, setLoadingViewer] = useState(false)
  const [downloadingPaper, setDownloadingPaper] = useState(false)
  const objectUrlRef = useRef<string | null>(null)

  function clearObjectUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }

  useEffect(() => {
    if (!paperId) return

    let active = true

    async function fetchPaperAndFiles() {
      setLoading(true)
      setError(null)

      async function loadInitialFile(file: FileRecord) {
        setLoadingViewer(true)
        setError(null)

        const permanentUrl = getPermanentFileUrl(file)
        if (permanentUrl) {
          clearObjectUrl()
          if (!active) return
          setViewerSourceUrl(permanentUrl)
          setViewerLoadedInMemory(false)
          setViewerUsingPermanentUrl(true)
          setActiveFileId(file.id)
          setLoadingViewer(false)
          return
        }

        try {
          const response = await getFileDownloadUrl(file.id, 900)

          let nextViewerUrl = response.data.download_url
          let loadedInMemory = false

          try {
            const pdfResponse = await fetch(response.data.download_url)
            if (!pdfResponse.ok) {
              throw new Error('Unable to fetch PDF bytes')
            }
            const pdfBlob = await pdfResponse.blob()
            nextViewerUrl = URL.createObjectURL(pdfBlob)
            loadedInMemory = true
          } catch {
            loadedInMemory = false
          }

          if (!active) {
            if (loadedInMemory) {
              URL.revokeObjectURL(nextViewerUrl)
            }
            return
          }

          clearObjectUrl()
          if (loadedInMemory) {
            objectUrlRef.current = nextViewerUrl
          }

          setViewerSourceUrl(nextViewerUrl)
          setViewerLoadedInMemory(loadedInMemory)
          setViewerUsingPermanentUrl(false)
          setActiveFileId(file.id)
        } catch (requestError) {
          if (!active) return
          setError(getFriendlyError(requestError))
        } finally {
          if (active) setLoadingViewer(false)
        }
      }

      try {
        const [paperResponse, filesResponse] = await Promise.all([getPaper(paperId), listPaperFiles(paperId)])

        if (!active) return
        const sortedFiles = [...filesResponse.data].sort((first, second) => Number(second.is_primary) - Number(first.is_primary))

        setPaper(paperResponse.data)
        setFiles(sortedFiles)

        const initialFile = pickDefaultFile(sortedFiles)
        if (initialFile) {
          await loadInitialFile(initialFile)
        } else {
          clearObjectUrl()
          setViewerSourceUrl(null)
          setViewerLoadedInMemory(false)
          setViewerUsingPermanentUrl(false)
          setActiveFileId(null)
        }
      } catch (requestError) {
        if (!active) return
        setError(getFriendlyError(requestError))
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchPaperAndFiles()

    return () => {
      active = false
      clearObjectUrl()
    }
  }, [paperId])

  async function onDownloadPaper() {
    if (!activeFileId || downloadingPaper) return

    setDownloadingPaper(true)
    setError(null)

    try {
      const activeFile = files.find((file) => file.id === activeFileId)
      if (activeFile) {
        const permanentUrl = getPermanentFileUrl(activeFile)
        if (permanentUrl) {
          window.open(permanentUrl, '_blank', 'noopener,noreferrer')
          return
        }
      }

      const response = await getFileDownloadUrl(activeFileId, 900)
      window.open(response.data.download_url, '_blank', 'noopener,noreferrer')
    } catch (requestError) {
      setError(getFriendlyError(requestError))
    } finally {
      setDownloadingPaper(false)
    }
  }

  return (
    <section className="space-y-6 flex flex-col h-full w-full px-6 sm:px-8 lg:px-10 py-8 md:py-10 max-w-screen-2xl mx-auto">
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 sm:p-7 shrink-0 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Paper Viewer</h1>
          <Link
            to={paper ? `/courses/${encodeURIComponent(paper.course.course_code)}` : '/'}
            className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5"
          >
            &larr; Back to Course
          </Link>
        </div>
        <p className="mt-3 text-sm font-medium text-slate-600 leading-relaxed">{paper?.title ?? paperId}</p>
        {paper?.course ? (
          <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50/50 inline-block px-2.5 py-1 rounded-md border border-slate-100">
            {paper.course.course_code} <span className="mx-1 text-slate-300">•</span> {paper.course.course_name}
          </p>
        ) : null}
      </div>

      {paper?.metadata_json && Object.keys(paper.metadata_json).length > 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 sm:p-6 shrink-0 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Metadata</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(paper.metadata_json).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3.5 hover:bg-slate-50 transition-colors">
                <dt className="text-[10px] uppercase font-bold tracking-widest text-slate-400">{key}</dt>
                <dd className="mt-1.5 text-sm font-semibold text-slate-700">{value || 'NA'}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 shrink-0 shadow-sm">{error}</div>
      ) : null}

      {loading ? (
        <div className="bg-white border border-slate-200/80 rounded-xl p-8 text-center text-sm font-medium text-slate-500 shrink-0 shadow-sm">Loading paper viewer...</div>
      ) : null}

      {!loading && files.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-xl p-8 text-center text-sm font-medium text-slate-500 shrink-0 shadow-sm">
          No files available for this paper.
        </div>
      ) : null}

      {!loading && files.length > 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-xl space-y-4 p-4 sm:p-5 flex-1 flex flex-col shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-slate-200/80 bg-slate-50/80 p-3.5 shrink-0">
            <p className="text-xs font-semibold text-slate-500">
              {loadingViewer
                ? 'Loading PDF...'
                : viewerUsingPermanentUrl
                  ? 'Using permanent public URL'
                : viewerLoadedInMemory
                  ? 'PDF loaded in browser memory for this session'
                  : `Streaming PDF from source`}
              {!loadingViewer && <span className="mx-2 text-slate-300">•</span>}
              {!loadingViewer && <span className="text-slate-400 font-medium">{formatBytes(files[0]?.size_bytes ?? null)}</span>}
            </p>
            <Button
              type="button"
              onClick={onDownloadPaper}
              disabled={!activeFileId || downloadingPaper}
              variant="primary"
              className="w-full sm:w-auto"
            >
              {downloadingPaper ? 'Opening...' : 'Open in New Tab'}
            </Button>
          </div>

          {loadingViewer ? (
            <div className="rounded-lg border border-slate-200/80 bg-slate-50/30 p-12 text-center text-sm font-medium text-slate-500 flex-1 flex items-center justify-center">Loading PDF...</div>
          ) : null}

          {!loadingViewer && viewerSourceUrl ? (
            <iframe
              title="Paper PDF Viewer"
              src={toViewerEmbedUrl(viewerSourceUrl)}
              className="w-full flex-1 min-h-[60vh] sm:min-h-[76vh] rounded-lg border border-slate-200/80 shadow-inner"
            />
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
