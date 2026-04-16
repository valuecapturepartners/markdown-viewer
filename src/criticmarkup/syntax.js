// CriticMarkup syntax helpers
// Standard patterns: {++ add ++}  {-- del --}  {~~ old ~> new ~~}  {== highlight ==}  {>> comment <<}
// VCP comment format: {>> @handle (YYYY-MM-DD): text <<}

export const CM_RE = {
  insertion:     /\{\+\+([\s\S]*?)\+\+\}/g,
  deletion:      /\{--([\s\S]*?)--\}/g,
  substitution:  /\{~~([\s\S]*?)~>([\s\S]*?)~~\}/g,
  highlight:     /\{==([\s\S]*?)==\}/g,
  comment:       /\{>>([\s\S]*?)<<\}/g,
}

// Returns true if the string contains any CriticMarkup
export function hasCriticMarkup(text) {
  return /\{\+\+|\{--|{~~|\{==|\{>>/.test(text)
}

// Accept all changes: keep insertions, drop deletions, keep new in substitutions,
// keep highlighted text, drop comments. Strips @author: prefixes.
const stripAuthor = s => s.trim().replace(/^@[\w.]+:\s*/, '')

export function acceptAll(md) {
  return md
    .replace(/\{~~([\s\S]*?)~>([\s\S]*?)~~\}/g, (_, _old, n) => stripAuthor(n))
    .replace(/\{\+\+([\s\S]*?)\+\+\}/g, (_, inner) => stripAuthor(inner))
    .replace(/\{--([\s\S]*?)--\}/g, '')
    .replace(/\{==([\s\S]*?)==\}/g, (_, inner) => inner.trim())
    .replace(/\{>>([\s\S]*?)<<\}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Reject all changes: drop insertions, keep deleted text, keep old in substitutions,
// keep highlighted text, drop comments.
export function rejectAll(md) {
  return md
    .replace(/\{~~([\s\S]*?)~>([\s\S]*?)~~\}/g, (_, o) => stripAuthor(o))
    .replace(/\{\+\+([\s\S]*?)\+\+\}/g, '')
    .replace(/\{--([\s\S]*?)--\}/g, (_, inner) => stripAuthor(inner))
    .replace(/\{==([\s\S]*?)==\}/g, (_, inner) => inner.trim())
    .replace(/\{>>([\s\S]*?)<<\}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function formatVCPComment(handle, text, { resolved = false } = {}) {
  const date = new Date().toISOString().split('T')[0]
  const h = handle.startsWith('@') ? handle : `@${handle}`
  const r = resolved ? ' [resolved]' : ''
  return `{>> ${h} (${date})${r}: ${text} <<}`
}

// Parse a CriticMarkup comment body into structured fields
export function parseCommentAttrs(raw) {
  const m = raw.trim().match(/^@([\w.-]+)\s*\((\d{4}-\d{2}-\d{2})\)\s*(\[resolved\])?\s*:\s*([\s\S]*)$/)
  if (m) return { author: `@${m[1]}`, date: m[2], resolved: !!m[3], text: m[4].trim() }
  return { author: '', date: '', resolved: false, text: raw.trim() }
}

// Wraps currently selected text with a CriticMarkup comment.
// If text is selected it becomes the annotated span.
export function buildCommentInsertion(handle, commentText, selectedText = '') {
  const date = new Date().toISOString().split('T')[0]
  const h = handle.startsWith('@') ? handle : `@${handle}`
  if (selectedText) {
    // Highlight the selection and attach a comment right after
    return `{== ${selectedText} ==}{>> ${h} (${date}): ${commentText} <<}`
  }
  return `{>> ${h} (${date}): ${commentText} <<}`
}
