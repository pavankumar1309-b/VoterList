import { normalizeText, phoneticNormalize } from './excelParser.ts';
import type { IndexedVoterRecord, PublicVoterRecord, VoterDataset } from './types.ts';

export type SearchScope = 'all' | 'name' | 'voterId' | 'houseNumber' | 'relativeName';
export type SortOption =
  | 'relevance'
  | 'name_asc'
  | 'name_desc'
  | 'age_asc'
  | 'age_desc'
  | 'serial_asc'
  | 'row_asc';

export interface SearchParams {
  query: string;
  scope?: SearchScope;
  sheet?: string;
  gender?: 'all' | 'male' | 'female' | 'other';
  pollingStation?: string;
  minAge?: number | null;
  maxAge?: number | null;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface SearchResponse {
  results: PublicVoterRecord[];
  totalMatches: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function toPublicVoter(record: IndexedVoterRecord): PublicVoterRecord {
  return {
    id: record.id,
    sheetName: record.sheetName,
    excelRowNumber: record.excelRowNumber,
    headers: record.headers,
    fields: record.fields,
    summary: record.summary,
  };
}

function boundedLevenshtein(a: string, b: string, maxDist = 2): number {
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > maxDist) return maxDist + 1;
  if (a === b) return 0;

  let prev = new Array<number>(lenB + 1);
  let curr = new Array<number>(lenB + 1);
  for (let j = 0; j <= lenB; j++) prev[j] = j;

  for (let i = 1; i <= lenA; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[lenB];
}

function scoreRecord(
  record: IndexedVoterRecord,
  normQuery: string,
  compactQuery: string,
  queryTokens: string[],
  phoneticQuery: string,
  scope: SearchScope
): number {
  if (!normQuery) return 1;

  let score = 0;

  // 1. EPIC / Voter ID matching
  if (scope === 'all' || scope === 'voterId') {
    if (record.normVoterId) {
      if (record.normVoterId === compactQuery) {
        score = Math.max(score, 1000);
      } else if (record.normVoterId.startsWith(compactQuery)) {
        score = Math.max(score, 850);
      } else if (record.normVoterId.includes(compactQuery)) {
        score = Math.max(score, 650);
      }
    }
  }

  // 2. House Number matching
  if (scope === 'all' || scope === 'houseNumber') {
    if (record.normHouseNumber) {
      if (record.normHouseNumber === normQuery) {
        score = Math.max(score, 900);
      } else if (record.normHouseNumber.startsWith(normQuery)) {
        score = Math.max(score, 720);
      } else if (record.normHouseNumber.includes(normQuery)) {
        score = Math.max(score, 540);
      }
    }
  }

  // 3. Relative / Father / Husband Name matching
  if (scope === 'all' || scope === 'relativeName') {
    if (record.normRelativeName) {
      if (record.normRelativeName === normQuery) {
        score = Math.max(score, 880);
      } else if (record.normRelativeName.startsWith(normQuery)) {
        score = Math.max(score, 700);
      } else if (record.normRelativeName.includes(normQuery)) {
        score = Math.max(score, 520);
      } else if (
        queryTokens.length > 0 &&
        queryTokens.every((t) => record.normRelativeName.includes(t))
      ) {
        score = Math.max(score, 460);
      }
    }
  }

  // 4. Primary Voter Name matching (exact, prefix, substring, out-of-order tokens, phonetic, fuzzy)
  if (scope === 'all' || scope === 'name') {
    if (record.normName) {
      if (record.normName === normQuery) {
        score = Math.max(score, 980);
      } else if (record.normName.startsWith(normQuery)) {
        score = Math.max(score, 860);
      } else if (record.normName.includes(normQuery)) {
        score = Math.max(score, 740);
      } else if (
        queryTokens.length > 0 &&
        queryTokens.every((qt) =>
          record.nameTokens.some((nt) => nt.startsWith(qt) || nt.includes(qt))
        )
      ) {
        score = Math.max(score, 680);
      } else if (phoneticQuery && record.phoneticName) {
        const phoneticTokens = phoneticQuery.split(' ');
        const recordPhoneticTokens = record.phoneticName.split(' ');
        if (record.phoneticName === phoneticQuery) {
          score = Math.max(score, 600);
        } else if (record.phoneticName.includes(phoneticQuery)) {
          score = Math.max(score, 500);
        } else if (
          phoneticTokens.length > 0 &&
          phoneticTokens.every((pt) =>
            recordPhoneticTokens.some((rpt) => rpt.startsWith(pt) || (pt.length >= 4 && rpt.includes(pt)))
          )
        ) {
          score = Math.max(score, 440);
        }
      }

      // Token-level bounded edit distance for minor typos (tokens length >= 4)
      if (score === 0 && queryTokens.length > 0 && queryTokens.length <= 4 && record.nameTokens.length > 0) {
        let matchedFuzzyTokens = 0;
        for (const qt of queryTokens) {
          if (qt.length < 3) continue;
          const maxDist = qt.length >= 6 ? 2 : 1;
          const matched = record.nameTokens.some((nt) => {
            if (nt.includes(qt)) return true;
            return boundedLevenshtein(qt, nt, maxDist) <= maxDist;
          });
          if (matched) matchedFuzzyTokens++;
        }
        if (matchedFuzzyTokens === queryTokens.filter((t) => t.length >= 3).length && matchedFuzzyTokens > 0) {
          score = Math.max(score, 320);
        }
      }
    }
  }

  // 5. Fallback across all columns when scope is 'all'
  if (score === 0 && scope === 'all') {
    if (record.normAllText.includes(normQuery)) {
      score = 260;
    } else if (queryTokens.length > 1 && queryTokens.every((t) => record.normAllText.includes(t))) {
      score = 220;
    }
  }

  return score;
}

function parseSerial(raw: string | undefined): number {
  if (!raw) return Number.MAX_SAFE_INTEGER;
  const n = Number.parseInt(raw.replace(/\D+/g, ''), 10);
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
}

export function searchVoters(dataset: VoterDataset, params: SearchParams): SearchResponse {
  const scope: SearchScope = params.scope || 'all';
  const normQuery = normalizeText(params.query || '');
  const compactQuery = normQuery.replace(/\s+/g, '');
  const queryTokens = normQuery ? normQuery.split(' ') : [];
  const phoneticQuery = phoneticNormalize(params.query || '');

  const sheetFilter = params.sheet && params.sheet !== 'all' ? params.sheet : null;
  const genderFilter = params.gender && params.gender !== 'all' ? params.gender : null;
  const psFilter =
    params.pollingStation && params.pollingStation !== 'all'
      ? params.pollingStation.trim().toLowerCase()
      : null;
  const minAge = typeof params.minAge === 'number' && !Number.isNaN(params.minAge) ? params.minAge : null;
  const maxAge = typeof params.maxAge === 'number' && !Number.isNaN(params.maxAge) ? params.maxAge : null;

  const scored: Array<{ record: IndexedVoterRecord; score: number }> = [];

  for (let i = 0; i < dataset.records.length; i++) {
    const rec = dataset.records[i];

    if (sheetFilter && rec.sheetName !== sheetFilter) continue;
    if (genderFilter && rec.genderCategory !== genderFilter) continue;
    if (psFilter && (rec.summary.pollingStation || '').trim().toLowerCase() !== psFilter) continue;
    if (minAge !== null && (rec.ageNum === null || rec.ageNum < minAge)) continue;
    if (maxAge !== null && (rec.ageNum === null || rec.ageNum > maxAge)) continue;

    if (!normQuery) {
      scored.push({ record: rec, score: 1 });
      continue;
    }

    const s = scoreRecord(rec, normQuery, compactQuery, queryTokens, phoneticQuery, scope);
    if (s > 0) {
      scored.push({ record: rec, score: s });
    }
  }

  const sortBy = params.sort || (normQuery ? 'relevance' : 'row_asc');

  scored.sort((a, b) => {
    switch (sortBy) {
      case 'name_asc':
        return (a.record.summary.name || '').localeCompare(b.record.summary.name || '');
      case 'name_desc':
        return (b.record.summary.name || '').localeCompare(a.record.summary.name || '');
      case 'age_asc':
        return (a.record.ageNum ?? 999) - (b.record.ageNum ?? 999);
      case 'age_desc':
        return (b.record.ageNum ?? -1) - (a.record.ageNum ?? -1);
      case 'serial_asc':
        return parseSerial(a.record.summary.serialNumber) - parseSerial(b.record.summary.serialNumber);
      case 'row_asc':
        return a.record.excelRowNumber - b.record.excelRowNumber;
      case 'relevance':
      default:
        if (b.score !== a.score) return b.score - a.score;
        return a.record.excelRowNumber - b.record.excelRowNumber;
    }
  });

  const pageSize = Math.min(Math.max(params.pageSize || 24, 1), 100);
  const totalMatches = scored.length;
  const totalPages = Math.max(1, Math.ceil(totalMatches / pageSize));
  const page = Math.min(Math.max(params.page || 1, 1), totalPages);
  const start = (page - 1) * pageSize;

  return {
    results: scored.slice(start, start + pageSize).map((item) => toPublicVoter(item.record)),
    totalMatches,
    page,
    pageSize,
    totalPages,
  };
}

export function getSearchSuggestions(
  dataset: VoterDataset,
  query: string,
  sheet?: string,
  limit = 8
): PublicVoterRecord[] {
  const normQuery = normalizeText(query);
  if (!normQuery || normQuery.length < 2) return [];

  const res = searchVoters(dataset, {
    query,
    scope: 'all',
    sheet,
    sort: 'relevance',
    page: 1,
    pageSize: limit,
  });

  return res.results;
}
