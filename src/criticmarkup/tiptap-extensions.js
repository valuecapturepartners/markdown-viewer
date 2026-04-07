import { Mark, Node, mergeAttributes } from '@tiptap/core'

// ── Insertion  {++ text ++} ───────────────────────────────────────────────────
export const CriticInsertion = Mark.create({
  name: 'criticInsertion',
  renderHTML: ({ HTMLAttributes }) =>
    ['ins', mergeAttributes({ class: 'critic-insertion' }, HTMLAttributes), 0],
  parseHTML: () => [{ tag: 'ins.critic-insertion' }],
})

// ── Deletion  {-- text --} ────────────────────────────────────────────────────
export const CriticDeletion = Mark.create({
  name: 'criticDeletion',
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
  ],
  parseHTML: () => [{
    tag: 'span.critic-comment',
    getAttrs: el => ({
      author: el.dataset.author || '',
      date:   el.dataset.date   || '',
      text:   (el.getAttribute('title') || '').replace(/^.*?\): /, ''),
    }),
  }],
})
