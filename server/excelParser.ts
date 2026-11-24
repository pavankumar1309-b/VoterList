import crypto from 'crypto';
import * as XLSX from 'xlsx';
import type {
  CanonicalField,
  DatasetStats,
  IndexedVoterRecord,
  VoterDataset,
  WorksheetMeta,
} from './types.ts';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_ROWS_PER_SHEET = 250000;
const MAX_COLS_PER_SHEET = 120;

const FIELD_PATTERNS: Array<{ field: CanonicalField; patterns: RegExp[]; antiPatterns?: RegExp[] }> = [
  {
    field: 'voterId',
    patterns: [
      /^epic(\s*|_|-)?(no|num|number|id)?$/i,
      /^voter(\s*|_|-)?id$/i,
      /^id(\s*|_|-)?card(\s*|_|-)?(no|number)?$/i,
      /^elector(\s*|_|-)?id$/i,
      /\bepic\b/i,
      /voter\s*id/i,
    ],
  },
  {
    field: 'motherName',
    patterns: [/^mother('?s)?(\s*|_|-)?(name)?$/i, /mother\s*name/i],
  },
  {
    field: 'relativeName',
    patterns: [
      /^father('?s)?(\s*|_|-)?(name)?$/i,
      /^husband('?s)?(\s*|_|-)?(name)?$/i,
      /^father\s*\/?\s*husband('?s)?(\s*|_|-)?(name)?$/i,
      /^(guardian|relative|relation|rln)(\s*|_|-)?(name)?$/i,
      /father|husband|guardian|relative\s*name|rln_name/i,
    ],
  },
  {
    field: 'name',
    patterns: [
      /^(voter|elector|full)(\s*|_|-)?name$/i,
      /^name(\s*of\s*(voter|elector))?$/i,
      /^fm_name$/i,
    ],
    antiPatterns: [/father|mother|husband|guardian|relative|polling|station|booth|constituency|district/i],
  },
  {
    field: 'age',
    patterns: [/^age(\s*in\s*years)?$/i, /^voter(\s*|_|-)?age$/i],
  },
  {
    field: 'gender',
    patterns: [/^(gender|sex)$/i, /^voter(\s*|_|-)?(gender|sex)$/i],
  },
  {
    field: 'houseNumber',
    patterns: [
      /^house(\s*|_|-)?(no|num|number)?$/i,
      /^h(\.|\s|_|-)?no\.?$/i,
      /^door(\s*|_|-)?(no|num|number)?$/i,
      /^c_house_no$/i,
    ],
  },
  {
    field: 'address',
    patterns: [
      /^(full\s*)?address$/i,
      /^(street|locality|area|ward|village|mohalla|colony|residence)$/i,
    ],
  },
  {
    field: 'pollingStation',
    patterns: [
      /^polling(\s*|_|-)?(station|booth|center|centre)(\s*|_|-)?(name|no)?$/i,
      /^ps(\s*|_|-)?name$/i,
      /^booth(\s*|_|-)?name$/i,
    ],
  },
  {
    field: 'partNumber',
    patterns: [
      /^part(\s*|_|-)?(no|num|number)?$/i,
      /^booth(\s*|_|-)?(no|num|number)$/i,
      /^ps(\s*|_|-)?no$/i,
    ],
  },
  {
    field: 'serialNumber',
    patterns: [
      /^serial(\s*|_|-)?(no|num|number)?$/i,
      /^(s|sl)(\.|\s|_|-)?no\.?$/i,
      /^sr(\.|\s|_|-)?no\.?$/i,
    ],
  },
  {
    field: 'constituency',
    patterns: [
      /^(assembly\s*)?constituency(\s*name)?$/i,
      /^ac(\s*|_|-)?(name|no)?$/i,
      /^parliamentary(\s*|_|-)?constituency$/i,
    ],
  },
  {
    field: 'district',
    patterns: [/^district(\s*name)?$/i, /^dist$/i],
  },
];

export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function phoneticNormalize(value: string): string {
  let s = normalizeText(value);
  if (!s) return '';
  s = s
    .replace(/ph/g, 'f')
    .replace(/bh/g, 'b')
    .replace(/gh/g, 'g')
    .replace(/kh/g, 'k')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/sh/g, 's')
    .replace(/ch/g, 'c')
    .replace(/x/g, 'ks')
    .replace(/ee/g, 'i')
    .replace(/ea/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/aa/g, 'a')
    .replace(/ou/g, 'u')
    .replace(/w/g, 'v')
    .replace(/z/g, 's')
    .replace(/q/g, 'k')
    .replace(/(.)\1+/g, '$1');

  // Produce a first-letter-preserving consonant-skeleton per token for spelling variations
  return s
    .split(' ')
    .map((tok) => {
      if (tok.length <= 3) return tok;
      return tok[0] + tok.slice(1).replace(/[aeiou]/g, '');
    })
    .join(' ');
}

function classifyGender(raw: string): 'male' | 'female' | 'other' | 'unknown' {
  const norm = raw.trim().toLowerCase();
  if (!norm) return 'unknown';
  if (norm === 'm' || norm === 'male' || norm === 'man' || norm === 'boy' || norm === 'purush') {
    return 'male';
  }
  if (norm === 'f' || norm === 'female' || norm === 'woman' || norm === 'girl' || norm === 'mahila') {
    return 'female';
  }
  if (
    norm === 'o' ||
    norm === 'other' ||
    norm === 'others' ||
    norm === 't' ||
    norm === 'tg' ||
    norm === 'third gender' ||
    norm === 'transgender' ||
    norm === 'non-binary'
  ) {
    return 'other';
  }
  if (norm.startsWith('male')) return 'male';
  if (norm.startsWith('fem')) return 'female';
  return 'other';
}

function parseAge(raw: string): number | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const match = cleaned.match(/^(\d{1,3})/);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  if (Number.isNaN(n) || n < 1 || n > 130) return null;
  return n;
}

function formatCellValue(cell: XLSX.CellObject | undefined): string {
  if (!cell) return '';
  if (cell.v === undefined || cell.v === null) return '';
  if (cell.v instanceof Date) {
    if (Number.isNaN(cell.v.getTime())) return '';
    return cell.v.toISOString().slice(0, 10);
  }
  if (typeof cell.w === 'string' && cell.w.trim().length > 0) {
    return cell.w.trim();
  }
  return String(cell.v).trim();
}

function detectHeaderRow(
  ws: XLSX.WorkSheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number
): number {
  const scanLimit = Math.min(endRow, startRow + 15);
  let bestRow = startRow;
  let bestScore = -1;

  for (let r = startRow; r <= scanLimit; r++) {
    let nonEmptyCount = 0;
    let textHeaderCount = 0;
    let keywordHits = 0;

    for (let c = startCol; c <= endCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const val = formatCellValue(ws[addr]);
      if (!val) continue;
      nonEmptyCount++;
      if (!/^\d+(\.\d+)?$/.test(val)) {
        textHeaderCount++;
      }
      for (const def of FIELD_PATTERNS) {
        if (def.antiPatterns?.some((re) => re.test(val))) continue;
        if (def.patterns.some((re) => re.test(val))) {
          keywordHits++;
          break;
        }
      }
    }

    // Score prefers rows with >= 2 non-empty cells, many text headers, and voter column keyword matches
    const score = keywordHits * 10 + textHeaderCount * 2 + (nonEmptyCount >= 2 ? nonEmptyCount : 0);
    if (nonEmptyCount >= 2 && score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }

  return bestRow;
}

function detectFieldMapping(headers: string[]): Partial<Record<CanonicalField, string>> {
  const map: Partial<Record<CanonicalField, string>> = {};
  const usedHeaders = new Set<string>();

  for (const def of FIELD_PATTERNS) {
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      const trimmed = header.trim();
      if (def.antiPatterns?.some((re) => re.test(trimmed))) continue;
      if (def.patterns.some((re) => re.test(trimmed))) {
        map[def.field] = header;
        usedHeaders.add(header);
        break;
      }
    }
  }

  return map;
}

export function validateExcelBuffer(fileName: string, buffer: Buffer): string | null {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
    return 'Unsupported file format. Please upload a valid Excel file (.xlsx or .xls).';
  }
  if (buffer.length < 8) {
    return 'The uploaded file appears to be empty or corrupted.';
  }

  // Check magic bytes: XLSX (ZIP PK\x03\x04) or XLS (OLE2 \xD0\xCF\x11\xE0)
  const isZip =
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);
  const isOle2 =
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0;

  if (lower.endsWith('.xlsx') && !isZip) {
    return 'Invalid .xlsx file signature. Please upload an authentic Microsoft Excel (.xlsx) file.';
  }
  if (lower.endsWith('.xls') && !isOle2 && !isZip) {
    return 'Invalid .xls file signature. Please upload an authentic Microsoft Excel (.xls) file.';
  }

  return null;
}

export function parseVoterWorkbook(fileName: string, buffer: Buffer): VoterDataset {
  const validationError = validateExcelBuffer(fileName, buffer);
  if (validationError) {
    throw new Error(validationError);
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellHTML: false,
      cellFormula: false,
      cellStyles: false,
      cellNF: false,
      cellDates: true,
    });
  } catch {
    throw new Error('Unable to read Excel workbook. The file may be corrupted or password-protected.');
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The Excel workbook does not contain any worksheets.');
  }

  const sheets: WorksheetMeta[] = [];
  const records: IndexedVoterRecord[] = [];
  const pollingStationCounts = new Map<string, number>();

  let hasGenderData = false;
  let maleVoters = 0;
  let femaleVoters = 0;
  let otherGenderVoters = 0;
  let unspecifiedGenderVoters = 0;
  let hasPollingStationData = false;
  let hasAgeData = false;

  const ageBucketsCount = {
    '18-25': 0,
    '26-35': 0,
    '36-45': 0,
    '46-60': 0,
    '60+': 0,
    'Under 18 / Unspecified': 0,
  };

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws || !ws['!ref']) continue;

    const range = XLSX.utils.decode_range(ws['!ref']);
    const startRow = range.s.r;
    const endRow = Math.min(range.e.r, startRow + MAX_ROWS_PER_SHEET);
    const startCol = range.s.c;
    const endCol = Math.min(range.e.c, startCol + MAX_COLS_PER_SHEET);

    if (endRow <= startRow) continue;

    const headerRow = detectHeaderRow(ws, startRow, endRow, startCol, endCol);

    // Build sanitized, unique header names
    const colIndices: number[] = [];
    const headers: string[] = [];
    const seenHeaderCounts = new Map<string, number>();

    for (let c = startCol; c <= endCol; c++) {
      const addr = XLSX.utils.encode_cell({ r: headerRow, c });
      let rawHeader = formatCellValue(ws[addr]);

      if (!rawHeader) {
        // Check if column actually has any values below headerRow
        let hasValues = false;
        for (let r = headerRow + 1; r <= Math.min(endRow, headerRow + 20); r++) {
          if (formatCellValue(ws[XLSX.utils.encode_cell({ r, c })])) {
            hasValues = true;
            break;
          }
        }
        if (!hasValues) continue;
        rawHeader = `Column ${c - startCol + 1}`;
      }

      if (FORBIDDEN_KEYS.has(rawHeader.toLowerCase())) {
        rawHeader = `Field_${rawHeader}`;
      }

      const count = seenHeaderCounts.get(rawHeader) || 0;
      seenHeaderCounts.set(rawHeader, count + 1);
      const uniqueHeader = count === 0 ? rawHeader : `${rawHeader} (${count + 1})`;

      colIndices.push(c);
      headers.push(uniqueHeader);
    }

    if (headers.length === 0) continue;

    const fieldMap = detectFieldMapping(headers);
    if (fieldMap.gender) hasGenderData = true;
    if (fieldMap.pollingStation) hasPollingStationData = true;
    if (fieldMap.age) hasAgeData = true;

    let sheetRecordCount = 0;

    for (let r = headerRow + 1; r <= endRow; r++) {
      const fields: Record<string, string> = {};
      let nonEmptyFields = 0;

      for (let i = 0; i < colIndices.length; i++) {
        const c = colIndices[i];
        const header = headers[i];
        const addr = XLSX.utils.encode_cell({ r, c });
        const val = formatCellValue(ws[addr]);
        if (val.length > 0) {
          nonEmptyFields++;
        }
        fields[header] = val;
      }

      if (nonEmptyFields === 0) continue;

      const summary: Partial<Record<CanonicalField, string>> = {};
      for (const [canonical, headerKey] of Object.entries(fieldMap) as Array<
        [CanonicalField, string]
      >) {
        if (headerKey && fields[headerKey] !== undefined) {
          summary[canonical] = fields[headerKey];
        }
      }

      // Gender analytics
      let genderCategory: 'male' | 'female' | 'other' | 'unknown' = 'unknown';
      if (fieldMap.gender) {
        const rawGender = summary.gender || '';
        genderCategory = classifyGender(rawGender);
        if (genderCategory === 'male') maleVoters++;
        else if (genderCategory === 'female') femaleVoters++;
        else if (genderCategory === 'other') otherGenderVoters++;
        else unspecifiedGenderVoters++;
      }

      // Polling station analytics
      if (fieldMap.pollingStation) {
        const ps = (summary.pollingStation || '').trim();
        if (ps) {
          pollingStationCounts.set(ps, (pollingStationCounts.get(ps) || 0) + 1);
        }
      }

      // Age analytics
      const ageNum = fieldMap.age ? parseAge(summary.age || '') : null;
      if (fieldMap.age) {
        if (ageNum === null || ageNum < 18) {
          ageBucketsCount['Under 18 / Unspecified']++;
        } else if (ageNum <= 25) {
          ageBucketsCount['18-25']++;
        } else if (ageNum <= 35) {
          ageBucketsCount['26-35']++;
        } else if (ageNum <= 45) {
          ageBucketsCount['36-45']++;
        } else if (ageNum <= 60) {
          ageBucketsCount['46-60']++;
        } else {
          ageBucketsCount['60+']++;
        }
      }

      // Build normalized search strings
      const nameRaw = summary.name || '';
      const normName = normalizeText(nameRaw);
      const nameTokens = normName ? normName.split(' ') : [];
      const phoneticName = phoneticNormalize(nameRaw);
      const normVoterId = normalizeText(summary.voterId || '').replace(/\s+/g, '');
      const normHouseNumber = normalizeText(summary.houseNumber || '');
      const normRelativeName = normalizeText(summary.relativeName || '');
      const normAllText = normalizeText(Object.values(fields).join(' '));

      records.push({
        id: crypto.randomUUID(),
        sheetName,
        excelRowNumber: r + 1,
        headers,
        fields,
        summary,
        ageNum,
        genderCategory,
        normName,
        nameTokens,
        phoneticName,
        normVoterId,
        normHouseNumber,
        normRelativeName,
        normAllText,
      });

      sheetRecordCount++;
    }

    if (sheetRecordCount > 0) {
      sheets.push({
        name: sheetName,
        rowCount: sheetRecordCount,
        headerRowNumber: headerRow + 1,
        headers,
        fieldMap,
      });
    }
  }

  if (records.length === 0) {
    throw new Error(
      'No voter records could be extracted. Ensure the Excel file has column headers and data rows.'
    );
  }

  const pollingStations = Array.from(pollingStationCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const ageBuckets = hasAgeData
    ? Object.entries(ageBucketsCount)
        .filter(([, count]) => count > 0 || true)
        .map(([label, count]) => ({ label, count }))
    : [];

  const stats: DatasetStats = {
    totalVoters: records.length,
    totalRecordsImported: records.length,
    hasGenderData,
    maleVoters,
    femaleVoters,
    otherGenderVoters,
    unspecifiedGenderVoters,
    hasPollingStationData,
    totalPollingStations: pollingStations.length,
    pollingStations,
    hasAgeData,
    ageBuckets,
    sheetBreakdown: sheets.map((s) => ({
      name: s.name,
      count: s.rowCount,
      headers: s.headers,
    })),
  };

  return {
    fileName,
    uploadedAt: new Date().toISOString(),
    fileSizeBytes: buffer.length,
    sheets,
    records,
    stats,
  };
}
