// Word-level diff that produces CriticMarkup annotations.
// Used by TiptapPane in tracking mode: on blur, compare markdown before/after
// editing and wrap differences in {++ ++} / {-- --} / {~~ ~> ~~}.
//
// Key invariants:
//   • Existing CriticMarkup blocks are atomic tokens — never re-wrapped
//   • Leading/trailing whitespace is kept outside markup delimiters
//   • Deleting a CriticMarkup block is handled gracefully (see deletedCriticToMarkup)

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

// When the user deletes an existing CriticMarkup block, convert it to the
// appropriate output rather than passing through or nesting:
//   {++ x ++} deleted  → rejected insertion → '' (text never landed)
//   {-- x --} deleted  → confirmed deletion → keep as-is
//   {~~ o ~> n ~~} deleted → n was visible, user removed it → {-- n --}
//   {== x ==} deleted  → highlighted text removed → {-- x --}
//   {>> ... <<} deleted → comment removed → ''
function deletedCriticToMarkup(token) {
  const t = token.trim()
  if (/^\{\+\+/.test(t)) return ''          // rejected insertion
  if (/^\{--/.test(t)) return token          // keep deletion mark
  const sub = t.match(/^\{~~([\s\S]*?)~>([\s\S]*?)~~\}$/)
  if (sub) {
    const n = sub[2].trim()
    return n ? `{-- ${n} --}` : ''
  }
  const hi = t.match(/^\{==([\s\S]*?)==\}$/)
  if (hi) {
    const x = hi[1].trim()
    return x ? `{-- ${x} --}` : ''
  }
  if (/^\{>>/.test(t)) return ''            // comment removed
  return token                               // unknown, pass through
}

// Process a del op that contains CriticMarkup blocks.
// Split on atomic CM blocks and handle each segment individually.
function delWithCriticToMarkup(text, delFn) {
  const re = new RegExp(CM_BLOCK.source, 'g')
  let out = '', pos = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > pos) {
      out += wrapCore(text.slice(pos, m.index), delFn)
    }
    out += deletedCriticToMarkup(m[0])
    pos = m.index + m[0].length
  }
  if (pos < text.length) {
    out += wrapCore(text.slice(pos), delFn)
  }
  return out
}

// Build annotated markdown with optional author attribution
function opsToMarkup(ops, authorPrefix = '') {
  const ins = c => `{++ ${authorPrefix}${c} ++}`
  const del = c => `{-- ${authorPrefix}${c} --}`

  let out = ''
  for (let i = 0; i < ops.length; i++) {
    const op   = ops[i]
    const next = ops[i + 1]

    if (op.type === 'eq') {
      out += op.v

    } else if (
      op.type === 'del' && next?.type === 'ins' &&
      !hasCritic(op.v) && !hasCritic(next.v) &&
      !op.v.includes('~~') && !next.v.includes('~~')
    ) {
      // Adjacent del+ins: emit as separate marks (avoids ~~ conflicts in substitutions)
      out += wrapCore(op.v, del) + wrapCore(next.v, ins)
      i++

    } else if (op.type === 'ins' && !hasCritic(op.v)) {
      out += wrapCore(op.v, ins)

    } else if (op.type === 'del') {
      // Deletion — may or may not contain CriticMarkup blocks
      out += hasCritic(op.v)
        ? delWithCriticToMarkup(op.v, del)
        : wrapCore(op.v, del)

    } else {
      out += op.v  // ins containing CriticMarkup — pass through
    }
  }
  return out
}

/**
 * Compare two markdown strings and return `after` annotated with CriticMarkup.
 * Existing CriticMarkup blocks in either string are treated as atomic tokens
 * and are never re-wrapped. Deleting a CriticMarkup block is handled correctly
 * (see deletedCriticToMarkup).
 *
 * @param {string} before  - original markdown
 * @param {string} after   - edited markdown
 * @param {string} author  - optional author handle (without @), e.g. 'max'
 */
export function applyTrackChanges(before, after, author = '') {
  if (before === after) return after
  const authorPrefix = author ? `@${author}: ` : ''
  return opsToMarkup(mergeOps(diffTokens(tokenize(before), tokenize(after))), authorPrefix)
}
