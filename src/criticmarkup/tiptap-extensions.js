import { Mark, Node, mergeAttributes } from '@tiptap/core'

// ── Insertion  {++ text ++} ───────────────────────────────────────────────────
export const CriticInsertion = Mark.create({
  name: 'criticInsertion',
  addAttributes: () => ({
    author: {
      default: '',
      parseHTML: el => el.getAttribute('data-author') || '',
      renderHTML: attrs => attrs.author ? { 'data-author': attrs.author } : {},
    },
  }),
  renderHTML: ({ HTMLAttributes }) =>
    ['ins', mergeAttributes({ class: 'critic-insertion' }, HTMLAttributes), 0],
  parseHTML: () => [{ tag: 'ins.critic-insertion' }],
})

// ── Deletion  {-- text --} ────────────────────────────────────────────────────
export const CriticDeletion = Mark.create({
  name: 'criticDeletion',
  addAttributes: () => ({
    author: {
      default: '',
      parseHTML: el => el.getAttribute('data-author') || '',
      renderHTML: attrs => attrs.author ? { 'data-author': attrs.author } : {},
    },
  }),
  renderHTML: ({ HTMLAttributes }) =>
    ['del', mergeAttributes({ class: 'critic-deletion' }, HTMLAttributes), 0],
  parseHTML: () => [{ tag: 'del.critic-deletion' }],
})

// ── Highlight  {== text ==} ───────────────────────────────────────────────────
export const CriticHighlight = Mark.create({
  name: 'criticHighlight',
  renderHTML: ({ HTMLAttributes }) =>
    ['mark', mergeAttributes({ class: 'critic-highlight' }, HTMLAttributes), 0],
  parseHTML: () => [{ tag: 'mark.critic-highlight' }],
})

// ── Substitution  {~~ old ~> new ~~}  (atomic inline node) ───────────────────
export const CriticSubstitution = Node.create({
  name: 'criticSubstitution',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => ({
    old: { default: '' },
    new: { default: '' },
  }),
  renderHTML: ({ node }) => [
    'span',
    {
      class: 'critic-sub',
      'data-old': node.attrs.old,
      'data-new': node.attrs.new,
      contenteditable: 'false',
    },
    ['del', { class: 'critic-deletion' }, node.attrs.old],
    ['ins', { class: 'critic-insertion' }, node.attrs.new],
  ],
  parseHTML: () => [{
    tag: 'span.critic-sub',
    getAttrs: el => ({ old: el.dataset.old || '', new: el.dataset.new || '' }),
  }],
})

// ── Comment  {>> @handle (date): text <<}  (atomic inline node) ───────────────

// Render @mentions as styled pills in comment text
function renderCommentText(text, container) {
  const mentionRe = /@[\w.-]+/g
  let last = 0
  let match
  while ((match = mentionRe.exec(text)) !== null) {
    if (match.index > last) {
      container.appendChild(document.createTextNode(text.slice(last, match.index)))
    }
    const pill = document.createElement('span')
    pill.className = 'ccp-mention'
    pill.textContent = match[0]
    container.appendChild(pill)
    last = match.index + match[0].length
  }
  if (last < text.length) {
    container.appendChild(document.createTextNode(text.slice(last)))
  }
}

// Collect a run of adjacent criticComment nodes starting at a given position
function getCommentThread(doc, startPos) {
  const comments = []
  let pos = startPos
  while (pos < doc.content.size) {
    const nodeAt = doc.nodeAt(pos)
    if (!nodeAt || nodeAt.type.name !== 'criticComment') break
    comments.push({ node: nodeAt, pos })
    pos += nodeAt.nodeSize
  }
  return comments
}

// Check if this comment is the first in its run of adjacent comments
function isFirstInThread(doc, pos) {
  if (pos <= 0) return true
  const before = doc.nodeAt(pos - 1)
  return !before || before.type.name !== 'criticComment'
}

// Build a single comment entry in the thread popover
function buildCommentEntry(comment, index, threadComments, editor, popover) {
  const entry = document.createElement('div')
  entry.className = `ccp-thread-entry${comment.node.attrs.resolved ? ' ccp-entry-resolved' : ''}`

  const entryHeader = document.createElement('div')
  entryHeader.className = 'ccp-entry-header'
  const authorEl = document.createElement('strong')
  authorEl.textContent = comment.node.attrs.author
  const dateEl = document.createElement('time')
  dateEl.textContent = comment.node.attrs.date
  entryHeader.append(authorEl, dateEl)

  // Resolve button per entry
  const resolveBtn = document.createElement('button')
  resolveBtn.className = 'ccp-entry-resolve'
  resolveBtn.textContent = comment.node.attrs.resolved ? 'Unresolve' : 'Resolve'
  resolveBtn.title = comment.node.attrs.resolved ? 'Unresolve this comment' : 'Resolve this comment'
  resolveBtn.addEventListener('click', (ev) => {
    ev.stopPropagation()
    const pos = comment.pos
    if (typeof pos === 'number') {
      editor.chain().focus()
        .command(({ tr }) => {
          tr.setNodeMarkup(pos, undefined, {
            ...comment.node.attrs,
            resolved: !comment.node.attrs.resolved,
          })
          return true
        })
        .run()
    }
    popover.remove()
  })
  entryHeader.appendChild(resolveBtn)

  const entryBody = document.createElement('div')
  entryBody.className = 'ccp-entry-body'
  renderCommentText(comment.node.attrs.text, entryBody)

  entry.append(entryHeader, entryBody)
  return entry
}

export const CriticComment = Node.create({
  name: 'criticComment',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => ({
    author:   { default: '' },
    date:     { default: '' },
    text:     { default: '' },
    resolved: { default: false },
  }),
  renderHTML: ({ node }) => [
    'span',
    {
      class: `critic-comment${node.attrs.resolved ? ' critic-comment-resolved' : ''}`,
      'data-author': node.attrs.author,
      'data-date':   node.attrs.date,
      'data-resolved': node.attrs.resolved ? 'true' : 'false',
      title: `${node.attrs.author} (${node.attrs.date}): ${node.attrs.text}`,
      contenteditable: 'false',
    },
    ['span', { class: 'critic-comment-icon' }, node.attrs.resolved ? '\u2713' : '\u{1F4AC}'],
  ],
  parseHTML: () => [{
    tag: 'span.critic-comment',
    getAttrs: el => ({
      author: el.dataset.author || '',
      date:   el.dataset.date   || '',
      text:   (el.getAttribute('title') || '').replace(/^.*?\): /, ''),
      resolved: el.dataset.resolved === 'true',
    }),
  }],
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('span')
      dom.contentEditable = 'false'

      const pos = getPos()
      const doc = editor.state.doc
      const first = isFirstInThread(doc, pos)

      if (!first) {
        // Not the first in a thread — hide this node, the first one renders the group
        dom.className = 'critic-comment critic-comment-hidden'
        return { dom }
      }

      // First in thread — collect all adjacent comments
      const threadComments = getCommentThread(doc, pos)
      const count = threadComments.length
      const allResolved = threadComments.every(c => c.node.attrs.resolved)

      dom.className = `critic-comment critic-comment-thread${allResolved ? ' critic-comment-resolved' : ''}`

      const label = document.createElement('span')
      label.className = 'critic-comment-thread-label'
      if (count === 1) {
        label.textContent = `${node.attrs.author}`
      } else {
        label.textContent = `Thread (${count})`
      }
      dom.appendChild(label)

      dom.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        document.querySelectorAll('.critic-comment-popover').forEach(el => el.remove())

        // Re-read thread from current doc state (may have changed)
        const currentPos = getPos()
        const currentDoc = editor.state.doc
        const currentThread = getCommentThread(currentDoc, currentPos)

        const popover = document.createElement('div')
        popover.className = 'critic-comment-popover ccp-thread-popover'

        // Thread header
        const header = document.createElement('div')
        header.className = 'ccp-header'
        const titleEl = document.createElement('strong')
        titleEl.textContent = currentThread.length === 1 ? 'Comment' : `Thread (${currentThread.length})`
        const close = document.createElement('button')
        close.className = 'ccp-close'
        close.textContent = '\u2715'
        close.addEventListener('click', (ev) => { ev.stopPropagation(); popover.remove() })
        header.append(titleEl, close)
        popover.appendChild(header)

        // Thread entries
        const threadBody = document.createElement('div')
        threadBody.className = 'ccp-thread-body'
        currentThread.forEach((comment, i) => {
          threadBody.appendChild(buildCommentEntry(comment, i, currentThread, editor, popover))
        })
        popover.appendChild(threadBody)

        // Reply input at the bottom
        const replyBox = document.createElement('div')
        replyBox.className = 'ccp-reply-box'
        const replyInput = document.createElement('textarea')
        replyInput.className = 'ccp-reply-input'
        replyInput.placeholder = 'Reply...'
        replyInput.rows = 2
        const replyActions = document.createElement('div')
        replyActions.className = 'ccp-reply-actions'
        const sendBtn = document.createElement('button')
        sendBtn.className = 'ccp-action-btn ccp-send-btn'
        sendBtn.textContent = 'Reply'
        sendBtn.addEventListener('click', () => {
          const replyText = replyInput.value.trim()
          if (!replyText) return
          // Insert after the last comment in the thread
          const lastComment = currentThread[currentThread.length - 1]
          const insertPos = lastComment.pos + lastComment.node.nodeSize
          const ext = editor.extensionManager.extensions.find(e => e.name === 'trackChanges')
          const handle = ext?.options.author || 'unknown'
          const date = new Date().toISOString().split('T')[0]
          const h = handle.startsWith('@') ? handle : `@${handle}`
          editor.chain().focus()
            .insertContentAt(insertPos, {
              type: 'criticComment',
              attrs: { author: h, date, text: replyText, resolved: false },
            })
            .run()
          popover.remove()
        })
        replyInput.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter' && (ke.ctrlKey || ke.metaKey)) {
            ke.preventDefault()
            sendBtn.click()
          }
          if (ke.key === 'Escape') popover.remove()
        })
        replyActions.appendChild(sendBtn)
        replyBox.append(replyInput, replyActions)
        popover.appendChild(replyBox)

        // Position near the label
        const rect = dom.getBoundingClientRect()
        popover.style.position = 'fixed'
        popover.style.left = Math.min(rect.left, window.innerWidth - 320) + 'px'
        popover.style.top = (rect.bottom + 6) + 'px'
        // If it would go off the bottom, position above instead
        const spaceBelow = window.innerHeight - rect.bottom - 6
        if (spaceBelow < 300) {
          popover.style.top = ''
          popover.style.bottom = (window.innerHeight - rect.top + 6) + 'px'
        }
        document.body.appendChild(popover)

        const onOutside = (ev) => {
          if (!popover.contains(ev.target) && !dom.contains(ev.target)) {
            popover.remove()
            document.removeEventListener('pointerdown', onOutside, true)
          }
        }
        setTimeout(() => {
          document.addEventListener('pointerdown', onOutside, true)
          replyInput.focus()
        }, 0)
      })

      return { dom }
    }
  },
})
