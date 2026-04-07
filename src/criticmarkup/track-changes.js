// Word-level diff that produces CriticMarkup annotations.
// Used by PreviewPane in tracking mode: on blur, compare markdown before/after
// editing and wrap differences in {++ ++} / {-- --} / {~~ ~> ~~}.
//
// Key invariants:
//   • Existing CriticMarkup blocks are atomic tokens — never re-wrapped
//   • Leading/trailing whitespace is kept outside markup delimiters

// CriticMarkup patterns used to find atomic blocks (order: sub before del/ins)
const CM_BLOCK = /\{~~[\s\S]*?~~\}|\{\+\+[\s\S]*?\+\+\}|\{--[\s\S]*?--\}|\{==[\s\S]*?==\}|\{>>[\s\S]*?<<\}/g

// Tokenise: CriticMarkup blocks → one token; everything else → words + whitespace runs
function tokenize(text) {
  const tokens = []
  let cursor = 0
  CM_BLOCK.lastIndex = 0
  let m
  while ((m = CM_BLOCK.exec(text)) !== null) {
    if (m.index > cursor) {
      for (const t of text.slice(cursor, m.index).match(/\S+|\s+/g) ?? []) tokens.push(t)
    }
    tokens.push(m[0])
    cursor = m.index + m[0].length
  }
  if (cursor < text.length) {
    for (const t of text.slice(cursor).match(/\S+|\s+/g) ?? []) tokens.push(t)
  }
  return tokens
}

// O(n·m) LCS table
function buildLCS(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Int32Array(b.length + 1))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp
}

// Backtrack → [{type:'eq'|'del'|'ins', v}]
function diffTokens(tokA, tokB) {
  const dp = buildLCS(tokA, tokB)
  const ops = []
  let i = tokA.length, j = tokB.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && tokA[i - 1] === tokB[j - 1]) {
      ops.unshift({ type: 'eq',  v: tokA[i - 1] }); i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'ins', v: tokB[j - 1] }); j--
    } else {
      ops.unshift({ type: 'del', v: tokA[i - 1] }); i--
    }
  }
  return ops
}

// Collapse adjacent same-type ops
function mergeOps(ops) {
  const out = []
  for (const op of ops) {
    if (out.length && out.at(-1).type === op.type) out.at(-1).v += op.v
    else out.push({ ...op })
  }
  return out
}

// True if a span contains a CriticMarkup block — we never nest
function hasCritic(text) {
  CM_BLOCK.lastIndex = 0
  return CM_BLOCK.test(text)
}

// Wrap the core (non-whitespace) part of text with markup,
// keeping leading/trailing whitespace outside the delimiters.
function wrapCore(text, makeMarkup) {
  if (!text.trim()) return text                        // pure whitespace — pass through
  const lead  = text.match(/^(\s*)/)[1]
  const trail = text.match(/(\s*)$/)[1]
  const core  = text.slice(lead.length, trail.length ? -trail.length : undefined)
  return lead + makeMarkup(core) + trail
}

// Build annotated markdown; del + ins fused into substitution where possible
function opsToMarkup(ops) {
  let out = ''
  for (let i = 0; i < ops.length; i++) {
    const op   = ops[i]
    const next = ops[i + 1]

    if (op.type === 'eq') {
      out += op.v

    } else if (
      op.type === 'del' && next?.type === 'ins' &&
      !hasCritic(op.v) && !hasCritic(next.v)
    ) {
      // Substitution: {~~ old ~> new ~~}  (old = del, new = ins)
      const oldCore = op.v.trim()
      const newCore = next.v.trim()
      const space   = op.v.match(/^(\s*)/)[1]   // preserve leading space from context
      out += oldCore && newCore
        ? space + `{~~ ${oldCore} ~> ${newCore} ~~}`
        : wrapCore(op.v, c => `{-- ${c} --}`) + wrapCore(next.v, c => `{++ ${c} ++}`)
      i++

    } else if (op.type === 'ins' && !hasCritic(op.v)) {
      out += wrapCore(op.v, c => `{++ ${c} ++}`)

    } else if (op.type === 'del' && !hasCritic(op.v)) {
      out += wrapCore(op.v, c => `{-- ${c} --}`)

    } else {
      out += op.v  // CriticMarkup block or unhandled edge — pass through unchanged
    }
  }
  return out
}

/**
 * Compare two markdown strings and return `after` annotated with CriticMarkup.
 * Existing CriticMarkup blocks in either string are never re-wrapped.
 *
 * @param {string} before  - original markdown
 * @param {string} after   - edited markdown
 * @param {string} [author] - handle of the editor, e.g. '@mh' or 'mh'
 * @param {string} [date]   - ISO date string, defaults to today
 */
export function applyTrackChanges(before, after, author, date) {
  if (before === after) return after
  const result = opsToMarkup(mergeOps(diffTokens(tokenize(before), tokenize(after))))
  if (!author || result === after) return result
  // Append a single attribution comment so reviewers know who made the changes
  const h = author.startsWith('@') ? author : `@${author}`
  const d = date || new Date().toISOString().split('T')[0]
  return `${result}{>> ${h} (${d}): edit <<}`
}
