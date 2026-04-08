# VCP Markdown Editor

A mobile-first collaborative markdown editor backed by Google Drive, built for document review workflows at Value Capture Partners. Supports real-time track changes, inline comments, AI-assisted content capture, and a Kanban board — all stored as plain `.md` files in your Drive.

---

## Features

### Rich-Text Editing
- **WYSIWYG preview editor** (Tiptap) as the default editing surface — no raw markdown required
- **Source editor** (CodeMirror 6) with syntax highlighting, line numbers, and markdown language support
- **Split view** on desktop: raw markdown left, rendered preview right
- Inline **bubble menu** when text is selected: bold, italic, highlight, insert, delete, comment

### Track Changes (CriticMarkup)
Full implementation of the [CriticMarkup](https://criticmarkup.com/) standard:

| Markup | Meaning |
|--------|---------|
| `{++ text ++}` | Insertion — shown in green |
| `{-- text --}` | Deletion — red strikethrough |
| `{~~ old ~> new ~~}` | Substitution |
| `{== text ==}` | Highlight — yellow background |
| `{>> @handle (YYYY-MM-DD): text <<}` | Comment |

- **Track mode** — toggle on to automatically wrap every edit in CriticMarkup as you type
- **Accept All / Reject All** — process all pending changes in one click and save a clean file
- Auto-detects CriticMarkup in loaded files and activates the track-changes UI

### Inline Comments
- Select text and tap 💬 to anchor a comment to that passage
- Auto-populates author from your Google account
- Renders as Google Docs-style inline badges in preview

### Google Drive Integration
- Lazy-loaded folder tree for My Drive and all Shared Drives
- Open, edit, and save `.md` files directly — no download/upload cycle
- Create new files from within the app
- Auto-saves 2 seconds after the last keystroke; manual save via **Cmd/Ctrl+S**
- Save status indicator (Unsaved → Saving… → Saved)

### Kanban Board
- Automatically finds all `board.md` files across your Drive
- Parses task checklist syntax into a drag-and-drop 3-column board (Backlog → Active → Done)
- Filter by owner, board, or due date (overdue / this week / later / none)
- Edits write back to the source `.md` file in Drive

**Task syntax:**
```markdown
- [ ] Task description | owner:name | priority:high | status:backlog | due:2026-04-15
- [x] Completed task | owner:name | status:done ✅ 2026-04-15
```

### AI Capture (Gemini)
A quick-capture screen for notes, meeting recaps, and dictation:
- Paste, type, or dictate raw text
- Processed by Gemini (Vertex AI) to clean grammar, structure as markdown, suggest context, and detect tasks
- Saves automatically to `/vcp/inbox/` with frontmatter metadata (context, author, timestamp, source)

### Progressive Web App
- Installable on desktop and mobile (standalone display mode)
- Service worker for offline access to cached documents
- Works on iOS Safari, Android Chrome, and all modern desktop browsers

### Responsive / Mobile-First
- Optimized for phones and tablets — default view is full-screen preview
- Sidebar collapses to a modal on mobile; header stays minimal
- All touch targets meet 44px minimum

### Dark / Light Theme
- Toggle between dark and light mode
- Persisted in `localStorage`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + Vite 8 |
| WYSIWYG editor | Tiptap 2 |
| Source editor | CodeMirror 6 |
| Markdown parsing | Marked 17 |
| Drag & drop | @dnd-kit |
| Auth | Google Identity Services (OAuth2) |
| Storage | Google Drive API v3 |
| AI | Vertex AI / Gemini Flash |
| PWA | vite-plugin-pwa |
| Tests | Vitest + jsdom |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Google Cloud project with the following APIs enabled:
  - Google Drive API
  - Vertex AI API (for Gemini capture)
- OAuth2 credentials (Web Application type) with your dev and production domains added as authorized origins

### Install

```bash
git clone git@github.com:valuecapturepartners/markdown-viewer.git
cd markdown-viewer
npm install
```

### Environment

Create a `.env.local` file in the project root:

```env
VITE_GOOGLE_CLIENT_ID=<your-oauth-client-id>
VITE_GOOGLE_API_KEY=<your-google-api-key>
VITE_GOOGLE_APP_ID=<your-google-cloud-project-number>
```

### Run

```bash
npm run dev        # Start dev server at http://localhost:5173
npm run build      # Production build → dist/
npm run preview    # Preview production build locally
npm run test       # Run test suite
npm run lint       # Lint
```

---

## Drive Folder Structure

The app expects the following layout in your Drive (My Drive or a Shared Drive named "VCP"):

```
/vcp/
├── inbox/        ← AI Capture saves here
├── clients/      ← Client/engagement folders (shown as capture contexts)
├── ops/
├── brain/
├── templates/
└── seed/
```

`board.md` files can live anywhere — the Kanban screen searches for them by filename across all drives.

---

## Project Structure

```
src/
├── auth/               # Google OAuth2 context & login UI
├── editor/             # Main editor (Tiptap + CodeMirror), toolbar, dialogs
├── kanban/             # Kanban board, columns, cards, task parser
├── capture/            # AI capture screen & Gemini API wrapper
├── drive/              # Google Drive API helpers & folder browser
├── criticmarkup/       # CriticMarkup parser, Marked plugin, Tiptap extensions
├── hooks/              # useTheme
├── pwa/                # Service worker registration
└── styles/             # CSS custom properties, theme, per-feature stylesheets
```

---

## Testing

Unit tests cover the core parsing and serialization logic:

```bash
npm test
```

- `criticmarkup/marked-plugin.test.js` — CriticMarkup rendering
- `criticmarkup/track-changes.test.js` — Auto-wrap behavior
- `criticmarkup/roundtrip.test.js` — Markdown round-trip fidelity
- `kanban/board-parser.test.js` — Task checklist parsing
- `editor/tiptap-serializer.test.js` — Tiptap JSON → Markdown conversion

---

## License

Private — Value Capture Partners
