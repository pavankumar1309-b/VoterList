# Smart Voter Search

A responsive web application for uploading Excel electoral roll workbooks (`.xlsx` / `.xls`), indexing thousands of voter records in memory, searching instantaneously across multiple fields, inspecting full Excel row details, viewing demographic analytics, and exporting individual voter PDF slips without requiring sign-in.

## Project Structure

```text
├── server.ts                        # Express server, API routes, Vite dev middleware
├── server/
│   ├── session.ts                   # Ephemeral in-memory session storage & purge controls
│   ├── excelParser.ts               # SheetJS (.xlsx/.xls) parser, smart header & column mapper
│   ├── searchEngine.ts              # Multi-field, phonetic, fuzzy, paginated search & filters
│   └── types.ts                     # Shared backend TypeScript definitions
├── src/
│   ├── App.tsx                      # Root application state & navigation shell
│   ├── index.css                    # Tailwind CSS v4 theme & typography
│   ├── types.ts                     # Frontend TypeScript interfaces
│   ├── utils/pdfExport.ts           # Single-voter PDF slip generator (jsPDF)
│   └── components/
│       ├── Header.tsx               # Navigation bar & session clear action
│       ├── FileUploadPanel.tsx      # Drag-and-drop Excel upload, replace & purge controls
│       ├── SearchWorkspace.tsx      # Prominent search bar, live suggestions, filters, cards/table
│       ├── VoterDetailModal.tsx     # Complete original Excel row viewer & single PDF download
│       ├── DashboardView.tsx        # Voter demographics, polling stations & recent voters
│       └── HistoryView.tsx          # Session-scoped search history & inspected voters
```

## Local Setup & Execution

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Run in development mode**

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000` in your browser.

3. **Build and run for production**

   ```bash
   npm run build
   npm start
   ```
