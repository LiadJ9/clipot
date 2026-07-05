// Turn arbitrary (possibly model-provided) text into a safe *.svg basename.
export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? ''
  const cleaned = base.replace(/[^a-zA-Z0-9._ -]/g, '').trim()
  if (!cleaned) return 'untitled.svg'
  return cleaned.toLowerCase().endsWith('.svg') ? cleaned : `${cleaned}.svg`
}
