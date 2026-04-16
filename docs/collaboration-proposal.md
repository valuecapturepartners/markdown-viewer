# VCP Collaboration System — Proposal

> Brainstormed 2026-04-16 (Max + Claude). Starting point for alignment with Jan-Niklas and Emanuel.

---

## Problem

We use five+ channels today (iMessage, email, GitHub, task boards, CriticMarkup comments). None of them connect discussion to the artifact being discussed. The conversation fragments — a comment on the Brandbrief becomes an email, becomes a task, becomes a Capture response, and the thread is lost across three systems.

## Design Principles

1. **The markdown artifact is the hub** — every topic already has (or gets) a markdown document. Discussion anchors there.
2. **No new silos** — use tools already in our stack (Google Chat, CriticMarkup, Drive, daily review).
3. **Human-initiated, machine-harvested** — founders decide when a discussion space is needed; the CoS captures and triages automatically.
4. **Lightweight over heavy** — must feel like chat, not email.

---

## Three Discussion Layers

Discussion happens at three distinct scopes. Each has its own tool, and they connect through the daily review.

### 1. Passage-level comments (in the Markdown Editor)

Annotate a specific text span. Use when feedback is about a particular sentence, paragraph, or section.

**Tool:** CriticMarkup inline comments in the editor.

```markdown
{== selected text ==}{>> @max (2026-04-16): this needs a different framing <<}
```

**Capabilities (built):**
- Click a comment icon to see the popover with author, date, text
- Reply to a comment — inserts a new CriticMarkup comment adjacent to the original
- Resolve a comment — marks it `[resolved]`, dims it visually, changes icon to checkmark
- @mentions render as styled pills in the popover

### 2. Document-level comments (in the Markdown Editor)

Discuss the document as a whole — not anchored to a passage. Use when the feedback is about direction, framing, or the artifact overall.

**Tool:** CriticMarkup comments in a `## Discussion` section appended to the document.

```markdown
## Discussion

{>> @max (2026-04-16): deployed landing page → pages.github.io/vcp — thoughts? <<}
{>> @emanuel (2026-04-16): layout is good, headline feels off <<}
{>> @jn (2026-04-16): agree, try shorter version <<}
```

**Capabilities (built):**
- Comment dialog has an Inline / Discussion toggle
- Discussion mode appends the comment to `## Discussion` at the end of the document
- Creates the section automatically if it doesn't exist
- Same reply, resolve, and @mention features as passage-level comments

### 3. Domain-level discussion (Google Chat Spaces)

Discuss a **topic that spans multiple artifacts** — e.g., "Landing Page" touches the branding sheet, the HTML page on GitHub Pages, the design system doc, and the deployment. A single artifact's Discussion section isn't enough; the conversation needs a home that links across them.

**Tool:** Google Chat Spaces, one per domain/topic.

**How it works:**
- A founder creates a space (e.g., `[VCP] Landing Page`) when a cross-artifact discussion is needed
- First message deeplinks to the relevant artifacts
- All three founders can discuss in real-time (mobile-native, lightweight, feels like chat)
- JN can participate without needing GitHub or the editor

**Conventions:**
- **Created by founders**, not automatically. Not every topic needs a space.
- **Naming convention for harvest**: spaces named with a prefix (e.g., `[VCP]`) are scanned by the CoS daily review. Unflagged spaces are ignored.
- **Deeplink to artifacts**: first message links to the relevant documents in Drive or the editor.
- **Capture format**: CoS captures space messages into the relevant artifact(s) as CriticMarkup comments in their `## Discussion` sections.

---

## How the Layers Connect

| Scope | Tool | When to use | Who |
|-------|------|-------------|-----|
| Passage | CriticMarkup inline (editor) | "This sentence needs work" | Anyone in the editor |
| Document | CriticMarkup in `## Discussion` (editor) | "The overall framing is off" | Anyone in the editor |
| Domain | Google Chat Space | "The landing page approach across all artifacts" | All founders, mobile-friendly |

```
Passage comment  ──┐
                    ├──  All live on or link to the markdown artifact
Document comment ──┤
                    │
Domain discussion ──┘  (Chat Space deeplinks to artifacts;
                        CoS harvests into ## Discussion sections)
```

### Flow

```
Something happens (deploy, email, idea, Claude conversation)
        │
        ▼
Context gets added to the markdown artifact
(paste link, Claude appends summary, email captured into doc)
        │
        ▼
People comment at the right scope
├── On a passage   →  CriticMarkup inline in the editor
├── On the document →  ## Discussion section in the editor
└── On the domain   →  Google Chat Space (deeplinked to artifacts)
        │
        ▼
Daily review picks it up
├── Scans flagged Chat Spaces → captures into artifact ## Discussion sections
├── Scans CriticMarkup comments → surfaces new comments in digest
└── Creates tasks where needed
        │
        ▼
Digest links back to artifact → next person reads, comments, cycle continues
```

### Example: Landing Page Discussion

The landing page topic spans: branding sheet, HTML page (GitHub Pages), design system doc.

1. Max creates the landing page, deploys via GitHub Pages
2. Max opens the branding conversation sheet, pastes the GitHub Pages link and Claude's design rationale
3. Emanuel opens the branding sheet in the editor, leaves **passage-level** CriticMarkup comments on the headline copy
4. Emanuel also adds a **document-level** comment in Discussion: "Overall layout works, but CTA needs rethinking"
5. Max creates a Google Chat Space `[VCP] Landing Page` — drops deeplinks to the branding sheet, the design system doc, and the deployed page
6. JN responds in the Chat Space with broader strategic feedback that touches all three artifacts
7. Daily review captures JN's Chat messages into the relevant artifacts' `## Discussion` sections
8. All context is traceable — passage feedback on the branding sheet, document-level discussion on each artifact, cross-artifact conversation harvested from the Chat Space

---

## What Needs to Be Built

### Markdown Editor — Features

| # | Feature | Priority | Status | Description |
|---|---------|----------|--------|-------------|
| 1 | **Reply to comment** | Must | Built | Click a comment popover → reply. Inserts a new CriticMarkup comment adjacent to the original. Ctrl+Enter to send. |
| 2 | **Resolve comment** | Must | Built | Mark a comment as resolved via popover button. Adds `[resolved]` to CriticMarkup, dims visually, changes icon to checkmark. Toggleable. |
| 3 | **Document-level comment (Discussion mode)** | Must | Built | Comment dialog has Inline/Discussion toggle. Discussion mode appends to `## Discussion` section (auto-created if missing). |
| 4 | **@mention rendering** | Should | Built | `@handle` in comment text renders as styled blue pills in popovers and hover bubbles. |
| 5 | **Discussion section rendering** | Should | Not built | Editor recognizes `## Discussion` and renders comments there as a chat-like thread (avatar, timestamp, message) rather than inline icons. |
| 6 | **Comment sidebar / panel** | Nice | Not built | Side panel listing all comments (passage + discussion), with jump-to-location. Similar to Google Docs. |
| 7 | **Notification badge** | Nice | Not built | Count of new/unresolved comments since last visit. |

### CoS / Daily Review — New Capabilities

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| 8 | **Google Chat Space scanner** | Must | New script `chat-scan.sh` — lists messages in flagged spaces since last scan. Similar to `gmail-scan.sh`. |
| 9 | **Google Chat Space capture** | Must | New script `chat-capture.sh` — fetches messages from a space and appends them as CriticMarkup comments to the linked artifact's `## Discussion` section. |
| 10 | **Comment-aware digest** | Should | Daily review scans artifacts for new CriticMarkup comments (by date) and surfaces them in the digest: "3 new comments on branding sheet — Emanuel questions headline." |
| 11 | **Space naming convention** | Must | Define and document the naming prefix that flags a space for harvest (e.g., `[VCP]`). |

### V2 — Agent Participation in Chat Spaces

The long-term vision: agents are **active participants** in Google Chat Spaces, not just passive harvesters. A team can @mention a domain agent mid-conversation, spar with it, and then harvest the entire discussion into a polished artifact.

#### Example: Legal Agent in a Chat Space

```
@Anna:       "What are the GDPR implications of storing EU customer data on US servers?"
@LegalAgent: "There are several key considerations under GDPR Chapter V
              regarding international transfers..."
@Tom:        "What about Standard Contractual Clauses?"
@LegalAgent: "SCCs are one of the primary safeguards recognized under Article 46..."
```

The group debates, the agent contributes — it becomes a collaborative sparring session. Afterwards, the conversation is harvested into a structured artifact (legal memo, decision matrix, risk assessment).

#### Architecture

```
Google Chat Space
    │
    ├── @mention triggers bot (Apps Script + Claude API)
    │       → Bot reads conversation context
    │       → Calls Claude API for domain-specific response
    │       → Posts answer back into the thread
    │
    └── Harvest phase (CoS daily review or on-demand)
            → Chat API exports conversation
            → Claude Code processes into artifact
            → Structured output: memo, action items, decision doc
```

#### V2 Feature Table

| # | Feature | Description |
|---|---------|-------------|
| 12 | Agent reads comments | Claude Code parses `## Discussion` and inline comments as part of daily review or on-demand analysis. |
| 13 | Agent writes comments | Claude Code appends CriticMarkup comments to artifacts (already possible with `formatVCPComment()` in `syntax.js`). |
| 14 | Agent joins Chat Space | A Google Chat bot (Apps Script + Claude API) responds to @mentions in Spaces — participates like a team member. |
| 15 | @agent mention trigger | `@agent-name` in a Chat Space triggers a domain-specific response (e.g., `@legal`, `@strategy`, `@ops`). |
| 16 | Conversation → artifact pipeline | After a Space discussion, harvest the full thread and generate structured documents (memos, matrices, action items with owners). |
| 17 | Multi-agent Spaces | Different domain agents in the same Space — `@legal` for compliance, `@strategy` for market context — collaborating with humans in one thread. |

---

## Open Questions

1. **Google Chat API access** — Do we have API access to read Chat Spaces via gws? Need to verify scope.
2. **Naming convention** — What prefix for harvestable spaces? `[VCP]`, `[harvest]`, or something else?
3. **Threading in V1** — Flat comments are fine for now. When does volume warrant explicit thread IDs?
4. **Resolve semantics** — Resolved comments are currently marked with `[resolved]` and dimmed. Should they be auto-cleaned after a period?
5. **Mobile commenting** — Google Chat covers mobile discussion. Do we also need the editor's comment features to work on mobile?
