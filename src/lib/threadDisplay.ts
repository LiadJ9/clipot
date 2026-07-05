export function countEdits(content: string): number {
  const m = content.match(/<<<(EDIT|FILE)/g)
  return m ? m.length : 0
}

// For display: remove raw edit-block markup and collapse any SVG payload
// (fenced or bare) to a short note, keeping surrounding explanation text.
export function displayText(content: string): string {
  const stripped = content
    .replace(/<<<EDIT[\s\S]*?>>>/g, '')
    .replace(/<<<FILE[\s\S]*?>>>/g, '')
    .replace(/\s*```[a-z]*\n?[\s\S]*?```/gi, (block) => (/<svg[\s>]/i.test(block) ? ' (SVG generated)' : block))
    .replace(/\s*<svg[\s>][\s\S]*?<\/svg>/gi, ' (SVG generated)')
    .trim()
  return stripped || '(edit applied)'
}
