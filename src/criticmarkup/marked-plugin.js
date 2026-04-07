// marked.js extension that renders CriticMarkup into styled HTML
//
// IMPORTANT: marked HTML-escapes special chars in inline text before passing
// to the paragraph renderer. So `>` becomes `&gt;` and `<` becomes `&lt;`.
// All regexes here must match the *HTML-escaped* form of CriticMarkup delimiters:
//   {~~ old ~> new ~~}  →  {~~ old ~&gt; new ~~}
//   {>> … <<}           →  {&gt;&gt; … &lt;&lt;}

function applyCriticMarkup(html) {
  // 1. Substitution  {~~ old ~> new ~~}  (escaped: ~&gt;)
  html = html.replace(
    /\{~~([\s\S]*?)~&gt;([\s\S]*?)~~\}/g,
    (m, oldPart, newPart) => {
      const o = oldPart.trim().replace(/"/g, '&quot;')
      const n = newPart.trim().replace(/"/g, '&quot;')
      return `<span class="critic-sub" data-old="${o}" data-new="${n}" contenteditable="false"><del class="critic-deletion">${oldPart.trim()}</del><ins class="critic-insertion">${newPart.trim()}</ins></span>`
    },
  )

  // 2. Insertion  {++ text ++}  or  {++ @author: text ++}
  html = html.replace(
    /\{\+\+([\s\S]*?)\+\+\}/g,
    (m, inner) => {
      const authorMatch = inner.match(/^@([\w.]+):\s*/)
      const author  = authorMatch ? authorMatch[1] : ''
      const content = authorMatch ? inner.slice(authorMatch[0].length) : inner
      return `<ins class="critic-insertion" data-author="${author}">${content}</ins>`
    },
  )

  // 3. Deletion  {-- text --}  or  {-- @author: text --}
  html = html.replace(
    /\{--([\s\S]*?)--\}/g,
    (m, inner) => {
      const authorMatch = inner.match(/^@([\w.]+):\s*/)
      const author  = authorMatch ? authorMatch[1] : ''
      const content = authorMatch ? inner.slice(authorMatch[0].length) : inner
      return `<del class="critic-deletion" data-author="${author}">${content}</del>`
    },
  )

  // 4. Highlight  {== text ==}
  html = html.replace(
    /\{==([\s\S]*?)==\}/g,
    (m, inner) => `<mark class="critic-highlight">${inner}</mark>`,
  )

  // 5. Comment  {>> @handle (date): text <<}  (escaped: &gt;&gt; … &lt;&lt;)
  html = html.replace(/\{&gt;&gt;([\s\S]*?)&lt;&lt;\}/g, (m, content) => {
    // content is already HTML-escaped; decode just enough to parse structure
    const raw = content.trim()
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
    const vcpMatch = raw.match(/^(@\w+)\s+\(([^)]+)\):\s*(.+)$/)
    if (vcpMatch) {
      const [, handle, date, text] = vcpMatch
      const safeText = text.replace(/"/g, '&quot;')
      return `<span class="critic-comment" data-author="${handle}" data-date="${date}" title="${handle} (${date}): ${safeText}"><span class="critic-comment-icon">&#x1F4AC;</span><span class="critic-comment-bubble"><strong>${handle}</strong> <time>${date}</time><br>${safeText}</span></span>`
    }
    return `<span class="critic-comment" title="${raw}"><span class="critic-comment-icon">&#x1F4AC;</span><span class="critic-comment-bubble">${raw}</span></span>`
  })

  return html
}

export function criticMarkupPlugin() {
  return {
    walkTokens() {},
    renderer: {
      paragraph({ tokens }) {
        let html = this.parser.parseInline(tokens)
        html = applyCriticMarkup(html)
        return `<p>${html}</p>\n`
      },
      heading({ tokens, depth }) {
        let html = this.parser.parseInline(tokens)
        html = applyCriticMarkup(html)
        return `<h${depth}>${html}</h${depth}>\n`
      },
      listitem({ tokens }) {
        let html = this.parser.parseInline(tokens)
        html = applyCriticMarkup(html)
        return `<li>${html}</li>\n`
      },
      tablecell({ tokens }) {
        let html = this.parser.parseInline(tokens)
        html = applyCriticMarkup(html)
        return `<td>${html}</td>\n`
      },
    },
  }
}
