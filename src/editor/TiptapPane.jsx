import {
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { marked } from "marked";
import { criticMarkupPlugin } from "../criticmarkup/marked-plugin.js";
import {
  CriticInsertion,
  CriticDeletion,
  CriticHighlight,
  CriticSubstitution,
  CriticComment,
} from "../criticmarkup/tiptap-extensions.js";
import { serializeToMarkdown } from "./tiptap-serializer.js";
import { TrackChanges } from "../criticmarkup/track-changes-extension.js";

marked.use(criticMarkupPlugin());

// ── Frontmatter handling ──────────────────────────────────────────────────────
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** Extract YAML frontmatter → { body, frontmatter: [{key,value}] | null } */
function extractFrontmatter(md) {
  const m = md.match(FRONTMATTER_RE);
  if (!m) return { body: md, frontmatter: null };
  const fields = [];
  const lines = m[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip indented continuation lines (handled below with their parent)
    if (/^\s/.test(line) && fields.length) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    let val = line.slice(colon + 1).trim();
    // Strip surrounding quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // Collect indented continuation lines (nested YAML values)
    if (!val) {
      const nested = [];
      while (i + 1 < lines.length && /^\s/.test(lines[i + 1])) {
        i++;
        nested.push(lines[i].trim());
      }
      val = nested.join(", ");
    }
    fields.push({ key, value: val });
  }
  const body = md.slice(m[0].length);
  return { body, frontmatter: fields.length ? fields : null };
}

// Convert markdown → HTML for Tiptap input (frontmatter stripped, rendered separately)
function markdownToHtml(md) {
  try {
    const { body } = extractFrontmatter(md);
    return marked.parse(body);
  } catch {
    return `<p>${md}</p>`;
  }
}

/** Return the raw frontmatter block (including delimiters + trailing newline) or '' */
function extractRawFrontmatter(md) {
  const m = md.match(FRONTMATTER_RE);
  return m ? m[0] : "";
}

const CRITIC_MARK_EXTENSIONS = [
  CriticInsertion,
  CriticDeletion,
  CriticHighlight,
  CriticSubstitution,
  CriticComment,
];

// ── Component ─────────────────────────────────────────────────────────────────

const TiptapPane = forwardRef(function TiptapPane(
  { content, onChange, onCommentRequest, tracking = false, author = "" },
  ref,
) {
  const lastMd = useRef(content);
  const [tapComment, setTapComment] = useState(null);
  // Store raw frontmatter block so we can prepend it back on serialization
  const frontmatterRef = useRef(extractRawFrontmatter(content));
  // Extract frontmatter fields for rendering as a React component
  const frontmatterFields = useMemo(
    () => extractFrontmatter(content).frontmatter,
    [content],
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      ...CRITIC_MARK_EXTENSIONS,
      TrackChanges.configure({ tracking, author }),
    ],
    content: markdownToHtml(content),
    editable: !!onChange,
    onUpdate({ editor }) {
      const bodyMd = serializeToMarkdown(editor.getJSON());
      const md = frontmatterRef.current
        ? frontmatterRef.current + bodyMd
        : bodyMd;
      lastMd.current = md;
      onChange?.(md);
    },
  });

  // Set editor content without triggering track-changes (file loads, external syncs)
  const setContentSafe = useCallback(
    (md) => {
      if (!editor) return;
      frontmatterRef.current = extractRawFrontmatter(md);
      const ext = editor.extensionManager.extensions.find(
        (e) => e.name === "trackChanges",
      );
      const prev = ext?.options.tracking;
      if (ext) ext.options.tracking = false;
      editor.commands.setContent(markdownToHtml(md), false);
      if (ext) ext.options.tracking = prev;
    },
    [editor],
  );

  // Sync external content changes (e.g. file open, CodeMirror edits in split)
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    if (content === lastMd.current) return;
    lastMd.current = content;
    setContentSafe(content);
  }, [content, editor, setContentSafe]);

  // Update editable when onChange presence changes
  useEffect(() => {
    editor?.setEditable(!!onChange, false);
  }, [editor, onChange]);

  // Keep TrackChanges extension options in sync with props
  useEffect(() => {
    if (!editor) return;
    const ext = editor.extensionManager.extensions.find(
      (e) => e.name === "trackChanges",
    );
    if (ext) {
      ext.options.tracking = tracking;
      ext.options.author = author;
    }
  }, [editor, tracking, author]);

  // Tap/click on critic-comment nodes → show popover
  useEffect(() => {
    const el = editor?.view?.dom;
    if (!el) return;
    const handler = (e) => {
      const comment = e.target.closest(".critic-comment");
      if (comment) {
        e.preventDefault();
        const rect = comment.getBoundingClientRect();
        setTapComment({
          author: comment.dataset.author || "",
          date: comment.dataset.date || "",
          text: (comment.getAttribute("title") || "").replace(/^.*?\):\s*/, ""),
          x: Math.min(rect.left, window.innerWidth - 288),
          y: rect.bottom + 6,
        });
      } else if (!e.target.closest(".ctp-close")) {
        setTapComment(null);
      }
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, [editor]);

  // Expose methods to Editor parent via ref
  useImperativeHandle(
    ref,
    () => ({
      // Force content update regardless of focus state (used by accept/reject all)
      forceContent: (md) => {
        if (!editor) return;
        lastMd.current = md;
        setContentSafe(md);
      },
      // Insert CriticMarkup comment (called after dialog submit)
      insertComment: ({ author, date, text, selectedText }) => {
        if (!editor) return;
        const h = author.startsWith("@") ? author : `@${author}`;
        // If selected text exists, apply highlight mark first
        if (selectedText) {
          const { from, to } = editor.state.selection;
          if (from !== to) {
            editor
              .chain()
              .focus()
              .setMark("criticHighlight")
              .insertContentAt(to, {
                type: "criticComment",
                attrs: { author: h, date, text },
              })
              .run();
            return;
          }
        }
        editor
          .chain()
          .focus()
          .insertContent({
            type: "criticComment",
            attrs: { author: h, date, text },
          })
          .run();
      },
      // Get selected text
      getSelection: () => {
        if (!editor) return "";
        const { from, to } = editor.state.selection;
        return editor.state.doc.textBetween(from, to, " ");
      },
    }),
    [editor],
  );

  const isEditable = !!onChange;

  // ── Bubble menu button handler ─────────────────────────────────────────────
  const handleComment = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, " ");
    onCommentRequest?.(text);
  }, [editor, onCommentRequest]);

  const isActive = (name) => editor?.isActive(name);

  return (
    <div className={`tiptap-wrap${tracking ? "" : " no-track"}`}>
      {editor && isEditable && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 150, placement: "top", maxWidth: "none" }}
          className="tiptap-bubble"
        >
          <button
            className={`tb-btn tb-comment`}
            onMouseDown={(e) => {
              e.preventDefault();
              handleComment();
            }}
            title="Add comment"
          >
            💬
          </button>
          <span className="tb-sep" />
          <button
            className={`tb-btn tb-highlight ${isActive("criticHighlight") ? "on" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleMark("criticHighlight").run();
            }}
            title="Highlight"
          >
            H
          </button>
          <button
            className={`tb-btn tb-insert ${isActive("criticInsertion") ? "on" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleMark("criticInsertion").run();
            }}
            title="Mark as insertion"
          >
            +
          </button>
          <button
            className={`tb-btn tb-delete ${isActive("criticDeletion") ? "on" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleMark("criticDeletion").run();
            }}
            title="Mark as deletion"
          >
            −
          </button>
          <span className="tb-sep" />
          <button
            className={`tb-btn ${isActive("bold") ? "on" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBold().run();
            }}
            title="Bold"
          >
            <b>B</b>
          </button>
          <button
            className={`tb-btn ${isActive("italic") ? "on" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleItalic().run();
            }}
            title="Italic"
          >
            <i>I</i>
          </button>
        </BubbleMenu>
      )}

      <div className="tiptap-content">
        {frontmatterFields && (
          <div className="frontmatter-table">
            <table>
              <tbody>
                {frontmatterFields.map(({ key, value }, i) => (
                  <tr key={i}>
                    <td className="fm-key">{key}</td>
                    <td className="fm-val">
                      {value || <span className="fm-empty">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <EditorContent editor={editor} />
      </div>

      {tapComment && (
        <div
          className="comment-tap-popover"
          style={{ position: "fixed", left: tapComment.x, top: tapComment.y }}
        >
          <div className="ctp-header">
            <strong>{tapComment.author}</strong>
            <time>{tapComment.date}</time>
            <button className="ctp-close" onClick={() => setTapComment(null)}>
              ✕
            </button>
          </div>
          <p className="ctp-text">{tapComment.text}</p>
        </div>
      )}
    </div>
  );
});

export default TiptapPane;
