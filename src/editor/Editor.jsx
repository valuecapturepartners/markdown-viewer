import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "../hooks/useTheme.js";
import { useAuth } from "../auth/auth-context.jsx";
import CodeMirrorPane from "./CodeMirrorPane.jsx";
import TiptapPane from "./TiptapPane.jsx";
import Toolbar from "./Toolbar.jsx";
import CommentDialog from "./CommentDialog.jsx";
import NewFileDialog from "./NewFileDialog.jsx";
import FolderBrowser from "../drive/FolderBrowser.jsx";
import { readFile, saveFile } from "../drive/drive-api.js";
import {
  hasCriticMarkup,
  acceptAll,
  rejectAll,
} from "../criticmarkup/syntax.js";
import HelpPanel from "./HelpPanel.jsx";

const WELCOME = `# VCP Markdown Editor

A mobile-first collaborative review editor backed by Google Drive.

---

## Getting started

1. **Open a file** — tap ☰ to open the file browser, navigate your Drive or shared drives, and tap any \`.md\` file.
2. **Edit** — the preview pane is your main editing surface. Tap anywhere to start writing.
3. **Save** — edits are auto-saved 2 seconds after you stop typing. Tap **Save** in the header to save immediately. Use **Cmd/Ctrl + S** on desktop.

---

## Views

| Button | Mode | Description |
|--------|------|-------------|
| Split | Side by side | Raw markdown on the left, rendered preview on the right |
| Editor | Source only | Full-screen raw markdown (CodeMirror) |
| Review | Preview only | Full-screen rendered preview — **primary editing surface** |

On mobile the view switches to Review by default. Use the tab bar at the bottom to switch modes.

---

## Review & track changes

### Inline markup (bubble menu)
Select any text in the preview to reveal the floating toolbar:

- **💬** — add a comment anchored to the selection
- **H** — highlight the selection {== like this ==}
- **+** — mark as insertion {++ like this ++}
- **−** — mark as deletion {-- like this --}
- **B / I** — bold / italic

### Track changes mode
Toggle **Track** in the toolbar (or the Track tab on mobile). While active, every edit you make is automatically wrapped in CriticMarkup when you finish a paragraph:

- New words → {++ inserted ++}
- Removed words → {-- deleted --}
- Replaced words → {~~ old ~> new ~~}

### Comments
Tap **💬** in the toolbar or select text and tap 💬 in the bubble menu. Enter your handle and comment text. Comments are stored as {>> @handle (date): text <<} and shown as an inline badge.

---

## CriticMarkup reference

\`\`\`
{++ inserted text ++}
{-- deleted text --}
{== highlighted text ==}
{~~ old text ~> new text ~~}
{>> @handle (2026-04-07): comment text <<}
\`\`\`

---

## File browser

- Tap **☰** to toggle the sidebar
- Tap **▸** next to a folder to expand it (lazy-loaded)
- Tap a file name to open it
- Tap **New** in the header to create a new \`.md\` file in the current folder
- Shared drives appear alongside My Drive at the root level

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + S | Save |
| Cmd/Ctrl + B | Bold |
| Cmd/Ctrl + I | Italic |

---

*Powered by Tiptap · Google Drive API · CriticMarkup*
`;

const LAST_FILE_KEY = "vcp_last_file";

export default function Editor({ onOpenCapture, onOpenKanban }) {
  const { accessToken, userInfo, signOut } = useAuth();
  // eslint-disable-next-line no-unused-vars
  const editorRef = useRef(null);
  const tiptapRef = useRef(null);
  const autosaveTimer = useRef(null);

  const [content, setContent] = useState(WELCOME);
  const [currentFile, setCurrentFile] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(LAST_FILE_KEY));
    } catch {
      return null;
    }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [viewMode, setViewMode] = useState("preview");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isNewFileOpen, setIsNewFileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentBrowseFolder, setCurrentBrowseFolder] = useState(null);
  const [refreshTarget, setRefreshTarget] = useState(null);
  const currentBrowseFolderRef = useRef(null);
  useEffect(() => { currentBrowseFolderRef.current = currentBrowseFolder; }, [currentBrowseFolder]);
  const [showHelp, setShowHelp] = useState(false);
  const [darkMode, setDarkMode] = useTheme();

  // Sidebar resize
  const SIDEBAR_MIN = 160;
  const SIDEBAR_MAX = 480;
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem("vcp_sidebar_w"), 10);
    return saved > 0 ? saved : 220;
  });
  const resizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, w: 0 });

  const sidebarWidthRef = useRef(sidebarWidth);
  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    document.body.classList.add("sidebar-resizing");
    resizingRef.current = true;
    resizeStartRef.current = { x: e.clientX, w: sidebarWidthRef.current };

    const onMove = (ev) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizeStartRef.current.x;
      const next = Math.min(
        SIDEBAR_MAX,
        Math.max(SIDEBAR_MIN, resizeStartRef.current.w + delta),
      );
      setSidebarWidth(next);
    };
    const onUp = () => {
      resizingRef.current = false;
      document.body.classList.remove("sidebar-resizing");
      localStorage.setItem("vcp_sidebar_w", String(sidebarWidthRef.current));
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);
  const [isTracking, setIsTracking] = useState(false);

  // Reload last open file on mount
  useEffect(() => {
    const stored = (() => {
      try {
        return JSON.parse(sessionStorage.getItem(LAST_FILE_KEY));
      } catch {
        return null;
      }
    })();
    if (stored?.id) {
      readFile(accessToken, stored.id)
        .then((text) => {
          setContent(text);
          setIsTracking(hasCriticMarkup(text));
        })
        .catch(() => {
          setCurrentFile(null);
          sessionStorage.removeItem(LAST_FILE_KEY);
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Autosave: 2 s after last content change (only when a file is open)
  useEffect(() => {
    if (!currentFile) return;
    setSaveStatus("Unsaved");
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => handleSave(), 2000);
    return () => clearTimeout(autosaveTimer.current);
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl+S / Cmd+S
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const handleFilePicked = useCallback(
    async ({ id, name }) => {
      try {
        const text = await readFile(accessToken, id);
        setContent(text);
        setCurrentFile({ id, name });
        setIsTracking(hasCriticMarkup(text));
        sessionStorage.setItem(LAST_FILE_KEY, JSON.stringify({ id, name }));
        setSaveStatus("");
      } catch (err) {
        alert(`Failed to open file: ${err.message}`);
      }
    },
    [accessToken],
  );

  const handleSave = useCallback(async () => {
    if (!currentFile) return;
    setIsSaving(true);
    setSaveStatus("Saving…");
    try {
      await saveFile(accessToken, currentFile.id, content);
      setSaveStatus("Saved");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (err) {
      setSaveStatus("Save failed");
      alert(`Failed to save: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [accessToken, currentFile, content]);

  const handleAcceptAll = useCallback(async () => {
    const clean = acceptAll(content);
    setContent(clean);
    setIsTracking(false);
    tiptapRef.current?.forceContent(clean);
    if (currentFile) {
      setIsSaving(true);
      setSaveStatus("Saving…");
      try {
        await saveFile(accessToken, currentFile.id, clean);
        setSaveStatus("Saved");
        setTimeout(() => setSaveStatus(""), 2000);
      } catch (err) {
        setSaveStatus("Save failed");
        alert(`Failed to save: ${err.message}`);
      } finally {
        setIsSaving(false);
      }
    }
  }, [content, currentFile, accessToken]);

  const handleRejectAll = useCallback(async () => {
    const clean = rejectAll(content);
    setContent(clean);
    setIsTracking(false);
    tiptapRef.current?.forceContent(clean);
    if (currentFile) {
      setIsSaving(true);
      setSaveStatus("Saving…");
      try {
        await saveFile(accessToken, currentFile.id, clean);
        setSaveStatus("Saved");
        setTimeout(() => setSaveStatus(""), 2000);
      } catch (err) {
        setSaveStatus("Save failed");
        alert(`Failed to save: ${err.message}`);
      } finally {
        setIsSaving(false);
      }
    }
  }, [content, currentFile, accessToken]);

  const handleFileCreated = useCallback(
    async ({ id, name }) => {
      try {
        const text = await readFile(accessToken, id);
        setContent(text);
      } catch {
        setContent("");
      }
      setCurrentFile({ id, name });
      sessionStorage.setItem(LAST_FILE_KEY, JSON.stringify({ id, name }));
      setSaveStatus("");
      // Refresh the parent folder in the tree so the new file appears
      const folder = currentBrowseFolderRef.current;
      if (folder?.id) {
        setRefreshTarget({ id: folder.id, key: Date.now() });
      }
    },
    [accessToken],
  );

  const openCommentDialog = (selText) => {
    const sel =
      selText !== undefined
        ? selText
        : tiptapRef.current?.getSelection() ||
          editorRef.current?.getSelection() ||
          "";
    setSelectedText(sel);
    setIsCommentOpen(true);
  };

  const handleCommentInsert = (markup, handle, commentText) => {
    if (tiptapRef.current) {
      // Tiptap is active: insert as a proper CriticComment node
      tiptapRef.current.insertComment({
        author: handle || userInfo?.name?.split(" ")[0]?.toLowerCase() || "",
        date: new Date().toISOString().split("T")[0],
        text: commentText || "",
        selectedText,
      });
    } else if (editorRef.current) {
      editorRef.current.insertText(markup);
    } else {
      setContent((prev) => {
        if (selectedText && prev.includes(selectedText))
          return prev.replace(selectedText, markup);
        return prev + "\n" + markup;
      });
    }
    setIsCommentOpen(false);
    setSelectedText("");
  };

  const effectiveView = isMobile && viewMode === "split" ? "preview" : viewMode;

  return (
    <div className="editor-shell">
      {/* Header */}
      <header className="editor-header">
        <div className="header-left">
          <span className="app-title desktop-only">VCP MD</span>
          <button
            className={`toolbar-btn sidebar-toggle ${sidebarOpen ? "active" : ""}`}
            onClick={() => setSidebarOpen((v) => !v)}
            title="Toggle file browser"
          >
            Files
          </button>
          {onOpenCapture && (
            <button
              className="toolbar-btn desktop-only"
              onClick={onOpenCapture}
              title="Go to Capture / Dump screen"
            >
              Capture
            </button>
          )}
          {onOpenKanban && (
            <button
              className="toolbar-btn desktop-only"
              onClick={onOpenKanban}
              title="Kanban board"
            >
              Board
            </button>
          )}
          <button
            className="toolbar-btn desktop-only"
            onClick={() => {
              if (currentBrowseFolder) setCurrentBrowseFolder(currentBrowseFolder);
              setIsNewFileOpen(true);
            }}
            title="New file in current folder"
          >
            New
          </button>
          {currentFile && (
            <span className="file-name" title={currentFile.name}>
              {currentFile.name}
            </span>
          )}
        </div>

        <div className="header-center">
          <Toolbar
            editorRef={editorRef}
            onComment={openCommentDialog}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            isMobile={isMobile}
            isTracking={isTracking}
            onTrackingChange={setIsTracking}
          />
        </div>

        <div className="header-right">
          {/* Mobile-only: Track + Comment in header */}
          <button
            className={`toolbar-btn mobile-only ${isTracking ? "active tracking-active" : ""}`}
            onClick={() => setIsTracking((v) => !v)}
            title={isTracking ? "Tracking on" : "Track changes"}
          >
            Track
          </button>
          <button
            className="toolbar-btn comment-btn mobile-only"
            onClick={() => openCommentDialog()}
            title="Add comment"
          >
            Comment
          </button>

          {isTracking && hasCriticMarkup(content) && (
            <>
              <button
                className="toolbar-btn accept-btn"
                onClick={handleAcceptAll}
                title="Accept all changes and save"
              >
                Accept
              </button>
              <button
                className="toolbar-btn reject-btn"
                onClick={handleRejectAll}
                title="Reject all changes and save"
              >
                Reject
              </button>
            </>
          )}
          {saveStatus && <span className="save-status">{saveStatus}</span>}
          {currentFile && (
            <button
              className="toolbar-btn save-btn"
              onClick={handleSave}
              disabled={isSaving}
            >
              Save
            </button>
          )}
          {userInfo?.picture && (
            <img
              src={userInfo.picture}
              alt={userInfo.name}
              className="user-avatar desktop-only"
              title={userInfo.name}
            />
          )}
          <button
            className="toolbar-btn theme-btn desktop-only"
            onClick={() => setDarkMode((d) => !d)}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? "Light" : "Dark"}
          </button>
          <button
            className="toolbar-btn desktop-only"
            onClick={() => setShowHelp(true)}
            title="Help"
          >
            Help
          </button>
          <button className="toolbar-btn desktop-only" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {/* Editor body */}
      <div className="editor-main">
        {sidebarOpen && (
          <>
            {isMobile && (
              <div
                className="sidebar-backdrop"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            <FolderBrowser
              currentFileId={currentFile?.id}
              onFilePicked={handleFilePicked}
              onNewFileInFolder={(folder) => {
                if (folder) setCurrentBrowseFolder(folder);
                setIsNewFileOpen(true);
              }}
              onFolderChange={setCurrentBrowseFolder}
              refreshTarget={refreshTarget}
              isMobile={isMobile}
              onClose={() => setSidebarOpen(false)}
              width={isMobile ? undefined : sidebarWidth}
              onResizeStart={isMobile ? undefined : handleResizeStart}
            />
          </>
        )}

        <div className={`editor-body view-${effectiveView}`}>
          {(effectiveView === "split" || effectiveView === "editor") && (
            <div className="editor-pane">
              <CodeMirrorPane
                ref={editorRef}
                content={content}
                onChange={setContent}
                darkMode={darkMode}
              />
            </div>
          )}
          {(effectiveView === "split" || effectiveView === "preview") && (
            <div className="preview-pane">
              <TiptapPane
                ref={tiptapRef}
                content={content}
                onChange={setContent}
                onCommentRequest={openCommentDialog}
                tracking={isTracking}
                author={
                  userInfo?.email?.split("@")[0] ||
                  userInfo?.name
                    ?.split(" ")
                    .map((p) => p[0].toLowerCase())
                    .join("") ||
                  ""
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Comment dialog */}
      {isCommentOpen && (
        <CommentDialog
          selectedText={selectedText}
          onInsert={handleCommentInsert}
          onClose={() => {
            setIsCommentOpen(false);
            setSelectedText("");
          }}
        />
      )}

      {/* New file dialog */}
      {isNewFileOpen && (
        <NewFileDialog
          currentFolder={currentBrowseFolder}
          onCreated={handleFileCreated}
          onClose={() => setIsNewFileOpen(false)}
        />
      )}

      {/* Help panel */}
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
    </div>
  );
}
