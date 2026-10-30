/**
 * 浏览器内 JS 沙箱
 *
 * 真实执行，不是假装执行：
 * - 用 sandbox="allow-scripts" 的 iframe（无 allow-same-origin），拿到唯一源，拿不到主页面 DOM / cookie / localStorage
 * - 代码在 iframe 内通过 new Function 执行，主页面不做 eval
 * - 超时直接移除 iframe，进程级隔离由浏览器负责
 *
 * 能力边界（诚实说明）：
 * - 只能跑纯 JS（无 DOM、无网络、无 require/import）
 * - Node.js 的 http / fs / net 跑不了，这类练习走"本地运行说明 + 代码审查"路径
 */

const TOKEN = 'sbx_' + Math.random().toString(36).slice(2)

export interface CheckResult {
  name: string
  pass: boolean
  error?: string
}

export interface RunResult {
  ok: boolean
  logs: string[]
  value?: unknown
  error?: string
  checks?: CheckResult[]
  ms: number
}

interface RunOptions {
  checks?: { name: string; expr: string }[]
  timeout?: number
}

const BOOTSTRAP = `<!doctype html><meta charset="utf-8"><script>
const TOKEN = ${JSON.stringify(TOKEN)};
function fmt(v) {
  if (typeof v === 'string') return v;
  if (v instanceof Error) return v.name + ': ' + v.message;
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}
window.addEventListener('message', async function (e) {
  if (!e.data || e.data.token !== TOKEN) return;
  const logs = [];
  const cap = function (level) {
    return function () {
      logs.push({ level: level, text: Array.prototype.map.call(arguments, fmt).join(' ') });
    };
  };
  console.log = cap('log');
  console.warn = cap('warn');
  console.error = cap('error');
  console.info = cap('info');

  let value, error = null;
  try {
    const fn = new Function('"use strict";' + e.data.code);
    value = await fn();
  } catch (err) {
    error = (err && err.message) ? String(err.message) : String(err);
  }

  let checks;
  if (!error && e.data.checks && e.data.checks.length) {
    checks = [];
    for (const c of e.data.checks) {
      try {
        const probe = new Function('result', '"use strict";return (' + c.expr + ')');
        const pass = !!(await probe(value));
        checks.push({ name: c.name, pass: pass });
      } catch (err) {
        checks.push({ name: c.name, pass: false, error: String(err && err.message || err) });
      }
    }
  }

  let serialized;
  try {
    serialized = JSON.parse(JSON.stringify(value === undefined ? null : value));
  } catch (e) {
    serialized = String(value);
  }

  parent.postMessage({ token: TOKEN, type: 'done', logs: logs, value: serialized, error: error, checks: checks }, '*');
});
<\/script>`

export function runInSandbox(code: string, opts: RunOptions = {}): Promise<RunResult> {
  const timeout = opts.timeout ?? 4000
  const started = performance.now()

  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve({ ok: false, logs: [], error: '沙箱只能在浏览器中运行', ms: 0 })
      return
    }

    const iframe = document.createElement('iframe')
    iframe.setAttribute('sandbox', 'allow-scripts')
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden'
    iframe.srcdoc = BOOTSTRAP

    let settled = false
    const finish = (res: RunResult) => {
      if (settled) return
      settled = true
      window.removeEventListener('message', onMessage)
      clearTimeout(timer)
      iframe.remove()
      resolve(res)
    }

    const onMessage = (e: MessageEvent) => {
      const d = e.data
      if (!d || d.token !== TOKEN || d.type !== 'done') return
      finish({
        ok: !d.error && (!d.checks || d.checks.every((c: CheckResult) => c.pass)),
        logs: (d.logs || []).map((l: { level: string; text: string }) =>
          l.level === 'log' ? l.text : `[${l.level}] ${l.text}`,
        ),
        value: d.value,
        error: d.error || undefined,
        checks: d.checks,
        ms: Math.round(performance.now() - started),
      })
    }

    const timer = setTimeout(() => {
      finish({
        ok: false,
        logs: [],
        error: `执行超时（>${timeout}ms）。检查是否有死循环，或 await 了一个永远不会 resolve 的 Promise。`,
        ms: timeout,
      })
    }, timeout)

    window.addEventListener('message', onMessage)

    iframe.onload = () => {
      iframe.contentWindow?.postMessage({ token: TOKEN, code, checks: opts.checks }, '*')
    }

    document.body.appendChild(iframe)
  })
}
