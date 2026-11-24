# Smart Voter Search

A secure, responsive web application for uploading Excel electoral roll workbooks (`.xlsx` / `.xls`), indexing thousands of voter records in memory, searching instantaneously across multiple fields, inspecting full Excel row details, viewing demographic analytics, and exporting individual voter PDF slips for authorized officers.

## Project Structure

```text
├── server.ts                        # Express server, API routes, Vite dev middleware
├── server/
│   ├── auth.ts                      # scrypt password hashing, HMAC-SHA256 Bearer sessions, RBAC
│   ├── excelParser.ts               # SheetJS (.xlsx/.xls) parser, smart header & column mapper
│   ├── searchEngine.ts              # Multi-field, phonetic, fuzzy, paginated search & filters
│   └── types.ts                     # Shared backend TypeScript definitions
├── src/
│   ├── App.tsx                      # Root application state & authorized session shell
│   ├── index.css                    # Tailwind CSS v4 theme & typography
│   ├── types.ts                     # Frontend TypeScript interfaces
│   ├── utils/pdfExport.ts           # Single-voter PDF slip generator (jsPDF)
│   └── components/
│       ├── AuthGate.tsx             # First-run admin claim & officer sign-in gate
│       ├── Header.tsx               # Navigation bar & officer session menu
│       ├── FileUploadPanel.tsx      # Drag-and-drop Excel upload, replace & purge controls
│       ├── SearchWorkspace.tsx      # Prominent search bar, live suggestions, filters, cards/table
│       ├── VoterDetailModal.tsx     # Complete original Excel row viewer & single PDF download
│       ├── DashboardView.tsx        # Voter demographics, polling stations & recent voters
│       ├── HistoryView.tsx          # Session-scoped search history & inspected voters
│       └── OfficerManagementModal.tsx # Admin account management for authorized officers
```

## Local Setup & Execution

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Optional environment configuration**

   Copy `.env.example` to `.env` if you wish to configure a shared `ADMIN_ACCESS_CODE`. When left unset, the application presents a first-run administrator setup screen on initial launch.

3. **Run in development mode**

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000` in your browser.

4. **Build and run for production**

   ```bash
   npm run build
   npm start
   ```
