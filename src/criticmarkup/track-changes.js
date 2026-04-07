// Word-level diff that produces CriticMarkup annotations.
// Used by PreviewPane in tracking mode: on blur, compare markdown before/after editing
// and wrap differences in {++ ++} / {-- --} / {~~ ~> ~~}.

// Split into word tokens + whitespace tokens so spaces survive the diff
function tokenize(text) {
  return text.match(/\S+|\s+/g) || []
}

// LCS dynamic programming table
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

// Backtrack LCS table into a list of {type, v} operations
function diffTokens(tokA, tokB) {
  const dp = buildLCS(tokA, tokB)
  const ops = []
  let i = tokA.length, j = tokB.length
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && tokA[i - 1] === tokB[j - 1]) {
      ops.unshift({ type: 'eq', v: tokA[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'ins', v: tokB[j - 1] })
      j--
    } else {
      ops.unshift({ type: 'del', v: tokA[i - 1] })
      i--
    }
  }
  return ops
}

// Merge adjacent same-type operations into single spans
function mergeOps(ops) {
  const out = []
  for (const op of ops) {
    if (out.length && out.at(-1).type === op.type) {
      out.at(-1).v += op.v
    } else {
      out.push({ ...op })
    }
  }
  return out
}

// Convert diff operations to a markdown string with CriticMarkup
function opsToMarkup(ops) {
  let result = ''
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    if (op.type === 'eq') {
      result += op.v
    } else if (op.type === 'del' && ops[i + 1]?.type === 'ins') {
      // Adjacent delete + insert → substitution
      result += `{~~ ${ops[i + 1].v} ~> ${op.v} ~~}`
      i++
    } else if (op.type === 'ins') {
      result += `{++ ${op.v} ++}`
    } else {
      result += `{-- ${op.v} --}`
    }
  }
  return result
}

/**
 * Compare two markdown strings and return the "after" string annotated
 * with CriticMarkup showing what changed.
 * Returns `after` unchanged if the strings are identical.
 */
export function applyTrackChanges(before, after) {
  if (before === after) return after
  const tokA = tokenize(before)
  const tokB = tokenize(after)
  const ops = mergeOps(diffTokens(tokA, tokB))
  return opsToMarkup(ops)
}
