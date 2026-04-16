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
      dom.className = `critic-comment${node.attrs.resolved ? ' critic-comment-resolved' : ''}`
      dom.contentEditable = 'false'
      dom.dataset.author = node.attrs.author
      dom.dataset.date = node.attrs.date
      dom.dataset.resolved = node.attrs.resolved ? 'true' : 'false'
      dom.title = `${node.attrs.author} (${node.attrs.date}): ${node.attrs.text}`

      const icon = document.createElement('span')
      icon.className = 'critic-comment-icon'
      icon.textContent = node.attrs.resolved ? '\u2713' : '\u{1F4AC}'
      dom.appendChild(icon)

      dom.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        // Remove any other open popover
        document.querySelectorAll('.critic-comment-popover').forEach(el => el.remove())

        const popover = document.createElement('div')
        popover.className = 'critic-comment-popover'

        // Header
        const header = document.createElement('div')
        header.className = 'ccp-header'
        const authorEl = document.createElement('strong')
        authorEl.textContent = node.attrs.author
        const dateEl = document.createElement('time')
        dateEl.textContent = node.attrs.date
        const close = document.createElement('button')
        close.className = 'ccp-close'
        close.textContent = '\u2715'
        close.addEventListener('click', (ev) => { ev.stopPropagation(); popover.remove() })
        header.append(authorEl, dateEl, close)

        // Body with @mention rendering
        const body = document.createElement('div')
        body.className = 'ccp-body'
        renderCommentText(node.attrs.text, body)

        // Actions bar (resolve + reply)
        const actions = document.createElement('div')
        actions.className = 'ccp-actions'

        const resolveBtn = document.createElement('button')
        resolveBtn.className = 'ccp-action-btn'
        resolveBtn.textContent = node.attrs.resolved ? 'Unresolve' : 'Resolve'
        resolveBtn.addEventListener('click', (ev) => {
          ev.stopPropagation()
          const pos = getPos()
          if (typeof pos === 'number') {
            editor.chain().focus()
              .command(({ tr }) => {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  resolved: !node.attrs.resolved,
                })
                return true
              })
              .run()
          }
          popover.remove()
        })

        const replyBtn = document.createElement('button')
        replyBtn.className = 'ccp-action-btn ccp-reply-btn'
        replyBtn.textContent = 'Reply'
        replyBtn.addEventListener('click', (ev) => {
          ev.stopPropagation()
          // Show reply input
          replyBtn.style.display = 'none'
          const replyBox = document.createElement('div')
          replyBox.className = 'ccp-reply-box'
          const replyInput = document.createElement('textarea')
          replyInput.className = 'ccp-reply-input'
          replyInput.placeholder = 'Write a reply...'
          replyInput.rows = 2
          const replyActions = document.createElement('div')
          replyActions.className = 'ccp-reply-actions'
          const cancelBtn = document.createElement('button')
          cancelBtn.className = 'ccp-action-btn'
          cancelBtn.textContent = 'Cancel'
          cancelBtn.addEventListener('click', () => {
            replyBox.remove()
            replyBtn.style.display = ''
          })
          const sendBtn = document.createElement('button')
          sendBtn.className = 'ccp-action-btn ccp-send-btn'
          sendBtn.textContent = 'Send'
          sendBtn.addEventListener('click', () => {
            const replyText = replyInput.value.trim()
            if (!replyText) return
            const pos = getPos()
            if (typeof pos === 'number') {
              // Get current user handle from the editor's trackChanges author
              const ext = editor.extensionManager.extensions.find(e => e.name === 'trackChanges')
              const handle = ext?.options.author || 'unknown'
              const date = new Date().toISOString().split('T')[0]
              const h = handle.startsWith('@') ? handle : `@${handle}`
              // Insert reply comment right after this comment node
              editor.chain().focus()
                .insertContentAt(pos + 1, {
                  type: 'criticComment',
                  attrs: { author: h, date, text: replyText, resolved: false },
                })
                .run()
            }
            popover.remove()
          })
          replyInput.addEventListener('keydown', (ke) => {
            if (ke.key === 'Enter' && (ke.ctrlKey || ke.metaKey)) {
              ke.preventDefault()
              sendBtn.click()
            }
            if (ke.key === 'Escape') cancelBtn.click()
          })
          replyActions.append(cancelBtn, sendBtn)
          replyBox.append(replyInput, replyActions)
          popover.appendChild(replyBox)
          setTimeout(() => replyInput.focus(), 0)
        })

        actions.append(resolveBtn, replyBtn)
        popover.append(header, body, actions)

        // Position near the icon
        const rect = dom.getBoundingClientRect()
        popover.style.position = 'fixed'
        popover.style.left = Math.min(rect.left, window.innerWidth - 300) + 'px'
        popover.style.top = (rect.bottom + 6) + 'px'
        document.body.appendChild(popover)

        // Close on outside click
        const onOutside = (ev) => {
          if (!popover.contains(ev.target) && !dom.contains(ev.target)) {
            popover.remove()
            document.removeEventListener('pointerdown', onOutside, true)
          }
        }
        setTimeout(() => document.addEventListener('pointerdown', onOutside, true), 0)
      })

      return { dom }
    }
  },
})
