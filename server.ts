import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseVoterWorkbook } from './server/excelParser.ts';
import {
  getSearchSuggestions,
  searchVoters,
  toPublicVoter,
  type SearchScope,
  type SortOption,
} from './server/searchEngine.ts';
import { attachSession, purgeSession, type SessionRequest } from './server/session.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
});

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.use(express.json({ limit: '1mb' }));

  // Security headers (iframe-compatible)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
    }
    next();
  });

  // --- Excel Upload & Search Routes (Direct Session Access, No Sign-In Required) ---
  app.post('/api/upload', attachSession, (req: SessionRequest, res) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ error: 'Excel file exceeds the 25 MB upload limit.' });
          return;
        }
        res.status(400).json({ error: 'Invalid file upload request.' });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'Please select an Excel file (.xlsx or .xls) to upload.' });
        return;
      }

      try {
        const safeFileName = path.basename(file.originalname || 'voter_list.xlsx');
        const dataset = parseVoterWorkbook(safeFileName, file.buffer);

        req.session!.dataset = dataset;
        req.session!.searchHistory = [];
        req.session!.recentVoters = [];

        res.json({
          fileName: dataset.fileName,
          uploadedAt: dataset.uploadedAt,
          fileSizeBytes: dataset.fileSizeBytes,
          sheets: dataset.sheets,
          stats: dataset.stats,
        });
      } catch (parseErr) {
        const message =
          parseErr instanceof Error ? parseErr.message : 'Failed to parse the uploaded Excel file.';
        res.status(400).json({ error: message });
      }
    });
  });

  app.get('/api/dashboard', attachSession, (req: SessionRequest, res) => {
    const session = req.session!;
    if (!session.dataset) {
      res.json({
        hasDataset: false,
        dataset: null,
        recentVoters: [],
        searchHistoryCount: 0,
      });
      return;
    }

    res.json({
      hasDataset: true,
      dataset: {
        fileName: session.dataset.fileName,
        uploadedAt: session.dataset.uploadedAt,
        fileSizeBytes: session.dataset.fileSizeBytes,
        sheets: session.dataset.sheets,
        stats: session.dataset.stats,
      },
      recentVoters: session.recentVoters,
      searchHistoryCount: session.searchHistory.length,
    });
  });

  app.get('/api/voters/suggest', attachSession, (req: SessionRequest, res) => {
    const session = req.session!;
    if (!session.dataset) {
      res.json({ suggestions: [] });
      return;
    }
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 120) : '';
    const sheet = typeof req.query.sheet === 'string' ? req.query.sheet : undefined;
    const validScopes = new Set<SearchScope>([
      'direct',
      'name',
      'voterId',
      'houseNumber',
      'relativeName',
      'all',
    ]);
    const rawScope = typeof req.query.scope === 'string' ? req.query.scope : 'direct';
    const scope: SearchScope = validScopes.has(rawScope as SearchScope)
      ? (rawScope as SearchScope)
      : 'direct';
    const suggestions = getSearchSuggestions(session.dataset, q, sheet, scope, 8);
    res.json({ suggestions });
  });

  app.get('/api/voters/search', attachSession, (req: SessionRequest, res) => {
    const session = req.session!;
    if (!session.dataset) {
      res.status(400).json({ error: 'No voter list uploaded in the current session.' });
      return;
    }

    const query = typeof req.query.q === 'string' ? req.query.q.slice(0, 150) : '';
    const validScopes = new Set<SearchScope>([
      'direct',
      'name',
      'voterId',
      'houseNumber',
      'relativeName',
      'all',
    ]);
    const rawScope = typeof req.query.scope === 'string' ? req.query.scope : 'direct';
    const scope: SearchScope = validScopes.has(rawScope as SearchScope)
      ? (rawScope as SearchScope)
      : 'direct';

    const validSorts = new Set<SortOption>([
      'relevance',
      'name_asc',
      'name_desc',
      'age_asc',
      'age_desc',
      'serial_asc',
      'row_asc',
    ]);
    const rawSort = typeof req.query.sort === 'string' ? req.query.sort : 'relevance';
    const sort: SortOption = validSorts.has(rawSort as SortOption)
      ? (rawSort as SortOption)
      : 'relevance';

    const rawGender = typeof req.query.gender === 'string' ? req.query.gender : 'all';
    const gender =
      rawGender === 'male' || rawGender === 'female' || rawGender === 'other' ? rawGender : 'all';

    const sheet = typeof req.query.sheet === 'string' ? req.query.sheet : 'all';
    const pollingStation =
      typeof req.query.pollingStation === 'string' ? req.query.pollingStation : 'all';

    const minAgeRaw = typeof req.query.minAge === 'string' ? Number.parseInt(req.query.minAge, 10) : NaN;
    const maxAgeRaw = typeof req.query.maxAge === 'string' ? Number.parseInt(req.query.maxAge, 10) : NaN;
    const pageRaw = typeof req.query.page === 'string' ? Number.parseInt(req.query.page, 10) : 1;
    const pageSizeRaw =
      typeof req.query.pageSize === 'string' ? Number.parseInt(req.query.pageSize, 10) : 24;

    const recordHistory = req.query.recordHistory === '1';

    const response = searchVoters(session.dataset, {
      query,
      scope,
      sheet,
      gender,
      pollingStation,
      minAge: Number.isNaN(minAgeRaw) ? null : minAgeRaw,
      maxAge: Number.isNaN(maxAgeRaw) ? null : maxAgeRaw,
      sort,
      page: Number.isNaN(pageRaw) ? 1 : pageRaw,
      pageSize: Number.isNaN(pageSizeRaw) ? 24 : pageSizeRaw,
    });

    if (recordHistory && query.trim().length > 0) {
      const trimmed = query.trim();
      session.searchHistory = [
        {
          id: crypto.randomUUID(),
          query: trimmed,
          scope,
          resultCount: response.totalMatches,
          timestamp: new Date().toISOString(),
        },
        ...session.searchHistory.filter(
          (item) => !(item.query.toLowerCase() === trimmed.toLowerCase() && item.scope === scope)
        ),
      ].slice(0, 25);
    }

    res.json(response);
  });

  app.get('/api/voters/:id', attachSession, (req: SessionRequest, res) => {
    const session = req.session!;
    if (!session.dataset) {
      res.status(404).json({ error: 'No active voter dataset.' });
      return;
    }

    const voterId = String(req.params.id || '');
    const record = session.dataset.records.find((r) => r.id === voterId);
    if (!record) {
      res.status(404).json({ error: 'Voter record not found.' });
      return;
    }

    const publicRecord = toPublicVoter(record);
    session.recentVoters = [
      publicRecord,
      ...session.recentVoters.filter((v) => v.id !== publicRecord.id),
    ].slice(0, 12);

    res.json({ voter: publicRecord });
  });

  app.get('/api/history', attachSession, (req: SessionRequest, res) => {
    const session = req.session!;
    res.json({
      searchHistory: session.searchHistory,
      recentVoters: session.recentVoters,
    });
  });

  app.delete('/api/history', attachSession, (req: SessionRequest, res) => {
    const session = req.session!;
    session.searchHistory = [];
    session.recentVoters = [];
    res.json({ ok: true });
  });

  app.post('/api/session/purge', attachSession, (req: SessionRequest, res) => {
    if (req.session) {
      purgeSession(req.session.sessionId);
    }
    res.json({ ok: true });
  });

  // Vite middleware in dev, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Voter Search server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err instanceof Error ? err.message : 'Unknown error');
  process.exit(1);
});
