import config from '../config.js';
import { logger } from '../utils/logger.js';

const BASE = config.aub.baseUrl;
const PAGE_SIZE = 500;

export type AubMeetingTime = {
  beginTime: string | null;
  endTime: string | null;
  startDate: string | null;
  endDate: string | null;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  meetingScheduleType: string | null;
  meetingType: string | null;
  meetingTypeDescription: string | null;
  room: string | null;
  building: string | null;
  buildingDescription: string | null;
  campus: string | null;
  hoursWeek: number | null;
  creditHourSession: number | null;
  weeklySchedulePatterns: string | null;
};

export type AubTerm = {
  code: string;
  description: string | null;
};

export type AubSection = {
  id: number;
  term: string;
  termDesc: string;
  courseReferenceNumber: string;
  subject: string;
  subjectDescription: string;
  courseNumber: string;
  sequenceNumber: string;
  courseTitle: string;
  creditHours: string | number | null;
  creditHourHigh: string | number | null;
  creditHourLow: string | number | null;
  campusDescription: string | null;
  scheduleTypeDescription: string | null;
  enrollmentAvailability: string | null;
  maximumEnrollment: string | null;
  seatsAvailable: string | null;
  isSectionLinked: boolean;
  linkIdentifier: string | null;
  faculty: Array<{ bannerId: string; firstName: string; lastName: string; displayName: string }>;
  meetingsFaculty: Array<{
    category: string | null;
    meetingTime: AubMeetingTime;
  }>;
  sectionAttributes: Array<{ description: string }>;
};

type SearchResponse = {
  success: boolean;
  totalCount: number;
  data: AubSection[] | null;
  pageOffset: number;
  pageMaxSize: number;
  sectionsFetchedCount: number;
};

type Session = {
  cookies: string;
  synchronizerToken: string;
};

function generateUniqueId(): string {
  const random = Math.random().toString(36).substring(2, 7);
  return `${random}${Date.now()}`;
}

function extractCookies(headers: Headers): string {
  const setCookies = headers.getSetCookie();
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}

function mergeCookies(existing: string, newCookies: string): string {
  if (!newCookies) return existing;
  const map = new Map<string, string>();
  for (const part of existing.split('; ')) {
    const [key, ...rest] = part.split('=');
    if (key) map.set(key, rest.join('='));
  }
  for (const part of newCookies.split('; ')) {
    const [key, ...rest] = part.split('=');
    if (key) map.set(key, rest.join('='));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function extractToken(html: string): string {
  const match = html.match(/synchronizerToken"\s+content="([^"]+)"/);
  return match?.[1] ?? '';
}

async function fetchWithCookies(
  url: string,
  cookies: string,
  init?: RequestInit,
): Promise<{ response: Response; cookies: string }> {
  const headers = new Headers(init?.headers);
  if (cookies) headers.set('Cookie', cookies);

  const response = await fetch(url, { ...init, headers, redirect: 'manual' });
  const newCookies = extractCookies(response.headers);
  const merged = mergeCookies(cookies, newCookies);

  return { response, cookies: merged };
}

async function initializeSession(): Promise<Session> {
  const { response, cookies } = await fetchWithCookies(
    `${BASE}/ssb/term/termSelection?mode=search`,
    '',
  );
  const html = await response.text();
  const synchronizerToken = extractToken(html);
  return { cookies, synchronizerToken };
}

async function saveTerm(session: Session, termCode: string): Promise<Session> {
  const body = new URLSearchParams({
    term: termCode,
    uniqueSessionId: generateUniqueId(),
  });

  const { response, cookies } = await fetchWithCookies(
    `${BASE}/ssb/term/saveTerm?mode=search`,
    session.cookies,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
  );

  await response.text();
  return { ...session, cookies };
}

async function submitTerm(session: Session, termCode: string): Promise<Session> {
  const body = new URLSearchParams({
    term: termCode,
    studyPath: '',
    studyPathText: '',
    student: '',
    altPin: '',
    stu_pin: '',
    holdPassword: '',
    startDatepicker: '',
    endDatepicker: '',
    uniqueSessionId: generateUniqueId(),
  });

  const { response, cookies } = await fetchWithCookies(
    `${BASE}/ssb/term/search?mode=search`,
    session.cookies,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
  );

  await response.text();
  return { ...session, cookies };
}

async function fetchPage(
  session: Session,
  termCode: string,
  offset: number,
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    txt_term: termCode,
    startDatepicker: '',
    endDatepicker: '',
    uniqueSessionId: generateUniqueId(),
    pageOffset: String(offset),
    pageMaxSize: String(PAGE_SIZE),
    sortColumn: 'subjectDescription',
    sortDirection: 'asc',
  });

  const { response, cookies } = await fetchWithCookies(
    `${BASE}/ssb/searchResults/searchResults?${params}`,
    session.cookies,
  );

  const json = (await response.json()) as SearchResponse;
  session.cookies = cookies;
  return json;
}

export async function fetchAllSections(termCode: string): Promise<AubSection[]> {
  logger.info({ termCode }, 'AUB sync: initializing session');

  let session = await initializeSession();
  session = await saveTerm(session, termCode);
  session = await submitTerm(session, termCode);

  const firstPage = await fetchPage(session, termCode, 0);

  if (!firstPage.success) {
    throw new Error(`AUB search failed: success=false`);
  }

  const totalCount = firstPage.totalCount;
  if (totalCount === 0) {
    logger.warn({ termCode }, 'AUB sync: no sections found for term');
    return [];
  }

  const allSections: AubSection[] = firstPage.data ?? [];
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  logger.info({ totalCount, totalPages }, 'AUB sync: fetching remaining pages');

  for (let page = 1; page < totalPages; page++) {
    const pageData = await fetchPage(session, termCode, page * PAGE_SIZE);

    if (!pageData.success || !pageData.data) {
      logger.error({ page, totalCount }, 'AUB sync: failed to fetch page');
      break;
    }

    allSections.push(...pageData.data);
  }

  logger.info({ fetched: allSections.length, totalCount }, 'AUB sync: fetch complete');
  return allSections;
}

/**
 * Fetches the list of registration terms AUB currently exposes via the class
 * search `getTerms` endpoint. Each term is identified by its external numeric
 * `code` (e.g. '202710') and a human-readable `description` (e.g.
 * "Fall 2026-2027 (View Only)"). The returned list drives the term selector and
 * the per-term sync loop; no term is hardcoded here.
 */
export async function getTerms(): Promise<AubTerm[]> {
  logger.info('AUB sync: fetching available terms');
  const session = await initializeSession();

  const params = new URLSearchParams({
    searchTerm: '',
    offset: '1',
    max: '15',
    _: String(Date.now()),
  });

  const { response } = await fetchWithCookies(
    `${BASE}/ssb/classSearch/getTerms?${params}`,
    session.cookies,
  );

  const json = (await response.json()) as unknown;
  if (!Array.isArray(json)) {
    logger.warn({ payloadType: typeof json }, 'AUB sync: getTerms returned a non-array payload');
    return [];
  }

  const terms = (json as Array<{ code: string; description?: string | null }>)
    .filter((term) => term && typeof term.code === 'string' && term.code.trim() !== '')
    .map((term) => ({ code: term.code.trim(), description: term.description ?? null }));

  logger.info({ count: terms.length }, 'AUB sync: terms fetched');
  return terms;
}
