/**
 * 轻量代码高亮
 *
 * 为什么不用 Shiki / Prism：课程正文的代码是运行时字符串，不是 markdown 代码块，
 * Shiki 需要在构建期处理，塞不进组件。而为了高亮引一个几百 KB 的运行时高亮库不值得。
 *
 * 这里只做 JS/TS/JSON 的粗粒度着色：注释、字符串、数字、关键字、函数调用。
 * 目标是"扫一眼能分清结构"，不是语法精确。宁可少染，不能染错。
 */

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
  'break', 'continue', 'switch', 'case', 'default', 'try', 'catch', 'finally',
  'throw', 'new', 'class', 'extends', 'super', 'this', 'import', 'from', 'export',
  'default', 'async', 'await', 'yield', 'typeof', 'instanceof', 'in', 'of', 'delete',
  'void', 'null', 'undefined', 'true', 'false', 'interface', 'type', 'enum',
  'implements', 'public', 'private', 'protected', 'readonly', 'static', 'as',
  'satisfies', 'keyof', 'declare', 'namespace', 'abstract',
])

const LITERALS = new Set(['null', 'undefined', 'true', 'false', 'this'])

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const TOKEN_RE =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g

export function highlight(code: string, lang = 'ts'): string {
  const l = lang.toLowerCase()
  if (!['ts', 'js', 'javascript', 'typescript', 'json', 'tsx', 'jsx', 'bash', 'sh'].includes(l)) {
    return esc(code)
  }

  let out = ''
  let last = 0
  let m: RegExpExecArray | null

  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(code))) {
    out += esc(code.slice(last, m.index))
    const [raw, comment, str, num, word] = m

    if (comment) {
      out += `<span class="tk-com">${esc(raw)}</span>`
    } else if (str) {
      out += `<span class="tk-str">${esc(raw)}</span>`
    } else if (num) {
      out += `<span class="tk-num">${esc(raw)}</span>`
    } else if (word) {
      // 后面紧跟 ( 的标识符按函数调用处理
      const rest = code.slice(m.index + raw.length)
      const isCall = /^\s*\(/.test(rest)
      if (LITERALS.has(word)) {
        out += `<span class="tk-lit">${esc(word)}</span>`
      } else if (KEYWORDS.has(word)) {
        out += `<span class="tk-kw">${esc(word)}</span>`
      } else if (isCall) {
        out += `<span class="tk-fn">${esc(word)}</span>`
      } else {
        out += esc(word)
      }
    } else {
      out += esc(raw)
    }
    last = m.index + raw.length
  }
  out += esc(code.slice(last))
  return out
}
