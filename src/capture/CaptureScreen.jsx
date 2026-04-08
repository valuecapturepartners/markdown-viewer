import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/auth-context.jsx";
import {
  findVCPFolders,
  listEngagements,
  saveToFolder,
} from "../drive/drive-api.js";
import { processCapture } from "./gemini-api.js";

const STATIC_CONTEXTS = [
  { id: "ops", label: "Ops" },
  { id: "brain", label: "Brain" },
  { id: "other", label: "Other" },
];

function buildFilename(context, source) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5).replace(":", "-");
  return `${date}-${time}-${context}-${source}.md`;
}

function buildFrontmatter(fields) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (v)
      lines.push(
        `${k}: ${typeof v === "string" && v.includes(":") ? `"${v}"` : v}`,
      );
  }
  lines.push("---", "");
  return lines.join("\n");
}

function deriveAuthor(userInfo) {
  if (!userInfo) return "unknown";
  return (userInfo.given_name || userInfo.name || "")
    .split(" ")[0]
    .toLowerCase();
}

export default function CaptureScreen({ onOpenEditor, onOpenKanban }) {
  const { accessToken, userInfo } = useAuth();
  const textRef = useRef(null);

  // VCP folder IDs
  const [vcpFolders, setVcpFolders] = useState(null);
  const [vcpError, setVcpError] = useState(null);

  // Context options (dynamic engagements + static)
  const [contexts, setContexts] = useState(STATIC_CONTEXTS);
  const [selectedContext, setSelectedContext] = useState("other");

  // Form state
  const [rawText, setRawText] = useState("");
  const [type, setType] = useState("note"); // 'note' | 'content+task'
  const [taskTitle, setTaskTitle] = useState("");
  const [source, setSource] = useState("manual"); // updated to 'paste' on paste event

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveConfirmation, setSaveConfirmation] = useState("");
  const [geminiError, setGeminiError] = useState("");

  // Load VCP folders and engagements on mount
  useEffect(() => {
    findVCPFolders(accessToken)
      .then(async (folders) => {
        setVcpFolders(folders);
        if (folders.engagementsId) {
          const engagements = await listEngagements(
            accessToken,
            folders.engagementsId,
          );
          const engCtx = engagements.map((e) => ({
            id: e.name,
            label: formatSlug(e.name),
          }));
          setContexts([...engCtx, ...STATIC_CONTEXTS]);
          if (engCtx.length > 0) setSelectedContext(engCtx[0].id);
        }
      })
      .catch((err) => setVcpError(err.message));
  }, [accessToken]);

  // Detect paste to set source
  const handlePaste = () => {
    setSource("paste");
  };

  const handleProcessWithGemini = useCallback(async () => {
    if (!rawText.trim()) return;
    setIsProcessing(true);
    setGeminiError("");
    try {
      const result = await processCapture(accessToken, rawText, contexts);
      setRawText(result.cleaned_content);
      if (result.suggested_context) {
        const match = contexts.find((c) => c.id === result.suggested_context);
        if (match) setSelectedContext(match.id);
      }
      if (result.suggested_type) setType(result.suggested_type);
      if (result.task_title) setTaskTitle(result.task_title);
      setSource("dictation"); // Gemini processed = dictation flow
    } catch (err) {
      setGeminiError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [accessToken, rawText, contexts]);

  const handleSave = useCallback(async () => {
    if (!rawText.trim()) return;
    if (!vcpFolders) {
      alert(
        "VCP inbox folder not found. Make sure /vcp/inbox/ exists in your Drive.",
      );
      return;
    }
    setIsSaving(true);
    try {
      const author = deriveAuthor(userInfo);
      const captured = new Date().toISOString();
      const frontmatter = buildFrontmatter({
        context: selectedContext,
        type,
        ...(type === "content+task" && taskTitle
          ? { task_title: taskTitle }
          : {}),
        author,
        captured,
        source,
      });
      const content = frontmatter + rawText;
      const filename = buildFilename(selectedContext, source);
      await saveToFolder(accessToken, vcpFolders.inboxId, filename, content);
      setSaveConfirmation(`Saved to inbox: ${filename}`);
      setRawText("");
      setTaskTitle("");
      setType("note");
      setSource("manual");
      setTimeout(() => setSaveConfirmation(""), 4000);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [
    accessToken,
    rawText,
    vcpFolders,
    selectedContext,
    type,
    taskTitle,
    source,
    userInfo,
  ]);

  return (
    <div className="capture-shell">
      {/* Header */}
      <header className="capture-header">
        <span className="app-title">VCP</span>
        <button
          className="toolbar-btn"
          onClick={() => onOpenEditor("browse")}
          style={{ marginLeft: 8, fontSize: 13 }}
          title="Go to Editor"
        >
          Editor
        </button>
        {onOpenKanban && (
          <button
            className="toolbar-btn"
            onClick={onOpenKanban}
            style={{ marginLeft: 4, fontSize: 13 }}
            title="Kanban board"
          >
            Board
          </button>
        )}
        {userInfo && (
          <div className="capture-user">
            {userInfo.picture && (
              <img
                src={userInfo.picture}
                alt={userInfo.name}
                className="user-avatar"
              />
            )}
            <span className="capture-username">
              {userInfo.given_name || userInfo.name}
            </span>
          </div>
        )}
      </header>

      <div className="capture-body">
        {/* VCP folder error */}
        {vcpError && (
          <div className="capture-warning">
            ⚠ {vcpError} — save will be disabled until resolved.
          </div>
        )}

        {/* Main text area */}
        <textarea
          ref={textRef}
          className="capture-textarea"
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            setSource("manual");
          }}
          onPaste={handlePaste}
          placeholder="Tap here and dictate, paste, or type…"
          autoFocus
        />

        {/* Gemini button */}
        <button
          className="gemini-btn"
          onClick={handleProcessWithGemini}
          disabled={isProcessing || !rawText.trim()}
        >
          {isProcessing ? "⏳ Processing…" : "✨ Process with Gemini"}
        </button>
        {geminiError && <p className="capture-error">{geminiError}</p>}

        {/* Divider */}
        <hr className="capture-divider" />

        {/* Context picker */}
        <div className="capture-section">
          <span className="capture-label">Context</span>
          <div className="context-chips">
            {contexts.map((ctx) => (
              <button
                key={ctx.id}
                className={`chip ${selectedContext === ctx.id ? "active" : ""}`}
                onClick={() => setSelectedContext(ctx.id)}
              >
                {ctx.label}
              </button>
            ))}
          </div>
        </div>

        {/* Type toggle */}
        <div className="capture-section">
          <span className="capture-label">Type</span>
          <div className="type-toggle">
            <button
              className={`toggle-btn ${type === "note" ? "active" : ""}`}
              onClick={() => setType("note")}
            >
              📝 Note
            </button>
            <button
              className={`toggle-btn ${type === "content+task" ? "active" : ""}`}
              onClick={() => setType("content+task")}
            >
              ✅ Also a task
            </button>
          </div>
        </div>

        {/* Task title (shown when type = content+task) */}
        {type === "content+task" && (
          <div className="capture-section">
            <span className="capture-label">Task title</span>
            <input
              className="task-title-input"
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="One-line task description…"
            />
          </div>
        )}

        {/* Save button */}
        <button
          className="save-inbox-btn"
          onClick={handleSave}
          disabled={isSaving || !rawText.trim() || !vcpFolders}
        >
          {isSaving ? "Saving…" : "Save to Inbox"}
        </button>

        {saveConfirmation && (
          <p className="save-confirmation">{saveConfirmation}</p>
        )}

        {/* Quick actions */}
        <hr className="capture-divider" />
        <div className="capture-actions">
          <button
            className="capture-action-btn"
            onClick={() => onOpenEditor("new")}
          >
            📄 New File
          </button>
          <button
            className="capture-action-btn"
            onClick={() => onOpenEditor("browse")}
          >
            📂 Browse
          </button>
        </div>
      </div>
    </div>
  );
}

function formatSlug(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
