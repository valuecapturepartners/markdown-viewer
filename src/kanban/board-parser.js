// Match checkbox items: - [ ] text / - [x] text
// AND plain list items that contain pipe-delimited fields: - text | field:val
const CHECKBOX_RE = /^- \[([ xX])\] (.+)$/;
const PLAIN_TASK_RE = /^- (.+\|.+)$/;
const INDENT_RE = /^[ \t]+/;

export function parseBoard(content, boardMeta = {}) {
  const { fileId = "", boardLabel = "" } = boardMeta;
  const lines = content.split("\n");
  const tasks = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cm = line.match(CHECKBOX_RE);
    const pm = !cm ? line.match(PLAIN_TASK_RE) : null;
    if (!cm && !pm) continue;

    // Checkbox provides explicit done; plain items infer from status/✅ below
    const hasCheckbox = !!cm;
    const checkboxDone = hasCheckbox && cm[1] !== " ";
    let rest = hasCheckbox ? cm[2] : pm[1];

    // Extract done date: ✅ YYYY-MM-DD at end
    let doneDate = "";
    const doneMatch = rest.match(/\s*✅\s*(\d{4}-\d{2}-\d{2})\s*$/);
    if (doneMatch) {
      doneDate = doneMatch[1];
      rest = rest.slice(0, doneMatch.index);
    }

    // Split on ' | ' to get fields
    const parts = rest.split(" | ");
    const description = parts[0].trim();

    const fields = {};
    for (let j = 1; j < parts.length; j++) {
      const colon = parts[j].indexOf(":");
      if (colon > 0) {
        const key = parts[j].slice(0, colon).trim().toLowerCase();
        const val = parts[j].slice(colon + 1).trim();
        fields[key] = val;
      }
    }

    // Collect indented continuation lines as details
    const detailLines = [];
    let endLine = i;
    while (endLine + 1 < lines.length && INDENT_RE.test(lines[endLine + 1])) {
      endLine++;
      detailLines.push(lines[endLine].replace(/^  /, ""));
    }

    // Parse details block: lines starting with "details:" header
    let details = "";
    if (detailLines.length > 0) {
      const firstTrimmed = detailLines[0].trim().toLowerCase();
      if (firstTrimmed === "details:" || firstTrimmed.startsWith("details:")) {
        // If "details:" is alone on the line, content is the remaining lines
        if (firstTrimmed === "details:") {
          details = detailLines
            .slice(1)
            .map((l) => l.replace(/^  /, ""))
            .join("\n")
            .trim();
        } else {
          // "details: some inline content" — take value after colon + remaining lines
          const inlineVal = detailLines[0].trim().slice("details:".length).trim();
          const remaining = detailLines
            .slice(1)
            .map((l) => l.replace(/^  /, ""))
            .join("\n")
            .trim();
          details = remaining ? `${inlineVal}\n${remaining}` : inlineVal;
        }
      } else {
        // Non-details indented lines (e.g. "From inbox: ...") — treat as context, not details
        details = "";
      }
    }

    // For plain items (no checkbox), infer done from status field or ✅ marker
    const done = hasCheckbox
      ? checkboxDone
      : (fields.status === "done" || !!doneDate);

    tasks.push({
      id: `${fileId}:${i}`,
      fileId,
      boardLabel,
      lineIndex: i,
      lineCount: endLine - i + 1,
      rawLine: lines.slice(i, endLine + 1).join("\n"),
      done,
      description,
      owner: fields.owner || "",
      priority: fields.priority || "",
      status: fields.status || "backlog",
      due: fields.due === "—" ? "" : fields.due || "",
      source: fields.source || "",
      details,
      doneDate,
    });
  }

  return tasks;
}

export function serializeTask(task) {
  const check = task.done ? "x" : " ";
  const parts = [task.description];
  if (task.owner) parts.push(`owner:${task.owner}`);
  if (task.priority) parts.push(`priority:${task.priority}`);
  parts.push(`status:${task.status || "backlog"}`);
  parts.push(`due:${task.due || "—"}`);
  if (task.source) parts.push(`source:${task.source}`);
  let line = `- [${check}] ${parts.join(" | ")}`;
  if (task.done && task.doneDate) {
    line += ` ✅ ${task.doneDate}`;
  }
  if (task.details) {
    const detailLines = task.details
      .split("\n")
      .map((l) => `    ${l}`)
      .join("\n");
    line += `\n  details:\n${detailLines}`;
  }
  return line;
}

export function updateBoardContent(
  content,
  lineIndex,
  newLine,
  expectedRaw,
  lineCount = 1,
) {
  const lines = content.split("\n");
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return { updatedContent: content, conflict: true };
  }
  if (expectedRaw) {
    const actual = lines.slice(lineIndex, lineIndex + lineCount).join("\n");
    if (actual !== expectedRaw) {
      return { updatedContent: content, conflict: true };
    }
  }
  const newLines = newLine.split("\n");
  lines.splice(lineIndex, lineCount, ...newLines);
  return { updatedContent: lines.join("\n"), conflict: false };
}

export function appendTaskToBoard(content, taskLine) {
  const trimmed = content.replace(/\n+$/, "");
  return trimmed + "\n" + taskLine + "\n";
}
