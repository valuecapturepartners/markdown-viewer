// Converts a Tiptap/ProseMirror document (JSON) back to a markdown string,
// including CriticMarkup syntax for our custom marks and nodes.

function applyMark(mark, text) {
  switch (mark.type) {
    case 'bold':            return `**${text}**`
    case 'italic':          return `_${text}_`
    case 'code':            return `\`${text}\``
    case 'strike':          return `~~${text}~~`
    case 'criticInsertion': {
      const a = mark.attrs?.author
      return `{++ ${a ? `@${a}: ` : ''}${text} ++}`
    }
    case 'criticDeletion': {
      const a = mark.attrs?.author
      return `{-- ${a ? `@${a}: ` : ''}${text} --}`
    }
    case 'criticHighlight': return `{== ${text} ==}`
    default:                return text
  }
}

function serializeInlineNode(node) {
  switch (node.type) {
    case 'text': {
      let text = node.text || ''
      // Apply marks from outermost to innermost (reverse so inner wraps first)
      ;(node.marks || []).slice().reverse().forEach(m => { text = applyMark(m, text) })
      return text
    }
    case 'hardBreak':
      return '  \n'
    case 'criticSubstitution':
      return `{~~ ${node.attrs?.old ?? ''} ~> ${node.attrs?.new ?? ''} ~~}`
    case 'criticComment': {
      const h = (node.attrs?.author || '').startsWith('@')
        ? node.attrs.author
        : `@${node.attrs?.author || ''}`
      const resolved = node.attrs?.resolved ? ' [resolved]' : ''
      return `{>> ${h} (${node.attrs?.date || ''})${resolved}: ${node.attrs?.text || ''} <<}`
    }
    default: {
      // Fallback: recurse into children
      return serializeInlineChildren(node)
    }
  }
}

function serializeInlineChildren(node) {
  return (node.content || []).map(serializeInlineNode).join('')
}

function serializeBlockNode(node, ctx = { listDepth: 0, ordered: false, start: 1 }) {
  switch (node.type) {
    case 'paragraph':
      return serializeInlineChildren(node)

    case 'heading': {
      const level = node.attrs?.level ?? 1
      return `${'#'.repeat(level)} ${serializeInlineChildren(node)}`
    }

    case 'codeBlock': {
      const lang = node.attrs?.language || ''
      const code = (node.content || []).map(n => n.text || '').join('')
      return `\`\`\`${lang}\n${code}\n\`\`\``
    }

    case 'blockquote': {
      const inner = (node.content || [])
        .map(child => serializeBlockNode(child, ctx))
        .join('\n\n')
      return inner.split('\n').map(l => `> ${l}`).join('\n')
    }

    case 'horizontalRule':
      return '---'

    case 'taskList': {
      return (node.content || [])
        .map(item => serializeTaskItem(item, { listDepth: ctx.listDepth }))
        .join('\n')
    }

    case 'taskItem':
      return serializeTaskItem(node, ctx)

    case 'bulletList': {
      return (node.content || [])
        .map(item => serializeListItem(item, { listDepth: ctx.listDepth, ordered: false }))
        .join('\n')
    }

    case 'orderedList': {
      const start = node.attrs?.start ?? 1
      return (node.content || [])
        .map((item, i) => serializeListItem(item, { listDepth: ctx.listDepth, ordered: true, index: start + i }))
        .join('\n')
    }

    case 'listItem':
      return serializeListItem(node, ctx)

    case 'table': {
      const rows = node.content || []
      if (!rows.length) return ''
      const rendered = rows.map(row => {
        const cells = (row.content || []).map(cell => {
          return serializeInlineChildren(cell).replace(/\|/g, '\\|')
        })
        return `| ${cells.join(' | ')} |`
      })
      // Insert separator after first row (header)
      const firstRow = node.content?.[0]
      const colCount = (firstRow?.content || []).length
      const sep = `| ${Array(colCount).fill('---').join(' | ')} |`
      rendered.splice(1, 0, sep)
      return rendered.join('\n')
    }

    // tableRow / tableHeader / tableCell are handled inside 'table' above
    case 'tableRow':
    case 'tableHeader':
    case 'tableCell':
      return serializeInlineChildren(node)

    default:
      return serializeInlineChildren(node)
  }
}

function serializeTaskItem(node, ctx) {
  const indent = '  '.repeat(ctx.listDepth || 0)
  const check = node.attrs?.checked ? 'x' : ' '
  const children = node.content || []
  const [first, ...rest] = children
  const firstText = first ? serializeBlockNode(first, { listDepth: (ctx.listDepth || 0) + 1 }) : ''
  const restText = rest.map(child => serializeBlockNode(child, ctx)).join('\n')
  return `${indent}- [${check}] ${firstText}${restText ? '\n' + restText : ''}`
}

function serializeListItem(node, ctx) {
  const indent = '  '.repeat(ctx.listDepth)
  const bullet = ctx.ordered ? `${ctx.index ?? 1}.` : '-'
  const children = node.content || []

  // First paragraph (inline), rest as nested blocks
  const [first, ...rest] = children
  const firstText = first ? serializeBlockNode(first, { ...ctx, listDepth: ctx.listDepth + 1 }) : ''

  const restText = rest.map(child => {
    if (child.type === 'bulletList' || child.type === 'orderedList') {
      return serializeBlockNode(child, { ...ctx, listDepth: ctx.listDepth + 1 })
    }
    return serializeBlockNode(child, ctx)
  }).join('\n')

  return `${indent}${bullet} ${firstText}${restText ? '\n' + restText : ''}`
}

/**
 * Serialize a Tiptap editor's JSON document to a markdown string.
 * Call with: serializeToMarkdown(editor.getJSON())
 */
export function serializeToMarkdown(doc) {
  if (!doc?.content) return ''
  return doc.content
    .map(node => serializeBlockNode(node))
    .filter(s => s !== null && s !== undefined)
    .join('\n\n')
    .trim()
}
