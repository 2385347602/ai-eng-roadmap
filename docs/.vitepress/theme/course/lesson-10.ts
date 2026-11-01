import type { Lesson } from './types'

/**
 * 第十课：可观测性
 *
 * 核心立场：LLM 应用的线上问题，80% 无法用传统日志定位。
 * 你必须能回答"这一次回答花了多少钱、用了哪个 prompt 版本、检索到了什么"。
 */
export const lesson10: Lesson = {
  id: 'L10',
  moduleId: 'observe',
  order: 10,
  path: '/learn/10-observability',
  title: '可观测性：五分钟定位到具体那一次调用',
  subtitle: '用户说"昨天它答错了"，你得能在两分钟内翻出那条记录，而不是靠猜。',
  minutes: 70,
  level: '进阶',
  outcome: '能设计一套记录成本、延迟、prompt 版本、检索结果的 trace，并从投诉快速定位到根因。',
  goals: [
    '说清为什么传统 APM 的"一次请求一条日志"模型在 LLM 应用里失效',
    '设计一次 LLM 调用该记录的字段，并知道哪些字段绝不能记',
    '用 trace/span 表达"一次请求 → 多次调用 → 多次工具"的嵌套结构',
    '把成本归因到用户、功能、租户，找出真正在烧钱的地方',
    '用 prompt 版本号把线上表现和代码改动对上',
    '设计"不吵人"的告警：告什么、不告什么',
  ],
  prereqs: [
    '学过第九课，有评测体系和基线数字',
    '跑过一次线上或准线上环境，被"复现不了"折磨过',
    '了解 trace / span 的基本概念（不了解也行，这一课会讲）',
  ],

  steps: [
    {
      id: 's1',
      title: '为什么传统日志在 LLM 应用里失效',
      checkpoint: '用户投诉"它给了个错的退款政策"，你手上只有一条 access log。能查吗？',
      blocks: [
        {
          type: 'p',
          text: '传统 Web 服务的日志模型是"一次请求一条记录"：`GET /api/orders 200 43ms`。出问题时，你顺着这条记录往下看错误栈就够了。',
        },
        {
          type: 'p',
          text: 'LLM 应用不是这样。一次用户请求，内部可能是：',
        },
        {
          type: 'flow',
          title: '一次请求，十几个可失败的点',
          ascii: `POST /api/ask
 ├─ embed(query)                     ← 可能超时，可能返回零向量
 ├─ vector_search + keyword_search    ← 可能权限过滤误杀，可能索引过期
 ├─ rrf + rerank                      ← 可能 rerank 服务降级
 ├─ build_prompt                      ← 用了哪个版本？材料怎么排的？
 ├─ llm(stream)                       ← 可能 429，可能截断，可能拒答
 │   └─ usage: 3,812 in / 402 out     ← 花了多少钱？
 ├─ validate_output                   ← schema 过没过？重试了吗？
 └─ save_message                      ← 存的是原文还是脱敏版？`,
        },
        {
          type: 'table',
          head: ['问题', '传统日志能回答吗', '为什么'],
          rows: [
            ['这次回答花了多少钱', '不能', '没有 usage 记录'],
            ['用的是哪版 prompt', '不能', 'prompt 在代码里，日志里没有版本号'],
            ['检索到了哪几个 chunk', '不能', '中间结果不落日志'],
            ['为什么这次答得比上次差', '不能', '没有可对比的两次调用快照'],
            ['哪个功能在烧钱', '不能', '成本没有归因维度'],
            ['延迟高在哪一段', '部分能', '只能看到总耗时，看不到 prefill / decode / rerank 分布'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '这一课的核心目标只有一个',
          text: '**给你一条 message id，能在 5 分钟内还原出：谁问的、检索到什么、用了哪版 prompt、模型返回什么、花了多少钱、每一步耗时多少。** 做不到这一条，其他所有优化都是盲改。',
        },
        {
          type: 'analogy',
          title: '和前端埋点对照',
          text: '你在前端埋点时会记 `page_view`、`click`、`error`，还要带 `userId`、`sessionId`、`pageVersion`，为的是"用户报了个 bug，能顺着 session 回放"。LLM 的 trace 就是同一件事，只不过回放的不是点击，而是**一次推理的完整输入输出**。',
        },
      ],
    },

    {
      id: 's2',
      title: '一次 LLM 调用该记什么（以及绝不能记什么）',
      checkpoint: 'prompt 全文和用户原话，哪个可以原样落库？',
      blocks: [
        {
          type: 'p',
          text: '字段设计有个简单的检验标准：**出问题时，这些字段够不够我还原现场？** 不够就补，够了就停——记得越多，成本越高，泄露风险越大。',
        },
        {
          type: 'table',
          head: ['字段', '示例', '用途', '敏感度'],
          rows: [
            ['trace_id', 'tr_9f2a…', '串起一次请求的所有步骤', '低'],
            ['span_id / parent_id', 'sp_03 / sp_01', '表达嵌套关系', '低'],
            ['user_id / tenant_id', 'u_882 / t_01', '归因、排查特定用户', '中（内部 id 可记）'],
            ['feature', 'kb_qa / agent_chat', '按功能归因成本', '低'],
            ['prompt_id + version', 'qa_answer@v7', '和代码改动对上', '低'],
            ['model', 'gpt-4o-mini / qwen-plus', '换模型后对比', '低'],
            ['usage', 'in 3812 / out 402', '算钱', '低'],
            ['latency_ms', 'ttft 480 / total 3200', '定位慢在哪', '低'],
            ['finish_reason', 'stop / length / content_filter', '区分"答完"和"被截断"', '低'],
            ['retrieved_chunk_ids', '["refund.md#3", …]', '判断检索是否命中', '低'],
            ['prompt 全文', '…', '复现，但**通常不该原样记**', '高'],
            ['用户原话', '…', '复现，但含 PII', '高'],
            ['模型输出全文', '…', '复现，但可能含敏感信息', '高'],
          ],
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '三条红线',
          text: '① **不要原样记录含 PII 的用户输入**（手机号、身份证、银行卡、病历）；② **不要把 API Key、内部服务地址、数据库错误原文写进 trace**；③ **不要把 trace 传给第三方服务而不做脱敏**——很多可观测平台默认存全量 payload。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '落库前脱敏：白名单 + 正则兜底',
          note: '白名单比黑名单可靠：只记你确定安全的字段，剩下的默认不记。反过来（默认全记、黑名单排除）一定会漏。',
          code: `const SAFE_FIELDS = [
  'trace_id', 'span_id', 'parent_id', 'user_id', 'tenant_id',
  'feature', 'prompt_id', 'prompt_version', 'model',
  'input_tokens', 'output_tokens', 'cached_tokens',
  'ttft_ms', 'latency_ms', 'finish_reason', 'status',
  'retrieved_chunk_ids', 'tool_names',
]

const PII_PATTERNS: [RegExp, string][] = [
  [/1[3-9]\\d{9}/g, '[PHONE]'],
  [/\\d{17}[\\dXx]/g, '[IDCARD]'],
  [/\\b\\d{16,19}\\b/g, '[CARD]'],
  [/[\\w.+-]+@[\\w-]+\\.[\\w.]+/g, '[EMAIL]'],
]

function redact(text: string): string {
  return PII_PATTERNS.reduce((s, [re, tag]) => s.replace(re, tag), text)
}

function buildRecord(span: Span): Record<string, unknown> {
  const rec: Record<string, unknown> = {}
  for (const k of SAFE_FIELDS) {
    if (span[k] !== undefined) rec[k] = span[k]
  }
  // 需要留一点原文用于复现时，只留前 200 字并脱敏
  if (span.inputPreview) rec.input_preview = redact(String(span.inputPreview).slice(0, 200))
  if (span.outputPreview) rec.output_preview = redact(String(span.outputPreview).slice(0, 200))
  return rec
}`,
        },
        {
          type: 'p',
          text: '注意 `input_preview` 这个折中：**留 200 字脱敏摘要**，既能在 80% 的情况下判断"它到底在问什么"，又不会把整段病历写进日志。需要完整内容时，让用户授权后去业务库取（业务库有权限控制和审计）。',
        },
      ],
    },

    {
      id: 's3',
      title: 'trace 结构：把嵌套关系表达清楚',
      checkpoint: '为什么不能把一次请求的所有步骤压平成一条日志？',
      blocks: [
        {
          type: 'p',
          text: '一次请求会调用多次模型、多次工具，而且 Agent 场景下这些调用是**嵌套**的：外层是"回答用户"，内层是"检索"和"调工具"，工具里还可能再调模型。压平成一条日志，你就失去了"谁包含谁"和"谁慢"的信息。',
        },
        {
          type: 'flow',
          title: '一棵 trace 树',
          ascii: `trace tr_9f2a  (总 3.4s, $0.0041)
│
├─ span sp_01  http.post /api/ask            3.4s
│  │
│  ├─ span sp_02  retrieve                   820ms
│  │  ├─ span sp_03  embed                    90ms
│  │  ├─ span sp_04  vector_search           210ms   ← 命中 50
│  │  ├─ span sp_05  keyword_search          180ms   ← 命中 50
│  │  └─ span sp_06  rerank                  340ms   ← 50 → 5
│  │
│  ├─ span sp_07  llm.generate              2450ms   ← 大头
│  │     ttft 480ms / decode 1970ms
│  │     in 3812 tok (cached 2048) / out 402 tok
│  │
│  └─ span sp_08  validate                    30ms   ← schema 通过
│
└─ span sp_09  persist                       60ms`,
        },
        {
          type: 'p',
          text: '有了树，你才能回答"慢在哪"：这里总 3.4s，模型占 2.45s（72%），检索 0.82s（24%）。**先优化模型那一段**——但注意 `cached 2048`，说明 prefix cache 已经在起作用，进一步压缩空间有限，真正的优化点可能是"把 out 402 tok 降下来"（输出越短越省时间）。',
        },
        {
          type: 'table',
          head: ['方案', '成本', '适合'],
          rows: [
            ['自己写表 + trace_id 串起来', '最低，一张 PG 表就够', '小项目、单服务'],
            ['OpenTelemetry SDK + 任意后端', '中，标准协议不锁定厂商', '已有 OTel 基础设施'],
            ['Langfuse / Phoenix 等 LLM 专用平台', '中，开箱有 prompt 版本、成本面板', '想省事、能接受自托管或 SaaS'],
            ['云厂商自带（如各家的 trace 服务）', '低上手成本，高锁定', '全栈都在一家云上'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '最小可用方案',
          text: '一张 `llm_spans` 表（trace_id, span_id, parent_id, name, started_at, duration_ms, attrs jsonb）+ 一个 `withSpan()` 包装函数，**50 行代码就能跑起来**。不要一上来就搭全套 OTel——先有数据，再谈标准化。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'withSpan：50 行的最小实现',
          code: `import { AsyncLocalStorage } from 'node:async_hooks'

const als = new AsyncLocalStorage<{ traceId: string; spanId: string }>()

export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attrs: Record<string, unknown> = {},
): Promise<T> {
  const parent = als.getStore()
  const traceId = parent?.traceId ?? newId('tr')
  const spanId = newId('sp')
  const startedAt = Date.now()

  try {
    return await als.run({ traceId, spanId }, fn)
  } finally {
    // finally 保证异常路径也落记录 —— 失败的 span 恰恰是最需要看的
    void db.insert('llm_spans', {
      trace_id: traceId,
      span_id: spanId,
      parent_id: parent?.spanId ?? null,
      name,
      duration_ms: Date.now() - startedAt,
      status: 'ok',
      attrs,
    })
  }
}

// 用法
await withSpan('http.post /api/ask', async () => {
  const chunks = await withSpan('retrieve', () => retrieve(q))
  const answer = await withSpan('llm.generate', () => llm(messages))
  return answer
})`,
        },
        {
          type: 'p',
          text: '`AsyncLocalStorage` 是这里的功臣：它让 `withSpan` 自动知道"我现在在哪个父 span 里"，不需要你手动传 traceId 参数。**这是 Node 里做 trace 的标准做法**，比手动传参干净得多。',
        },
      ],
    },

    {
      id: 's4',
      title: '成本归因：找出真正在烧钱的那 10%',
      checkpoint: '总账单涨了 3 倍，但 QPS 没变。你会先查什么？',
      blocks: [
        {
          type: 'p',
          text: '成本是个乘法：`调用次数 × (输入 token × 输入单价 + 输出 token × 输出单价)`。每一项都可能出问题，所以必须分维度归因。',
        },
        {
          type: 'table',
          head: ['归因维度', '能回答的问题', '怎么记'],
          rows: [
            ['按 feature', '哪个功能最贵？值不值？', '请求入口打 feature 标签'],
            ['按用户/租户', '有没有单个用户在刷？', '从会话取 userId'],
            ['按模型', '换小模型能省多少？', '记 model 字段'],
            ['按 prompt 版本', '新版是不是变贵了？', '记 prompt_version'],
            ['按输入/输出', '是上下文太长还是话太多？', '分别记 in/out token'],
            ['按缓存命中', 'prefix cache 有没有生效？', '记 cached_tokens'],
          ],
        },
        {
          type: 'code',
          lang: 'sql',
          title: '三个能立刻用上的查询',
          code: `-- 1. 哪个功能最贵（近 7 天）
SELECT feature,
       count(*)                                   AS calls,
       sum(input_tokens)                          AS in_tok,
       sum(output_tokens)                         AS out_tok,
       round(sum(input_tokens *  $in_price / 1e6
               + output_tokens * $out_price / 1e6), 4) AS usd
  FROM llm_spans
 WHERE name = 'llm.generate'
   AND started_at > now() - interval '7 days'
 GROUP BY feature
 ORDER BY usd DESC;

-- 2. 有没有异常用户（单日调用 > 均值 10 倍）
SELECT user_id, count(*) AS calls, sum(output_tokens) AS out_tok
  FROM llm_spans
 WHERE name = 'llm.generate'
   AND started_at > now() - interval '1 day'
 GROUP BY user_id
HAVING count(*) > 200
 ORDER BY calls DESC;

-- 3. prompt 版本变化对成本的影响
SELECT prompt_version,
       avg(input_tokens)::int  AS avg_in,
       avg(output_tokens)::int AS avg_out,
       count(*)                AS calls
  FROM llm_spans
 WHERE name = 'llm.generate'
   AND started_at > now() - interval '14 days'
 GROUP BY prompt_version
 ORDER BY calls DESC;`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '最常见的成本失控原因，按发生频率排',
          text: '① **上下文没裁剪**（Agent 跑十几轮，messages 越滚越大）；② **RAG top-k 太大**（top-20 全塞进 prompt，实际只用前 3 条）；③ **输出没限长**（`max_tokens` 没设，模型写小作文）；④ **重试没有上限**（一个 429 触发三次重试，成本 ×3）；⑤ **prefix cache 没命中**（system prompt 每次都变，缓存全废）；⑥ **该用小模型的用了大模型**。这六条占了绝大多数账单异常。',
        },
        {
          type: 'p',
          text: '特别说一下 **prefix cache**：它的原理是"开头相同的 prompt 可以复用已算好的 KV cache"。但**只要开头有一个字符不同，整段缓存就失效**。所以 system prompt 里千万不要放时间戳、随机 id、用户名——把这些放到最后。这个改动通常能省 30%~50% 的输入成本。',
        },
      ],
    },

    {
      id: 's5',
      title: 'prompt 版本：让线上表现和代码改动对上',
      checkpoint: '你把 prompt 从 v6 改到 v7 之后准确率下降了。怎么确认是 v7 的问题？',
      blocks: [
        {
          type: 'p',
          text: '如果没有版本号，你只能靠"改的时间点"猜。而线上表现的变化可能来自：模型供应商更新、用户问题分布变化、检索库更新、你的 prompt 改动。**四个变量同时动，你无法归因。**',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'prompt 即文件，版本即内容哈希',
          note: '不要手写版本号（人会忘记改），用内容哈希自动生成。改一个字版本就变，改不回来版本也对得上。',
          code: `import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export function loadPrompt(id: string) {
  const text = readFileSync(\`prompts/\${id}.md\`, 'utf8')
  const version = createHash('sha256').update(text).digest('hex').slice(0, 8)
  return {
    id: \`\${id}@\${version}\`,
    version,
    render: (vars: Record<string, string>) =>
      text.replace(/\\{\\{(\\w+)\\}\\}/g, (_, k) => vars[k] ?? \`{{\${k}}}\`),
  }
}

// 调用时
const p = loadPrompt('qa_answer')
const span = { prompt_id: p.id, prompt_version: p.version }
// → 日志里就是 "qa_answer@3f9c1a2b"，改一个字就变成另一个版本`,
        },
        {
          type: 'p',
          text: '有了这个，三个问题立刻变得可回答：',
        },
        {
          type: 'list',
          items: [
            '**"v7 比 v6 差吗？"** → 按 `prompt_version` 分组算准确率，样本够就直接出结论。',
            '**"这周为什么变差？"** → 看 `prompt_version` 分布有没有变（是不是灰度发了一半）。',
            '**"这条坏回答是哪版产生的？"** → trace 里直接有。',
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          title: '和评测集联动',
          text: '每次 prompt 版本变更，CI 里跑一遍评测集，把"版本号 → 通过率"存成一张表。这样你能画出**版本演进曲线**：哪个版本是分水岭，哪个改动其实是负收益。**这张表是你三个月后回看时最有价值的东西。**',
        },
        {
          type: 'p',
          text: '灰度发布也要靠它：新版本先给 5% 流量，观察 24 小时的成本、延迟、点踩率、转人工率，没问题再全量。**没有版本号就没有灰度，没有灰度就只能全量赌博。**',
        },
      ],
    },

    {
      id: 's6',
      title: '五分钟定位：从投诉到根因',
      checkpoint: '用户说"昨天问退款，它说 30 天无理由"。你手上有 message id。走哪几步？',
      blocks: [
        {
          type: 'p',
          text: '这是本课的实战演练。假设你有前面的 trace 体系，流程是这样：',
        },
        {
          type: 'flow',
          title: '定位流程（每一步都有明确的"看什么"）',
          ascii: `① 拿 message_id 找到 trace
   → SELECT * FROM llm_spans WHERE trace_id = ?
   看：feature / prompt_version / model / status

② 看检索 span：retrieved_chunk_ids 里有没有退款政策？
   ├─ 没有 → 检索问题，跳到 ③
   └─ 有   → 生成问题，跳到 ④

③ 检索为什么没命中？
   - chunk_ids 数量为 0 → 权限过滤误杀？索引没更新？
   - 命中的是别的文档 → 切分/embedding/查询改写问题
   - 复现：拿同样的 query 手动跑 retrieve()，看 top-50

④ 生成为什么答错？
   - 材料里写的是"7 天"，模型说"30 天" → 幻觉，看 prompt 约束
   - 材料里确实有"30 天"（旧版文档）→ 知识库过期
   - finish_reason = length → 被截断了，答了半句
   - 上下文里"7 天"排在第 5 位 → lost in the middle，调整排序

⑤ 修复后回填：把这条用例加进评测集，防止再犯`,
        },
        {
          type: 'code',
          lang: 'sql',
          title: '一条查询还原现场',
          code: `SELECT s.name,
       s.duration_ms,
       s.attrs->>'model'            AS model,
       s.attrs->>'prompt_version'   AS prompt_ver,
       s.attrs->>'input_tokens'     AS in_tok,
       s.attrs->>'output_tokens'    AS out_tok,
       s.attrs->>'finish_reason'    AS finish,
       s.attrs->'retrieved_chunk_ids' AS chunks,
       s.attrs->>'input_preview'    AS q,
       s.attrs->>'output_preview'   AS a
  FROM llm_spans s
 WHERE s.trace_id = $1
 ORDER BY s.started_at;`,
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '把"回填"变成习惯',
          text: '每修一个线上问题，就把那条用例加进评测集（第九课）。**修完不回填，等于下次还会犯。** 这是评测体系和可观测体系之间最重要的一根线——观测发现问题，评测防止复发。',
        },
        {
          type: 'p',
          text: '还有一件事要做：**给用户一个"报告问题"的入口**。用户点一下，你把 trace_id 带上，他再补一句"这里说的不对"。这条链路的价值极高——它把"用户模糊的不满"变成"一条带完整上下文的工单"，而且是**用户主动标注的失败案例**，比你自己抽检高效得多。',
        },
      ],
    },

    {
      id: 's7',
      title: '告警：只告"需要人动手"的事',
      checkpoint: '为什么"错误率超过 1% 就告警"在 LLM 应用里通常会变成噪声？',
      blocks: [
        {
          type: 'p',
          text: '告警设计只有一个标准：**收到这条告警的人，能不能立刻做一件具体的事？** 不能，就不该告。',
        },
        {
          type: 'table',
          head: ['现象', '该告警吗', '为什么'],
          rows: [
            ['LLM API 持续 429 / 5xx', '✅ 告', '服务不可用，要切模型或降级'],
            ['P95 延迟从 3s 涨到 15s', '✅ 告', '用户体验崩了，要查'],
            ['成本日环比涨 200%', '✅ 告', '可能在漏钱，要查'],
            ['拒答率突然从 8% 涨到 60%', '✅ 告', '索引可能坏了'],
            ['单个用户调用量异常', '✅ 告（低优先级）', '可能被刷'],
            ['单次回答"质量差"', '❌ 不告', '无法自动判定，会全是噪声'],
            ['错误率 1.2%（基线 0.9%）', '❌ 不告', '在噪声范围内'],
            ['某条 trace 慢', '❌ 不告', '看 P95，不看单条'],
            ['模型返回了 content_filter', '⚠️ 看比例', '偶发正常，比例异常才告'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '带"抖动容忍"的告警规则',
          note: 'LLM 的指标天然抖。用"连续 N 个窗口都异常"代替"单点超阈值"，能砍掉 80% 的假告警。',
          code: `type Window = { ts: number; total: number; errors: number; cost: number }

function evaluate(windows: Window[]) {
  const recent = windows.slice(-5)          // 最近 5 个 5 分钟窗口
  const errRate = recent.map((w) => (w.total ? w.errors / w.total : 0))
  const allHigh = errRate.every((r) => r > 0.05)

  const alerts: string[] = []
  if (allHigh && recent.reduce((a, w) => a + w.total, 0) > 50) {
    alerts.push(\`错误率连续 25 分钟高于 5%（当前 \${(errRate.at(-1)! * 100).toFixed(1)}%）\`)
  }

  // 成本：和昨天同一时段比，而不是和上一个窗口比（避免日间波动误报）
  const todayCost = recent.reduce((a, w) => a + w.cost, 0)
  const ydaySameSlot = getYesterdaySameSlotCost()
  if (ydaySameSlot > 0 && todayCost > ydaySameSlot * 2 && todayCost > 5) {
    alerts.push(\`成本是昨天同时段的 \${(todayCost / ydaySameSlot).toFixed(1)} 倍\`)
  }

  return alerts
}`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '告警疲劳是真实的成本',
          text: '一条天天响的告警，三周后所有人都会无视它——包括真正出事的那次。**宁可少告，不可乱告。** 定期清理：过去 30 天一次都没被人处理过的告警，删掉或降级成面板。',
        },
        {
          type: 'p',
          text: '最后补一个容易被忽略的：**记录"降级"事件**。当你因为 429 切到备用模型、因为 rerank 超时跳过重排、因为预算超限拒绝服务时，这些都要打点。否则你会看到"质量莫名下降"，其实是因为系统已经悄悄降级跑了两周，而你不知道。',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '该记什么',
      points: 10,
      prompt: '下面哪一组字段最适合作为 LLM 调用的**默认**记录内容？',
      options: [
        { id: 'a', text: 'prompt 全文 + 用户原话 + 模型输出全文' },
        { id: 'b', text: 'trace_id、model、prompt_version、token 数、延迟、finish_reason、检索到的 chunk id，加脱敏后的 200 字摘要' },
        { id: 'c', text: '只记耗时和状态码' },
        { id: 'd', text: '把整个请求体 JSON 原样存下来' },
      ],
      answer: ['b'],
      hints: [
        '两个约束同时存在：要能还原现场，又不能泄露 PII。',
        'a 和 d 都会把敏感数据写进日志；c 信息不够，出问题查不出来。',
        'b 是白名单思路：只记确定安全的元数据，加一小段脱敏摘要。需要全文时去业务库取（有权限和审计）。',
      ],
      explanation: '正确答案是 b。默认记录应该是"白名单 + 脱敏摘要"，而不是"全量 + 黑名单"——后者一定会漏。',
      approach: [
        '列出"还原现场最少需要哪些元数据"',
        'PII 一律不记原文，只记脱敏摘要',
        '需要全文时通过业务库 + 授权访问，而不是复制到日志',
        '对第三方可观测平台，落库前再脱敏一次',
      ],
      knowledge: ['trace 字段', 'PII 脱敏', '白名单原则'],
      pitfalls: [
        '把 prompt 全文和用户原话直接落库',
        '只记状态码，出问题无法复现',
      ],
    },
    {
      id: 'e2',
      type: 'multi',
      title: 'trace 该记哪些信息',
      points: 15,
      prompt: '为了让"用户投诉某次回答错误"能被定位，trace 里应该包含哪些？（多选）',
      options: [
        { id: 'a', text: 'prompt 的版本号（内容哈希）' },
        { id: 'b', text: '检索命中的 chunk id 列表' },
        { id: 'c', text: '每一步的耗时和父子嵌套关系' },
        { id: 'd', text: '模型的 API Key，方便复现调用' },
        { id: 'e', text: 'finish_reason（区分正常结束和被截断）' },
      ],
      answer: ['a', 'b', 'c', 'e'],
      hints: [
        '想"定位流程"：先看检索有没有命中，再看生成为什么错。',
        '还有一步：判断是不是被 max_tokens 截断了。',
        'a 让改动可归因；b 判断检索层是否失败；c 定位慢在哪、谁包含谁；e 区分"答完了"和"被截断"。d 是绝对禁止的——密钥永远不能进日志。',
      ],
      explanation: 'a、b、c、e 都是定位必需的。d 是严重安全事故：密钥进日志等于泄露。',
      approach: [
        '按"定位流程"倒推需要什么字段',
        '检索层：chunk id + 各路召回数量 + rerank 分数',
        '生成层：prompt 版本 + model + token 数 + finish_reason',
        '结构层：span 的父子关系和耗时',
        '凭证类信息一律排除',
      ],
      knowledge: ['trace 设计', 'finish_reason', 'chunk id', '密钥管理'],
      pitfalls: [
        '把 API Key 或内部地址写进 trace',
        '不记 finish_reason，把"截断"误判成"答错"',
      ],
    },
    {
      id: 'e3',
      type: 'fill',
      title: '算清一次调用的成本',
      points: 15,
      prompt: '某次调用：输入 12,000 token（其中 8,000 命中 prefix cache），输出 900 token。输入单价 $0.5/百万 token，缓存命中按 10% 计价，输出单价 $1.5/百万 token。算出这次的成本。',
      templateLang: 'text',
      template: `未命中输入 = 12000 - 8000 = {{u1}} token
未命中成本   = 4000 × 0.5 / 1e6  = \${{u2}}
命中成本     = 8000 × 0.5 × 0.1 / 1e6 = \${{u3}}
输出成本     = 900 × 1.5 / 1e6   = \${{u4}}

总成本       = \${{total}}
其中输出占比 = {{pct}}%

结论：这次调用里，{{concl}} 是主要成本`,
      blanks: [
        { id: 'u1', label: '未命中输入 token', accept: ['4000', '4,000'], width: 80 },
        { id: 'u2', label: '未命中输入成本', accept: ['0.002', '.002'], width: 90 },
        { id: 'u3', label: '缓存命中成本', accept: ['0.0004', '.0004'], width: 90 },
        { id: 'u4', label: '输出成本', accept: ['0.00135', '.00135'], width: 90 },
        { id: 'total', label: '总成本', accept: ['0.00375', '.00375'], width: 90 },
        { id: 'pct', label: '输出占比（保留整数）', accept: ['36'], width: 60 },
        { id: 'concl', label: '哪一部分是主要成本', accept: ['未命中输入', '输入', '未命中输入的输入', '输入（未命中部分）'], width: 130 },
      ],
      hints: [
        '缓存命中的部分按 10% 计价，不是免费。',
        '输出单价是输入的 3 倍，但输出量通常只有输入的 1/10，所以两边都要算。',
        '未命中输入 = 4000 token → 4000 × 0.5/1e6 = $0.002。缓存命中 = 8000 × 0.5 × 0.1/1e6 = $0.0004。输出 = 900 × 1.5/1e6 = $0.00135。总计 $0.00375。输出占 0.00135/0.00375 = 36%。主要成本是未命中的输入（53%）。',
      ],
      explanation: '总成本 $0.00375。虽然输出单价是输入的 3 倍，但因为输入量是输出的 13 倍，未命中输入仍占 53%。这解释了为什么"缩短输入"往往比"缩短输出"更省钱——但也说明两者都不能忽略。',
      approach: [
        '先拆成三段：未命中输入、缓存命中输入、输出',
        '分别乘各自单价（注意缓存是折扣价）',
        '相加得总成本',
        '算各段占比，找出主要成本项',
      ],
      knowledge: ['token 成本', 'prefix cache 计价', '成本拆解'],
      pitfalls: [
        '把缓存命中的部分当免费',
        '只算输入不算输出（输出单价通常更高）',
      ],
    },
    {
      id: 'e4',
      type: 'code',
      title: '实现递归脱敏',
      points: 20,
      prompt: '实现 `redact(obj, keys)`：返回一个**新对象**（不修改原对象），把任意层级中键名命中 `keys` 的值替换成 `\'[REDACTED]\'`，并递归处理嵌套对象和数组。',
      starter: `function redact(obj, keys) {
  const hit = new Set(keys)
  // TODO
  return obj
}

return redact`,
      checks: [
        {
          name: '顶层字段被脱敏',
          expr: "result({ name: 'a', apiKey: 'sk-1' }, ['apiKey']).apiKey === '[REDACTED]'",
        },
        {
          name: '不命中字段保留原值',
          expr: "result({ name: 'a', apiKey: 'sk-1' }, ['apiKey']).name === 'a'",
        },
        {
          name: '嵌套对象也脱敏',
          expr: "result({ cfg: { apiKey: 'sk-1', host: 'h' } }, ['apiKey']).cfg.apiKey === '[REDACTED]' && result({ cfg: { apiKey: 'sk-1', host: 'h' } }, ['apiKey']).cfg.host === 'h'",
        },
        {
          name: '数组里的对象也脱敏',
          expr: "result({ list: [{ token: 't1' }, { token: 't2' }] }, ['token']).list[1].token === '[REDACTED]'",
        },
        {
          name: '不修改原对象',
          expr: "(() => { const o = { apiKey: 'sk-1' }; result(o, ['apiKey']); return o.apiKey === 'sk-1' })()",
        },
        {
          name: 'null 和基本类型不炸',
          expr: "(() => { const r = result({ a: null, b: 1, c: 'x' }, ['a']); return r.a === '[REDACTED]' && r.b === 1 && r.c === 'x' })()",
        },
      ],
      solution: `function redact(obj, keys) {
  const hit = new Set(keys)

  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const out = {}
      for (const [k, val] of Object.entries(v)) {
        out[k] = hit.has(k) ? '[REDACTED]' : walk(val)
      }
      return out
    }
    return v
  }

  return walk(obj)
}`,
      hints: [
        '写一个内部递归函数 `walk`，它只负责"给一个值，返回一个安全的副本"。',
        '注意区分三种情况：数组、普通对象、其他（基本类型 / null）。',
        '完整实现：`walk` 先判 `Array.isArray` 就 map；再判 `typeof v === \'object\' && v !== null` 就遍历 entries，键命中就替换、否则递归；其余原样返回。**一定要新建对象**，不能原地改，否则会污染调用方的数据。',
      ],
      explanation: '脱敏函数必须"纯"——返回新对象，不改原对象。因为原对象往往还要继续用（比如真的去调 API），被改坏了就是线上事故。',
      approach: [
        '写递归函数处理三种类型：数组、对象、其他',
        '对象遍历 entries，键命中直接替换，未命中递归',
        '数组逐项递归',
        '全程新建对象/数组，绝不原地修改',
      ],
      knowledge: ['递归', '深拷贝式变换', '脱敏', '纯函数'],
      pitfalls: [
        '原地修改原对象（会破坏后续调用）',
        '只处理一层，漏掉嵌套结构',
        '把 `null` 当对象处理导致报错',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 15,
    questions: [
      {
        id: 'q1',
        stem: '为什么传统 access log 无法定位 LLM 应用的答错问题？',
        options: [
          { id: 'a', text: '日志文件太大' },
          { id: 'b', text: '它只记了请求路径和状态码，没有检索结果、prompt 版本、token 数和模型输出' },
          { id: 'c', text: '日志不支持中文' },
          { id: 'd', text: '因为 LLM 是异步的' },
        ],
        answer: 'b',
        why: 'LLM 应用一次请求内部有十几个可失败的点，每个都需要自己的记录。一条 access log 还原不了现场。',
        stepId: 's1',
      },
      {
        id: 'q2',
        stem: '关于日志里的 PII，正确做法是？',
        options: [
          { id: 'a', text: '原样记录，方便排查' },
          { id: 'b', text: '默认不记原文，只记脱敏后的短摘要；需要全文时去业务库按权限取' },
          { id: 'c', text: '加密后记录' },
          { id: 'd', text: '只记长度' },
        ],
        answer: 'b',
        why: '白名单 + 脱敏摘要 + 业务库授权访问，是唯一可持续的做法。加密后记录仍然会在解密后泄露，且增加运维复杂度。',
        stepId: 's2',
      },
      {
        id: 'q3',
        stem: '为什么 trace 要用树形结构而不是压平的一行日志？',
        options: [
          { id: 'a', text: '树形更省空间' },
          { id: 'b', text: '为了表达"谁包含谁"，从而看出哪一段慢、哪一段是子步骤' },
          { id: 'c', text: '因为数据库要求' },
          { id: 'd', text: '为了好看' },
        ],
        answer: 'b',
        why: '嵌套关系是定位的前提。一次请求里检索、生成、工具调用是并列或嵌套的，压平后无法判断"3.4 秒里模型占多少"。',
        stepId: 's3',
      },
      {
        id: 'q4',
        stem: '总账单涨了 3 倍但 QPS 没变，下面哪个原因最不可能？',
        options: [
          { id: 'a', text: 'Agent 轮次变多，上下文越来越长' },
          { id: 'b', text: 'RAG top-k 从 5 调到 20，全塞进 prompt' },
          { id: 'c', text: 'prefix cache 失效了' },
          { id: 'd', text: '用户变多了' },
        ],
        answer: 'd',
        why: '题干已说 QPS 没变，所以"用户变多"自相矛盾。其余三个都是典型的单次成本上升原因。',
        stepId: 's4',
      },
      {
        id: 'q5',
        stem: '为什么 system prompt 里不要放时间戳和随机 id？',
        options: [
          { id: 'a', text: '会让模型困惑' },
          { id: 'b', text: '开头一变，prefix cache 全部失效，输入成本大幅上升' },
          { id: 'c', text: '违反规范' },
          { id: 'd', text: '会超出上下文' },
        ],
        answer: 'b',
        why: 'prefix cache 依赖"开头完全相同"。任何动态内容放在最前面都会让缓存命中率为 0，通常白烧 30%~50% 的输入成本。',
        stepId: 's4',
      },
      {
        id: 'q6',
        stem: 'prompt 版本号为什么建议用内容哈希而不是手写 v1/v2？',
        options: [
          { id: 'a', text: '哈希更短' },
          { id: 'b', text: '手写版本号会忘记改，导致日志里的版本和实际内容不符；哈希自动跟随内容变化' },
          { id: 'c', text: '哈希更安全' },
          { id: 'd', text: '数据库要求' },
        ],
        answer: 'b',
        why: '版本号的意义是"可归因"。手写版本号一旦忘记更新，归因就全错了，而且这种错不会报错，只会让你得出错误结论。',
        stepId: 's5',
      },
      {
        id: 'q7',
        stem: '用户投诉某次回答错误，检索 span 显示 retrieved_chunk_ids 为空。下一步该做什么？',
        options: [
          { id: 'a', text: '换更强的模型' },
          { id: 'b', text: '查检索为什么空：权限过滤是否误杀、索引是否更新、查询改写是否有问题' },
          { id: 'c', text: '改 prompt 让模型更谨慎' },
          { id: 'd', text: '增加 top-k' },
        ],
        answer: 'b',
        why: '检索为空是检索层故障，改模型和 prompt 都无效。要先搞清楚是"该搜到没搜到"还是"根本不该搜到"。',
        stepId: 's6',
      },
      {
        id: 'q8',
        stem: '什么样的指标适合做成告警？',
        options: [
          { id: 'a', text: '单次回答的质量评分' },
          { id: 'b', text: '连续多个时间窗口内 429 比例超阈值、成本日环比暴涨、拒答率异常升高' },
          { id: 'c', text: '每一条慢请求' },
          { id: 'd', text: '用户的每一条点踩' },
        ],
        answer: 'b',
        why: '告警的标准是"收到的人能立刻做一件具体的事"。单条质量、单条慢请求、单次点踩都无法自动判定且会制造噪声。',
        stepId: 's7',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统：可观测层',
    contributes:
      '这一课给项目装上"黑匣子"。做完之后，任何一次回答都能被还原：谁问的、搜到什么、用了哪版 prompt、花了多少钱、慢在哪。',
    tasks: [
      '建 llm_spans 表（trace_id, span_id, parent_id, name, duration_ms, attrs jsonb），写 withSpan 包装函数',
      '用 AsyncLocalStorage 实现父子关系自动传递，把 retrieve / rerank / llm.generate / validate 都包成 span',
      '实现白名单 + 正则兜底的脱敏，落库前只保留安全字段和 200 字脱敏摘要',
      'prompt 改为文件加载 + 内容哈希版本号，把 prompt_version 记进 span',
      '写三个成本查询：按 feature、按用户异常、按 prompt 版本对比',
      '做一个 /admin/trace/:id 页面（或 CLI 命令），输入 trace_id 输出完整的树形时间线',
      '实现告警规则：连续 5 个窗口错误率 > 5%、成本是昨日同时段 2 倍、拒答率突增',
      '在用户侧加"报告问题"入口，自动带上 trace_id',
    ],
    done: '给一个 message id，能在两分钟内说出"这次检索命中了 3 条但都不含退款政策，prompt 用的是 qa_answer@3f9c1a2b，输入 3812 token 里 2048 命中缓存，总共花了 $0.0038"；成本面板能指出"agent_chat 这个功能占了 78% 的成本但只有 9% 的调用量"。',
  },

  further: [
    { text: 'OpenTelemetry · GenAI semantic conventions（LLM span 的标准字段命名）' },
    { text: 'Langfuse 文档 · trace / generation / score 的数据模型' },
    { text: 'Google SRE Book · 第四章 Service Level Objectives（SLI/SLO 的原始定义）' },
    { text: '知识地图 08 可观测与运维（/guide/08-observability）' },
  ],
}
