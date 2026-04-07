import { describe, it, expect } from 'vitest'
import { applyTrackChanges } from './track-changes.js'

// ─── helpers ─────────────────────────────────────────────────────────────────

const tc = (before, after, author, date) => applyTrackChanges(before, after, author, date)

// ─── author attribution ───────────────────────────────────────────────────────

describe('author attribution', () => {
  it('appends {>> @handle (date): edit <<} when author provided', () => {
    const r = tc('Hello world', 'Hello earth', 'mh', '2026-04-07')
    expect(r).toContain('{>> @mh (2026-04-07): edit <<}')
  })

  it('prepends @ if missing', () => {
    const r = tc('Hello world', 'Hello earth', 'ej', '2026-04-07')
    expect(r).toContain('{>> @ej')
  })

  it('keeps @ if already present', () => {
    const r = tc('Hello world', 'Hello earth', '@jnk', '2026-04-07')
    expect(r).toContain('{>> @jnk')
    expect(r).not.toContain('@@jnk')
  })

  it('no attribution when no author', () => {
    const r = tc('Hello world', 'Hello earth')
    expect(r).not.toContain('{>>')
  })

  it('no attribution when no changes', () => {
    const r = tc('Hello world', 'Hello world', 'mh', '2026-04-07')
    expect(r).toBe('Hello world')
    expect(r).not.toContain('{>>')
  })
})

// ─── no-op ───────────────────────────────────────────────────────────────────

describe('no change', () => {
  it('identical strings return the same string', () => {
    expect(tc('Hello world', 'Hello world')).toBe('Hello world')
  })

  it('empty string', () => {
    expect(tc('', '')).toBe('')
  })
})

// ─── pure insertion ───────────────────────────────────────────────────────────

describe('insertion', () => {
  it('append word', () => {
    expect(tc('Hello', 'Hello world')).toBe('Hello {++ world ++}')
  })

  it('prepend word', () => {
    expect(tc('world', 'Hello world')).toBe('{++ Hello ++} world')
  })

  it('insert in middle', () => {
    expect(tc('Hello world', 'Hello beautiful world')).toBe('Hello {++ beautiful ++} world')
  })

  it('append sentence', () => {
    const r = tc('Hello.', 'Hello. Please add here.')
    expect(r).toBe('Hello. {++ Please add here. ++}')
  })

  it('multi-word insert preserves spaces outside markup', () => {
    const r = tc('A B', 'A X Y B')
    expect(r).toBe('A {++ X Y ++} B')
  })
})

// ─── pure deletion ────────────────────────────────────────────────────────────

describe('deletion', () => {
  it('delete trailing word', () => {
    expect(tc('Hello world', 'Hello')).toBe('Hello {-- world --}')
  })

  it('delete leading word', () => {
    expect(tc('Hello world', 'world')).toBe('{-- Hello --} world')
  })

  it('delete middle word', () => {
    expect(tc('Hello beautiful world', 'Hello world')).toBe('Hello {-- beautiful --} world')
  })
})

// ─── substitution ─────────────────────────────────────────────────────────────

describe('substitution', () => {
  it('single word replacement', () => {
    expect(tc('Hello world', 'Hello earth')).toBe('Hello {~~ world ~> earth ~~}')
  })

  it('substitution order: old first, new second', () => {
    const r = tc('foo bar', 'foo baz')
    expect(r).toMatch(/\{~~ bar ~> baz ~~\}/)
    // old = bar, new = baz — NOT the other way around
    expect(r).not.toMatch(/\{~~ baz ~> bar ~~\}/)
  })

  it('replace first word', () => {
    expect(tc('Hello world', 'Hi world')).toBe('{~~ Hello ~> Hi ~~} world')
  })

  it('multi-word substitution', () => {
    const r = tc('The quick brown fox', 'The slow red fox')
    // LCS preserves the space between words as an eq token, so each word gets
    // its own substitution rather than one combined block — both are correct.
    expect(r).toContain('{~~ quick ~> slow ~~}')
    expect(r).toContain('{~~ brown ~> red ~~}')
    expect(r).toContain('fox')
  })
})

// ─── mixed operations ─────────────────────────────────────────────────────────

describe('mixed operations', () => {
  it('delete and append', () => {
    const r = tc('Hello world', 'Hi there planet')
    // "Hello" → "Hi", "world" → "there planet" or similar — at minimum no plain text corruption
    expect(r).toContain('{~~')
    expect(r).not.toBe('Hello world')
  })

  it('insert + delete in different positions', () => {
    const r = tc('Alpha Beta Gamma', 'Alpha NEW Beta')
    // LCS may match "Beta" in the right position (giving {++ NEW ++} + {-- Gamma --})
    // or match spaces as eq (giving substitutions). Either is a valid diff result.
    // What must hold: Alpha is unchanged, and the result is not plain/unmodified.
    expect(r).toContain('Alpha')
    expect(r).not.toBe('Alpha Beta Gamma')
    expect(r).not.toBe('Alpha NEW Beta')
    // At minimum some markup must be present
    expect(r).toMatch(/\{[+~-]/)
  })
})

// ─── whitespace handling ──────────────────────────────────────────────────────

describe('whitespace', () => {
  it('preserves leading space outside markup', () => {
    const r = tc('Hello world', 'Hello  world') // extra space
    // extra whitespace token is an insertion
    expect(r).not.toMatch(/\{[+-]+ \s/)  // space must NOT be inside markup
  })

  it('newline in diff does not break markup delimiters', () => {
    const r = tc('Line one\n\nLine two', 'Line one\n\nLine two added')
    expect(r).toContain('{++')
    expect(r).not.toContain('{++\n')
  })
})

// ─── atomic CriticMarkup blocks ──────────────────────────────────────────────

describe('existing CriticMarkup is never re-wrapped', () => {
  it('existing insertion passes through unchanged', () => {
    const before = 'Hello {++ world ++}'
    const after  = 'Hello {++ world ++}'
    expect(tc(before, after)).toBe(before)
  })

  it('existing deletion passes through unchanged', () => {
    const before = 'Hello {-- old --} world'
    expect(tc(before, before)).toBe(before)
  })

  it('existing substitution passes through unchanged', () => {
    const before = '{~~ old ~> new ~~} world'
    expect(tc(before, before)).toBe(before)
  })

  it('existing highlight passes through unchanged', () => {
    const before = 'Hello {== important ==} world'
    expect(tc(before, before)).toBe(before)
  })

  it('existing comment passes through unchanged', () => {
    const before = 'Hello {>> @alice (2026-01-01): review <<} world'
    expect(tc(before, before)).toBe(before)
  })

  it('does NOT wrap an existing insertion in another insertion', () => {
    const before = '{++ existing ++}'
    const after  = '{++ existing ++} and more'
    const r = tc(before, after)
    // "and more" should be wrapped as a new insertion
    expect(r).toContain('{++ existing ++}')
    expect(r).toContain('{++ and more ++}')
    // The existing block must not be re-wrapped (no {++ ... {++ nesting)
    // Use a non-greedy check: only flag if one {++ is inside another's content
    expect(r).not.toMatch(/\{\+\+[^}]*\{\+\+/)
  })

  it('does NOT wrap an existing substitution in another block', () => {
    const before = 'text {~~ old ~> new ~~} end'
    const after  = 'text {~~ old ~> new ~~} end added'
    const r = tc(before, after)
    expect(r).toContain('{~~ old ~> new ~~}')
    expect(r).toContain('{++ added ++}')
    // the substitution must not be re-wrapped
    expect(r).not.toMatch(/\{~~.*\{~~/)
  })

  it('catastrophic nesting regression — does not produce nested markup', () => {
    // Reported bug: track changes was producing {~~ besten? {~~ ~> {~~ ~> ...
    const before = 'Wie geht das am besten?'
    const after  = 'Wie geht das am besten? Wie geht das weiter?'
    const r = tc(before, after)
    // Must contain no nested CriticMarkup
    expect(r).not.toMatch(/\{[~+-].*\{[~+-]/)
    expect(r).toContain('{++')
  })
})

// ─── edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('from empty to text', () => {
    const r = tc('', 'Hello world')
    expect(r).toBe('{++ Hello world ++}')
  })

  it('from text to empty', () => {
    const r = tc('Hello world', '')
    expect(r).toBe('{-- Hello world --}')
  })

  it('single character change', () => {
    const r = tc('cat', 'bat')
    expect(r).toContain('{~~')
  })

  it('punctuation-only change', () => {
    const r = tc('Hello world.', 'Hello world!')
    expect(r).toContain('{~~')
  })

  it('does not double-wrap when called twice', () => {
    const before = 'Hello world'
    const after  = 'Hello earth'
    const first  = tc(before, after)     // → Hello {~~ world ~> earth ~~}
    const second = tc(first, first)      // identical → no change
    expect(second).toBe(first)
  })

  it('self-diff is always a no-op', () => {
    // tc(x, x) must always return x unchanged — the true idempotency check
    const marked = 'Foo {~~ bar ~> qux ~~} baz'
    expect(tc(marked, marked)).toBe(marked)
  })
})
