// marked.js extension that renders CriticMarkup into styled HTML

function applyCriticMarkup(html) {
  // Order matters: substitution before deletion/insertion to avoid overlap
  html = html.replace(
    /\{~~([\s\S]*?)~>([\s\S]*?)~~\}/g,
    (m, oldPart, newPart) => {
      const o = oldPart.trim().replace(/"/g, '&quot;')
      const n = newPart.trim().replace(/"/g, '&quot;')
      return `<span class="critic-sub" data-old="${o}" data-new="${n}" contenteditable="false"><del class="critic-deletion">${oldPart.trim()}</del><ins class="critic-insertion">${newPart.trim()}</ins></span>`
    },
  )
  html = html.replace(
    /\{\+\+([\s\S]*?)\+\+\}/g,
    (m, inner) => `<ins class="critic-insertion" data-critic="${encodeURIComponent(m)}">${inner}</ins>`,
  )
  html = html.replace(
    /\{--([\s\S]*?)--\}/g,
    (m, inner) => `<del class="critic-deletion" data-critic="${encodeURIComponent(m)}">${inner}</del>`,
  )
  html = html.replace(
    /\{==([\s\S]*?)==\}/g,
    (m, inner) => `<mark class="critic-highlight" data-critic="${encodeURIComponent(m)}">${inner}</mark>`,
  )
  html = html.replace(/\{>>([\s\S]*?)<<\}/g, (m, content) => {
    const safe = content.trim().replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const encoded = encodeURIComponent(m)
    // Parse VCP format: @handle (date): text
    const vcpMatch = safe.match(/^(@\w+)\s+\(([^)]+)\):\s*(.+)$/)
    if (vcpMatch) {
      const [, handle, date, text] = vcpMatch
      return `<span class="critic-comment" data-critic="${encoded}" data-author="${handle}" data-date="${date}" title="${handle} (${date}): ${text}"><span class="critic-comment-icon">&#x1F4AC;</span><span class="critic-comment-bubble"><strong>${handle}</strong> <time>${date}</time><br>${text}</span></span>`
    }
    return `<span class="critic-comment" data-critic="${encoded}" title="${safe}"><span class="critic-comment-icon">&#x1F4AC;</span><span class="critic-comment-bubble">${safe}</span></span>`
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
      // Also apply to list items and blockquotes
      listitem({ tokens }) {
        let html = this.parser.parseInline(tokens)
        html = applyCriticMarkup(html)
        return `<li>${html}</li>\n`
      },
    },
  }
}
