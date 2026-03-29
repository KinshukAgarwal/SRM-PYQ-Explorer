import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { BackButton } from '../components/BackButton';
import { FilterGroup } from '../components/FilterGroup';
import { ResultCard } from '../components/ResultCard';
import { SearchInput } from '../components/SearchInput';
import { getPaper, listCoursePapers, listCourses } from '../lib/api';
import type { FilterOption, ResultCardData } from '../data/mockData';
import type { Course, Paper } from '../types/api';
import { useNavigate, useSearchParams } from 'react-router-dom';

type SearchPaper = Paper & {
  courseCode: string;
  courseName: string;
  department: string | null;
  semester: number | null;
  semesterValues: number[];
};

type CachedSearchPayload = {
  cachedAt: number;
  results: SearchPaper[];
  warningMessage: string | null;
};

type CourseSemesterCacheMap = Record<string, number[]>;

type GroupedCourseResult = {
  courseCode: string;
  courseName: string;
  department: string | null;
  semester: number | null;
  papers: SearchPaper[];
  latestPaper: SearchPaper;
};

const PAGE_SIZE = 9;
const COURSE_FETCH_CONCURRENCY = 6;
const SEARCH_CACHE_STORAGE_KEY = 'srm-pyq-search-cache-v1';
const COURSE_SEMESTER_CACHE_KEY = 'srm-pyq-course-semesters-v1';
const SEARCH_CACHE_TTL_MS = 1000 * 60 * 20;

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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unable to fetch search results right now.';
}

function formatMonthYear(examMonth: number | null, examYear: number | null) {
  if (!examMonth && !examYear) {
    return 'Date unavailable';
  }

  const monthLabel = examMonth && examMonth >= 1 && examMonth <= 12 ? MONTH_NAMES[examMonth - 1] : null;
  if (monthLabel && examYear) {
    return `${monthLabel} ${examYear}`;
  }

  if (monthLabel) {
    return monthLabel;
  }

  return String(examYear);
}

function toResultTag(examTerm: string | null) {
  if (!examTerm) {
    return 'PYQ';
  }
  return examTerm.toUpperCase();
}

function toMonthOption(examMonth: number): FilterOption {
  return {
    id: String(examMonth),
    label: MONTH_NAMES[examMonth - 1],
  };
}

function parseSemesterValues(rawValues: unknown): number[] {
  if (!Array.isArray(rawValues)) {
    return [];
  }

  const numeric = rawValues
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0) as number[];

  return Array.from(new Set(numeric)).sort((first, second) => first - second);
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

function normalizeCachedResults(results: SearchPaper[]): SearchPaper[] {
  return results.map((paper) => ({
    ...paper,
    semesterValues:
      Array.isArray(paper.semesterValues) && paper.semesterValues.length > 0
        ? paper.semesterValues
        : paper.semester !== null
          ? [paper.semester]
          : [],
  }));
}

async function fetchCoursesByQuery(query: string) {
  const allCourses: Course[] = [];
  let cursor: string | null = null;

  while (true) {
    const response = await listCourses({ q: query, cursor, limit: 200 });
    allCourses.push(...response.data);

    if (!response.page.has_more || !response.page.next_cursor) {
      break;
    }

    cursor = response.page.next_cursor;
  }

  return allCourses;
}

async function fetchPapersForCourse(course: Course) {
  const allPapers: SearchPaper[] = [];
  let cursor: string | null = null;

  while (true) {
    const response = await listCoursePapers(course.course_code, { cursor, limit: 200 });

    const papers = response.data.map((paper) => ({
      ...paper,
      courseCode: course.course_code,
      courseName: course.course_name,
      department: course.department,
      semester: course.semester,
      semesterValues: course.semester !== null ? [course.semester] : [],
    }));

    allPapers.push(...papers);

    if (!response.page.has_more || !response.page.next_cursor) {
      break;
    }

    cursor = response.page.next_cursor;
  }

  return allPapers;
}

async function resolveSemesterValuesForCourse(
  course: Course,
  papers: SearchPaper[],
  semesterCacheRef: MutableRefObject<Map<string, number[]>>,
) {
  if (course.semester !== null) {
    const fixedValues = [course.semester];
    semesterCacheRef.current.set(course.course_code, fixedValues);
    return fixedValues;
  }

  const cached = semesterCacheRef.current.get(course.course_code);
  if (cached) {
    return cached;
  }

  if (papers.length === 0) {
    return [];
  }

  try {
    const detail = await getPaper(papers[0].id);
    const parsed = parseSemesterValues(detail.data.metadata?.semester);
    semesterCacheRef.current.set(course.course_code, parsed);
    return parsed;
  } catch {
    return [];
  }
}

async function fetchPapersForCourses(
  courses: Course[],
  semesterCacheRef: MutableRefObject<Map<string, number[]>>,
) {
  const aggregated: SearchPaper[] = [];
  let failedCourses = 0;

  for (let index = 0; index < courses.length; index += COURSE_FETCH_CONCURRENCY) {
    const batch = courses.slice(index, index + COURSE_FETCH_CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(async (course) => {
        const papers = await fetchPapersForCourse(course);
        const semesterValues = await resolveSemesterValuesForCourse(course, papers, semesterCacheRef);

        return papers.map((paper) => ({
          ...paper,
          semester: semesterValues[0] ?? null,
          semesterValues,
        }));
      }),
    );

    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        aggregated.push(...result.value);
      } else {
        failedCourses += 1;
      }
    });
  }

  return {
    papers: aggregated,
    failedCourses,
  };
}

export function SearchResultsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeQuery = (searchParams.get('q') ?? '').trim();

  const [searchInput, setSearchInput] = useState(activeQuery);
  const [allResults, setAllResults] = useState<SearchPaper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedSemesters, setSelectedSemesters] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const queryCacheRef = useRef<Map<string, CachedSearchPayload>>(new Map());
  const semesterCacheRef = useRef<Map<string, number[]>>(new Map());

  useEffect(() => {
    const storedQueryCache = readJsonStorage<Record<string, CachedSearchPayload>>(SEARCH_CACHE_STORAGE_KEY, {});
    const now = Date.now();

    Object.entries(storedQueryCache).forEach(([query, payload]) => {
      if (now - payload.cachedAt <= SEARCH_CACHE_TTL_MS) {
        queryCacheRef.current.set(query, {
          ...payload,
          results: normalizeCachedResults(payload.results),
        });
      }
    });

    const storedSemesterCache = readJsonStorage<CourseSemesterCacheMap>(COURSE_SEMESTER_CACHE_KEY, {});
    Object.entries(storedSemesterCache).forEach(([courseCode, values]) => {
      semesterCacheRef.current.set(courseCode, values);
    });
  }, []);

  const persistQueryCache = (query: string, payload: CachedSearchPayload) => {
    queryCacheRef.current.set(query, payload);
    const serializable = Object.fromEntries(queryCacheRef.current.entries());
    writeJsonStorage(SEARCH_CACHE_STORAGE_KEY, serializable);
  };

  const persistSemesterCache = () => {
    const serializable = Object.fromEntries(semesterCacheRef.current.entries());
    writeJsonStorage(COURSE_SEMESTER_CACHE_KEY, serializable);
  };

  useEffect(() => {
    setSearchInput(activeQuery);
  }, [activeQuery]);

  useEffect(() => {
    setSelectedYears([]);
    setSelectedMonths([]);
    setSelectedSemesters([]);
    setCurrentPage(1);
  }, [activeQuery]);

  useEffect(() => {
    let cancelled = false;

    async function runSearch() {
      if (!activeQuery) {
        setAllResults([]);
        setErrorMessage(null);
        setWarningMessage(null);
        setIsLoading(false);
        return;
      }

      const cachedPayload = queryCacheRef.current.get(activeQuery);
      if (cachedPayload && Date.now() - cachedPayload.cachedAt <= SEARCH_CACHE_TTL_MS) {
        setAllResults(normalizeCachedResults(cachedPayload.results));
        setErrorMessage(null);
        setWarningMessage(cachedPayload.warningMessage);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      setWarningMessage(null);

      try {
        const courses = await fetchCoursesByQuery(activeQuery);

        if (courses.length === 0) {
          if (!cancelled) {
            persistQueryCache(activeQuery, {
              cachedAt: Date.now(),
              results: [],
              warningMessage: null,
            });
            setAllResults([]);
            setWarningMessage(null);
          }
          return;
        }

        const { papers, failedCourses } = await fetchPapersForCourses(courses, semesterCacheRef);
        persistSemesterCache();

        if (papers.length === 0 && failedCourses > 0) {
          throw new Error('The server is temporarily failing while loading papers. Please try again.');
        }

        const uniqueByPaperId = new Map<string, SearchPaper>();
        papers.forEach((paper) => {
          if (!uniqueByPaperId.has(paper.id)) {
            uniqueByPaperId.set(paper.id, paper);
          }
        });

        const merged = Array.from(uniqueByPaperId.values());

        merged.sort((first, second) => {
          const yearDiff = (second.exam_year ?? 0) - (first.exam_year ?? 0);
          if (yearDiff !== 0) {
            return yearDiff;
          }

          const monthDiff = (second.exam_month ?? 0) - (first.exam_month ?? 0);
          if (monthDiff !== 0) {
            return monthDiff;
          }

          return second.created_at.localeCompare(first.created_at);
        });

        if (!cancelled) {
          const warning =
            failedCourses > 0
              ? `Some courses failed to load (${failedCourses}). Showing available results.`
              : null;

          persistQueryCache(activeQuery, {
            cachedAt: Date.now(),
            results: merged,
            warningMessage: warning,
          });

          setAllResults(merged);
          setWarningMessage(warning);
        }
      } catch (error) {
        if (!cancelled) {
          setAllResults([]);
          setErrorMessage(getErrorMessage(error));
          setWarningMessage(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void runSearch();

    return () => {
      cancelled = true;
    };
  }, [activeQuery]);

  const examYearOptions = useMemo<FilterOption[]>(() => {
    const years = new Set<number>();
    allResults.forEach((paper) => {
      if (paper.exam_year) {
        years.add(paper.exam_year);
      }
    });

    return Array.from(years)
      .sort((first, second) => second - first)
      .map((year) => ({ id: String(year), label: String(year) }));
  }, [allResults]);

  const examMonthOptions = useMemo<FilterOption[]>(() => {
    const months = new Set<number>();
    allResults.forEach((paper) => {
      if (paper.exam_month && paper.exam_month >= 1 && paper.exam_month <= 12) {
        months.add(paper.exam_month);
      }
    });

    return Array.from(months)
      .sort((first, second) => second - first)
      .map((month) => toMonthOption(month));
  }, [allResults]);

  const semesterOptions = useMemo<FilterOption[]>(() => {
    const semesters = new Set<number>();
    allResults.forEach((paper) => {
      paper.semesterValues.forEach((semester) => semesters.add(semester));
    });

    return Array.from(semesters)
      .sort((first, second) => first - second)
      .map((semester) => ({ id: String(semester), label: `Semester ${semester}` }));
  }, [allResults]);

  const filteredResults = useMemo(() => {
    return allResults.filter((paper) => {
      const yearMatch =
        selectedYears.length === 0 ||
        (paper.exam_year !== null && selectedYears.includes(String(paper.exam_year)));

      const monthMatch =
        selectedMonths.length === 0 ||
        (paper.exam_month !== null && selectedMonths.includes(String(paper.exam_month)));

      const semesterMatch =
        selectedSemesters.length === 0 ||
        paper.semesterValues.some((semester) => selectedSemesters.includes(String(semester)));

      return yearMatch && monthMatch && semesterMatch;
    });
  }, [allResults, selectedMonths, selectedSemesters, selectedYears]);

  const groupedCourseResults = useMemo<GroupedCourseResult[]>(() => {
    const groupedMap = new Map<string, GroupedCourseResult>();

    filteredResults.forEach((paper) => {
      const existing = groupedMap.get(paper.courseCode);
      if (existing) {
        existing.papers.push(paper);
        return;
      }

      groupedMap.set(paper.courseCode, {
        courseCode: paper.courseCode,
        courseName: paper.courseName,
        department: paper.department,
        semester: paper.semester,
        papers: [paper],
        latestPaper: paper,
      });
    });

    return Array.from(groupedMap.values());
  }, [filteredResults]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedYears, selectedMonths, selectedSemesters]);

  const totalPages = Math.ceil(groupedCourseResults.length / PAGE_SIZE);

  useEffect(() => {
    if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1);
      return;
    }

    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedCourses = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return groupedCourseResults.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, groupedCourseResults]);

  const clearFilters = () => {
    setSelectedYears([]);
    setSelectedMonths([]);
    setSelectedSemesters([]);
  };

  const hasSelectedFilters =
    selectedYears.length > 0 || selectedMonths.length > 0 || selectedSemesters.length > 0;

  const toggleSelected = (
    id: string,
    setter: Dispatch<SetStateAction<string[]>>,
  ) => {
    setter((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const visibleCards = useMemo<ResultCardData[]>(() => {
    return paginatedCourses.map((group) => ({
      id: group.courseCode,
      tag: toResultTag(group.latestPaper.exam_term),
      courseCode: group.courseCode,
      title: group.courseName,
      semester: group.semester ? `Semester ${group.semester}` : 'Semester -',
      monthYear: formatMonthYear(group.latestPaper.exam_month, group.latestPaper.exam_year),
      department: group.department ? `${group.department} Department` : 'Department unavailable',
      papersCount: group.papers.length,
    }));
  }, [paginatedCourses]);

  const openCoursePapers = (courseCode: string) => {
    navigate(`/preview?courseCode=${encodeURIComponent(courseCode)}`);
  };

  const submitSearch = () => {
    const normalizedQuery = searchInput.trim();
    const nextParams = new URLSearchParams(searchParams);

    if (normalizedQuery) {
      nextParams.set('q', normalizedQuery);
    } else {
      nextParams.delete('q');
    }

    setSearchParams(nextParams);
  };

  return (
    <div className="results-page">
      <div className="page-top-bar">
        <BackButton fallbackPath="/" label="Home" />
      </div>

      <div className="results-top-search">
        <SearchInput
          placeholder="Search by course code or course name"
          buttonLabel="Search"
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={submitSearch}
          compact
        />
      </div>

      <section className="results-layout">
        <aside className="results-sidebar">
          <div className="sidebar-title-row">
            <h2>Filters</h2>
            <button type="button" onClick={clearFilters} disabled={!hasSelectedFilters}>
              Clear all
            </button>
          </div>

          <FilterGroup
            title="Exam Year"
            options={examYearOptions}
            selectedIds={selectedYears}
            onToggle={(id) => toggleSelected(id, setSelectedYears)}
          />

          <FilterGroup
            title="Exam Month"
            options={examMonthOptions}
            selectedIds={selectedMonths}
            onToggle={(id) => toggleSelected(id, setSelectedMonths)}
          />

          <FilterGroup
            title="Semester"
            options={semesterOptions}
            selectedIds={selectedSemesters}
            onToggle={(id) => toggleSelected(id, setSelectedSemesters)}
          />
        </aside>

        <div className="results-main">
          {!activeQuery ? (
            <p className="results-count">Enter a course code or course name to search papers.</p>
          ) : isLoading ? (
            <p className="results-count">Loading papers for "{activeQuery}"...</p>
          ) : errorMessage ? (
            <p className="results-count">{errorMessage}</p>
          ) : (
            <p className="results-count">
              Showing {groupedCourseResults.length} course
              {groupedCourseResults.length === 1 ? '' : 's'} for "{activeQuery}" ({filteredResults.length}{' '}
              paper{filteredResults.length === 1 ? '' : 's'})
            </p>
          )}

          {!isLoading && !errorMessage && groupedCourseResults.length === 0 ? (
            <p className="results-count">No papers match the current search and filters.</p>
          ) : null}

          {!isLoading && !errorMessage && warningMessage ? (
            <p className="results-count">{warningMessage}</p>
          ) : null}

          <div className="results-grid stagger-children">
            {visibleCards.map((result) => (
              <ResultCard
                key={result.id}
                result={result}
                onOpen={() => openCoursePapers(result.courseCode)}
                onCourseCodeOpen={() => openCoursePapers(result.courseCode)}
              />
            ))}
          </div>

          {totalPages > 1 ? (
            <nav className="pagination" aria-label="Search results pagination">
              {Array.from({ length: totalPages }, (_, index) => {
                const pageNumber = index + 1;
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    className={`page-btn ${pageNumber === currentPage ? 'page-btn--active' : ''}`}
                    onClick={() => setCurrentPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </nav>
          ) : null}
        </div>
      </section>
    </div>
  );
}
