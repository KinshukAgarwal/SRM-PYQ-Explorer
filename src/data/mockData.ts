export type QuickFilter = {
  id: string;
  label: string;
};

export type StatItem = {
  value: string;
  label: string;
  highlighted?: boolean;
};

export type FilterOption = {
  id: string;
  label: string;
};

export type ResultCardData = {
  id: string;
  tag: string;
  courseCode: string;
  title: string;
  semester: string;
  monthYear: string;
  department: string;
  papersCount?: number;
};

export type PaperListItem = {
  id: string;
  tag: string;
  monthYear: string;
  marksAndDuration: string;
  active?: boolean;
};

export const quickFilters: QuickFilter[] = [
  { id: 'cat-1', label: 'CAT-1' },
  { id: 'cat-2', label: 'CAT-2' },
  { id: 'sem-end', label: 'Semester End' },
  { id: '2024', label: '2024' },
  { id: '2023', label: '2023' },
];

export const statItems: StatItem[] = [
  { value: '10K+', label: 'Question papers', highlighted: true },
  { value: '45', label: 'Departments' },
  { value: '8', label: 'Semesters covered' },
  { value: '24/7', label: 'Access anytime' },
];

export const examYearOptions: FilterOption[] = [
  { id: '2024', label: '2024' },
  { id: '2023', label: '2023' },
  { id: '2022', label: '2022' },
  { id: '2021', label: '2021' },
];

export const examMonthOptions: FilterOption[] = [
  { id: 'nov', label: 'November' },
  { id: 'oct', label: 'October' },
  { id: 'sep', label: 'September' },
  { id: 'aug', label: 'August' },
  { id: 'may', label: 'May' },
  { id: 'mar', label: 'March' },
];

export const resultCards: ResultCardData[] = [
  {
    id: '1',
    tag: 'CAT-1',
    courseCode: '18CSC201J',
    title: 'Data Structures and Algorithms',
    semester: 'Semester 3',
    monthYear: 'November 2024',
    department: 'CSE Department',
  },
  {
    id: '2',
    tag: 'CAT-2',
    courseCode: '18CSC201J',
    title: 'Data Structures and Algorithms',
    semester: 'Semester 3',
    monthYear: 'October 2024',
    department: 'CSE Department',
  },
  {
    id: '3',
    tag: 'SEM END',
    courseCode: '18CSC201J',
    title: 'Data Structures and Algorithms',
    semester: 'Semester 3',
    monthYear: 'December 2023',
    department: 'CSE Department',
  },
  {
    id: '4',
    tag: 'CAT-1',
    courseCode: '18CSC302J',
    title: 'Advanced Data Structures',
    semester: 'Semester 5',
    monthYear: 'September 2024',
    department: 'CSE Department',
  },
  {
    id: '5',
    tag: 'LAB',
    courseCode: '18CSC3018',
    title: 'Data Structures Lab',
    semester: 'Semester 3',
    monthYear: 'November 2024',
    department: 'CSE Department',
  },
  {
    id: '6',
    tag: 'CAT-1',
    courseCode: '18CSC201J',
    title: 'Data Structures and Algorithms',
    semester: 'Semester 3',
    monthYear: 'September 2023',
    department: 'CSE Department',
  },
  {
    id: '7',
    tag: 'CAT-2',
    courseCode: '18CSC3023',
    title: 'Advanced Data Structures',
    semester: 'Semester 5',
    monthYear: 'October 2023',
    department: 'CSE Department',
  },
  {
    id: '8',
    tag: 'SEM END',
    courseCode: '18CSC3023',
    title: 'Advanced Data Structures',
    semester: 'Semester 5',
    monthYear: 'May 2023',
    department: 'CSE Department',
  },
  {
    id: '9',
    tag: 'CAT-1',
    courseCode: '18CSC201J',
    title: 'Data Structures and Algorithms',
    semester: 'Semester 3',
    monthYear: 'March 2023',
    department: 'CSE Department',
  },
];

export const availablePapers: PaperListItem[] = [
  { id: 'p1', tag: 'CAT-1', monthYear: 'November 2024', marksAndDuration: '50 Marks | 1.5 Hours', active: true },
  { id: 'p2', tag: 'CAT-2', monthYear: 'October 2024', marksAndDuration: '50 Marks | 1.5 Hours' },
  { id: 'p3', tag: 'SEM END', monthYear: 'Dec 2023', marksAndDuration: '100 Marks | 3 Hours' },
  { id: 'p4', tag: 'CAT-1', monthYear: 'September 2023', marksAndDuration: '50 Marks | 1.5 Hours' },
  { id: 'p5', tag: 'CAT-2', monthYear: 'August 2023', marksAndDuration: '50 Marks | 1.5 Hours' },
  { id: 'p6', tag: 'SEM END', monthYear: 'May 2023', marksAndDuration: '100 Marks | 3 Hours' },
];
