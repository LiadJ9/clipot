import { describe, it, expect } from 'vitest'
import { displayText, countEdits } from '@/lib/threadDisplay'

describe('threadDisplay', () => {
  it('collapses a fenced svg block to a short note, keeping prose', () => {
    expect(displayText('Here is a dog:\n```svg\n<svg><circle/></svg>\n```')).toBe('Here is a dog: (SVG generated)')
  })
  it('collapses a bare <svg>…</svg>', () => {
    expect(displayText('Sure <svg id="x"><rect/></svg> done')).toBe('Sure (SVG generated) done')
  })
  it('strips <<<FILE>>> blocks (with a name) to the fallback note', () => {
    expect(displayText('<<<FILE dog.svg\n<svg/>\n>>>')).toBe('(edit applied)')
  })
  it('leaves non-svg fenced code and plain prose alone', () => {
    expect(displayText('run ```js\nconsole.log(1)\n``` ok')).toBe('run ```js\nconsole.log(1)\n``` ok')
    expect(displayText('just text')).toBe('just text')
  })
  it('countEdits counts EDIT and FILE markers', () => {
    expect(countEdits('<<<EDIT\n>>><<<FILE a.svg\n>>>')).toBe(2)
  })
})
