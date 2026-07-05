// Promise-based in-app text prompt. Electron does not support window.prompt(),
// so components call promptText(...) and a mounted <PromptHost/> renders the modal.
export type PromptRequest = { message: string; defaultValue: string }

let current: PromptRequest | null = null
let resolver: ((value: string | null) => void) | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function promptText(message: string, defaultValue = ''): Promise<string | null> {
  // If a prompt is already open, cancel it before opening the next.
  resolver?.(null)
  current = { message, defaultValue }
  return new Promise((resolve) => {
    resolver = resolve
    emit()
  })
}

export function settlePrompt(value: string | null) {
  const r = resolver
  resolver = null
  current = null
  emit()
  r?.(value)
}

export function getPromptState(): PromptRequest | null {
  return current
}

export function subscribePrompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
