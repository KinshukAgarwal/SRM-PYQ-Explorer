import { useEffect, useMemo, useState } from 'react';
import { listCourses, listCoursePapers, listPaperFiles, getFileDownloadUrl } from './lib/api';
import type { Paper } from './types/api';

type PaperWithCourse = Paper & { courseCode: string; courseName: string };
type CourseGroup = { courseCode: string; courseName: string; papers: PaperWithCourse[] };

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something went wrong while contacting the API.';
}

function sortPapers(items: PaperWithCourse[]) {
  return [...items].sort((first, second) => {
    const yearA = first.exam_year ?? 0;
    const yearB = second.exam_year ?? 0;
    if (yearA !== yearB) return yearB - yearA;
    return second.created_at.localeCompare(first.created_at);
  });
}

function tabLabel(paper: PaperWithCourse, index: number) {
  if (paper.exam_term && paper.exam_year) return `${paper.exam_term} ${paper.exam_year}`;
  if (paper.session_label) return paper.session_label;
  return `Paper ${index + 1}`;
}

function isCompactViewport() {
  return window.matchMedia('(max-width: 1023px)').matches;
}

function App() {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const [query, setQuery] = useState(initialParams.get('q') ?? '');
  const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCourseCode, setSelectedCourseCode] = useState(initialParams.get('course'));
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingResultsError, setLoadingResultsError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [paperUrlCache, setPaperUrlCache] = useState<Record<string, string>>({});
  const [isResultsDrawerOpen, setIsResultsDrawerOpen] = useState(!initialParams.get('paper'));
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => courseGroups.find((group) => group.courseCode === selectedCourseCode) ?? null,
    [courseGroups, selectedCourseCode],
  );

  const selectedPaper = useMemo(
    () => selectedGroup?.papers.find((paper) => paper.id === selectedPaperId) ?? null,
    [selectedGroup, selectedPaperId],
  );

  useEffect(() => {
    let active = true;

    async function fetchData() {
      if (!query.trim()) {
        setLoadingResultsError(null);
        setCourseGroups([]);
        return;
      }

      setLoading(true);
      setLoadingResultsError(null);

      try {
        const { data: courses } = await listCourses({ q: query, limit: 10 });

        if (!active) return;
        if (courses.length === 0) {
          setCourseGroups([]);
          return;
        }

        const paperResults = await Promise.allSettled(
          courses.map(async (course) => {
            const { data: coursePapers } = await listCoursePapers(course.course_code, { limit: 30 });
            return coursePapers.map((paper) => ({
              ...paper,
              courseCode: course.course_code,
              courseName: course.course_name,
            }));
          }),
        );

        if (!active) return;

        const allPapers = paperResults
          .filter((result): result is PromiseFulfilledResult<PaperWithCourse[]> => result.status === 'fulfilled')
          .flatMap((result) => result.value);

        const uniqueByPaperId = new Map<string, PaperWithCourse>();
        allPapers.forEach((paper) => {
          if (!uniqueByPaperId.has(paper.id)) {
            uniqueByPaperId.set(paper.id, paper);
          }
        });

        const groupedByCourseCode = new Map<string, CourseGroup>();
        Array.from(uniqueByPaperId.values()).forEach((paper) => {
          const existing = groupedByCourseCode.get(paper.courseCode);
          if (!existing) {
            groupedByCourseCode.set(paper.courseCode, {
              courseCode: paper.courseCode,
              courseName: paper.courseName,
              papers: [paper],
            });
            return;
          }
          existing.papers.push(paper);
        });

        const nextGroups = Array.from(groupedByCourseCode.values())
          .map((group) => ({
            ...group,
            papers: sortPapers(group.papers),
          }))
          .sort((first, second) => first.courseCode.localeCompare(second.courseCode));

        setCourseGroups(nextGroups);
      } catch (e) {
        if (active) {
          setCourseGroups([]);
          setLoadingResultsError(getErrorMessage(e));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    
    const timeout = setTimeout(fetchData, 500);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    if (courseGroups.length === 0) {
      if (!query.trim()) {
        setSelectedCourseCode(null);
      }
      setSelectedPaperId(null);
      return;
    }

    if (isCompactViewport()) {
      const currentGroup = selectedCourseCode
        ? courseGroups.find((group) => group.courseCode === selectedCourseCode)
        : null;

      if (!currentGroup) {
        setSelectedCourseCode(null);
        setSelectedPaperId(null);
        return;
      }

      const paperStillExists = currentGroup.papers.some((paper) => paper.id === selectedPaperId);
      if (!paperStillExists) {
        setSelectedPaperId(null);
      }
      return;
    }

    const currentGroup = courseGroups.find((group) => group.courseCode === selectedCourseCode);
    if (!currentGroup) {
      const firstGroup = courseGroups[0];
      setSelectedCourseCode(firstGroup.courseCode);
      setSelectedPaperId(firstGroup.papers[0]?.id ?? null);
      return;
    }

    const paperStillExists = currentGroup.papers.some((paper) => paper.id === selectedPaperId);
    if (!paperStillExists) {
      setSelectedPaperId(currentGroup.papers[0]?.id ?? null);
    }
  }, [courseGroups, query, selectedCourseCode, selectedPaperId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (query.trim()) params.set('q', query.trim());
    else params.delete('q');

    if (selectedCourseCode) params.set('course', selectedCourseCode);
    else params.delete('course');

    params.delete('paper');

    const nextQueryString = params.toString();
    const nextUrl = nextQueryString ? `${window.location.pathname}?${nextQueryString}` : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [query, selectedCourseCode]);

  useEffect(() => {
    if (isCompactViewport() && selectedPaperId) {
      setIsResultsDrawerOpen(false);
    }
  }, [selectedPaperId]);

  useEffect(() => {
    if (!isCompactViewport()) return;
    if (!query.trim() || !selectedPaperId) {
      setIsResultsDrawerOpen(true);
    }
  }, [query, selectedPaperId]);

  useEffect(() => {
    if (!isCompactViewport()) return;
    if (courseGroups.length === 0) {
      setIsResultsDrawerOpen(true);
    }
  }, [courseGroups.length]);

  useEffect(() => {
    if (!selectedPaperId) {
      setPdfUrl(null);
      setPdfError(null);
      return;
    }

    const paperId = selectedPaperId;

    const cachedUrl = paperUrlCache[paperId];
    if (cachedUrl) {
      setPdfUrl(cachedUrl);
      setPdfError(null);
      setLoadingPdf(false);
      return;
    }

    setPdfUrl(null);
    setLoadingPdf(true);
    setPdfError(null);

    async function loadPdf() {
    try {
        const { data: files } = await listPaperFiles(paperId);
      if (files.length > 0) {
        const selectedFile = files.find((file) => file.is_primary) ?? files[0];
        const { data: downloadInfo } = await getFileDownloadUrl(selectedFile.id);
        const { download_url } = downloadInfo;
        setPdfUrl(download_url);
          setPaperUrlCache((prev) => ({ ...prev, [paperId]: download_url }));
      } else {
        setPdfUrl('empty');
        setPdfError('No PDF file is available for this paper.');
      }
    } catch(e) {
      setPdfUrl('error');
      setPdfError(getErrorMessage(e));
    } finally {
      setLoadingPdf(false);
    }
    }

    loadPdf();
  }, [paperUrlCache, selectedPaperId]);

  function selectCourse(group: CourseGroup) {
    setSelectedCourseCode(group.courseCode);
    setSelectedPaperId(group.papers[0]?.id ?? null);
    if (isCompactViewport()) {
      setIsResultsDrawerOpen(false);
    }
  }

  function selectPaper(paperId: string) {
    setSelectedPaperId(paperId);
  }

  function createShareUrl(courseCode: string) {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set('q', query.trim());
    }
    params.set('course', courseCode);

    const queryString = params.toString();
    const relativePath = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    return `${window.location.origin}${relativePath}`;
  }

  async function shareCourse(course: CourseGroup, paper: PaperWithCourse | null) {
    const shareUrl = createShareUrl(course.courseCode);
    const shareText = paper ? `${course.courseCode} - ${paper.title}` : `${course.courseCode} - ${course.courseName}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'SRM PYQ Explorer',
          text: shareText,
          url: shareUrl,
        });
        setShareMessage('Share sheet opened.');
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareMessage('Share link copied.');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      try {
        await navigator.clipboard.writeText(shareUrl);
        setShareMessage('Share link copied.');
      } catch {
        setShareMessage('Unable to share this paper on this device.');
      }
    }

    window.setTimeout(() => {
      setShareMessage(null);
    }, 2200);
  }

  return (
    <div className="flex flex-col h-screen max-lg:h-[100dvh] bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Navbar */}
      <header className="flex-none flex items-center justify-between px-6 py-4 max-lg:px-4 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm z-20 h-16 max-lg:h-auto max-lg:min-h-16">
        <div className="flex-1 max-w-sm max-lg:max-w-none">
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 hover:bg-white text-sm transition-colors"
              placeholder="Search courses or codes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="text-xl font-bold tracking-tight text-slate-800 ml-4 hidden lg:block">
          SRM PYQ Explorer
        </div>
      </header>

      {/* Main Container */}
      <main className="relative flex-1 flex overflow-hidden w-full h-full max-lg:flex-col max-lg:p-0 max-lg:bg-slate-50">
        {isResultsDrawerOpen ? (
          <button
            type="button"
            aria-label="Close results panel"
            onClick={() => setIsResultsDrawerOpen(false)}
            className="hidden max-lg:block absolute inset-0 z-20 bg-slate-900/35"
          />
        ) : null}

        {/* Left Section (Search Results) */}
        <div className={`w-full lg:w-[360px] flex-none flex flex-col bg-white border-r border-slate-200 z-10 h-full max-lg:absolute max-lg:left-3 max-lg:right-3 max-lg:w-auto max-lg:top-3 max-lg:bottom-3 max-lg:min-h-0 max-lg:border max-lg:border-slate-200 max-lg:rounded-xl max-lg:shadow-xl max-lg:overflow-hidden ${isResultsDrawerOpen ? 'max-lg:flex max-lg:z-30' : 'max-lg:hidden'}`}>
          <div className="flex-none px-6 py-4 max-lg:px-4 max-lg:py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Search Results</h2>
            <div className="flex items-center gap-2">
              {loading && (
                <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <button
                type="button"
                onClick={() => setIsResultsDrawerOpen(false)}
                className="hidden max-lg:inline-flex items-center justify-center h-8 w-8 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100"
                aria-label="Close results"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 max-lg:p-3 space-y-4 max-lg:space-y-3">
            {loadingResultsError ? (
              <div className="text-sm border border-red-200 bg-red-50 rounded-lg p-3 text-red-700">
                {loadingResultsError}
              </div>
            ) : null}
            {query.trim() === '' ? (
               <div className="text-sm border border-slate-200 border-dashed rounded-lg p-8 text-center text-slate-500 bg-slate-50/50">
                 Type a course code or name to find papers.
               </div>
            ) : courseGroups.length === 0 && !loading ? (
              <div className="text-sm border border-slate-200 border-dashed rounded-lg p-8 text-center text-slate-500 bg-slate-50/50">
                No papers found for "{query}".
              </div>
            ) : (
              courseGroups.map((group) => (
                <div
                  key={group.courseCode} 
                  className={`p-4 rounded-xl border transition-all ${selectedCourseCode === group.courseCode ? 'border-blue-500 bg-blue-50/30 shadow-md shadow-blue-500/10' : 'border-slate-200 shadow-sm hover:shadow hover:border-slate-300 bg-white'}`}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-xs font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded uppercase tracking-wider">
                        {group.courseCode}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 leading-tight">
                        {group.courseName}
                      </h3>
                    </div>
                    
                    <div className="text-sm text-slate-600 border-t border-slate-100 pt-2">
                      <span className="font-medium text-slate-800">
                        {group.papers.length} paper{group.papers.length === 1 ? '' : 's'} available
                      </span>
                    </div>
                    
                    <button 
                      onClick={() => selectCourse(group)}
                      className={`mt-1 w-full py-2 text-sm font-medium rounded-lg transition-colors duration-200 flex justify-center items-center gap-2 ${
                        selectedCourseCode === group.courseCode
                        ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                        : 'bg-slate-900 text-white shadow-sm hover:bg-slate-800'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                      {selectedCourseCode === group.courseCode ? 'Viewing Papers' : 'View Papers'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Section (PDF Viewer & Metadata) */}
        <div className="flex-1 min-w-0 flex flex-col bg-slate-100 h-full relative z-0 overflow-hidden max-lg:min-h-0 max-lg:border-0 max-lg:rounded-none max-lg:shadow-none max-lg:bg-slate-100">
          <div className="hidden max-lg:flex absolute right-3 top-3 z-20">
            <button
              type="button"
              onClick={() => setIsResultsDrawerOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white/95 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
            >
              {isResultsDrawerOpen ? 'Hide Results' : 'Show Results'}
            </button>
          </div>
          {shareMessage ? (
            <div className="absolute z-20 right-3 top-14 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
              {shareMessage}
            </div>
          ) : null}

          {selectedGroup && selectedPaper ? (
            <>
              {/* Metadata Panel */}
              <div className="flex-none px-8 py-5 max-lg:px-4 max-lg:py-3 bg-white border-b border-slate-200 z-10 shadow-sm">
                <div className="flex flex-col gap-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">{selectedGroup.courseCode}</span>
                    <span>{selectedGroup.courseName}</span>
                  </div>
                  <div className="mt-1 flex items-start justify-between gap-3 max-lg:gap-2 max-lg:flex-wrap">
                    <h1 className="flex-1 min-w-0 text-xl max-lg:text-base font-bold text-slate-900 break-words">
                      {selectedPaper.title}
                    </h1>
                    <button
                      type="button"
                      onClick={() => shareCourse(selectedGroup, selectedPaper)}
                      className="shrink-0 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm max-lg:text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Share
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600 mt-2">
                     {selectedPaper.exam_term && selectedPaper.exam_year && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
                        </svg>
                        <span>{selectedPaper.exam_term} {selectedPaper.exam_year}</span>
                      </div>
                    )}
                    {selectedPaper.session_label && (
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                        </svg>
                        <span>{selectedPaper.session_label}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-none px-8 py-3 max-lg:px-4 max-lg:py-2 bg-white border-b border-slate-200 overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                  {selectedGroup.papers.map((paper, index) => (
                    <button
                      key={paper.id}
                      onClick={() => selectPaper(paper.id)}
                      className={`px-3 py-1.5 max-lg:px-2.5 max-lg:py-1 text-sm max-lg:text-xs rounded-md border transition-colors ${
                        selectedPaper.id === paper.id
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {tabLabel(paper, index)}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* PDF Viewer Area */}
              <div className="flex-1 p-6 max-lg:p-2 relative h-full flex flex-col min-h-0 min-w-0 overflow-hidden">
                {loadingPdf ? (
                  <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200">
                    <svg className="animate-spin h-8 w-8 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <div className="text-slate-500 font-medium">Fetching secure paper link...</div>
                  </div>
                ) : pdfUrl && pdfUrl !== 'error' && pdfUrl !== 'empty' ? (
                  <iframe 
                    src={pdfUrl} 
                    className="flex-1 h-full w-full min-h-0 min-w-0 rounded-xl shadow-lg border border-slate-300 bg-white"
                    title={selectedPaper.title}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-lg:p-5 text-center max-w-lg mx-auto w-full my-auto">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-red-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">
                       {pdfUrl === 'empty' ? 'No PDF available' : 'Failed to load PDF'}
                    </h3>
                    <p className="text-slate-500 text-sm">
                      {pdfError ?? (pdfUrl === 'empty' ? 'This paper does not have a PDF document associated with it.' : 'We encountered an error while trying to fetch the file. Please try again later.')}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 max-lg:p-4">
              <div className="text-center p-10 max-lg:p-6 max-w-sm rounded-[2rem] border-2 border-dashed border-slate-300 bg-white/50 text-slate-500 shadow-sm">
                <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-slate-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No Paper Selected</h3>
                <p className="text-sm">Search and choose a paper from the left panel to read its contents here.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
