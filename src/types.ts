export type CanonicalField =
  | 'name'
  | 'voterId'
  | 'relativeName'
  | 'motherName'
  | 'age'
  | 'gender'
  | 'houseNumber'
  | 'address'
  | 'pollingStation'
  | 'partNumber'
  | 'serialNumber'
  | 'constituency'
  | 'district';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'officer';
  createdAt?: string;
}

export interface WorksheetMeta {
  name: string;
  rowCount: number;
  headerRowNumber: number;
  headers: string[];
  fieldMap: Partial<Record<CanonicalField, string>>;
}

export interface PublicVoterRecord {
  id: string;
  sheetName: string;
  excelRowNumber: number;
  headers: string[];
  fields: Record<string, string>;
  summary: Partial<Record<CanonicalField, string>>;
}

export interface DatasetStats {
  totalVoters: number;
  totalRecordsImported: number;
  hasGenderData: boolean;
  maleVoters: number;
  femaleVoters: number;
  otherGenderVoters: number;
  unspecifiedGenderVoters: number;
  hasPollingStationData: boolean;
  totalPollingStations: number;
  pollingStations: Array<{ name: string; count: number }>;
  hasAgeData: boolean;
  ageBuckets: Array<{ label: string; count: number }>;
  sheetBreakdown: Array<{ name: string; count: number; headers: string[] }>;
}

export interface DatasetSummary {
  fileName: string;
  uploadedAt: string;
  fileSizeBytes: number;
  sheets: WorksheetMeta[];
  stats: DatasetStats;
}

export interface RecentSearchEntry {
  id: string;
  query: string;
  scope: string;
  resultCount: number;
  timestamp: string;
}

export type SearchScope = 'all' | 'name' | 'voterId' | 'houseNumber' | 'relativeName';
export type SortOption =
  | 'relevance'
  | 'name_asc'
  | 'name_desc'
  | 'age_asc'
  | 'age_desc'
  | 'serial_asc'
  | 'row_asc';

export interface SearchResponse {
  results: PublicVoterRecord[];
  totalMatches: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type ActiveTab = 'search' | 'dashboard' | 'upload' | 'history';
