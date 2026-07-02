// Polyfill CSS.escape for jsdom if not available
if (typeof CSS === 'undefined' || typeof CSS.escape !== 'function') {
  globalThis.CSS = globalThis.CSS || {}
  globalThis.CSS.escape = function (ident: string): string {
    // CSS.escape implementation per spec
    let result = ''
    let i = 0
    while (i < ident.length) {
      const code = ident.charCodeAt(i)
      // If first char is digit, escape it
      if (i === 0 && code >= 48 && code <= 57) {
        result += '\\' + String.fromCharCode(code)
      } else if (code === 0) {
        // Null character
        result += '�'
      } else if (
        code >= 1 &&
        code <= 31 &&
        code !== 9
      ) {
        // Control chars except tab
        result += '\\' + code.toString(16).padStart(1, '0') + ' '
      } else if (code === 34 || code === 39 || code === 40 || code === 41 || code === 44) {
        // Quote, backslash, parens, comma
        result += '\\' + ident[i]
      } else if (i === 0 && ident.length === 1 && code === 45) {
        // Single hyphen
        result += '\\-'
      } else {
        result += ident[i]
      }
      i++
    }
    return result
  }
}
