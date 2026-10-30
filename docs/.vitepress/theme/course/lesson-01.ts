import type { Lesson } from './types'

/**
 * 第一课：从 Vue 前端到 Node.js 后端 —— 一次 HTTP 请求的完整生命周期
 *
 * 写作原则（后续课程沿用）：
 * - 每个知识点都回答四件事：是什么 / 为什么需要 / 怎么实现 / 什么时候不该用
 * - 所有新概念先挂到 Vue / TS 的旧知识上，再往深处走
 * - 代码都是能跑的真代码，不是伪代码
 * - 每步结束留一个问题，逼读者合上页面自己想一次
 */
export const lesson01: Lesson = {
  id: 'L01',
  moduleId: 'node',
  order: 1,
  title: '从 Vue 前端到 Node.js 后端：一次 HTTP 请求的完整生命周期',
  subtitle: '你写了三年 fetch，但从来没看过它在网络上长什么样。这一课把黑盒拆开。',
  minutes: 75,
  level: '入门',
  outcome: '能独立写出一个带路由、校验、错误处理、安全边界的 Node.js HTTP 服务，并说清每一步为什么这么做。',
  goals: [
    '说清一次请求从 fetch 到 Node 回调之间经过的每一层，以及每层可能出的问题',
    '手写 HTTP 报文的首行和关键头，看懂 curl -v 的输出',
    '用 node:http 起一个能处理 GET/POST、带路由和参数解析的服务',
    '判断该用哪个状态码，并说清 400 / 401 / 403 / 404 / 409 / 422 的边界',
    '解释 Node 单线程为什么能处理并发，await 到底挂起了什么',
    '给服务加上四道安全边界：输入校验、body 限制、CORS、超时',
  ],
  prereqs: [
    '会用 Vue 3 的 <script setup> 和 ref',
    '知道 Promise / async await 基本用法',
    '装过 Node.js，能在终端敲 node -v',
  ],

  steps: [
    {
      id: 's1',
      title: '先换一个心智模型：渲染管线 vs 请求管线',
      checkpoint: '如果后端某个接口突然变慢，前端能做的补救有几层？分别是什么？',
      blocks: [
        {
          type: 'p',
          text: '你现在的直觉是"页面 = 状态 + 模板"。数据变了，Vue 重新渲染，屏幕更新。整条链路在你自己的进程里，同步、可预测、出错有 Vue 的警告帮你兜着。',
        },
        {
          type: 'p',
          text: '后端不是这样。后端是"字节进 → 字节出"的管线。一端连着网络（不可信、会超时、会断），另一端连着数据库（会锁、会慢、会挂），中间夹着你的业务代码。你写的函数不是被 Vue 调用的，是被一个你看不见的循环调用的。',
        },
        {
          type: 'analogy',
          title: '和 Vue 的组件树对照',
          text: 'Vue 里数据流是单向的：state → computed → render。后端里数据流也是单向的，但方向相反：request → parse → validate → handle → persist → response。Vue 里你关心"渲染结果对不对"，后端里你关心"输入是否可信、输出是否合规"。前者错了用户看到花屏，后者错了用户看到别人的数据。',
        },
        {
          type: 'flow',
          title: '一次请求的完整链路',
          ascii: `浏览器                     网络                    你的 Node 进程              存储
──────                    ────                    ─────────────              ────
fetch('/api/notes')
  │
  ├─ 1. 拼 URL、查 DNS ──────► DNS 服务器
  ├─ 2. 建 TCP 连接 ────────► 三次握手 ─────────► listen(3000) 的 socket
  ├─ 3. (https) TLS 握手 ───► 证书校验
  ├─ 4. 写请求报文 ─────────► ────────────────► 5. request 事件
  │                                                │
  │                                              6. 路由匹配
  │                                              7. 读 body（流）
  │                                              8. 校验参数
  │                                              9. 查库 ──────────────► PostgreSQL
  │                                             10. 组装响应
  │◄── 11. 响应报文 ────────◄────────────────────┘
  ├─ 12. 解析、resolve
  └─ 13. ref.value = data → 重新渲染`,
        },
        {
          type: 'p',
          text: '这张图上有 13 个位置，每一个都能出问题，而且症状完全不同。你以前只见过第 13 步的结果——"数据没出来"。这一课的目的就是让你在第 13 步看到异常时，能立刻判断问题在第几步。',
        },
        {
          type: 'table',
          head: ['症状', '最可能出问题的位置', '排查手段'],
          rows: [
            ['fetch 直接 reject，控制台红字 "Failed to fetch"', '第 2 步（连不上）或第 3 步（TLS）或 CORS 预检被拒', 'curl -v 看是否能建连；看 Network 面板的 Timing'],
            ['请求发出去了，一直 pending', '第 5 步没触发（服务没起/端口错）或第 9 步卡住', '在服务里打日志；看服务进程是否活着'],
            ['返回 200，但 body 是空的', '第 10 步写了 header 忘了 end，或提前 return', '检查每个分支是否都有 res.end()'],
            ['返回 500，日志里没报错', '第 10 步之前抛错且没被捕获', '加 process.on("uncaughtException")'],
            ['本地正常，线上 404', '第 6 步路由前缀不同（nginx 反代去掉了 /api）', '看 nginx 的 proxy_pass 是否带尾斜杠'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '这一课最值钱的一句话',
          text: '"Failed to fetch" 这个错误信息是浏览器故意模糊的——它不告诉你是 DNS 错、连不上、证书错、还是 CORS 被拒，因为精确信息会泄漏内网结构。所以你不能靠这句话定位，只能靠分层排查。学会分层，比记住任何一个 API 都重要。',
        },
      ],
    },

    {
      id: 's2',
      title: '第 1~4 步：fetch 之后，浏览器到底做了什么',
      checkpoint: '为什么浏览器要把"域名解析"和"TCP 连接"分成两步？合并成一步不行吗？',
      blocks: [
        {
          type: 'p',
          text: '你写 fetch("/api/notes")，浏览器做的是四件互相独立的事。分开理解，因为它们的失败方式和优化手段完全不同。',
        },
        { type: 'h', text: '① URL 分解' },
        {
          type: 'p',
          text: 'fetch("/api/notes?page=2#top") 传的是相对路径，浏览器先拿 location.origin 拼成绝对 URL，然后拆成五段。这个拆分你在后端要一模一样地重做一遍，所以现在就要记住每一段叫什么。',
        },
        {
          type: 'code',
          lang: 'text',
          title: 'URL 的五段结构',
          code: `https://api.example.com:8443/api/notes?page=2&tag=work#top
└─┬─┘   └──────┬───────┘└┬─┘└───┬────┘└──────┬──────┘└┬─┘
scheme      host        port  pathname      search    hash
             └──────┬──────┘
                  origin（scheme + host + port）`,
          note: 'hash 部分（#top）永远不会发给服务器，它只在浏览器本地生效。后端拿不到它，别指望用它传参。',
        },
        { type: 'h', text: '② DNS 解析' },
        {
          type: 'p',
          text: '把 api.example.com 变成 IP。顺序是：浏览器缓存 → 系统 hosts → 系统 DNS 缓存 → 递归解析器 → 根/顶级/权威服务器。这一步的耗时通常 1~50ms，但第一次访问新域名可能是 100ms 以上。',
        },
        {
          type: 'analogy',
          title: '相当于 import 的模块解析',
          text: 'import Button from "@/components/Button.vue" 需要先被解析成真实文件路径，DNS 做的是同一件事——把人类可读的名字变成机器可寻址的地址。区别是 import 失败了构建就报错，DNS 失败了运行时才报错，而且报的是那句模糊的 "Failed to fetch"。',
        },
        { type: 'h', text: '③ TCP 连接（三次握手）' },
        {
          type: 'p',
          text: 'HTTP/1.1 和 HTTP/2 都跑在 TCP 上。建连需要三次握手：客户端 SYN → 服务端 SYN+ACK → 客户端 ACK。这一步至少一个 RTT（往返时延）。北京到上海约 30ms，到美西约 150ms。所以跨洋接口光是建连就吃掉 150ms，这就是为什么要有连接复用和 CDN。',
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'keep-alive 省的就是这一步',
          text: 'HTTP/1.1 默认开启 Connection: keep-alive，一个 TCP 连接可以连续发多个请求。但浏览器对同一域名只开 6 个并发连接（HTTP/1.1 限制）。所以你看到"12 个接口同时发，只有 6 个在跑"就是这个原因。HTTP/2 用多路复用解决了这个问题。',
        },
        { type: 'h', text: '④ TLS 握手（仅 https）' },
        {
          type: 'p',
          text: '比 TCP 握手贵得多：要协商加密套件、验证证书链、交换密钥，TLS 1.2 需要 2 个 RTT，TLS 1.3 优化到 1 个 RTT（会话复用时甚至 0-RTT）。这就是为什么"换 https 之后首屏慢了 200ms"是正常现象，要靠 TLS 1.3 + 会话复用 + CDN 边缘节点来解决。',
        },
        {
          type: 'p',
          text: '握手全部完成后，浏览器才开始写 HTTP 报文。注意这个顺序：**HTTP 是应用层协议，它建立在已经连通的 TCP/TLS 之上**。所以"接口超时"和"连不上"是两类完全不同的故障。',
        },
        {
          type: 'qa',
          q: '为什么本地开发时 127.0.0.1 感觉比 localhost 快？',
          a: '因为 localhost 需要先查一次 DNS（虽然通常解析到 127.0.0.1），而某些系统会先尝试 IPv6 的 ::1，失败后再回退到 IPv4，多了一次失败尝试。Node 18+ 的 dns.setDefaultResultOrder("ipv4first") 就是治这个的。这是真实存在的几毫秒到几十毫秒差异，不是玄学。',
        },
      ],
    },

    {
      id: 's3',
      title: '第 4 步：HTTP 报文长什么样',
      checkpoint: 'Content-Length 和 Transfer-Encoding: chunked 能同时出现吗？为什么？',
      blocks: [
        {
          type: 'p',
          text: 'HTTP 报文是纯文本（HTTP/2 是二进制帧，但语义一样）。你在 DevTools 里看到的"Headers"表格，是浏览器帮你解析后的结果。原始报文长这样：',
        },
        {
          type: 'code',
          lang: 'http',
          title: '请求报文（浏览器 → 服务器）',
          code: `POST /api/notes?draft=1 HTTP/1.1
Host: api.example.com
Content-Type: application/json; charset=utf-8
Content-Length: 42
Authorization: Bearer eyJhbGciOi...
Accept: application/json
User-Agent: Mozilla/5.0 ...

{"title":"周会纪要","content":"讨论了三件事"}`,
        },
        {
          type: 'code',
          lang: 'http',
          title: '响应报文（服务器 → 浏览器）',
          code: `HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Content-Length: 96
Location: /api/notes/42
Cache-Control: no-store

{"id":42,"title":"周会纪要","createdAt":"2026-10-30T06:12:00.000Z"}`,
        },
        {
          type: 'list',
          items: [
            '**首行（start line）**：请求是 `方法 路径 协议版本`，响应是 `协议版本 状态码 原因短语`。原因短语只是给人看的，程序只认状态码。',
            '**头部（headers）**：`Name: value`，大小写不敏感，一行一个。空行是头部结束的标志。',
            '**空行**：CRLF CRLF，这一行不能省，省了服务器就不知道头在哪结束。',
            '**报文主体（body）**：可选。GET 通常没有，POST/PUT 有。',
          ],
        },
        { type: 'h', text: '三个必懂的头部' },
        {
          type: 'p',
          text: '**Content-Type** —— 告诉对方 body 是什么格式。没有它，服务器只能猜，而猜的结果经常是把 JSON 当纯文本。charset=utf-8 也别省，中文乱码十次有九次是这个。',
        },
        {
          type: 'p',
          text: '**Content-Length** —— body 有多少字节。注意是字节不是字符："你好"是 2 个字符但 6 个字节（UTF-8 每字 3 字节）。如果你用字符串长度算，中文一定出错。',
        },
        {
          type: 'p',
          text: '**Transfer-Encoding: chunked** —— 不知道总长度时用分块传输。SSE 流式响应就是这么发的：来一块发一块，最后发一个 0 长度的块表示结束。',
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '这两个头互斥',
          text: 'Content-Length 和 Transfer-Encoding: chunked 不能同时出现。前者说"我知道有多长"，后者说"我不知道，边发边算"。同时出现属于协议错误，某些代理会直接拒绝，某些会取其中一个——行为不一致，是经典的请求走私（request smuggling）攻击入口。',
        },
        {
          type: 'qa',
          q: 'curl -v 输出的 "> " 和 "< " 分别是什么？',
          a: '"> " 是你发出去的（> 表示 outgoing），"< " 是收到的。以后调接口遇到怪问题，先 curl -v 看一眼原始报文，比在浏览器里猜快得多。加 --noproxy "*" 可以绕过系统代理，排除代理干扰。',
        },
      ],
    },

    {
      id: 's4',
      title: '第 5 步：用 node:http 起第一个服务器',
      checkpoint: '如果把 createServer 的回调写成 async 函数，抛出的错误会被谁捕获？',
      blocks: [
        {
          type: 'p',
          text: '先不用框架。框架会帮你隐藏细节，而你现在需要看见细节。二十行代码，一个能跑的服务器。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'server.ts —— 最小可用服务器',
          code: `import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  // req 是可读流，res 是可写流。就这两个对象。
  console.log(req.method, req.url)

  // 1. 先写状态码和头
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  // 2. 再写 body，最后必须 end()
  res.end(JSON.stringify({ ok: true, path: req.url }))
})

server.listen(3000, '127.0.0.1', () => {
  console.log('listening on http://127.0.0.1:3000')
})`,
          note: '跑起来：node server.ts（Node 22 支持直接跑 TS，不需要 tsc）。',
        },
        { type: 'h', text: '这两个对象到底是什么' },
        {
          type: 'table',
          head: ['对象', '本质', '你要用的东西'],
          rows: [
            ['req: IncomingMessage', '一个可读流（Readable）', 'req.method、req.url、req.headers、req.on("data")、req.on("end")'],
            ['res: ServerResponse', '一个可写流（Writable）', 'res.statusCode、res.setHeader()、res.write()、res.end()'],
          ],
        },
        {
          type: 'analogy',
          title: '和 Vue 的 setup 参数对照',
          text: 'createServer 的回调很像 setup(props, ctx)：框架把两个上下文对象递给你，你只能通过它们和外界交互，不能直接碰框架内部。区别是 setup 返回渲染函数，而这里的回调必须自己调用 res.end()——忘了 end()，请求就永远挂在那里，浏览器一直转圈，直到超时。',
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '新手最常犯的三个错，全都和 end() 有关',
          text: '① 某个 if 分支 return 了但没 end() → 请求挂死。② 调了两次 res.end() → 报 ERR_STREAM_WRITE_AFTER_END，进程可能崩。③ 先 end() 再 setHeader() → 头已经发出去了，设置无效且不报错，你会对着"为什么 Content-Type 没生效"怀疑人生。顺序永远是：状态码 → 头 → body → end。',
        },
        { type: 'h', text: '为什么回调不能写成 async' },
        {
          type: 'p',
          text: '这是 Node 里最隐蔽的坑之一。createServer 的回调返回的 Promise 没有任何人 await 它。所以如果你写成 async (req, res) => { throw new Error() }，这个 throw 变成 rejected Promise，Node 不会捕获，进程直接退出（Node 15+ 的默认行为）。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '正确写法：自己包一层错误边界',
          code: `import { createServer } from 'node:http'

createServer((req, res) => {
  // 同步抛错和异步 reject 都收敛到这里
  handle(req, res).catch((err) => {
    console.error('unhandled', err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'INTERNAL_ERROR' }))
    } else {
      res.destroy()  // 头已经发了，只能断开，不能改状态码
    }
  })
}).listen(3000)

async function handle(req: any, res: any) {
  // 真正的业务逻辑放这里，可以随便 await、随便 throw
}`,
          note: 'res.headersSent 这个判断很关键：头一旦发出，你就再也改不了状态码了。',
        },
        {
          type: 'qa',
          q: '为什么监听 127.0.0.1 而不是 0.0.0.0？',
          a: '127.0.0.1 只接受本机连接，0.0.0.0 接受所有网卡（包括局域网）。本地开发用前者更安全——否则同一个 WiFi 下的任何人都能访问你的开发服务器。部署到容器里才需要 0.0.0.0，因为容器的端口映射依赖它。',
        },
      ],
    },

    {
      id: 's5',
      title: '第 6 步：路由 —— 从 if/else 到匹配表',
      checkpoint: 'GET /api/notes/12 和 GET /api/notes?page=2 里的 "12" 和 "2"，为什么一个放路径一个放查询串？',
      blocks: [
        {
          type: 'p',
          text: '路由就是"根据 方法 + 路径 决定执行哪个函数"。最原始的做法是 if/else，然后你会发现它不可维护。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '第一版：if/else（能跑，但很快会烂）',
          code: `const url = new URL(req.url!, 'http://' + req.headers.host)

if (req.method === 'GET' && url.pathname === '/api/notes') {
  return listNotes(res)
}
if (req.method === 'POST' && url.pathname === '/api/notes') {
  return createNote(req, res)
}
if (req.method === 'GET' && url.pathname.startsWith('/api/notes/')) {
  const id = url.pathname.split('/').pop()      // 这里迟早出事
  return getNote(id, res)
}
res.statusCode = 404
res.end()`,
          note: '问题：路径多到 20 个就没人看得懂；取参数靠 split 和正则；方法没匹配上时返回 404 还是 405 说不清。',
        },
        { type: 'h', text: '路径参数 vs 查询参数：分工是明确的' },
        {
          type: 'table',
          head: ['', '路径参数 /notes/:id', '查询参数 /notes?page=2'],
          rows: [
            ['语义', '标识资源本身', '修饰资源的呈现方式'],
            ['是否影响缓存', '影响（不同 id 是不同资源）', '影响（分页结果不同）'],
            ['是否必填', '必填，缺了就是 404', '可选，缺了用默认值'],
            ['典型用途', 'id、slug、子资源', '分页、排序、筛选、字段裁剪'],
            ['反例', '把筛选条件塞进路径 /notes/tag/work/page/2', '用查询串传 id ?id=12 导致缓存混乱'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '一条可用的判断标准',
          text: '问自己"这个值变了，是不是在说另一个东西？"是 → 路径参数。问"这个值变了，是不是还是同一个东西、只是看法不同？"是 → 查询参数。/users/12 是用户 12；/users?sort=name 还是那批用户，只是排序变了。',
        },
        { type: 'h', text: '第二版：匹配表' },
        {
          type: 'code',
          lang: 'ts',
          title: '手写一个 30 行的路由表',
          code: `type Handler = (ctx: {
  req: IncomingMessage
  res: ServerResponse
  params: Record<string, string>
  query: URLSearchParams
}) => Promise<void> | void

interface Route {
  method: string
  /** /api/notes/:id 拆成 ['api','notes',':id'] */
  segments: string[]
  handler: Handler
}

const routes: Route[] = []

function add(method: string, pattern: string, handler: Handler) {
  routes.push({ method, segments: pattern.split('/').filter(Boolean), handler })
}

/** 返回 params 或 null（不匹配） */
function match(route: Route, pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length !== route.segments.length) return null

  const params: Record<string, string> = {}
  for (let i = 0; i < parts.length; i++) {
    const seg = route.segments[i]
    if (seg.startsWith(':')) {
      params[seg.slice(1)] = decodeURIComponent(parts[i])
    } else if (seg !== parts[i]) {
      return null
    }
  }
  return params
}

export function dispatch(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url!, 'http://localhost')
  let pathMatched = false

  for (const r of routes) {
    const params = match(r, url.pathname)
    if (params === null) continue
    pathMatched = true
    if (r.method !== req.method) continue          // 路径对了方法不对
    return r.handler({ req, res, params, query: url.searchParams })
  }

  // 路径存在但方法不对 → 405，而不是 404
  res.statusCode = pathMatched ? 405 : 404
  if (pathMatched) res.setHeader('Allow', allowedFor(url.pathname).join(', '))
  res.end()
}`,
          note: '这个 30 行的 dispatch 就是 Express、Fastify、Hono 的核心。看懂它，框架的路由文档你就不用背了。',
        },
        {
          type: 'p',
          text: '注意 405 和 404 的区别：路径存在但方法不支持，返回 405 并带 Allow 头，这是 HTTP 规范的要求，也让调用方能立刻知道"是我用错方法了"而不是"接口不存在"。这个细节区分了"能跑"和"专业"。',
        },
        {
          type: 'qa',
          q: '为什么用 new URL(req.url, "http://localhost") 而不是直接解析字符串？',
          a: 'req.url 只有路径和查询串（没有协议和域名），new URL 需要一个 base 才能解析。传一个假的 base 就能白拿 pathname / searchParams / 自动解码，比手写正则可靠得多。这是个非常实用的小技巧，几乎每个手写服务器的项目里都能看到。',
        },
      ],
    },

    {
      id: 's6',
      title: '第 7 步：读请求体 —— 流、限制、和 JSON 解析失败',
      checkpoint: '为什么不能在 request 事件里立刻 JSON.parse(req.body)？',
      blocks: [
        {
          type: 'p',
          text: 'req 是流，不是字符串。当 request 事件触发时，body 的字节可能一个都还没到。你必须一段一段收集，等 end 事件才能拿到完整内容。这是 Node 和浏览器 fetch 最大的差异——浏览器帮你 await res.json()，Node 把流交给你自己管。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '读 body：带大小限制的正确实现',
          code: `const MAX_BODY = 1024 * 1024  // 1MB，明确的上限

export function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0

    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        // 关键：超限要主动断开，否则攻击者可以一直发
        reject(Object.assign(new Error('BODY_TOO_LARGE'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve(undefined)
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(Object.assign(new Error('INVALID_JSON'), { status: 400 }))
      }
    })

    req.on('error', reject)   // 客户端中途断开
  })
}`,
          note: '这三件事缺一不可：大小上限、解析失败处理、error 监听。少任何一个都是线上事故。',
        },
        { type: 'h', text: '为什么必须设上限' },
        {
          type: 'p',
          text: '不设上限意味着任何人都能发一个 2GB 的 body，把你的内存吃光。这类攻击叫"内存耗尽型 DoS"，不需要任何技术含量，一个 curl 循环就能打挂。Node 默认没有 body 大小限制（Express 的 json() 默认 100kb，就是这个原因）。',
        },
        {
          type: 'p',
          text: '上限该设多少？按业务定：普通 JSON 接口 100KB 足够；富文本笔记 1~2MB；图片不能走 JSON，应该走 multipart 或直传对象存储。**看到有人把上限设成 50MB 就要问一句为什么**——通常是他把文件上传和 JSON 接口混在一起了。',
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'Content-Length 不可信',
          text: '客户端可以在头里写 Content-Length: 100 却发 1GB。所以不能只靠这个头做校验，必须在 data 事件里边收边计数。这是很多人写校验时的盲区。',
        },
        {
          type: 'qa',
          q: '为什么 Buffer.concat 而不是字符串直接加？',
          a: '字符串拼接会在每个 chunk 边界处做解码，而 UTF-8 的中文字符是 3 字节，可能正好被切在两个 chunk 之间，解码出来就是乱码（经典的"中文变问号"）。正确做法是先收集 Buffer，最后一次性 toString("utf8")。这个问题在英文环境测不出来，一上中文就炸。',
        },
      ],
    },

    {
      id: 's7',
      title: '第 8 步：状态码 —— 语义边界比记忆更重要',
      checkpoint: '参数格式正确但业务校验失败（比如"余额不足"），该用 400 还是 422？',
      blocks: [
        {
          type: 'p',
          text: '状态码不是装饰。它是你和调用方（可能是别人的代码、可能是重试逻辑、可能是 CDN 缓存）之间的契约。用错了，缓存会缓存错误页，重试机制会重试不该重试的请求，监控会漏报。',
        },
        {
          type: 'table',
          head: ['码', '含义', '什么时候用', '什么时候别用'],
          rows: [
            ['200', '成功', 'GET/PUT/PATCH 成功且返回内容', '创建资源成功别用 200，用 201'],
            ['201', '已创建', 'POST 创建资源，配 Location 头指向新资源', '不是"创建"语义的 POST 不要用'],
            ['204', '成功无内容', 'DELETE 成功、PUT 成功但无需返回 body', '返回了 body 却用 204 —— body 会被丢弃'],
            ['400', '请求格式错误', 'JSON 解析失败、必填字段缺失、类型不对', '业务规则不满足时慎用（见 422）'],
            ['401', '未认证', '没带 token、token 过期、签名不对', '已登录但没权限时别用（那是 403）'],
            ['403', '已认证但无权限', '登录了，但这不是你的资源', '没登录时用 403 会让前端不知道该跳登录页'],
            ['404', '资源不存在', 'id 查不到', '为了隐藏资源存在性时也可用（安全考虑）'],
            ['409', '冲突', '唯一键重复、乐观锁版本不匹配、状态机非法流转', '普通校验失败别用'],
            ['422', '语义错误', '格式对但业务规则不满足（余额不足、日期区间反了）', '字段类型错误用 400 更准'],
            ['429', '限流', '触发速率限制，配 Retry-After 头', '服务过载用 503'],
            ['500', '服务端错误', '未预期的异常，代码 bug', '可预期的业务失败别用 500'],
            ['502/504', '网关错误/超时', '反代后面的服务挂了或超时', '你的业务代码不该主动返回这两个'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '401 vs 403 的记忆法',
          text: '401 = "你是谁？"（Who are you）→ 前端应该跳登录页。403 = "我知道你是谁，但你不能"（I know you, but no）→ 前端应该显示无权限提示。搞混了，用户会陷入"登录了还是被踢回登录页"的死循环。',
        },
        { type: 'h', text: '400 还是 422？一个实用判据' },
        {
          type: 'p',
          text: '问："这个错误，换一个客户端（比如 curl 手写）能避免吗？"',
        },
        {
          type: 'list',
          items: [
            '能 —— 说明是请求本身不合法，用 **400**。例如：JSON 语法错、字段类型错、缺必填字段、Content-Type 不对。',
            '不能 —— 说明请求合法，是业务状态不允许，用 **422**（或 409）。例如：余额不足、库存为 0、优惠券已过期、状态机不允许从"已完成"回到"进行中"。',
          ],
        },
        {
          type: 'p',
          text: '这条判据的好处是可执行。团队里争不清的时候，问这一句就有答案了。注意很多团队统一用 400，那也是一种选择——**但要在文档里写清楚，并且前后端约定一致**。最糟的是同一个人今天用 400 明天用 422。',
        },
        {
          type: 'qa',
          q: '为什么错误响应也要有结构化的 body？',
          a: '因为前端要区分错误类型做不同处理。{ "error": "余额不足" } 这种字符串，前端只能整段展示给用户。而 { "code": "INSUFFICIENT_BALANCE", "message": "余额不足", "field": "amount", "requestId": "req_abc" } 让前端能判断 code 做分支、能把 field 定位到具体输入框、能用 requestId 找后端查日志。这三件事决定了错误体验的好坏。',
        },
      ],
    },

    {
      id: 's8',
      title: '第 9 步：异步 —— 单线程为什么能扛并发',
      checkpoint: 'await 一个慢查询时，Node 的线程在干什么？',
      blocks: [
        {
          type: 'p',
          text: '这是前端转后端最容易建立错的心智模型。你在 Vue 里理解的 async 是"等结果"，在 Node 里 async 的含义是"把控制权交还给事件循环"。这两个理解在语法上一样，在性能后果上完全不同。',
        },
        {
          type: 'flow',
          title: '事件循环处理三个并发请求',
          ascii: `时间轴 ──────────────────────────────────────────►

请求 A ─┐
请求 B ─┼─► [事件循环] 依次取出，同步执行到第一个 await
请求 C ─┘        │
                 ├─ A 执行到 await db.query()  ──► 交出控制权，A 挂起
                 ├─ B 执行到 await db.query()  ──► 交出控制权，B 挂起
                 ├─ C 执行到 await db.query()  ──► 交出控制权，C 挂起
                 │   （这三个查询在数据库那边并行跑）
                 ├─ A 的结果回来了 ──► 回调入队 ──► 继续执行 A 剩余代码
                 ├─ B 的结果回来了 ──► 回调入队 ──► 继续执行 B
                 └─ C 的结果回来了 ──► 回调入队 ──► 继续执行 C

关键：主线程从来没有"等"，它只是在"没有活干时"去睡，
      有结果回来就醒。所以单线程也能同时处理上千个慢请求。`,
        },
        {
          type: 'p',
          text: '所以"Node 单线程"这句话是**不准确的**。准确说法是：你的 JS 代码跑在单线程上，但底层的 I/O（网络、文件、DNS）由 libuv 的线程池和操作系统的异步机制完成。你写 await 的那一刻，主线程就去处理别的请求了。',
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '什么会真的阻塞',
          text: 'CPU 密集的同步代码会阻塞整个进程，所有请求一起卡住。典型杀手：JSON.parse 一个 50MB 的字符串、用 for 循环做几百万次加密、同步读文件（readFileSync）、复杂的正则回溯、大数组的同步排序。判断标准很简单：**这段代码有没有 await？没有，它就在独占主线程。**',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '一个真实的阻塞案例',
          code: `// 反例：这个接口会拖慢所有其他接口
app.get('/api/report', (req, res) => {
  const rows = db.prepare('SELECT * FROM events').all()   // 10 万行，同步
  const result = rows.map(heavyCompute)                    // 纯 CPU，同步，500ms
  res.json(result)
})

// 正例 1：分页，把一次 500ms 拆成多次 5ms
// 正例 2：扔到 worker_threads，主线程不受影响
// 正例 3：改成异步流式返回，边算边发`,
          note: '面试常问"Node 适合什么场景"。标准答案：I/O 密集型适合，CPU 密集型不适合（除非用 worker_threads 或拆成独立服务）。',
        },
        { type: 'h', text: 'await 的三个真实陷阱' },
        {
          type: 'list',
          ordered: true,
          items: [
            '**在循环里 await** —— `for (const id of ids) await fetchOne(id)` 是串行，100 个就是 100 倍延迟。要用 `Promise.all(ids.map(fetchOne))`，但注意并发数要有上限（用 p-limit 或自己写信号量），否则会打爆下游。',
            '**忘了 await** —— `saveNote(data)` 不 await，函数返回时写入还没完成，测试里就会随机失败。TypeScript 的 `no-floating-promises` 规则能抓这个，务必打开。',
            '**await 在 try 外面** —— `const p = fetchData(); try { await p } catch {}` 和 `try { await fetchData() } catch {}` 在错误时序上有微妙差别，后者才是你想要的。',
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '并发控制：有上限的 Promise.all',
          code: `async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i])
    }
  }

  // 起 limit 个 worker，每个自己领任务
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}`,
          note: '这个函数值得背下来。批量调 LLM、批量查库、批量发消息，全都用它。',
        },
      ],
    },

    {
      id: 's9',
      title: '第 10 步：错误处理 —— 别把堆栈发给用户',
      checkpoint: '为什么不能把数据库的原始错误信息返回给前端？',
      blocks: [
        {
          type: 'p',
          text: '错误分三类，处理方式完全不同。混在一起处理，要么泄漏内部信息，要么丢失排查线索。',
        },
        {
          type: 'table',
          head: ['类型', '例子', '返回给客户端', '记日志'],
          rows: [
            ['用户错误（预期内）', '缺字段、类型错、没权限、资源不存在', '具体原因 + 字段定位', '不需要（量太大）'],
            ['业务拒绝（预期内）', '余额不足、库存为 0、状态不允许', '业务码 + 可读文案', '按需（关键业务要）'],
            ['系统错误（预期外）', '数据库连接断了、空指针、第三方超时', '只说"服务异常"+ requestId', '必须，含完整堆栈'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '统一错误对象',
          code: `export class AppError extends Error {
  constructor(
    public code: string,          // 机器读：INSUFFICIENT_BALANCE
    message: string,              // 人读：余额不足
    public status = 400,
    public field?: string,        // 定位到具体输入框
    public expose = true,         // 是否可以把 message 给用户看
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// 业务里随手抛，不用每层判断
if (account.balance < amount) {
  throw new AppError('INSUFFICIENT_BALANCE', '余额不足', 422, 'amount')
}

// 统一出口：所有错误在这里变成响应
function sendError(res: ServerResponse, err: unknown, requestId: string) {
  if (err instanceof AppError) {
    res.statusCode = err.status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({
      code: err.code,
      message: err.expose ? err.message : '请求失败',
      field: err.field,
      requestId,
    }))
    return
  }

  // 未知错误：日志里留全量，响应里只留 requestId
  console.error('[unhandled]', requestId, err)
  res.statusCode = 500
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ code: 'INTERNAL_ERROR', message: '服务异常，请稍后重试', requestId }))
}`,
          note: 'requestId 是整个可观测性的地基。前端报错时带上它，后端一 grep 就能定位到那一次请求的全部日志。',
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '为什么绝不能返回原始错误',
          text: '一个 PostgreSQL 的报错可能长这样：duplicate key value violates unique constraint "users_email_key"。这句话告诉攻击者：① 你用的是 PostgreSQL ② 表名是 users ③ email 字段有唯一索引 ④ 这个邮箱已经注册了（可以拿来枚举用户）。三类信息泄漏一次全给了。正确做法是转成 EMAIL_TAKEN + "该邮箱已被注册"，语义更清楚，信息更少。',
        },
        { type: 'h', text: '三层兜底，一层都不能少' },
        {
          type: 'list',
          ordered: true,
          items: [
            '**请求级**：每个 handler 包 try/catch（或框架的 error hook），保证单个请求出错不影响其他请求。',
            '**进程级**：process.on("uncaughtException") 和 ("unhandledRejection")，记录日志后优雅退出，让进程管理器（pm2 / k8s）重启。**注意：uncaughtException 之后进程状态不可信，必须退出，不能继续服务。**',
            '**基础设施级**：健康检查 + 重启策略 + 告警。前两层是代码，这一层是运维，但设计时就要留好 /healthz 接口。',
          ],
        },
      ],
    },

    {
      id: 's10',
      title: '第 11 步：安全边界 —— 后端不相信任何人',
      checkpoint: '前端已经做了表单校验，后端为什么还要再校验一遍？',
      blocks: [
        {
          type: 'p',
          text: '前端的校验是"用户体验"，后端的校验是"安全"。前者可以被绕过（改 JS、直接 curl、改请求），后者不行。这不是重复劳动，是两道不同性质的闸门。',
        },
        { type: 'h', text: '四道必须有的边界' },
        {
          type: 'code',
          lang: 'ts',
          title: '边界 1：输入校验（用 zod，和 TS 类型同源）',
          code: `import { z } from 'zod'

const CreateNote = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(120, '标题最多 120 字'),
  content: z.string().max(50_000).default(''),
  tags: z.array(z.string().max(20)).max(10).default([]),
  // 关键：不要接受客户端传来的 userId
  // userId: z.number()   ← 这是越权漏洞的标准写法
})

// 校验 + 类型收窄一步完成
const parsed = CreateNote.safeParse(body)
if (!parsed.success) {
  throw new AppError('VALIDATION_FAILED', parsed.error.issues[0].message, 400,
    parsed.error.issues[0].path.join('.'))
}
// 到这里 data 的类型是 { title: string; content: string; tags: string[] }
const data = parsed.data`,
          note: 'z.infer<typeof CreateNote> 能直接得到 TS 类型，校验规则和类型定义永远同步，不会出现"类型说有、运行时没有"。',
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '越权：最常见的严重漏洞',
          text: '任何"用户自己的资源"操作，都必须带上 `WHERE user_id = ?`。前端传了 id=12 不代表 12 是你的。标准写法是先认证拿到 userId（从 token 解出来），再 `WHERE id = ? AND user_id = ?`，两条都满足才返回。少一个条件，就是水平越权——你能看别人的订单、别人的笔记、别人的聊天记录。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '边界 2：CORS（不是安全机制，是浏览器策略）',
          code: `// 开发环境：精确白名单，不要写 *
res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
res.setHeader('Access-Control-Allow-Credentials', 'true')
res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE')
res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
res.setHeader('Access-Control-Max-Age', '600')   // 预检结果缓存 10 分钟

// 处理预检
if (req.method === 'OPTIONS') {
  res.statusCode = 204
  res.end()
  return
}`,
          note: 'Access-Control-Allow-Origin: * 和 Allow-Credentials: true 不能共存，浏览器会直接拒绝。这是规范强制，不是 bug。',
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'CORS 的常见误解',
          text: 'CORS 是浏览器强制的策略，不是服务器强制的。curl 和 Postman 完全不受 CORS 限制。所以"CORS 配好了就安全了"是错的——它只防止别的网站用用户浏览器发请求，不防止任何人直接调你的接口。真正的防护是认证 + 授权 + 限流。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '边界 3：超时与限流',
          code: `// 请求级超时：防止慢请求占满连接
server.requestTimeout = 30_000      // 整个请求的最大时长
server.headersTimeout = 10_000      // 只等头的时长（防 slowloris 攻击）
server.keepAliveTimeout = 65_000    // 略大于上游 LB 的 idle timeout

// 应用级：简单的内存限流（生产用 Redis）
const hits = new Map<string, { n: number; reset: number }>()
function rateLimit(ip: string, limit = 60, windowMs = 60_000) {
  const now = Date.now()
  const rec = hits.get(ip)
  if (!rec || now > rec.reset) {
    hits.set(ip, { n: 1, reset: now + windowMs })
    return true
  }
  rec.n += 1
  return rec.n <= limit
}`,
          note: 'keepAliveTimeout 必须比上游负载均衡的 idle timeout 大一点，否则会出现偶发的 502——这是线上最经典的"玄学 502"来源之一。',
        },
        { type: 'h', text: '边界 4：SSRF —— 别让用户决定你请求谁' },
        {
          type: 'p',
          text: '只要有"用户提供一个 URL，服务器去抓取"的功能（网页摘要、图片导入、webhook 回调），就有 SSRF 风险。攻击者传 http://169.254.169.254/latest/meta-data/，你的服务器就去读了云厂商的元数据服务，可能拿到临时凭证。',
        },
        {
          type: 'list',
          items: [
            '**白名单**：只允许协议 http/https，只允许明确的域名列表。这是唯一可靠的做法。',
            '**解析后校验 IP**：先 DNS 解析，检查结果不是内网段（10./172.16-31./192.168./127./169.254.），再发起请求。注意要防 DNS rebinding（解析和请求之间换 IP）。',
            '**禁止跟随重定向**：或者每次重定向都重新校验。',
            '**出站代理**：所有外部请求走一个受控代理，在代理层做过滤和审计。',
          ],
        },
        {
          type: 'qa',
          q: '为什么不能靠"过滤掉 127.0.0.1 和 localhost 字符串"？',
          a: '因为绕过方式太多：127.0.0.2、0.0.0.0、[::1]、2130706433（127.0.0.1 的十进制）、0x7f000001、甚至用你自己的域名解析到 127.0.0.1。字符串黑名单永远堵不完，必须解析成 IP 之后判断网段。',
        },
      ],
    },

    {
      id: 's11',
      title: '第 12~13 步：回到 Vue —— 前端该怎么消费这条链路',
      checkpoint: '如果接口返回 409，前端应该做什么？和 500 的处理有什么不同？',
      blocks: [
        {
          type: 'p',
          text: '现在你知道后端每个状态码的含义了。前端消费时要做的第一件事，是**按状态码分类处理**，而不是统一 toast 一个"请求失败"。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '一个够用的 fetch 封装',
          code: `export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string,
    public requestId?: string,
  ) {
    super(message)
  }
}

export async function api<T>(path: string, init: RequestInit & { signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
    credentials: 'include',
  })

  // 204 没有 body，不能调 json()
  if (res.status === 204) return undefined as T

  const text = await res.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { /* 非 JSON 响应 */ }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.code ?? 'UNKNOWN',
      body?.message ?? \`请求失败（\${res.status}）\`,
      body?.field,
      body?.requestId,
    )
  }
  return body as T
}`,
          note: '注意 res.status === 204 这个分支。忘了它，DELETE 接口一定会报 "Unexpected end of JSON input"。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'Vue 组件里按错误类型分支',
          code: `const loading = ref(false)
const errorMsg = ref('')
const fieldError = ref<Record<string, string>>({})

async function save() {
  loading.value = true
  errorMsg.value = ''
  fieldError.value = {}
  try {
    await api('/api/notes', { method: 'POST', body: JSON.stringify(form) })
    router.push('/notes')
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401) return router.push('/login')          // 跳登录
      if (e.status === 403) return (errorMsg.value = '没有权限')    // 提示
      if (e.status === 409) return (errorMsg.value = '该标题已存在') // 可恢复
      if (e.status === 422 || e.status === 400) {
        if (e.field) fieldError.value[e.field] = e.message          // 定位到输入框
        else errorMsg.value = e.message
        return
      }
      // 5xx：不暴露细节，给 requestId 方便报障
      errorMsg.value = \`服务异常，请稍后重试（\${e.requestId ?? ''}）\`
    } else {
      errorMsg.value = '网络异常，请检查连接'
    }
  } finally {
    loading.value = false   // finally 保证 loading 一定复位
  }
}`,
          note: '这个 finally 很关键。漏了它，一次失败之后按钮就永远转圈——这是最常见的"UI 卡死"来源。',
        },
        { type: 'h', text: '取消请求：你一定会需要' },
        {
          type: 'code',
          lang: 'ts',
          title: '搜索框的经典场景',
          code: `let controller: AbortController | null = null

watch(keyword, async (kw) => {
  controller?.abort()                    // 取消上一次
  controller = new AbortController()
  try {
    const data = await api(\`/api/search?q=\${encodeURIComponent(kw)}\`, {
      signal: controller.signal,
    })
    results.value = data
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return  // 正常取消，忽略
    throw e
  }
})`,
          note: '注意 AbortError 要单独判断并忽略。不判断的话，每次快速输入都会弹一个错误提示。',
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '一个反直觉的点',
          text: 'abort() 只取消浏览器侧的等待，服务端可能已经在执行了。所以"取消"不等于"没发生"——如果这个请求会写数据（下单、扣款），取消后仍要按幂等键去查结果，不能假设它失败了。这是前端转后端必须建立的新直觉：**网络取消 ≠ 业务取消**。',
        },
      ],
    },

    {
      id: 's12',
      title: '收尾：把整条链路串起来，以及一张自检清单',
      checkpoint: '如果让你给这个服务加一个"导出全部笔记为 CSV"的接口，你会遇到什么新问题？',
      blocks: [
        {
          type: 'p',
          text: '现在把前面 11 步拼成一个完整可跑的文件。这就是你这一课的产出物，也是后面所有课程的地基。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'server.ts —— 完整版（约 90 行，无框架）',
          code: `import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'

interface Note { id: string; title: string; content: string; createdAt: string }
const notes = new Map<string, Note>()

const MAX_BODY = 1024 * 100

function readJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) { reject(Object.assign(new Error('TOO_LARGE'), { status: 413 })); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve(undefined)
      try { resolve(JSON.parse(raw)) } catch { reject(Object.assign(new Error('BAD_JSON'), { status: 400 })) }
    })
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body?: unknown) {
  res.statusCode = status
  if (body === undefined) return res.end()
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

const server = createServer((req, res) => {
  const requestId = randomUUID()
  res.setHeader('X-Request-Id', requestId)

  // CORS（开发环境精确白名单）
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return json(res, 204)

  handle(req, res).catch((err) => {
    console.error('[error]', requestId, err)
    if (res.headersSent) return res.destroy()
    const status = typeof err?.status === 'number' ? err.status : 500
    json(res, status, {
      code: err?.message === 'BAD_JSON' ? 'INVALID_JSON'
          : err?.message === 'TOO_LARGE' ? 'BODY_TOO_LARGE'
          : status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED',
      message: status === 500 ? '服务异常，请稍后重试' : String(err?.message ?? '请求失败'),
      requestId,
    })
  })
})

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url!, 'http://localhost')
  const parts = url.pathname.split('/').filter(Boolean)   // ['api','notes','12']

  if (parts[0] !== 'api') return json(res, 404, { code: 'NOT_FOUND' })

  // GET /api/notes
  if (parts[1] === 'notes' && parts.length === 2 && req.method === 'GET') {
    return json(res, 200, { items: [...notes.values()] })
  }

  // POST /api/notes
  if (parts[1] === 'notes' && parts.length === 2 && req.method === 'POST') {
    const body = await readJson(req)
    if (!body?.title || typeof body.title !== 'string') {
      return json(res, 400, { code: 'VALIDATION_FAILED', message: '标题必填', field: 'title' })
    }
    const note: Note = {
      id: randomUUID(),
      title: body.title.slice(0, 120),
      content: String(body.content ?? ''),
      createdAt: new Date().toISOString(),
    }
    notes.set(note.id, note)
    res.setHeader('Location', \`/api/notes/\${note.id}\`)
    return json(res, 201, note)
  }

  // GET /api/notes/:id
  if (parts[1] === 'notes' && parts.length === 3 && req.method === 'GET') {
    const note = notes.get(parts[2])
    if (!note) return json(res, 404, { code: 'NOT_FOUND', message: '笔记不存在' })
    return json(res, 200, note)
  }

  // DELETE /api/notes/:id
  if (parts[1] === 'notes' && parts.length === 3 && req.method === 'DELETE') {
    if (!notes.delete(parts[2])) return json(res, 404, { code: 'NOT_FOUND' })
    return json(res, 204)
  }

  return json(res, 405, { code: 'METHOD_NOT_ALLOWED' })
}

server.listen(3000, '127.0.0.1', () => console.log('http://127.0.0.1:3000'))`,
        },
        {
          type: 'p',
          text: '这份代码只有 90 行，但已经把这一课的所有知识点都用上了。你现在应该能指着任何一行说出"为什么这么写"。如果有一行说不出来，回去重看对应的那一步。',
        },
        { type: 'h', text: '交付前自检清单' },
        {
          type: 'table',
          head: ['检查项', '不合格的表现'],
          rows: [
            ['每个分支都有 res.end()', '某个 if 里 return 了没 end，请求挂死'],
            ['body 有大小上限', '一个 curl 循环就能打挂进程'],
            ['JSON 解析失败返回 400', '返回 500，日志里一堆 SyntaxError'],
            ['状态码语义正确', '创建返回 200、无权限返回 401、删除返回 200 + 空对象'],
            ['错误响应有 code 字段', '前端只能整段展示 message，没法做分支'],
            ['5xx 不返回堆栈', '响应里出现 at Object.<anonymous> 或表名'],
            ['CORS 白名单不是 *', '生产环境 Allow-Origin: * 且带 credentials'],
            ['有 requestId', '线上报错时无法定位是哪一次请求'],
            ['设置了 headersTimeout', 'slowloris 攻击可以耗尽连接'],
            ['监听 127.0.0.1 而非 0.0.0.0（本地）', '同 WiFi 的人能访问你的开发服务'],
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          title: '下一课预告',
          text: '这一课的服务有三个明显的问题：数据在内存里（重启就没了）、没有分层（路由、校验、业务、存储全挤在 handle 里）、没有认证。下一课《分层与依赖注入：把 90 行拆成可维护的结构》会用 NestJS 的架构思路解决它们，但先手写一遍再上框架——否则你只是在背 API。',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '状态码：创建成功该返回什么',
      prompt:
        '你的 `POST /api/notes` 成功创建了一条笔记，并且希望客户端知道新资源的地址。下面哪个响应最规范？',
      points: 10,
      options: [
        { id: 'a', text: '200 OK，body 里放 { id, title, createdAt }' },
        { id: 'b', text: '201 Created，配 Location: /api/notes/42，body 里放完整资源' },
        { id: 'c', text: '204 No Content，什么都不返回' },
        { id: 'd', text: '202 Accepted，body 里放 { id }' },
      ],
      answer: ['b'],
      hints: [
        '想一下 2xx 这一组里，每个码分别对应"什么动作完成了"。创建这个动作有没有专属的码？',
        '201 的语义就是"请求已完成，并因此创建了新资源"。规范还要求：如果你能给出新资源的地址，应该放在 Location 头里。',
        '正确答案是 B。201 表示"创建成功"，Location 头告诉客户端新资源在哪，body 返回完整资源能让前端省掉一次 GET。A 的问题是语义不准（200 是通用成功，丢失了"创建"这个信息）；C 的问题是客户端拿不到 id，还得再查一次；D 的 202 是"已接受、尚未处理完"，用于异步任务，这里处理已经完成了。',
      ],
      explanation:
        '201 + Location 是 REST 的标准写法。前端可以立即用 Location 跳转或做后续操作，不用猜 id。',
      approach: [
        '判断动作性质：这是"创建"，不是"更新"也不是"异步提交"',
        '创建有专属状态码 201',
        '201 的配套要求是 Location 头指向新资源',
        'body 返回完整资源，减少一次往返',
      ],
      knowledge: ['状态码语义', '201 Created', 'Location 头', 'REST 约定'],
      pitfalls: [
        '很多人习惯所有成功都返回 200，这在内部项目里能跑，但一接入网关、缓存、SDK 生成器就会出问题',
        '返回 204 却带 body：body 会被客户端丢弃，看起来"数据没返回"',
      ],
    },

    {
      id: 'e2',
      type: 'multi',
      title: '哪些校验必须放在后端',
      prompt:
        '你的表单已经用 Element Plus 的 rules 做了校验。下面哪些检查**仍然必须**在后端再做一遍？（多选）',
      points: 15,
      options: [
        { id: 'a', text: '标题不能为空、长度不超过 120' },
        { id: 'b', text: '当前用户是否有权修改这条笔记' },
        { id: 'c', text: '输入框失焦时边框变红' },
        { id: 'd', text: '金额不能为负数，且不能超过账户余额' },
        { id: 'e', text: '标签最多 10 个' },
      ],
      answer: ['a', 'b', 'd', 'e'],
      hints: [
        '分两类看：一类是"数据本身的合法性"，一类是"界面表现"。界面表现不需要后端管。',
        '还有一类最容易被忽略：涉及"当前用户"和"当前数据状态"的判断，前端根本不可能知道真相。',
        '正确答案 A、B、D、E。A/E 是数据合法性——前端校验可被绕过（curl 直接发），后端必须再验。B 是授权——前端不知道自己有没有权限，只有服务端知道。D 里的"余额"只有服务端知道真实值，前端看到的余额可能已经过期。C 是纯 UI 表现，后端不需要也不应该管。',
      ],
      explanation:
        '前端校验是体验（快速反馈、少一次往返），后端校验是安全（不可绕过）。凡涉及"服务端才知道的事实"和"数据合法性"，后端必须重验。',
      approach: [
        '把所有校验项列出来',
        '标注每一项：数据合法性 / 权限 / 服务端状态 / 纯 UI',
        '前三类全部下沉到后端；纯 UI 留在前端',
      ],
      knowledge: ['输入校验', '前后端职责边界', '越权防护', 'zod'],
      pitfalls: [
        '相信前端传来的 userId / role / price —— 这是最严重的一类漏洞，攻击者改一个字段就能提权或改价',
        '只校验格式不校验业务规则（格式对但金额超过余额）',
      ],
    },

    {
      id: 'e3',
      type: 'fill',
      title: '填空：把 HTTP 报文补完整',
      prompt:
        '下面是一个"创建笔记"的请求报文，以及服务端返回的响应报文。请补全空缺的部分。注意首行的格式、必填的头部、以及状态码。',
      points: 15,
      templateLang: 'http',
      template: `{{line1}}
Host: api.example.com
{{ctype}}
{{clen}}
Authorization: Bearer eyJhbGciOi...

{"title":"周会纪要","content":"讨论了三件事"}

─────────────────────────────

HTTP/1.1 {{status}} Created
Content-Type: application/json; charset=utf-8
{{loc}}

{"id":42,"title":"周会纪要"}`,
      blanks: [
        {
          id: 'line1',
          label: '请求首行（方法 + 路径 + 协议版本）',
          accept: ['post /api/notes http/1.1'],
          placeholder: 'POST /api/notes HTTP/1.1',
          width: 34,
        },
        {
          id: 'ctype',
          label: '声明 body 格式的头部',
          accept: ['content-type: application/json', 'content-type: application/json; charset=utf-8'],
          placeholder: 'Content-Type: application/json',
          width: 42,
        },
        {
          id: 'clen',
          label: '声明 body 字节长度的头部（示例里 body 是 42 字节）',
          accept: ['content-length: 42'],
          placeholder: 'Content-Length: 42',
          width: 26,
        },
        {
          id: 'status',
          label: '创建成功的状态码',
          accept: ['201'],
          placeholder: '201',
          width: 8,
        },
        {
          id: 'loc',
          label: '指向新资源的响应头',
          accept: ['location: /api/notes/42'],
          placeholder: 'Location: /api/notes/42',
          width: 30,
        },
      ],
      hints: [
        '请求首行由三段组成，用空格分隔：方法、路径（含查询串）、协议版本。大小写不敏感，但惯例是大写方法、大写 HTTP。',
        'body 是 JSON 就必须有两个头：Content-Type 说明格式，Content-Length 说明字节数。响应侧 201 还要求一个指向新资源的头。',
        '完整答案：`POST /api/notes HTTP/1.1` / `Content-Type: application/json` / `Content-Length: 42` / `201` / `Location: /api/notes/42`。注意 Content-Length 是**字节数**，如果 body 里有中文，字符数会比字节数小。',
      ],
      explanation:
        'HTTP 报文是"首行 + 头部 + 空行 + body"的结构。请求首行三段、响应首行三段，格式固定。缺 Content-Length 或 Transfer-Encoding，服务端不知道 body 何时结束。',
      approach: [
        '请求首行：方法 空格 路径 空格 协议版本',
        '有 body 就要声明 Content-Type 和长度',
        '响应 201 要配 Location',
        '注意字节数 ≠ 字符数',
      ],
      knowledge: ['HTTP 报文结构', 'Content-Type', 'Content-Length', 'Location 头', '201'],
      pitfalls: [
        '把 Content-Length 写成字符数（中文场景必错）',
        '忘记 charset=utf-8，导致中文乱码',
        '写 Location 用绝对路径时忘了协议和域名（规范允许相对路径，但有些客户端只认绝对 URL）',
      ],
    },

    {
      id: 'e4',
      type: 'debug',
      title: '找 bug：这个接口有三个问题',
      prompt:
        '下面这段代码在本地测通了，上线后出现三种症状：① 偶尔有请求一直不返回 ② 有人发 50MB 的 body 后服务崩了 ③ 前端拿到的错误提示里出现了数据库表名。找出这三处问题。',
      points: 20,
      buggyLang: 'ts',
      buggyCode: `createServer(async (req, res) => {
  const url = new URL(req.url!, 'http://localhost')

  if (url.pathname === '/api/notes' && req.method === 'POST') {
    const body = await readBody(req)          // 无大小限制
    const note = await db.note.create({ data: JSON.parse(body) })
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(note))
    return
  }

  if (url.pathname === '/api/notes' && req.method === 'GET') {
    const list = await db.note.findMany()
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(list))
    return
  }

  res.statusCode = 404
  // 忘了 end()
})`,
      options: [
        { id: 'a', text: 'createServer 的回调是 async，抛出的错误没人接，会变成 unhandledRejection 导致进程退出' },
        { id: 'b', text: 'readBody 没有大小上限，大 body 会吃光内存' },
        { id: 'c', text: 'JSON.parse 没有 try/catch，且错误对象被直接序列化返回给客户端' },
        { id: 'd', text: '404 分支没有 res.end()，请求会一直挂到超时' },
        { id: 'e', text: 'res.setHeader 必须在 res.end 之后调用' },
        { id: 'f', text: 'URL 构造函数的第二个参数应该是 req.headers.host' },
      ],
      answer: ['a', 'b', 'c', 'd'],
      hints: [
        '三个症状对应三个不同的位置。先把症状和代码行对上：挂死 → 哪条路径没有结束响应？崩溃 → 哪里没有上限？泄漏 → 哪里把内部错误原样返回了？',
        '还有一处不在症状里但同样致命：`createServer(async ...)` 这个 async。它返回的 Promise 没有任何人 await。',
        '正确答案 A、B、C、D。A：async 回调里的 throw 变成 rejected Promise，Node 不会捕获，进程退出（Node 15+）。B：readBody 无上限。C：JSON.parse 抛错会冒泡到 A 的未捕获路径，而且如果被捕获后直接返回 err.message，就会把 `duplicate key ... "notes_title_key"` 这类信息给到前端。D：404 分支没有 end，请求挂死直到 30s 超时。E 是错的——setHeader 必须在 end 之前。F 是错的——用 "http://localhost" 作 base 完全够用，因为只需要 pathname。',
      ],
      explanation:
        '四处问题分别对应：错误边界缺失（A）、资源上限缺失（B）、错误信息泄漏（C）、响应未终结（D）。这四个是手写 Node 服务的"四大经典事故"。',
      approach: [
        '先按症状定位：挂死找没 end 的分支，崩溃找没上限的地方，泄漏找返回原始错误的地方',
        '再看全局：async 回调必须自己 catch',
        '最后核对顺序：状态码 → 头 → body → end',
      ],
      knowledge: ['错误边界', 'body 大小限制', '错误信息脱敏', 'res.end 必要性', 'async 回调陷阱'],
      pitfalls: [
        '以为 try/catch 包住 createServer 的回调就能捕获所有错误 —— 异步错误捕获不到',
        '以为框架会帮你处理 404 —— 框架也有"没匹配到路由"的分支，一样要 end',
      ],
    },

    {
      id: 'e5',
      type: 'code',
      title: '编程：实现路由匹配函数',
      prompt:
        '实现 `matchRoute(pattern, pathname)`：pattern 支持 `:param` 占位符，返回参数对象；不匹配返回 `null`。这段代码会在真实沙箱里执行，下面的检查项全部通过才算对。',
      points: 25,
      starter: `function matchRoute(pattern, pathname) {
  // pattern 例：'/api/notes/:id'
  // pathname 例：'/api/notes/42'
  // 期望返回：{ id: '42' }
  // 不匹配返回 null

  // 提示：先 split('/').filter(Boolean) 去掉空段，
  // 再逐段比较：以 ':' 开头的是参数，其余必须完全相等，
  // 最后段数也要相等。

  return null
}

return matchRoute`,
      checks: [
        { name: '静态路径匹配', expr: "result('/api/notes', '/api/notes') && Object.keys(result('/api/notes','/api/notes')).length === 0" },
        { name: '单个参数', expr: "JSON.stringify(result('/api/notes/:id', '/api/notes/42')) === '{\"id\":\"42\"}'" },
        { name: '多个参数', expr: "JSON.stringify(result('/api/:a/:b', '/api/x/y')) === '{\"a\":\"x\",\"b\":\"y\"}'" },
        { name: '段数不同返回 null', expr: "result('/api/notes/:id', '/api/notes') === null" },
        { name: '静态段不符返回 null', expr: "result('/api/notes/:id', '/api/users/42') === null" },
        { name: '尾部斜杠应被忽略', expr: "JSON.stringify(result('/api/notes/:id', '/api/notes/42/')) === '{\"id\":\"42\"}'" },
        { name: '根路径', expr: "JSON.stringify(result('/', '/')) === '{}'" },
      ],
      solution: `function matchRoute(pattern, pathname) {
  const ps = pattern.split('/').filter(Boolean)
  const xs = pathname.split('/').filter(Boolean)
  if (ps.length !== xs.length) return null

  const params = {}
  for (let i = 0; i < ps.length; i++) {
    if (ps[i].startsWith(':')) {
      params[ps[i].slice(1)] = decodeURIComponent(xs[i])
    } else if (ps[i] !== xs[i]) {
      return null
    }
  }
  return params
}`,
      hints: [
        '先把两个字符串都拆成段数组，用 split("/") 之后 filter(Boolean) 去掉空段。为什么不直接比长度？因为 "/api/notes/" 和 "/api/notes" 应该视为同一条路径。',
        '段数必须相等，否则直接 null。然后逐段比较：`:` 开头的段是参数，把后面那段路径存进结果对象；其余段必须严格相等。别忘了 decodeURIComponent。',
        '完整实现见下。三个容易漏的点：① 段数不等要提前返回 null（否则会把 /api/notes 匹配到 /api/notes/:id 上）② 尾部斜杠要用 filter(Boolean) 消掉 ③ 参数值要 decodeURIComponent，否则 "a%20b" 拿到的还是编码后的字符串。',
      ],
      explanation:
        '这就是 Express / Fastify / Hono 路由匹配的核心算法。手写过一遍，你就再也不会困惑"为什么我的路由没匹配上"。',
      approach: [
        '两边都 split("/") 并 filter(Boolean)，消掉空段',
        '段数不等 → null',
        '逐段比较：参数段存值，静态段严格相等',
        '参数值 decodeURIComponent',
      ],
      knowledge: ['路由匹配', '路径参数', 'decodeURIComponent', 'Express 内部原理'],
      pitfalls: [
        '忘记段数检查，导致 /api/notes 被 /api/notes/:id 匹配到，params 里多出一个 undefined',
        '忘记 decodeURIComponent，中文路径参数拿到 %E4%BD%A0 这种值',
        '用 startsWith 做前缀匹配，导致 /api/notes 也匹配 /api/notes-archive',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 12,
    questions: [
      {
        id: 'q1',
        stem: '浏览器报 "Failed to fetch"，最不该做的是？',
        options: [
          { id: 'a', text: '用 curl -v 看是否能建立连接' },
          { id: 'b', text: '检查服务进程是否在监听该端口' },
          { id: 'c', text: '根据这句话直接判断是后端返回了 500' },
          { id: 'd', text: '检查 CORS 预检是否被拒' },
        ],
        answer: 'c',
        why: '"Failed to fetch" 是浏览器故意模糊的提示，它可能是 DNS 失败、TCP 连不上、TLS 证书错、CORS 被拒、或被用户主动 abort。它绝不会告诉你"后端返回了 500"——因为 500 是成功建立连接之后的 HTTP 层结果，那种情况 fetch 会正常 resolve，只是 res.ok 为 false。',
        stepId: 's1',
      },
      {
        id: 'q2',
        stem: '下面哪一组头部不能同时出现在同一个报文里？',
        options: [
          { id: 'a', text: 'Content-Type 和 Content-Length' },
          { id: 'b', text: 'Content-Length 和 Transfer-Encoding: chunked' },
          { id: 'c', text: 'Host 和 Authorization' },
          { id: 'd', text: 'Accept 和 User-Agent' },
        ],
        answer: 'b',
        why: '前者说"我知道 body 有多长"，后者说"我不知道，边发边算"，语义互斥。同时出现属于协议错误，不同代理的处理方式不一致，是请求走私（request smuggling）的攻击入口。',
        stepId: 's3',
      },
      {
        id: 'q3',
        stem: '用户已登录，但访问了别人的订单详情 /orders/99。应该返回？',
        options: [
          { id: 'a', text: '401，让前端跳登录' },
          { id: 'b', text: '403，表示无权限' },
          { id: 'c', text: '404，隐藏资源存在性（也符合安全实践）' },
          { id: 'd', text: '200，返回空对象' },
        ],
        answer: 'c',
        why: '403 语义正确（已认证但无权限），但会泄漏"这个订单确实存在"这一信息，攻击者可以借此枚举有效 id。返回 404 既符合"资源对你不可见"的语义，又不泄漏存在性，是安全敏感场景的常见选择。注意：如果业务允许用户知道"存在但无权访问"，403 也完全可以。关键是别用 401。',
        stepId: 's7',
      },
      {
        id: 'q4',
        stem: 'createServer(async (req, res) => { throw new Error("x") }) 会发生什么？',
        options: [
          { id: 'a', text: 'Node 自动返回 500' },
          { id: 'b', text: '错误被吞掉，请求挂起' },
          { id: 'c', text: '变成 unhandledRejection，Node 15+ 默认让进程退出' },
          { id: 'd', text: '被 createServer 内部的 try/catch 捕获' },
        ],
        answer: 'c',
        why: 'createServer 不 await 回调的返回值。async 函数里 throw 会变成 rejected Promise，没人处理就触发 unhandledRejection，Node 15+ 的默认行为是打印错误并退出进程。这就是"上线后偶发进程重启"的常见原因。正确做法是回调里自己 .catch()，或把业务逻辑抽成 async 函数再显式 catch。',
        stepId: 's4',
      },
      {
        id: 'q5',
        stem: '关于 Node 的"单线程"，最准确的说法是？',
        options: [
          { id: 'a', text: '整个 Node 进程只有一个线程，所有工作都在这一个线程上' },
          { id: 'b', text: 'JS 代码跑在单线程上，I/O 由 libuv 线程池和操作系统异步机制完成' },
          { id: 'c', text: '每个请求一个线程，所以能并发' },
          { id: 'd', text: 'Node 是多线程的，所以 CPU 密集任务也很快' },
        ],
        answer: 'b',
        why: 'JS 执行是单线程的（所以没有锁、没有数据竞争），但底层 I/O 靠 libuv 线程池（默认 4 个线程）和操作系统的 epoll/kqueue 完成。因此 I/O 密集场景并发能力很强，而 CPU 密集的同步代码会独占主线程、阻塞所有请求。',
        stepId: 's8',
      },
      {
        id: 'q6',
        stem: '请求体里包含中文，你在服务端用字符串拼接收集 chunk 后发现乱码。原因是？',
        options: [
          { id: 'a', text: '应该用 GBK 解码' },
          { id: 'b', text: 'UTF-8 中文占 3 字节，字符可能被切在两个 chunk 之间，逐块解码就会坏' },
          { id: 'c', text: 'Content-Type 没写 charset' },
          { id: 'd', text: 'Node 的 Buffer 不支持中文' },
        ],
        answer: 'b',
        why: 'chunk 的边界是任意字节位置，不保证落在字符边界上。一个 3 字节的中文字符被拆成 1+2，两半各自解码都是非法序列。正确做法是收集 Buffer 数组，最后 Buffer.concat(chunks).toString("utf8") 一次性解码。这个问题在纯英文测试里永远发现不了。',
        stepId: 's6',
      },
      {
        id: 'q7',
        stem: '为什么 CORS 配好了不代表接口安全？',
        options: [
          { id: 'a', text: '因为 CORS 有浏览器兼容性问题' },
          { id: 'b', text: '因为 CORS 是浏览器强制的策略，curl / Postman / 服务端调用完全不受限制' },
          { id: 'c', text: '因为 Access-Control-Allow-Origin 可以被伪造' },
          { id: 'd', text: '因为 CORS 只对 GET 生效' },
        ],
        answer: 'b',
        why: 'CORS 是浏览器为了保护用户而实施的同源策略扩展，它约束的是"网页里的 JS 能读什么响应"。任何人用 curl 直接请求你的接口，完全不受 CORS 影响。真正的防护是认证 + 授权 + 限流 + 输入校验。',
        stepId: 's10',
      },
      {
        id: 'q8',
        stem: '接口返回 409 Conflict，前端最合适的处理是？',
        options: [
          { id: 'a', text: '跳转到登录页' },
          { id: 'b', text: '提示"服务异常，请稍后重试"' },
          { id: 'c', text: '提示具体冲突原因（如"该标题已存在"），让用户修改后重试' },
          { id: 'd', text: '自动重试三次' },
        ],
        answer: 'c',
        why: '409 表示请求本身合法，但与当前资源状态冲突（唯一键重复、乐观锁版本不匹配、状态机非法流转）。这是可恢复错误，应该告诉用户具体冲突点让他改。跳登录是 401 的处理，提示"服务异常"是 5xx 的处理，自动重试只会重复冲突。',
        stepId: 's11',
      },
      {
        id: 'q9',
        stem: '关于 res.end()，下面哪个说法是错误的？',
        options: [
          { id: 'a', text: '不调用 end()，请求会一直挂起直到超时' },
          { id: 'b', text: '调用两次 end() 会报 ERR_STREAM_WRITE_AFTER_END' },
          { id: 'c', text: 'setHeader 可以在 end() 之后调用，只要还没 flush' },
          { id: 'd', text: '头已发出后出错，只能 destroy() 而不能改状态码' },
        ],
        answer: 'c',
        why: 'end() 一旦调用，头部就随第一个字节发出了，之后 setHeader 无效且不报错——这是"为什么我设的 Content-Type 没生效"的经典原因。正确顺序永远是：statusCode → setHeader → write → end。判断头是否已发出用 res.headersSent。',
        stepId: 's4',
      },
      {
        id: 'q10',
        stem: '要实现"用户提供一个 URL，服务器抓取网页生成摘要"，最关键的安全措施是？',
        options: [
          { id: 'a', text: '限制 URL 长度' },
          { id: 'b', text: '过滤掉包含 "localhost" 和 "127.0.0.1" 的字符串' },
          { id: 'c', text: '域名白名单 + 解析后校验 IP 不是内网段 + 禁止跟随重定向' },
          { id: 'd', text: '用 https 而不是 http' },
        ],
        answer: 'c',
        why: '这是 SSRF。字符串黑名单必然被绕过（127.0.0.2、0.0.0.0、[::1]、2130706433、0x7f000001、或自己的域名解析到内网）。必须解析成 IP 后判断网段，并防 DNS rebinding，最可靠的是域名白名单。',
        stepId: 's10',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统的后端骨架',
    contributes: '本课产出 server.ts —— 项目的 HTTP 入口层。后面的 RAG 检索、Agent 工具调用、鉴权、流式响应都会挂在这个骨架上。',
    tasks: [
      '把 90 行的 server.ts 跑起来，用 curl 测通 4 个接口（含 404 / 405 / 413 / 400 四种错误分支）',
      '加上 X-Request-Id 响应头，并在错误日志里打印它',
      '把 notes 从内存换成 SQLite（用 node:sqlite 或 better-sqlite3），保证重启后数据还在',
      '给 POST 接口加上 zod 校验，校验失败返回 400 + field',
    ],
    done: '能用 curl 复现出 201 / 400 / 404 / 405 / 413 五种响应，且每种响应的 body 结构一致（都含 code 和 requestId）。',
  },

  further: [
    { text: 'MDN · HTTP 概述与报文结构' },
    { text: 'Node.js 官方文档 · HTTP 模块与 Stream' },
    { text: 'RFC 9110 · HTTP Semantics（状态码的权威定义）' },
    { text: 'OWASP · SSRF Prevention Cheat Sheet' },
  ],
}
