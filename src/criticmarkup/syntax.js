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
export function acceptAll(md) {
  return md
    .replace(/\{~~([\s\S]*?)~>([\s\S]*?)~~\}/g, (_, _old, n) => n.trim())
    .replace(/\{\+\+([\s\S]*?)\+\+\}/g, (_, inner) =>
      inner.replace(/^@[\w.]+:\s*/, '').trim())
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
    .replace(/\{~~([\s\S]*?)~>([\s\S]*?)~~\}/g, (_, o) => o.trim())
    .replace(/\{\+\+([\s\S]*?)\+\+\}/g, '')
    .replace(/\{--([\s\S]*?)--\}/g, (_, inner) =>
      inner.replace(/^@[\w.]+:\s*/, '').trim())
    .replace(/\{==([\s\S]*?)==\}/g, (_, inner) => inner.trim())
    .replace(/\{>>([\s\S]*?)<<\}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function formatVCPComment(handle, text) {
  const date = new Date().toISOString().split('T')[0]
  const h = handle.startsWith('@') ? handle : `@${handle}`
  return `{>> ${h} (${date}): ${text} <<}`
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
