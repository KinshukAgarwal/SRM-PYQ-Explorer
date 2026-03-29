import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { BackButton } from '../components/BackButton';
import { ApiError, getFileDownloadUrl, listCoursePapers, listPaperFiles } from '../lib/api';
import type { FileRecord, Paper } from '../types/api';
import { useSearchParams } from 'react-router-dom';

type PreviewPaper = Paper & {
  courseCode: string;
  courseName: string;
};

type CachedCoursePapers = {
  cachedAt: number;
  papers: PreviewPaper[];
};

type CachedPaperFiles = {
  cachedAt: number;
  files: FileRecord[];
};

const COURSE_PAPERS_CACHE_KEY = 'srm-pyq-preview-course-papers-v1';
const PAPER_FILES_CACHE_KEY = 'srm-pyq-preview-paper-files-v1';
const PREVIEW_CACHE_TTL_MS = 1000 * 60 * 20;
const R2_PUBLIC_BASE_URL = (import.meta.env.VITE_R2_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function getFriendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Paper or file not found.';
    if (error.status === 422) return 'Invalid request sent to API.';
    if (error.status >= 500) return 'Server issue. Please retry in a moment.';
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

function formatMonth(examMonth: number | null) {
  if (!examMonth || examMonth < 1 || examMonth > 12) {
    return 'Unknown';
  }
  return MONTH_NAMES[examMonth - 1];
}

function formatMonthYear(examMonth: number | null, examYear: number | null) {
  if (!examMonth && !examYear) {
    return 'Unknown session';
  }
  const month = formatMonth(examMonth);
  if (examYear) {
    return `${month} ${examYear}`;
  }
  return month;
}

function formatExamTerm(examTerm: string | null) {
  if (!examTerm) return 'PYQ';
  return examTerm.replace(/_/g, ' ').toUpperCase();
}

function formatBytes(bytes: number | null) {
  if (!bytes || bytes < 1) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pickDefaultFile(files: FileRecord[]) {
  return files.find((file) => file.is_primary) ?? files[0] ?? null;
}

function encodeObjectKey(objectKey: string) {
  return objectKey
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function getPermanentFileUrl(file: FileRecord) {
  if (file.public_url) return file.public_url;
  if (!R2_PUBLIC_BASE_URL) return null;
  return `${R2_PUBLIC_BASE_URL}/${encodeObjectKey(file.object_key)}`;
}

function readJsonStorage<T>(storageKey: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(storageKey: string, value: unknown) {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Ignore storage quota and serialization failures.
  }
}

function isCacheFresh(cachedAt: number) {
  return Date.now() - cachedAt <= PREVIEW_CACHE_TTL_MS;
}

async function fetchAllPapersForCourse(courseCode: string) {
  const allPapers: PreviewPaper[] = [];
  let cursor: string | null = null;

  while (true) {
    const response = await listCoursePapers(courseCode, { cursor, limit: 200 });
    allPapers.push(
      ...response.data.map((paper) => ({
        ...paper,
        courseCode: response.course.course_code,
        courseName: response.course.course_name,
      })),
    );

    if (!response.page.has_more || !response.page.next_cursor) {
      break;
    }

    cursor = response.page.next_cursor;
  }

  allPapers.sort((first, second) => {
    const yearDiff = (second.exam_year ?? 0) - (first.exam_year ?? 0);
    if (yearDiff !== 0) return yearDiff;
    const monthDiff = (second.exam_month ?? 0) - (first.exam_month ?? 0);
    if (monthDiff !== 0) return monthDiff;
    return second.created_at.localeCompare(first.created_at);
  });

  return allPapers;
}

async function getDownloadableUrl(file: FileRecord) {
  const permanentUrl = getPermanentFileUrl(file);
  if (permanentUrl) {
    return permanentUrl;
  }

  const response = await getFileDownloadUrl(file.id, 900);
  return response.data.download_url;
}

function toEmbedUrl(url: string) {
  return `${url}#toolbar=1&navpanes=0&view=FitH`;
}

function persistCoursePapersCache(
  cacheRef: MutableRefObject<Map<string, CachedCoursePapers>>,
  courseCode: string,
  papers: PreviewPaper[],
) {
  cacheRef.current.set(courseCode, { cachedAt: Date.now(), papers });
  writeJsonStorage(COURSE_PAPERS_CACHE_KEY, Object.fromEntries(cacheRef.current.entries()));
}

function persistPaperFilesCache(
  cacheRef: MutableRefObject<Map<string, CachedPaperFiles>>,
  paperId: string,
  files: FileRecord[],
) {
  cacheRef.current.set(paperId, { cachedAt: Date.now(), files });
  writeJsonStorage(PAPER_FILES_CACHE_KEY, Object.fromEntries(cacheRef.current.entries()));
}

async function resolvePaperFiles(
  paperId: string,
  cacheRef: MutableRefObject<Map<string, CachedPaperFiles>>,
) {
  const cachedFiles = cacheRef.current.get(paperId);
  if (cachedFiles && isCacheFresh(cachedFiles.cachedAt)) {
    return cachedFiles.files;
  }

  const response = await listPaperFiles(paperId);
  const sortedFiles = [...response.data].sort(
    (first, second) => Number(second.is_primary) - Number(first.is_primary),
  );
  persistPaperFilesCache(cacheRef, paperId, sortedFiles);
  return sortedFiles;
}

export function PaperPreviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const courseCode = (searchParams.get('courseCode') ?? '').trim();
  const requestedPaperId = (searchParams.get('paperId') ?? '').trim();

  const [papers, setPapers] = useState<PreviewPaper[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const [loadingPapers, setLoadingPapers] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingViewer, setLoadingViewer] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const coursePapersCacheRef = useRef<Map<string, CachedCoursePapers>>(new Map());
  const paperFilesCacheRef = useRef<Map<string, CachedPaperFiles>>(new Map());
  const viewerSourceCacheRef = useRef<Map<string, string>>(new Map());

  const selectedPaper = useMemo(
    () => papers.find((paper) => paper.id === selectedPaperId) ?? null,
    [papers, selectedPaperId],
  );

  const activeFile = useMemo(() => files.find((file) => file.id === activeFileId) ?? null, [files, activeFileId]);

  useEffect(() => {
    const storedCourseCache = readJsonStorage<Record<string, CachedCoursePapers>>(COURSE_PAPERS_CACHE_KEY, {});
    Object.entries(storedCourseCache).forEach(([key, value]) => {
      if (isCacheFresh(value.cachedAt)) {
        coursePapersCacheRef.current.set(key, value);
      }
    });

    const storedFilesCache = readJsonStorage<Record<string, CachedPaperFiles>>(PAPER_FILES_CACHE_KEY, {});
    Object.entries(storedFilesCache).forEach(([key, value]) => {
      if (isCacheFresh(value.cachedAt)) {
        paperFilesCacheRef.current.set(key, value);
      }
    });
  }, []);

  useEffect(() => {
    if (!courseCode) {
      setError('Course code is missing from URL.');
      setPapers([]);
      setSelectedPaperId(null);
      return;
    }

    let cancelled = false;

    async function loadPapers() {
      setLoadingPapers(true);
      setError(null);

      try {
        const cached = coursePapersCacheRef.current.get(courseCode);
        if (cached && isCacheFresh(cached.cachedAt)) {
          if (cancelled) return;
          setPapers(cached.papers);
          const targetPaper =
            cached.papers.find((paper) => paper.id === requestedPaperId)?.id ?? cached.papers[0]?.id ?? null;
          setSelectedPaperId(targetPaper);
          return;
        }

        const fetchedPapers = await fetchAllPapersForCourse(courseCode);
        if (cancelled) return;

        persistCoursePapersCache(coursePapersCacheRef, courseCode, fetchedPapers);
        setPapers(fetchedPapers);

        const targetPaper =
          fetchedPapers.find((paper) => paper.id === requestedPaperId)?.id ?? fetchedPapers[0]?.id ?? null;
        setSelectedPaperId(targetPaper);
      } catch (requestError) {
        if (cancelled) return;
        setError(getFriendlyError(requestError));
        setPapers([]);
        setSelectedPaperId(null);
      } finally {
        if (!cancelled) {
          setLoadingPapers(false);
        }
      }
    }

    void loadPapers();

    return () => {
      cancelled = true;
    };
  }, [courseCode, requestedPaperId]);

  useEffect(() => {
    if (!selectedPaperId) {
      setFiles([]);
      setActiveFileId(null);
      setViewerUrl(null);
      return;
    }

    let cancelled = false;

    async function loadFilesAndViewer() {
      const currentPaperId = selectedPaperId;
      if (!currentPaperId) return;

      setLoadingFiles(true);
      setLoadingViewer(true);
      setError(null);
      setStatusMessage(null);

      try {
        const selectedFiles = await resolvePaperFiles(currentPaperId, paperFilesCacheRef);

        if (cancelled) return;

        setFiles(selectedFiles);
        const nextActiveFile = pickDefaultFile(selectedFiles);

        if (!nextActiveFile) {
          setActiveFileId(null);
          setViewerUrl(null);
          setStatusMessage('No files available for this paper.');
          return;
        }

        setActiveFileId(nextActiveFile.id);

        const cachedViewerSource = viewerSourceCacheRef.current.get(nextActiveFile.id);
        if (cachedViewerSource) {
          setViewerUrl(cachedViewerSource);
          return;
        }

        const source = await getDownloadableUrl(nextActiveFile);
        if (cancelled) return;

        viewerSourceCacheRef.current.set(nextActiveFile.id, source);
        setViewerUrl(source);
      } catch (requestError) {
        if (cancelled) return;
        setViewerUrl(null);
        setError(getFriendlyError(requestError));
      } finally {
        if (!cancelled) {
          setLoadingFiles(false);
          setLoadingViewer(false);
        }
      }
    }

    void loadFilesAndViewer();

    return () => {
      cancelled = true;
    };
  }, [selectedPaperId]);

  useEffect(() => {
    if (!selectedPaperId) return;

    const nextParams = new URLSearchParams(searchParams);
    if (selectedPaperId) {
      nextParams.set('paperId', selectedPaperId);
    }

    const currentSerialized = searchParams.toString();
    const nextSerialized = nextParams.toString();
    if (currentSerialized !== nextSerialized) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, selectedPaperId, setSearchParams]);

  const openPaper = (paperId: string) => {
    setSelectedPaperId(paperId);
  };

  const withActionState = async (actionName: string, action: () => Promise<void>) => {
    setActionBusy(actionName);
    setStatusMessage(null);
    setError(null);

    try {
      await action();
    } catch (actionError) {
      setError(getFriendlyError(actionError));
    } finally {
      setActionBusy(null);
    }
  };

  const onOpenInNewTab = () =>
    withActionState('open-tab', async () => {
      if (!viewerUrl) throw new Error('No PDF loaded to open.');
      const opened = window.open(viewerUrl, '_blank', 'noopener,noreferrer');
      if (!opened) throw new Error('Pop-up blocked. Allow pop-ups and retry.');
    });

  const onShare = () =>
    withActionState('share', async () => {
      if (!selectedPaper) throw new Error('No paper selected to share.');

      const shareUrl = `${window.location.origin}/preview?courseCode=${encodeURIComponent(
        selectedPaper.courseCode,
      )}&paperId=${encodeURIComponent(selectedPaper.id)}`;

      if (navigator.share) {
        await navigator.share({
          title: selectedPaper.courseName,
          text: `${selectedPaper.courseCode} - ${selectedPaper.title}`,
          url: shareUrl,
        });
        setStatusMessage('Share sheet opened.');
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setStatusMessage('Share link copied to clipboard.');
    });

  const pageLabel = loadingViewer
    ? 'Loading PDF...'
    : viewerUrl
      ? `Page 1 / 1`
      : 'No preview available';

  const selectedPaperSubtitle = selectedPaper
    ? `${formatMonthYear(selectedPaper.exam_month, selectedPaper.exam_year)} | ${formatExamTerm(selectedPaper.exam_term)}`
    : 'No paper selected';

  return (
    <div className="preview-page">
      <div className="page-top-bar">
        <BackButton fallbackPath="/results" label="Results" />
      </div>

      <div className="preview-header-row">
        <div>
          <p className="preview-code">{selectedPaper?.courseCode ?? (courseCode || 'Course unavailable')}</p>
          <h1>{selectedPaper?.courseName ?? 'Paper Preview'}</h1>
          <p className="preview-subtitle">{selectedPaperSubtitle}</p>
        </div>
        <div className="preview-actions-top">
        </div>
      </div>

      <section className="preview-layout">
        <aside className="papers-sidebar">
          <div className="papers-sidebar__top">
            <h2>Available Papers</h2>
            <span className="paper-count">{papers.length}</span>
          </div>

          <div className="papers-list">
            {loadingPapers ? <p className="preview-note">Loading papers...</p> : null}
            {!loadingPapers && papers.length === 0 ? <p className="preview-note">No papers found for this course.</p> : null}

            {papers.map((paper) => (
              <article
                key={paper.id}
                className={`paper-item ${paper.id === selectedPaperId ? 'paper-item--active' : ''}`}
                onClick={() => openPaper(paper.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openPaper(paper.id);
                  }
                }}
              >
                <div>
                  <div className="paper-item__title-row">
                    <span className="result-tag">{formatExamTerm(paper.exam_term)}</span>
                    <h3>{formatMonthYear(paper.exam_month, paper.exam_year)}</h3>
                  </div>
                  <p>{paper.title}</p>
                </div>
                <button type="button" aria-label="Open paper" className="paper-item__open">
                  &gt;
                </button>
              </article>
            ))}
          </div>
        </aside>

        <div className="preview-main">
          <div className="preview-main__actions">
            <button type="button" onClick={onOpenInNewTab} disabled={!viewerUrl || actionBusy === 'open-tab'}>
              {actionBusy === 'open-tab' ? 'Opening...' : 'Open in New Tab'}
            </button>
            <button type="button" onClick={onShare} disabled={!selectedPaperId || actionBusy === 'share'}>
              {actionBusy === 'share' ? 'Sharing...' : 'Share'}
            </button>
          </div>

          {error ? <p className="preview-note preview-note--error">{error}</p> : null}
          {statusMessage ? <p className="preview-note">{statusMessage}</p> : null}

          <div className="pdf-shell">
            <div className="pdf-toolbar">
              <span>{pageLabel}</span>
              <span>{viewerUrl ? '100%' : '-'}</span>
            </div>

            <div className={`pdf-canvas ${viewerUrl ? 'pdf-canvas--embed' : ''}`}>
              {loadingFiles || loadingViewer ? <p>Loading PDF preview...</p> : null}

              {!loadingFiles && !loadingViewer && viewerUrl ? (
                <iframe
                  title="Paper PDF viewer"
                  src={toEmbedUrl(viewerUrl)}
                  className="pdf-frame"
                />
              ) : null}

              {!loadingFiles && !loadingViewer && !viewerUrl ? <p>No PDF available for this paper.</p> : null}
            </div>

            <div className="meta-grid">
              <div className="meta-item">
                <span>File Size</span>
                <strong>{formatBytes(activeFile?.size_bytes ?? null)}</strong>
              </div>
              <div className="meta-item">
                <span>Exam Year</span>
                <strong>{selectedPaper?.exam_year ?? 'Unknown'}</strong>
              </div>
              <div className="meta-item">
                <span>Exam Month</span>
                <strong>{formatMonth(selectedPaper?.exam_month ?? null)}</strong>
              </div>
              <div className="meta-item">
                <span>Course Code</span>
                <strong>{selectedPaper?.courseCode ?? 'Unknown'}</strong>
              </div>
              <div className="meta-item">
                <span>Course Name</span>
                <strong>{selectedPaper?.courseName ?? 'Unknown'}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
