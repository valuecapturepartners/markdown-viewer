import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "../hooks/useTheme.js";
import { useAuth } from "../auth/auth-context.jsx";
import CodeMirrorPane from "./CodeMirrorPane.jsx";
import TiptapPane from "./TiptapPane.jsx";
import Toolbar from "./Toolbar.jsx";
import CommentDialog from "./CommentDialog.jsx";
import NewFileDialog from "./NewFileDialog.jsx";
import FolderBrowser from "../drive/FolderBrowser.jsx";
import { readFile, saveFile, getFileMetadata } from "../drive/drive-api.js";
import {
  hasCriticMarkup,
  acceptAll,
  rejectAll,
} from "../criticmarkup/syntax.js";
import HelpPanel from "./HelpPanel.jsx";
import HomeScreen, { pushRecent } from "./HomeScreen.jsx";

const LAST_FILE_KEY = "vcp_last_file";

export default function Editor({ onOpenCapture, onOpenKanban, hideSidebar, onBack, fileToOpen }) {
  const { accessToken, userInfo, signOut } = useAuth();
  // eslint-disable-next-line no-unused-vars
  const editorRef = useRef(null);
  const tiptapRef = useRef(null);
  const autosaveTimer = useRef(null);

  const [content, setContent] = useState("");
  const [currentFile, setCurrentFile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LAST_FILE_KEY));
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

  // Reload last open file on mount; also handles ?file=<id> deep-links.
  // Skipped on mobile — MobileShell manages the open file via the fileToOpen prop.
  useEffect(() => {
    if (hideSidebar) return;
    const urlFileId = new URLSearchParams(location.search).get('file');
    const stored = (() => {
      try { return JSON.parse(localStorage.getItem(LAST_FILE_KEY)); } catch { return null; }
    })();
    const fileId = urlFileId || stored?.id;
    if (!fileId) return;
    const load = async () => {
      try {
        let name = stored?.id === fileId ? stored?.name : null;
        if (!name) {
          const meta = await getFileMetadata(accessToken, fileId);
          name = meta.name;
        }
        const text = await readFile(accessToken, fileId);
        setContent(text);
        setCurrentFile({ id: fileId, name });
        setIsTracking(hasCriticMarkup(text));
        localStorage.setItem(LAST_FILE_KEY, JSON.stringify({ id: fileId, name }));
        pushRecent({ id: fileId, name });
        history.replaceState(null, '', '?file=' + fileId);
      } catch {
        setCurrentFile(null);
        localStorage.removeItem(LAST_FILE_KEY);
      }
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When mobile shell picks a file, load it
  useEffect(() => {
    if (!fileToOpen?.id || !accessToken) return;
    readFile(accessToken, fileToOpen.id)
      .then((text) => {
        setContent(text);
        setCurrentFile({ id: fileToOpen.id, name: fileToOpen.name });
        setIsTracking(hasCriticMarkup(text));
        localStorage.setItem(LAST_FILE_KEY, JSON.stringify({ id: fileToOpen.id, name: fileToOpen.name }));
        pushRecent({ id: fileToOpen.id, name: fileToOpen.name });
        history.replaceState(null, '', '?file=' + fileToOpen.id);
        setSaveStatus("");
      })
      .catch(() => {
        setContent("");
        setCurrentFile({ id: fileToOpen.id, name: fileToOpen.name });
      });
  }, [fileToOpen?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        localStorage.setItem(LAST_FILE_KEY, JSON.stringify({ id, name }));
        pushRecent({ id, name });
        history.replaceState(null, '', '?file=' + id);
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
      localStorage.setItem(LAST_FILE_KEY, JSON.stringify({ id, name }));
      pushRecent({ id, name });
      history.replaceState(null, '', '?file=' + id);
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
      typeof selText === "string"
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
          <button
            className="app-title desktop-only"
            onClick={() => {
              setCurrentFile(null);
              setContent("");
              localStorage.removeItem(LAST_FILE_KEY);
              history.replaceState(null, '', location.pathname);
            }}
            title="Home"
          >VCP MD</button>
          {hideSidebar ? (
            onBack && (
              <button className="mobile-back-btn" onClick={onBack} title="Back to files">
                ← Files
              </button>
            )
          ) : (
            <button
              className={`toolbar-btn sidebar-toggle ${sidebarOpen ? "active" : ""}`}
              onClick={() => setSidebarOpen((v) => !v)}
              title="Toggle file browser"
            >
              Files
            </button>
          )}
          {onOpenCapture && (
            <button
              className="toolbar-btn toolbar-btn-capture desktop-only"
              onClick={onOpenCapture}
              title="Dictate or paste → Gemini cleans it up"
            >
              ✨ Capture
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
        {!hideSidebar && sidebarOpen && (
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

        {!currentFile && !hideSidebar ? (
          <HomeScreen
            onFilePicked={handleFilePicked}
            onToggleSidebar={() => setSidebarOpen(true)}
          />
        ) : (
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
        )}
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
