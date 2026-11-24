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

export interface IndexedVoterRecord extends PublicVoterRecord {
  ageNum: number | null;
  genderCategory: 'male' | 'female' | 'other' | 'unknown';
  normName: string;
  nameTokens: string[];
  phoneticName: string;
  normVoterId: string;
  normHouseNumber: string;
  normRelativeName: string;
  normAllText: string;
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

export interface VoterDataset {
  fileName: string;
  uploadedAt: string;
  fileSizeBytes: number;
  sheets: WorksheetMeta[];
  records: IndexedVoterRecord[];
  stats: DatasetStats;
}

export interface RecentSearchEntry {
  id: string;
  query: string;
  scope: string;
  resultCount: number;
  timestamp: string;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'officer';
  createdAt: string;
}

export interface SessionState {
  tokenId: string;
  userId: string;
  username: string;
  displayName: string;
  role: 'admin' | 'officer';
  createdAt: number;
  expiresAt: number;
  dataset: VoterDataset | null;
  searchHistory: RecentSearchEntry[];
  recentVoters: PublicVoterRecord[];
}
