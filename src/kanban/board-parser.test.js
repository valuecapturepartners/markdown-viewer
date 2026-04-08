import { describe, it, expect } from "vitest";
import {
  parseBoard,
  serializeTask,
  updateBoardContent,
  appendTaskToBoard,
} from "./board-parser.js";

const SAMPLE_BOARD = `## Tasks

- [ ] Send out list of prep questions (data requirements) | owner:jan-niklas | priority:medium | status:active | due:2026-03-30 | source:inbox-2026-03-24
- [x] Propose workshop slots in April to Orlando for portco scanning exercise | owner:jan-niklas | priority:medium | status:done | due:2026-03-30 | source:inbox-2026-03-24 ✅ 2026-04-02
- [ ] Create Bechtle/SVA leasing briefing document for Master Box | owner:jan-niklas | priority:medium | status:backlog | due:— | source:inbox-2026-03-26
  From inbox: 2026-03-26-email-analyze-deploy-pipeline-thread.md

- [ ] Sketch and discuss workshop content | owner:max | priority:high | status:backlog | due:2026-04-24 | source:ad-hoc`;

describe("parseBoard", () => {
  it("parses all task lines from sample board", () => {
    const tasks = parseBoard(SAMPLE_BOARD, { fileId: "f1", boardLabel: "ops" });
    expect(tasks).toHaveLength(4);
  });

  it("extracts fields from a full task", () => {
    const tasks = parseBoard(SAMPLE_BOARD, { fileId: "f1", boardLabel: "ops" });
    const t = tasks[0];
    expect(t.description).toBe(
      "Send out list of prep questions (data requirements)",
    );
    expect(t.owner).toBe("jan-niklas");
    expect(t.priority).toBe("medium");
    expect(t.status).toBe("active");
    expect(t.due).toBe("2026-03-30");
    expect(t.source).toBe("inbox-2026-03-24");
    expect(t.done).toBe(false);
    expect(t.doneDate).toBe("");
  });

  it("parses done tasks with completion date", () => {
    const tasks = parseBoard(SAMPLE_BOARD, { fileId: "f1", boardLabel: "ops" });
    const t = tasks[1];
    expect(t.done).toBe(true);
    expect(t.status).toBe("done");
    expect(t.doneDate).toBe("2026-04-02");
  });

  it("handles em-dash due dates as empty", () => {
    const tasks = parseBoard(SAMPLE_BOARD, { fileId: "f1", boardLabel: "ops" });
    const t = tasks[2];
    expect(t.due).toBe("");
  });

  it("skips non-task lines", () => {
    const content = `## Heading

Some text paragraph

- [ ] Real task | status:backlog

  Indented context line`;
    const tasks = parseBoard(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).toBe("Real task");
  });

  it("assigns unique IDs using fileId:lineIndex", () => {
    const tasks = parseBoard(SAMPLE_BOARD, {
      fileId: "abc123",
      boardLabel: "test",
    });
    expect(tasks[0].id).toBe("abc123:2");
    expect(tasks[1].id).toBe("abc123:3");
  });

  it("parses a minimal task with only status", () => {
    const content = "- [ ] Do something | status:backlog";
    const tasks = parseBoard(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).toBe("Do something");
    expect(tasks[0].status).toBe("backlog");
    expect(tasks[0].owner).toBe("");
    expect(tasks[0].priority).toBe("");
    expect(tasks[0].due).toBe("");
    expect(tasks[0].source).toBe("");
  });

  it("defaults status to backlog when missing", () => {
    const content = "- [ ] No status task";
    const tasks = parseBoard(content);
    expect(tasks[0].status).toBe("backlog");
  });

  it("handles uppercase X checkbox", () => {
    const content = "- [X] Done task | status:done";
    const tasks = parseBoard(content);
    expect(tasks[0].done).toBe(true);
  });

  it("preserves board metadata", () => {
    const tasks = parseBoard("- [ ] Task | status:active", {
      fileId: "fid",
      boardLabel: "clients/acme",
    });
    expect(tasks[0].fileId).toBe("fid");
    expect(tasks[0].boardLabel).toBe("clients/acme");
  });
});

describe("serializeTask", () => {
  it("serializes a complete task", () => {
    const line = serializeTask({
      done: false,
      description: "Do the thing",
      owner: "alice",
      priority: "high",
      status: "active",
      due: "2026-05-01",
      source: "weekly",
      doneDate: "",
    });
    expect(line).toBe(
      "- [ ] Do the thing | owner:alice | priority:high | status:active | due:2026-05-01 | source:weekly",
    );
  });

  it("serializes a done task with completion date", () => {
    const line = serializeTask({
      done: true,
      description: "Finished",
      owner: "bob",
      priority: "low",
      status: "done",
      due: "2026-04-01",
      source: "standup",
      doneDate: "2026-04-08",
    });
    expect(line).toContain("- [x]");
    expect(line).toContain("✅ 2026-04-08");
    expect(line).toContain("status:done");
  });

  it("uses em-dash for empty due date", () => {
    const line = serializeTask({
      done: false,
      description: "Task",
      owner: "",
      priority: "",
      status: "backlog",
      due: "",
      source: "",
      doneDate: "",
    });
    expect(line).toContain("due:—");
    expect(line).not.toContain("owner:");
    expect(line).not.toContain("source:");
  });

  it("round-trips through parse and serialize", () => {
    const original =
      "- [ ] Send out prep questions | owner:jan-niklas | priority:medium | status:active | due:2026-03-30 | source:inbox-2026-03-24";
    const tasks = parseBoard(original);
    const serialized = serializeTask(tasks[0]);
    expect(serialized).toBe(original);
  });

  it("round-trips a done task", () => {
    const original =
      "- [x] Finished task | owner:max | priority:high | status:done | due:2026-04-01 | source:weekly ✅ 2026-04-08";
    const tasks = parseBoard(original);
    const serialized = serializeTask(tasks[0]);
    expect(serialized).toBe(original);
  });
});

describe("updateBoardContent", () => {
  it("replaces the line at the given index", () => {
    const content = "line0\nline1\nline2";
    const { updatedContent, conflict } = updateBoardContent(
      content,
      1,
      "REPLACED",
      "line1",
    );
    expect(conflict).toBe(false);
    expect(updatedContent).toBe("line0\nREPLACED\nline2");
  });

  it("detects conflict when line content changed", () => {
    const content = "line0\nchanged\nline2";
    const { conflict } = updateBoardContent(content, 1, "REPLACED", "original");
    expect(conflict).toBe(true);
  });

  it("skips conflict check when no expected raw provided", () => {
    const content = "line0\nwhatever\nline2";
    const { updatedContent, conflict } = updateBoardContent(
      content,
      1,
      "REPLACED",
    );
    expect(conflict).toBe(false);
    expect(updatedContent).toBe("line0\nREPLACED\nline2");
  });

  it("detects conflict for out-of-range index", () => {
    const { conflict } = updateBoardContent("single line", 5, "nope", "nope");
    expect(conflict).toBe(true);
  });
});

describe("appendTaskToBoard", () => {
  it("appends a task line at the end", () => {
    const content = "## Tasks\n\n- [ ] Existing | status:backlog\n";
    const result = appendTaskToBoard(
      content,
      "- [ ] New task | status:backlog | due:—",
    );
    expect(result).toContain("- [ ] Existing | status:backlog");
    expect(
      result.trim().endsWith("- [ ] New task | status:backlog | due:—"),
    ).toBe(true);
  });

  it("handles content without trailing newline", () => {
    const content = "- [ ] Only task | status:active";
    const result = appendTaskToBoard(
      content,
      "- [ ] Second | status:backlog | due:—",
    );
    const lines = result.trim().split("\n");
    expect(lines).toHaveLength(2);
  });
});
