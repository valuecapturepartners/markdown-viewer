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
export const CriticComment = Node.create({
  name: 'criticComment',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => ({
    author: { default: '' },
    date:   { default: '' },
    text:   { default: '' },
  }),
  renderHTML: ({ node }) => [
    'span',
    {
      class: 'critic-comment',
      'data-author': node.attrs.author,
      'data-date':   node.attrs.date,
      title: `${node.attrs.author} (${node.attrs.date}): ${node.attrs.text}`,
      contenteditable: 'false',
    },
    ['span', { class: 'critic-comment-icon' }, '\u{1F4AC}'],
  ],
  parseHTML: () => [{
    tag: 'span.critic-comment',
    getAttrs: el => ({
      author: el.dataset.author || '',
      date:   el.dataset.date   || '',
      text:   (el.getAttribute('title') || '').replace(/^.*?\): /, ''),
    }),
  }],
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span')
      dom.className = 'critic-comment'
      dom.contentEditable = 'false'
      dom.dataset.author = node.attrs.author
      dom.dataset.date = node.attrs.date
      dom.title = `${node.attrs.author} (${node.attrs.date}): ${node.attrs.text}`

      const icon = document.createElement('span')
      icon.className = 'critic-comment-icon'
      icon.textContent = '\u{1F4AC}'
      dom.appendChild(icon)

      dom.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        // Remove any other open popover
        document.querySelectorAll('.critic-comment-popover').forEach(el => el.remove())

        const popover = document.createElement('div')
        popover.className = 'critic-comment-popover'

        const header = document.createElement('div')
        header.className = 'ccp-header'
        const author = document.createElement('strong')
        author.textContent = node.attrs.author
        const date = document.createElement('time')
        date.textContent = node.attrs.date
        const close = document.createElement('button')
        close.className = 'ccp-close'
        close.textContent = '\u2715'
        close.addEventListener('click', (ev) => { ev.stopPropagation(); popover.remove() })
        header.append(author, date, close)

        const body = document.createElement('div')
        body.className = 'ccp-body'
        body.textContent = node.attrs.text

        popover.append(header, body)

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
