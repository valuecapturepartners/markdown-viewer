import {
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
  useCallback,
  useMemo,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
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

// Convert marked's checkbox list HTML to Tiptap TaskList/TaskItem format.
// marked:  <ul><li><input checked="" disabled="" type="checkbox"> text</li></ul>
// tiptap:  <ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>text</p></li></ul>
function convertCheckboxLists(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, "text/html");
  for (const ul of doc.querySelectorAll("ul")) {
    const lis = [...ul.children];
    const isTaskList = lis.length > 0 && lis.every(
      (li) => li.tagName === "LI" && li.querySelector('input[type="checkbox"]'),
    );
    if (!isTaskList) continue;
    ul.setAttribute("data-type", "taskList");
    for (const li of lis) {
      const cb = li.querySelector('input[type="checkbox"]');
      const checked = cb?.hasAttribute("checked") || false;
      li.setAttribute("data-type", "taskItem");
      li.setAttribute("data-checked", String(checked));
      if (cb) {
        const cbParent = cb.parentNode;
        cb.remove();
        // Trim the leading whitespace left by the removed checkbox marker
        const firstText = cbParent?.firstChild;
        if (firstText?.nodeType === Node.TEXT_NODE) {
          firstText.textContent = firstText.textContent.replace(/^\s+/, "");
        }
      }
      // If the li already has block-level children (e.g. <p> from a loose list),
      // the text is already structured.  If it has a nested list but no wrapping
      // <p>, collect the text nodes that precede the nested list and put them in
      // a <p> so Tiptap's taskItem schema (paragraph block*) is satisfied without
      // merging the details bullets into the task description.
      if (!li.querySelector("p, div, blockquote")) {
        const nestedList = li.querySelector("ul, ol");
        if (nestedList) {
          // Gather all nodes before the first nested list into a <p>
          const beforeNodes = [];
          let node = li.firstChild;
          while (node && node !== nestedList) {
            beforeNodes.push(node);
            node = node.nextSibling;
          }
          if (beforeNodes.length > 0) {
            const p = doc.createElement("p");
            for (const n of beforeNodes) p.appendChild(n);
            li.insertBefore(p, nestedList);
          }
        } else {
          // No nested list — wrap all inline content in <p>
          const p = doc.createElement("p");
          while (li.firstChild) p.appendChild(li.firstChild);
          li.appendChild(p);
        }
      }
    }
  }
  return doc.body.innerHTML;
}

// Convert markdown → HTML for Tiptap input (frontmatter stripped, rendered separately)
function markdownToHtml(md) {
  try {
    const { body } = extractFrontmatter(md);
    const html = marked.parse(body);
    return convertCheckboxLists(html);
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
  { content, onChange, tracking = false, author = "" },
  ref,
) {
  const lastMd = useRef(content);
  // Store raw frontmatter block so we can prepend it back on serialization
  const frontmatterRef = useRef(extractRawFrontmatter(content));
  // Extract frontmatter fields for rendering as a React component
  const frontmatterFields = useMemo(
    () => extractFrontmatter(content).frontmatter,
    [content],
  );
  // True while setContentSafe is running — suppresses onUpdate so that
  // programmatic content loads (file open, external sync) never trigger autosave.
  const settingContentRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      ...CRITIC_MARK_EXTENSIONS,
      TrackChanges.configure({ tracking, author }),
    ],
    content: markdownToHtml(content),
    editable: !!onChange,
    onUpdate({ editor }) {
      if (settingContentRef.current) return;
      const bodyMd = serializeToMarkdown(editor.getJSON());
      const md = frontmatterRef.current
        ? frontmatterRef.current + bodyMd
        : bodyMd;
      lastMd.current = md;
      onChange?.(md);
    },
  });

  // Set editor content without triggering track-changes or autosave (file loads,
  // external syncs).  settingContentRef suppresses onUpdate for the duration of
  // the synchronous setContent call and any ProseMirror appendTransaction passes.
  const setContentSafe = useCallback(
    (md) => {
      if (!editor) return;
      settingContentRef.current = true;
      frontmatterRef.current = extractRawFrontmatter(md);
      const ext = editor.extensionManager.extensions.find(
        (e) => e.name === "trackChanges",
      );
      const prev = ext?.options.tracking;
      if (ext) ext.options.tracking = false;
      editor.commands.setContent(markdownToHtml(md), false);
      if (ext) ext.options.tracking = prev;
      // ProseMirror dispatches are synchronous, so all onUpdate calls triggered
      // by setContent (including schema normalisation) have completed by now.
      settingContentRef.current = false;
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

  return (
    <div className={`tiptap-wrap${tracking ? "" : " no-track"}`}>
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

    </div>
  );
});

export default TiptapPane;
