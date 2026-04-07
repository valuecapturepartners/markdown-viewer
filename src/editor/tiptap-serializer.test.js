import { describe, it, expect } from 'vitest'
import { serializeToMarkdown } from './tiptap-serializer.js'

// ─── helpers ─────────────────────────────────────────────────────────────────

// Build minimal Tiptap JSON docs for testing
function doc(...blocks) {
  return { type: 'doc', content: blocks }
}
function para(...inline) {
  return { type: 'paragraph', content: inline }
}
function text(t, ...marks) {
  const node = { type: 'text', text: t }
  if (marks.length) node.marks = marks
  return node
}
function mark(type, attrs) {
  return attrs ? { type, attrs } : { type }
}
function heading(level, ...inline) {
  return { type: 'heading', attrs: { level }, content: inline }
}
function codeBlock(lang, code) {
  return { type: 'codeBlock', attrs: { language: lang }, content: [{ type: 'text', text: code }] }
}
function blockquote(...blocks) {
  return { type: 'blockquote', content: blocks }
}
function bulletList(...items) {
  return { type: 'bulletList', content: items }
}
function orderedList(...items) {
  return { type: 'orderedList', attrs: { start: 1 }, content: items }
}
function listItem(...blocks) {
  return { type: 'listItem', content: blocks }
}
function hr() {
  return { type: 'horizontalRule' }
}
function criticSubstitution(oldText, newText) {
  return { type: 'criticSubstitution', attrs: { old: oldText, new: newText } }
}
function criticComment(author, date, t) {
  return { type: 'criticComment', attrs: { author, date, text: t } }
}

// ─── basic blocks ─────────────────────────────────────────────────────────────

describe('paragraph', () => {
  it('plain text', () => {
    expect(serializeToMarkdown(doc(para(text('Hello world'))))).toBe('Hello world')
  })

  it('multiple paragraphs separated by blank line', () => {
    const r = serializeToMarkdown(doc(para(text('First')), para(text('Second'))))
    expect(r).toBe('First\n\nSecond')
  })
})

describe('headings', () => {
  it('h1', () => {
    expect(serializeToMarkdown(doc(heading(1, text('Title'))))).toBe('# Title')
  })
  it('h2', () => {
    expect(serializeToMarkdown(doc(heading(2, text('Sub'))))).toBe('## Sub')
  })
  it('h3', () => {
    expect(serializeToMarkdown(doc(heading(3, text('Deep'))))).toBe('### Deep')
  })
})

describe('code block', () => {
  it('fenced with language', () => {
    const r = serializeToMarkdown(doc(codeBlock('js', 'const x = 1')))
    expect(r).toBe('```js\nconst x = 1\n```')
  })
  it('fenced without language', () => {
    const r = serializeToMarkdown(doc(codeBlock('', 'plain code')))
    expect(r).toBe('```\nplain code\n```')
  })
})

describe('blockquote', () => {
  it('single paragraph', () => {
    const r = serializeToMarkdown(doc(blockquote(para(text('Quote')))))
    expect(r).toBe('> Quote')
  })
})

describe('horizontal rule', () => {
  it('renders as ---', () => {
    expect(serializeToMarkdown(doc(hr()))).toBe('---')
  })
})

describe('lists', () => {
  it('bullet list', () => {
    const r = serializeToMarkdown(doc(bulletList(
      listItem(para(text('Alpha'))),
      listItem(para(text('Beta'))),
    )))
    expect(r).toBe('- Alpha\n- Beta')
  })

  it('ordered list', () => {
    const r = serializeToMarkdown(doc(orderedList(
      listItem(para(text('First'))),
      listItem(para(text('Second'))),
    )))
    expect(r).toBe('1. First\n2. Second')
  })
})

// ─── inline marks ─────────────────────────────────────────────────────────────

describe('inline marks', () => {
  it('bold', () => {
    const r = serializeToMarkdown(doc(para(text('Hello'), text('world', mark('bold')))))
    expect(r).toContain('**world**')
  })

  it('italic', () => {
    const r = serializeToMarkdown(doc(para(text('text', mark('italic')))))
    expect(r).toContain('_text_')
  })

  it('code', () => {
    const r = serializeToMarkdown(doc(para(text('code', mark('code')))))
    expect(r).toContain('`code`')
  })

  it('strikethrough', () => {
    const r = serializeToMarkdown(doc(para(text('struck', mark('strike')))))
    expect(r).toContain('~~struck~~')
  })
})

// ─── CriticMarkup marks ───────────────────────────────────────────────────────

describe('CriticMarkup marks on text nodes', () => {
  it('criticInsertion → {++ text ++}', () => {
    const r = serializeToMarkdown(doc(para(text('added', mark('criticInsertion')))))
    expect(r).toBe('{++ added ++}')
  })

  it('criticDeletion → {-- text --}', () => {
    const r = serializeToMarkdown(doc(para(text('removed', mark('criticDeletion')))))
    expect(r).toBe('{-- removed --}')
  })

  it('criticHighlight → {== text ==}', () => {
    const r = serializeToMarkdown(doc(para(text('highlight', mark('criticHighlight')))))
    expect(r).toBe('{== highlight ==}')
  })
})

// ─── CriticMarkup atom nodes ──────────────────────────────────────────────────

describe('CriticSubstitution node', () => {
  it('renders {~~ old ~> new ~~}', () => {
    const r = serializeToMarkdown(doc(para(criticSubstitution('old', 'new'))))
    expect(r).toBe('{~~ old ~> new ~~}')
  })

  it('old comes first, new comes second', () => {
    const r = serializeToMarkdown(doc(para(criticSubstitution('foo', 'bar'))))
    expect(r).toMatch(/\{~~ foo ~> bar ~~\}/)
  })

  it('empty old and new still produces valid syntax', () => {
    const r = serializeToMarkdown(doc(para(criticSubstitution('', ''))))
    expect(r).toMatch(/\{~~.*~>.*~~\}/)
  })
})

describe('CriticComment node', () => {
  it('renders {>> @handle (date): text <<}', () => {
    const r = serializeToMarkdown(doc(para(criticComment('@alice', '2026-04-07', 'review'))))
    expect(r).toBe('{>> @alice (2026-04-07): review <<}')
  })

  it('prepends @ if missing from author', () => {
    const r = serializeToMarkdown(doc(para(criticComment('bob', '2026-04-07', 'ok'))))
    expect(r).toBe('{>> @bob (2026-04-07): ok <<}')
  })
})
22
// ─── mixed content ────────────────────────────────────────────────────────────

describe('mixed inline content', () => {
  it('plain + bold + plain', () => {
    const r = serializeToMarkdown(doc(para(
      text('Hello '),
      text('bold', mark('bold')),
      text(' world'),
    )))
    expect(r).toBe('Hello **bold** world')
  })

  it('insertion inside a sentence', () => {
    const r = serializeToMarkdown(doc(para(
      text('Hello '),
      text('new ', mark('criticInsertion')),
      text('world'),
    )))
    expect(r).toBe('Hello {++ new  ++}world')
  })

  it('substitution node in a sentence', () => {
    const r = serializeToMarkdown(doc(para(
      text('Hello '),
      criticSubstitution('world', 'earth'),
    )))
    expect(r).toBe('Hello {~~ world ~> earth ~~}')
  })
})

// ─── null / empty safety ──────────────────────────────────────────────────────

describe('edge cases', () => {
  it('empty doc returns empty string', () => {
    expect(serializeToMarkdown({ type: 'doc', content: [] })).toBe('')
  })

  it('null doc returns empty string', () => {
    expect(serializeToMarkdown(null)).toBe('')
  })

  it('paragraph with no content', () => {
    expect(serializeToMarkdown(doc({ type: 'paragraph', content: [] }))).toBe('')
  })
})
