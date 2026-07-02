export interface UndoStack {
  push(source: string): void
  undo(): string | null
  redo(): string | null
  current(): string
  canUndo(): boolean
  canRedo(): boolean
}

export function createUndoStack(initial: string): UndoStack {
  const stack: string[] = [initial]
  let cursor = 0
  return {
    push(source) {
      stack.splice(cursor + 1)
      stack.push(source)
      cursor = stack.length - 1
    },
    undo() {
      if (cursor === 0) return null
      cursor--
      return stack[cursor]
    },
    redo() {
      if (cursor >= stack.length - 1) return null
      cursor++
      return stack[cursor]
    },
    current: () => stack[cursor],
    canUndo: () => cursor > 0,
    canRedo: () => cursor < stack.length - 1,
  }
}
