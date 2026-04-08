const TASK_RE = /^- \[([ xX])\] (.+)$/;

export function parseBoard(content, boardMeta = {}) {
  const { fileId = "", boardLabel = "" } = boardMeta;
  const lines = content.split("\n");
  const tasks = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(TASK_RE);
    if (!m) continue;

    const done = m[1] !== " ";
    let rest = m[2];

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

    tasks.push({
      id: `${fileId}:${i}`,
      fileId,
      boardLabel,
      lineIndex: i,
      rawLine: line,
      done,
      description,
      owner: fields.owner || "",
      priority: fields.priority || "",
      status: fields.status || "backlog",
      due: fields.due === "—" ? "" : fields.due || "",
      source: fields.source || "",
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
  return line;
}

export function updateBoardContent(content, lineIndex, newLine, expectedRaw) {
  const lines = content.split("\n");
  if (lineIndex < 0 || lineIndex >= lines.length) {
    return { updatedContent: content, conflict: true };
  }
  if (expectedRaw && lines[lineIndex] !== expectedRaw) {
    return { updatedContent: content, conflict: true };
  }
  lines[lineIndex] = newLine;
  return { updatedContent: lines.join("\n"), conflict: false };
}

export function appendTaskToBoard(content, taskLine) {
  const trimmed = content.replace(/\n+$/, "");
  return trimmed + "\n" + taskLine + "\n";
}
