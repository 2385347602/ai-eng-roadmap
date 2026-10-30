/**
 * AI 导师代理服务
 *
 * 存在意义只有一个：API Key 不能出现在前端。
 * 前端只拿到 /api/tutor 这个地址，Key 从进程环境变量读，浏览器永远接触不到。
 *
 * 零依赖，只用 node: 内置模块。启动：
 *   OPENAI_API_KEY=sk-xxx node server/tutor.mjs
 *
 * 兼容任何 OpenAI 格式的接口（DeepSeek / Moonshot / 智谱 / 本地 vLLM 都可以）：
 *   OPENAI_BASE_URL=https://api.deepseek.com/v1 MODEL=deepseek-chat node server/tutor.mjs
 */
import { createServer } from 'node:http'

const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '127.0.0.1'
const API_KEY = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || ''
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
const MODEL = process.env.MODEL || process.env.LLM_MODEL || 'gpt-4o-mini'
const MAX_BODY = 64 * 1024

const SYSTEM_PROMPT = `你是一位带过很多前端工程师转后端的资深工程师，正在给一名 Vue3 + TypeScript 前端工程师做一对一辅导。

要求：
1. 用他能理解的方式解释：优先用 Vue / TypeScript / 浏览器的概念做类比。
2. 不要写百科词条。回答"是什么"之后必须说清"为什么需要""怎么做""什么情况下不该用"。
3. 给代码就给能跑的完整片段，不要伪代码，不要省略号。
4. 如果他问的东西在教材里已经有答案，先确认他卡在哪一句，再针对那句讲，不要重讲一遍。
5. 不确定的地方直说不确定，不要编造 API、参数名或数字。
6. 回答控制在 600 字以内，用短段落，不要用大标题。
7. 拒绝代替他完成作业式的要求（比如"直接给我这一课的答案"）。可以给思路、给反例、给检查清单。`

const MODE_HINT = {
  explain: '用户希望换一种更通俗的说法重讲。请找出最可能让他困惑的那个点，从那个点切入。',
  deeper: '用户想再深入一层。请讲实现细节、边界情况、以及为什么不是另一种做法。',
  example: '用户想要具体场景。请给一个 Vue3 / 前端工程师日常工作里能遇到的例子，带代码。',
  review: '用户想让你审查代码。请先说明你需要看到哪些信息，如果他已经给了代码，按"正确性→边界→安全→可读性"的顺序指出问题。',
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '600')
}

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('BODY_TOO_LARGE'), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(Object.assign(new Error('INVALID_JSON'), { status: 400 }))
      }
    })
    req.on('error', reject)
  })
}

/** 简单的内存限流：每 IP 每分钟 20 次 */
const hits = new Map()
function rateLimit(ip) {
  const now = Date.now()
  const rec = hits.get(ip)
  if (!rec || now > rec.reset) {
    hits.set(ip, { n: 1, reset: now + 60_000 })
    return true
  }
  rec.n += 1
  return rec.n <= 20
}

const server = createServer((req, res) => {
  cors(res)

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  const url = new URL(req.url, 'http://localhost')

  if (url.pathname === '/api/health') {
    return json(res, 200, {
      ok: true,
      configured: Boolean(API_KEY),
      model: API_KEY ? MODEL : null,
      baseUrl: API_KEY ? BASE_URL : null,
      hint: API_KEY
        ? ''
        : '设置环境变量 OPENAI_API_KEY 后重启本服务。也支持 OPENAI_BASE_URL 指向任何兼容接口。',
    })
  }

  if (url.pathname === '/api/tutor' && req.method === 'POST') {
    return handleTutor(req, res).catch((err) => {
      console.error('[tutor]', err)
      if (res.headersSent) return res.destroy()
      json(res, 500, { error: 'INTERNAL_ERROR', message: String(err?.message || err) })
    })
  }

  json(res, 404, { error: 'NOT_FOUND' })
})

async function handleTutor(req, res) {
  if (!API_KEY) {
    return json(res, 503, {
      error: 'NOT_CONFIGURED',
      message: '导师服务未配置模型 Key。设置 OPENAI_API_KEY 后重启。',
    })
  }

  const ip = req.socket.remoteAddress || 'unknown'
  if (!rateLimit(ip)) {
    return json(res, 429, { error: 'RATE_LIMITED', message: '请求太频繁，等一分钟再试。' })
  }

  const body = await readJson(req)
  const question = String(body.question || '').slice(0, 4000)
  if (!question.trim()) {
    return json(res, 400, { error: 'EMPTY_QUESTION', message: '问题不能为空。' })
  }

  const mode = MODE_HINT[body.mode] ? body.mode : 'explain'
  const context = [
    `当前课程：《${String(body.lessonTitle || '未命名').slice(0, 120)}》`,
    `当前步骤：${String(body.stepTitle || '未指定').slice(0, 120)}`,
    `模式：${MODE_HINT[mode]}`,
  ].join('\n')

  const upstream = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: context },
        { role: 'user', content: question },
      ],
    }),
  })

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.end(
      JSON.stringify({
        error: 'UPSTREAM_ERROR',
        status: upstream.status,
        // 只回传上游的错误摘要，绝不回传我们的 Key
        message: text.slice(0, 400),
      }),
    )
  }

  // 边收边转：把上游的 SSE 拆成纯文本增量，前端直接 append
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('X-Accel-Buffering', 'no') // 关掉 nginx 缓冲，否则流式会变成一次性
  res.flushHeaders?.()

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const obj = JSON.parse(payload)
          const delta = obj.choices?.[0]?.delta?.content
          if (delta) res.write(delta)
        } catch {
          // 半截 JSON，丢掉等下一个 chunk
        }
      }
    }
  } catch (err) {
    console.error('[tutor] stream error', err)
  } finally {
    res.end()
  }
}

server.listen(PORT, HOST, () => {
  console.log(`[tutor] http://${HOST}:${PORT}`)
  if (API_KEY) {
    console.log(`[tutor] 已配置：${BASE_URL} · model=${MODEL}`)
  } else {
    console.log('[tutor] 未配置 OPENAI_API_KEY —— /api/health 会返回 configured:false')
    console.log('[tutor] 前端会明确显示"未配置"，不会伪造回答')
  }
})
