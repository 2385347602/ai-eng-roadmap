import type { Lesson } from './types'

/**
 * 第十八课：成本工程
 *
 * 核心立场：成本不是财务指标，是产品指标。
 * "每个工单花多少钱"决定了这个功能能不能规模化。
 */
export const lesson18: Lesson = {
  id: 'L18',
  moduleId: 'cost',
  order: 18,
  path: '/learn/18-cost',
  title: '成本工程：把每次调用的钱算清楚，然后砍掉一半',
  subtitle: '省成本的正确顺序不是"换便宜模型"，而是"别把不该发的 token 发出去"。',
  minutes: 65,
  level: '进阶',
  outcome: '能算出自己产品的单位经济，并用手上的六个杠杆把成本降下来，同时用评测守住质量。',
  goals: [
    '拆解成本的六个组成部分，找出真正的成本大头',
    '按收益排序使用六个降本杠杆，而不是一上来就换小模型',
    '正确使用三层缓存，并知道各自的失效条件',
    '设计模型路由与级联，让简单请求走便宜路径',
    '建立预算、配额、预警机制，防止单点失控',
    '算出单位经济（每个任务多少钱），并据此做产品决策',
  ],
  prereqs: [
    '学过第十课，有 trace 和成本归因数据',
    '学过第九课，有评测集能验证质量',
    '学过第十七课，理解 token 定价的构成',
  ],

  steps: [
    {
      id: 's1',
      title: '成本不是"单价 × token 数"这么简单',
      checkpoint: '为什么账单总是比你自己算的高 30%？',
      blocks: [
        {
          type: 'p',
          text: '因为账单里有六项，你通常只算了第一项：',
        },
        {
          type: 'table',
          head: ['成本项', '占比（典型）', '容易被忽略的原因'],
          rows: [
            ['输入 token', '35~50%', '主要成本，但常被低估（上下文比想象的长）'],
            ['输出 token', '25~40%', '单价是输入的 2~4 倍'],
            ['重试', '5~15%', '失败的调用也要付费'],
            ['缓存未命中', '隐性', '本该命中却每次都重算'],
            ['闲置/空转', '5~10%', '轮询、心跳、超时后仍在跑的请求'],
            ['检索与工具', '5~10%', 'embedding、rerank、OCR、ASR 都是钱'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '把六项都算进去',
          code: `type Usage = {
  inputTokens: number
  cachedTokens: number      // 命中 prefix cache 的部分
  outputTokens: number
  retries: number
  embeddingTokens?: number
  rerankCalls?: number
}

function realCost(u: Usage, p: Pricing) {
  const freshInput = u.inputTokens - u.cachedTokens

  const input = (freshInput / 1e6) * p.inputPerM
  const cached = (u.cachedTokens / 1e6) * p.inputPerM * (p.cacheDiscount ?? 0.1)
  const output = (u.outputTokens / 1e6) * p.outputPerM

  // 重试是"白花的钱"：它不产生额外价值
  const retry = u.retries * (input + output) * 0.6

  const embed = ((u.embeddingTokens ?? 0) / 1e6) * p.embedPerM
  const rerank = (u.rerankCalls ?? 0) * p.rerankPerCall

  return { input, cached, output, retry, embed, rerank,
           total: input + cached + output + retry + embed + rerank }
}`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '重试是纯损耗',
          text: '一次成功的调用产生价值，一次失败的重试只产生账单。**重试率从 3% 涨到 15%，成本直接多 10%，而用户什么也没得到。** 所以"降低重试率"本身就是降本手段——超时设合理、错误分类清楚、限流做好，比换模型有效。',
        },
        {
          type: 'p',
          text: '还有一个常被忽略的：**超时后仍在跑的请求**。用户关掉页面，你的流式生成还在继续，直到 max_tokens 才停。第十二课讲过要 `abort`，这里补上它的成本意义：**一个 4000 token 的输出，跑到一半被放弃，那 2000 token 已经付过钱了。**',
        },
      ],
    },

    {
      id: 's2',
      title: '六个杠杆，按收益排序',
      checkpoint: '想把成本砍一半，第一个该动的是什么？',
      blocks: [
        {
          type: 'p',
          text: '大多数人第一反应是"换个便宜模型"。这是杠杆五，收益中等且风险最高（质量会掉）。真正的高收益杠杆在前三个。',
        },
        {
          type: 'table',
          head: ['排序', '杠杆', '典型收益', '质量影响', '实施成本'],
          rows: [
            ['1', '缩短上下文（去掉无用材料）', '30~50%', '**可能提升**', '低'],
            ['2', 'prefix cache 命中', '20~40% 输入成本', '无', '低'],
            ['3', '限制输出长度 + 精简输出', '15~30%', '可能提升', '低'],
            ['4', '缓存答案（语义缓存）', '10~30%', '无（命中的是已验过的）', '中'],
            ['5', '模型路由 / 降级到小模型', '20~40%', '**可能下降**', '中'],
            ['6', '批处理 + 异步', '5~15%', '无', '高'],
          ],
        },
        {
          type: 'p',
          text: '**杠杆 1 为什么可能"提升质量"？** 因为上下文越长，噪声越多，模型越容易被无关材料带偏。删掉一半检索材料，往往准确率还上升了。这不是省钱，是同时省钱又变好——**这种机会应该优先找。**',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '杠杆 1 的具体做法：按"是否被引用"裁剪',
          note: '关键思路：先跑一遍完整版，记录模型实际引用了哪几个 chunk，然后把"从未被引用"的材料从 prompt 里去掉。这是数据驱动的裁剪，不是拍脑袋。',
          code: `// 第一步：统计每个 chunk 的"被引用率"
// 跑 200 条真实问题，记录输出里引用到的 chunk id
const usage = new Map<string, { shown: number; cited: number }>()

for (const c of cases) {
  const chunks = await retrieve(c.question, 20)
  const answer = await generate(chunks, c.question)
  const cited = extractCitations(answer)

  for (const ch of chunks) {
    const s = usage.get(ch.id) ?? { shown: 0, cited: 0 }
    s.shown++
    if (cited.includes(ch.id)) s.cited++
    usage.set(ch.id, s)
  }
}

// 第二步：找出"展示了 200 次，引用 0 次"的 chunk 类型
const dead = [...usage.entries()]
  .filter(([, s]) => s.shown >= 20 && s.cited / s.shown < 0.02)
  .map(([id]) => id)

// 第三步：这些 chunk 后续不再进 prompt（但仍然可以被检索到，只是不默认注入）
// 结果：上下文平均从 20 条降到 6 条，输入 token 降 60%，准确率不变或略升`,
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '一个反直觉的发现',
          text: '很多团队实测发现：**top-20 检索 + 全部注入，效果不如 top-20 检索 + rerank 取 top-5 注入。** 后者不仅便宜 4 倍，准确率还更高。原因是模型在 20 条材料里更容易被干扰。**"给更多材料"是个常见错觉。**',
        },
      ],
    },

    {
      id: 's3',
      title: '三层缓存，三种失效条件',
      checkpoint: '语义缓存在什么情况下会给出错误答案？',
      blocks: [
        {
          type: 'table',
          head: ['层', '原理', '命中条件', '失效风险'],
          rows: [
            ['Prefix cache', '相同前缀复用 KV cache', '**前缀逐字节相同**', 'system prompt 里有动态内容 → 永不命中'],
            ['结果缓存', '相同输入直接返回上次结果', '输入完全一致 + 权限一致', '数据更新了但缓存没失效'],
            ['语义缓存', '相似问题复用答案', '向量相似度 > 阈值', '**语义相近但答案不同**'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '语义缓存的三个护栏',
          note: '语义缓存最危险，因为"看起来像同一个问题"和"是同一个问题"差很远。必须加这三道护栏。',
          code: `async function semanticCacheLookup(question: string, ctx: Ctx) {
  const emb = await embed(question)
  const hit = await cache.search(emb, { threshold: 0.95, topK: 1 })
  if (!hit) return null

  // 护栏 1：答案里必须"不含可变事实"
  // 含日期、金额、库存、状态的答案不能走语义缓存
  if (/\\d{4}-\\d{2}-\\d{2}|¥\\d|库存|剩余|当前/.test(hit.answer)) return null

  // 护栏 2：必须同一权限域
  if (hit.scope !== ctx.permScope) return null

  // 护栏 3：实体必须一致（问题里的关键实体要相同）
  if (!sameEntities(question, hit.question)) return null

  return hit.answer
}

// 缓存写入时也要过滤
function cacheable(answer: string, question: string) {
  if (/\\d{4}-\\d{2}-\\d{2}/.test(answer)) return false   // 含日期
  if (question.includes('我的') || question.includes('我账户')) return false  // 个性化
  return true
}`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '语义缓存最常见的翻车',
          text: '"退款多久到账" 和 "退款多久到账？我昨天申请的" 相似度 0.96，但后者需要查具体订单。**把个性化问题当成通用问题缓存，就会给出别人的答案。** 护栏三条里，"权限域"和"实体一致"是硬性的，不能省。',
        },
        {
          type: 'p',
          text: '还有一个容易忽略的：**缓存的 TTL 要和数据更新频率对齐**。知识库每天更新，缓存 TTL 就不该是 7 天。做法：**文档更新时主动失效相关缓存**（按 docId 建反向索引），而不是等 TTL 过期。',
        },
      ],
    },

    {
      id: 's4',
      title: '模型路由：让简单的走便宜路',
      checkpoint: '80% 的请求其实很简单，但你全用了最贵的模型。怎么改？',
      blocks: [
        {
          type: 'p',
          text: '路由的核心假设是：**请求难度分布是长尾的**。大部分请求简单，少数复杂。用一套配置服务所有请求，要么简单请求被浪费，要么复杂请求不够用。',
        },
        {
          type: 'flow',
          title: '三种路由策略',
          ascii: `① 规则路由（最便宜、最可控）
   问题长度 < 20 字 且 命中 FAQ 库 → 小模型
   否则 → 大模型

② 分类器路由（需要训练或标注）
   [小分类模型] → simple / medium / complex
   simple → 小模型，medium → 中模型，complex → 大模型

③ 级联（Cascade，最省心）
   先小模型答 → 自检置信度 → 不够就升级到大模型
   优点：不需要预判难度，用结果说话
   缺点：复杂请求要跑两次（但只占少数）`,
        },
        {
          type: 'code',
          lang: 'ts',
          title: '级联：用"自检"决定要不要升级',
          note: '关键在"自检"怎么做。让模型自己说"我确定吗"不可靠，要用可观察的信号：引用是否完整、格式是否合规、关键字段是否缺失。',
          code: `async function cascadedAnswer(question: string, chunks: Chunk[]) {
  // 第一档：小模型
  const cheap = await callModel('small', question, chunks)
  const verdict = checkQuality(cheap, chunks)

  if (verdict.ok) return { ...cheap, tier: 'small' }

  // 第二档：大模型（只在必要时）
  const strong = await callModel('large', question, chunks)
  return { ...strong, tier: 'large', escalated: verdict.reason }
}

function checkQuality(r: Answer, chunks: Chunk[]) {
  // 1. 格式合规（结构化输出能不能解析）
  if (!r.parsed) return { ok: false, reason: 'format' }

  // 2. 引用完整（每个断言都有 chunk 支撑）
  const uncited = r.claims.filter((c) => !c.chunkId)
  if (uncited.length > 0) return { ok: false, reason: 'uncited' }

  // 3. 拒答检查（不该拒的拒了，说明能力不足）
  if (r.refused && chunks.length >= 3) return { ok: false, reason: 'false_refusal' }

  // 4. 长度异常（太短通常意味着没答完整）
  if (r.text.length < 30) return { ok: false, reason: 'too_short' }

  return { ok: true }
}`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '路由的隐藏成本：分类错误',
          text: '路由策略本身要花钱（分类器调用、规则维护）。更麻烦的是**分类错误**：把复杂问题路由给小模型，用户得到烂答案，你还得处理投诉。**所以路由必须先有评测**：在 50 条用例上验证"分类准确率 > 90%"，否则省下的钱不够赔体验。',
        },
        {
          type: 'p',
          text: '实践建议：**从级联开始，不要从分类器开始**。级联不需要预判难度，它用"结果质量"来决定升级，天然更准。等你有足够数据了，再考虑用分类器做"提前分流"——那能把升级率从 30% 降到 15%。',
        },
      ],
    },

    {
      id: 's5',
      title: '预算、配额、预警：防止单点失控',
      checkpoint: '一个用户写了个脚本循环调用你的接口，你多久能发现？',
      blocks: [
        {
          type: 'p',
          text: '成本事故的典型形态不是"慢慢涨"，而是**某个下午突然涨 10 倍**。原因通常是：脚本死循环、爬虫、某个功能 bug 导致重试风暴、或者一次批量任务忘了限速。',
        },
        {
          type: 'table',
          head: ['机制', '粒度', '触发动作'],
          rows: [
            ['单次请求上限', '一次调用', '拒绝（`max_tokens` 上限、输入长度上限）'],
            ['用户日配额', '用户 / 天', '超额返回 429 + 提示'],
            ['用户月配额', '用户 / 月', '超额降级到小模型或只读'],
            ['租户月预算', '租户 / 月', '超额通知管理员 + 硬限流'],
            ['全局日预算', '全局 / 天', '超额进入"仅付费用户"模式'],
            ['异常检测', '实时', '单用户调用量 > 均值 10 倍 → 告警 + 临时限流'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '多层预算检查（在调用前，不是调用后）',
          note: '关键：预算是"事前拒绝"，不是"事后统计"。等账单出来再管就晚了。做法是"预估本次成本 → 检查剩余额度 → 不够就拒绝或降级"。',
          code: `async function guardBudget(ctx: Ctx, estimatedTokens: number) {
  const cost = (estimatedTokens / 1e6) * PRICE.inputPerM * 1.5  // 含输出预估

  const checks = [
    { key: \`u:\${ctx.userId}:d:\${today()}\`, limit: ctx.plan.dailyUsd },
    { key: \`u:\${ctx.userId}:m:\${month()}\`, limit: ctx.plan.monthlyUsd },
    { key: \`t:\${ctx.tenantId}:m:\${month()}\`, limit: ctx.tenant.budgetUsd },
    { key: \`g:d:\${today()}\`, limit: GLOBAL_DAILY_USD },
  ]

  for (const c of checks) {
    const used = Number(await redis.get(c.key) ?? 0)
    if (used + cost > c.limit) {
      return { allowed: false, scope: c.key, used, limit: c.limit }
    }
  }

  // 预扣（防并发超发），调用结束后按实际用量修正
  for (const c of checks) {
    await redis.incrbyfloat(c.key, cost)
    await redis.expire(c.key, 40 * 86400)
  }
  return { allowed: true, reserved: cost }
}`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '预算必须有"全局兜底"',
          text: '按用户限流挡不住"一万个用户同时用"这种正常场景，也挡不住"某个 bug 让所有人都在重试"。**必须有一层全局日预算**，超过就降级（只服务付费用户、切小模型、缩短输出）。这层是最后的安全网，宁可体验降级，也不要收到一张天价账单。',
        },
        {
          type: 'p',
          text: '预警比硬限更重要。设三个档：**50% 提醒**（只是知道）、**80% 告警**（要有人看）、**100% 硬限**。只有 100% 那一档会伤体验，所以要把前两档做足——**在 80% 的时候人还有时间做决策。**',
        },
      ],
    },

    {
      id: 's6',
      title: '单位经济：成本最终要落到"每件事多少钱"',
      checkpoint: '"每月花 5000 美元"这个数字，能不能用来做决策？',
      blocks: [
        {
          type: 'p',
          text: '不能。因为它不告诉你"值不值"。能用来做决策的是**单位经济**：每解决一个工单、每生成一份报告、每服务一个用户，花多少钱。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '算单位成本',
          code: `type UnitEconomics = {
  unit: string                 // 'ticket' / 'report' / 'user-month'
  costPerUnit: number
  revenuePerUnit?: number
  humanCostPerUnit?: number    // 人工做同样的事要多少钱
  margin?: number
}

// 例：客服工单自动回复
const ticketEcon: UnitEconomics = {
  unit: 'ticket',
  costPerUnit: 0.032,          // 平均 6400 token 输入 + 400 输出 + 检索
  humanCostPerUnit: 2.4,       // 人工处理一个工单约 2.4 美元
  margin: (2.4 - 0.032) / 2.4, // 98.7%
}

// 关键问题不是"成本高不高"，而是：
// 1. 自动化率是多少？（只有 60% 的工单能自动处理）
// 2. 自动处理的工单里，有多少需要返工？
// 3. 综合下来，每个工单的真实节省是多少？

const effectiveSaving =
  0.6 * (2.4 - 0.032) -        // 自动处理省下的
  0.4 * 0.1 * 2.4              // 返工 10% 的额外成本
// = 1.42 - 0.096 = 1.32 美元/工单`,
        },
        {
          type: 'table',
          head: ['产品', '单位', '成本量级', '关键问题'],
          rows: [
            ['客服问答', '每工单', '$0.01~0.05', '自动化率和返工率'],
            ['文档生成', '每份', '$0.05~0.5', '人工修改比例'],
            ['代码补全', '每开发者/月', '$10~50', '采纳率'],
            ['数据分析', '每次查询', '$0.01~0.1', '查错率'],
            ['批量处理', '每千条', '$0.5~5', '需要人工复核的比例'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '成本优化要有"分母"',
          text: '单纯降成本会走向"什么都用最便宜的"，最后质量崩了没人用。**正确的目标是"降低单位成本"，也就是"每解决一件事的成本"**。如果降本导致自动化率从 60% 掉到 40%，那单位成本其实上升了。**降本必须和评测一起做。**',
        },
        {
          type: 'p',
          text: '最后一条实践：**把成本写进产品指标，和延迟、准确率并列。** 看板上要有"每个工单成本"这个数字，改动前后要对比。**不看的指标不会有人优化。** 这也是第十课 trace 体系的价值所在——没有归因数据，单位经济就是拍脑袋。',
        },
        {
          type: 'qa',
          q: '省成本到什么程度就该停？',
          a: '三条停止线：① **质量跌破阈值**——评测集通过率掉了 3 个点以上，停；② **单位成本不再下降**——边际收益为零，停；③ **维护成本超过节省**——为了省 100 美元写了 500 行缓存失效逻辑，停。**降本是个收益递减的游戏，前 50% 很容易，后 20% 极难。** 做到 50% 就该把精力转回产品。',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '降本优先级',
      points: 10,
      prompt: '你的 RAG 问答成本是每个问题 $0.04。想砍一半，第一步该做什么？',
      options: [
        { id: 'a', text: '把大模型换成小模型' },
        { id: 'b', text: '统计模型实际引用了哪几个 chunk，把从未被引用的材料从 prompt 里去掉' },
        { id: 'c', text: '减少 max_tokens' },
        { id: 'd', text: '上语义缓存' },
      ],
      answer: ['b'],
      hints: [
        '先问：输入 token 和输出 token 哪个占大头？RAG 通常是输入。',
        '输入 token 里，有多少是真正被用到的？',
        'b 是收益最高、风险最低的杠杆：**可能同时降本和提质**（噪声减少，准确率反而上升）。a 会掉质量；c 可能导致回答不完整；d 是中等收益但需要护栏。**顺序应该是：先删无用上下文 → 再开 prefix cache → 再限输出 → 最后才考虑换模型。**',
      ],
      explanation: '正确答案是 b。RAG 系统的输入里通常有大量"展示了但从未被引用"的材料，删掉它们既省钱又减少干扰。',
      approach: [
        '先用 trace 数据算输入/输出各占多少',
        '统计 chunk 的被引用率，找出"死重"',
        '裁剪上下文，重跑评测确认质量没降',
        '再依次上 prefix cache、输出限长、模型路由',
      ],
      knowledge: ['降本杠杆', '上下文裁剪', '被引用率'],
      pitfalls: [
        '一上来就换小模型（质量掉了还得回滚）',
        '不做评测就删上下文',
      ],
    },
    {
      id: 'e2',
      type: 'multi',
      title: 'prefix cache 为什么没命中',
      points: 15,
      prompt: '你开了 prefix cache，但命中率只有 5%。可能的原因有哪些？（多选）',
      options: [
        { id: 'a', text: 'system prompt 开头放了当前时间戳' },
        { id: 'b', text: 'system prompt 里拼了用户名或用户 id' },
        { id: 'c', text: '检索材料放在了 system prompt 前面' },
        { id: 'd', text: '每次请求的 few-shot 示例顺序随机打乱' },
        { id: 'e', text: '输出太短' },
      ],
      answer: ['a', 'b', 'c', 'd'],
      hints: [
        'prefix cache 的唯一条件是"前缀逐字节相同"。',
        '任何在开头发生变化的内容都会让整段缓存失效。',
        'a 时间戳每次都变；b 用户名每个用户不同；c 检索材料每个问题不同，放在前面就把后面全冲掉了；d 顺序变了就是不同的字节序列。e 与命中率无关（输出不参与前缀）。**正确做法：把可变内容全部放到最后，system prompt 只放固定的规则和示例。**',
      ],
      explanation: 'a、b、c、d 都会破坏"前缀完全相同"。prefix cache 的设计原则是"越稳定的越靠前，越易变的越靠后"。',
      approach: [
        '检查前缀里有没有动态内容（时间、id、随机数）',
        '把易变内容移到消息末尾',
        '检索材料单独成一条 user 消息，放在 system 之后',
        'few-shot 顺序固定，不要随机',
      ],
      knowledge: ['prefix cache', '前缀稳定性', 'prompt 结构'],
      pitfalls: [
        '把检索材料拼进 system prompt',
        '在 system prompt 里放时间戳',
      ],
    },
    {
      id: 'e3',
      type: 'fill',
      title: '算清一次调用的真实成本',
      points: 15,
      prompt: '某次调用：输入 8000 token（命中缓存 5000），输出 600 token，重试 1 次。单价：输入 $1/百万，缓存按 10% 计价，输出 $4/百万。重试按"输入+输出成本的 60%"估算。算总成本。',
      templateLang: 'text',
      template: `未命中输入 = 8000 - 5000 = {{n1}} token
未命中成本 = 3000 × 1 / 1e6 = \${{n2}}
缓存成本   = 5000 × 1 × 0.1 / 1e6 = \${{n3}}
输出成本   = 600 × 4 / 1e6 = \${{n4}}

单次成功 = {{n2}} + {{n3}} + {{n4}} = \${{n5}}

重试成本 = 单次成功 × 0.6 × 1 = \${{n6}}

总成本   = \${{n7}}
其中重试占 {{n8}}%`,
      blanks: [
        { id: 'n1', label: '未命中输入 token', accept: ['3000', '3,000'], width: 80 },
        { id: 'n2', label: '未命中成本', accept: ['0.003', '.003'], width: 80 },
        { id: 'n3', label: '缓存成本', accept: ['0.0005', '.0005'], width: 80 },
        { id: 'n4', label: '输出成本', accept: ['0.0024', '.0024'], width: 80 },
        { id: 'n5', label: '单次成功总成本', accept: ['0.0059', '.0059'], width: 80 },
        { id: 'n6', label: '重试成本', accept: ['0.00354', '.00354'], width: 90 },
        { id: 'n7', label: '总成本', accept: ['0.00944', '.00944'], width: 90 },
        { id: 'n8', label: '重试占比（整数）', accept: ['37', '38', '37.5'], width: 60 },
      ],
      hints: [
        '缓存命中的部分按 10% 计价，不是免费。',
        '重试成本按"单次成功成本 × 60%"算。',
        '未命中 3000 → $0.003；缓存 5000×0.1 → $0.0005；输出 600×4 → $0.0024。单次 $0.0059。重试 $0.0059×0.6 = $0.00354。总计 $0.00944。重试占 37%。**一次重试让成本涨了 60%，这就是"降重试率"的降本价值。**',
      ],
      explanation: '总成本 $0.00944，其中重试占 37%。这个数字说明：**重试率是成本的关键变量**，把重试率从 15% 降到 3%，成本能降 10% 以上，而且用户满意度同时上升。',
      approach: [
        '把输入拆成"未命中"和"命中"两段分别计价',
        '输出单独按输出单价',
        '三项相加得单次成本',
        '重试成本按单次成本的 60% 估算，乘以重试次数',
        '算占比，看哪一项是主要成本',
      ],
      knowledge: ['成本拆解', '缓存计价', '重试成本'],
      pitfalls: [
        '把缓存命中当免费',
        '忘记重试也要付费',
        '用输出单价算输入',
      ],
    },
    {
      id: 'e4',
      type: 'code',
      title: '实现成本估算',
      points: 20,
      prompt: '实现 `estimateCost(usage, pricing)`。`usage` 含 `inputTokens`、`cachedTokens`、`outputTokens`、`retries`；`pricing` 含 `inputPerM`、`outputPerM`、`cacheDiscount`（默认 0.1）。返回 `{ input, cached, output, retry, total }`。规则：缓存部分按 `inputPerM * cacheDiscount` 计价；`retry` 等于"单次成本 × 0.6 × retries"。所有金额保留 6 位小数。',
      starter: `function estimateCost(usage, pricing) {
  // TODO
  return { input: 0, cached: 0, output: 0, retry: 0, total: 0 }
}

return estimateCost`,
      checks: [
        {
          name: '纯输入成本',
          expr: "Math.abs(result({inputTokens:1e6,cachedTokens:0,outputTokens:0,retries:0},{inputPerM:1,outputPerM:4}).input - 1) < 1e-9",
        },
        {
          name: '缓存按折扣计价',
          expr: "Math.abs(result({inputTokens:1e6,cachedTokens:1e6,outputTokens:0,retries:0},{inputPerM:1,outputPerM:4}).cached - 0.1) < 1e-9",
        },
        {
          name: '未命中部分正确扣减',
          expr: "Math.abs(result({inputTokens:1e6,cachedTokens:4e5,outputTokens:0,retries:0},{inputPerM:1,outputPerM:4}).input - 0.6) < 1e-9",
        },
        {
          name: '输出成本',
          expr: "Math.abs(result({inputTokens:0,cachedTokens:0,outputTokens:1e6,retries:0},{inputPerM:1,outputPerM:4}).output - 4) < 1e-9",
        },
        {
          name: '重试成本为单次的 60%',
          expr: "(() => { const r = result({inputTokens:1e6,cachedTokens:0,outputTokens:1e6,retries:1},{inputPerM:1,outputPerM:4}); return Math.abs(r.retry - (1+4)*0.6) < 1e-9 })()",
        },
        {
          name: 'total 等于各项之和',
          expr: "(() => { const r = result({inputTokens:8e5,cachedTokens:3e5,outputTokens:2e5,retries:2},{inputPerM:1,outputPerM:4,cacheDiscount:0.1}); return Math.abs(r.total - (r.input + r.cached + r.output + r.retry)) < 1e-9 })()",
        },
      ],
      solution: `function estimateCost(usage, pricing) {
  const discount = pricing.cacheDiscount ?? 0.1
  const round6 = (n) => Math.round(n * 1e6) / 1e6

  const fresh = Math.max(0, usage.inputTokens - usage.cachedTokens)

  const input = (fresh / 1e6) * pricing.inputPerM
  const cached = (usage.cachedTokens / 1e6) * pricing.inputPerM * discount
  const output = (usage.outputTokens / 1e6) * pricing.outputPerM

  const once = input + cached + output
  const retry = once * 0.6 * (usage.retries || 0)

  return {
    input: round6(input),
    cached: round6(cached),
    output: round6(output),
    retry: round6(retry),
    total: round6(input + cached + output + retry),
  }
}`,
      hints: [
        '先把输入拆成"未命中"和"命中"两段。',
        '重试是"单次成本 × 0.6 × 次数"，所以要先算出单次成本。',
        '完整实现：`fresh = max(0, input - cached)`；三段分别算；`once = input + cached + output`；`retry = once * 0.6 * retries`；最后都过一遍 `round6`。注意 `Math.max(0, ...)` 防脏数据。',
      ],
      explanation: '这个函数把"账单为什么比预期高"变得可解释。跑一段时间真实数据后，你会看到重试和缓存未命中各占多少——那才是优化的入口。',
      approach: [
        '输入拆成未命中和命中两段',
        '分别乘各自单价（缓存是折扣价）',
        '输出单独算',
        '单次成本 × 0.6 × 重试次数',
        '各项求和，统一保留精度',
      ],
      knowledge: ['成本模型', '缓存计价', '重试成本'],
      pitfalls: [
        '缓存部分重复计入未命中',
        '重试按完整成本算（应为 60%）',
        '不处理 cachedTokens > inputTokens 的脏数据',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 12,
    questions: [
      {
        id: 'q1',
        stem: '降本的第一优先级应该是？',
        options: [
          { id: 'a', text: '换便宜模型' },
          { id: 'b', text: '删掉上下文中"从未被引用"的材料' },
          { id: 'c', text: '减少功能' },
          { id: 'd', text: '涨价' },
        ],
        answer: 'b',
        why: '收益最大（30~50%）、风险最低，甚至可能提升质量（噪声减少）。换模型收益中等但风险最高。',
        stepId: 's2',
      },
      {
        id: 'q2',
        stem: 'prefix cache 命中的唯一条件是？',
        options: [
          { id: 'a', text: '语义相似' },
          { id: 'b', text: '前缀逐字节完全相同' },
          { id: 'c', text: '同一个用户' },
          { id: 'd', text: '同一小时内' },
        ],
        answer: 'b',
        why: '一个字符不同就全部失效。所以动态内容（时间戳、用户名）绝不能放在开头。',
        stepId: 's3',
      },
      {
        id: 'q3',
        stem: '语义缓存最危险的失效场景是？',
        options: [
          { id: 'a', text: '缓存过期' },
          { id: 'b', text: '语义相近但实际是不同问题（尤其涉及个人数据、可变事实）' },
          { id: 'c', text: '缓存太大' },
          { id: 'd', text: '命中率低' },
        ],
        answer: 'b',
        why: '"退款多久到账"和"我的退款多久到账"相似度很高，但后者需要查具体订单。必须加权限域和实体一致性护栏。',
        stepId: 's3',
      },
      {
        id: 'q4',
        stem: '级联（cascade）相比分类器路由的优势是？',
        options: [
          { id: 'a', text: '更快' },
          { id: 'b', text: '不需要预判难度，用"结果质量"决定是否升级，天然更准' },
          { id: 'c', text: '更便宜' },
          { id: 'd', text: '不需要评测' },
        ],
        answer: 'b',
        why: '分类器需要训练和评测，还会误判。级联让"实际结果"说话，虽然复杂请求要跑两次，但只占少数。',
        stepId: 's4',
      },
      {
        id: 'q5',
        stem: '为什么必须有"全局日预算"这一层？',
        options: [
          { id: 'a', text: '为了合规' },
          { id: 'b', text: '按用户限流挡不住"所有用户同时用"或"某个 bug 让所有人重试"，需要最后的安全网' },
          { id: 'c', text: '为了让报表好看' },
          { id: 'd', text: '没必要' },
        ],
        answer: 'b',
        why: '用户级配额是分布式的，无法防止全局性的异常（爬虫、bug、突发热点）。全局预算是最后一道闸。',
        stepId: 's5',
      },
      {
        id: 'q6',
        stem: '评估降本是否成功，正确的指标是？',
        options: [
          { id: 'a', text: '总成本下降了多少' },
          { id: 'b', text: '单位成本（每解决一件事的成本）下降了多少，且质量没跌破阈值' },
          { id: 'c', text: 'token 数下降了多少' },
          { id: 'd', text: '模型价格降了多少' },
        ],
        answer: 'b',
        why: '总成本会随用量变化，不能反映效率。单位成本才是效率指标，而且必须和质量一起看——降本导致自动化率下降，单位成本反而上升。',
        stepId: 's6',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统：降本一轮',
    contributes:
      '这一课产出一份可验证的降本报告：成本从 X 降到 Y，质量没有下降，并且有数据支撑每一步的贡献。',
    tasks: [
      '用 trace 数据算出当前六项成本的占比，找出真正的大头',
      '统计每个 chunk 的"展示次数 / 被引用次数"，删掉引用率 < 2% 的材料，重跑评测',
      '把 system prompt 里所有动态内容移到末尾，测 prefix cache 命中率变化',
      '给输出加 max_tokens 上限和"简洁"约束，测输出 token 变化和用户满意度',
      '实现语义缓存（三道护栏：无可变事实、同权限域、实体一致），测命中率和错误率',
      '实现级联：小模型先答 + checkQuality 自检，测升级率和综合成本',
      '实现多层预算：用户日/月、租户月、全局日，验证超额时正确拒绝或降级',
      '算出单位经济：每个工单多少钱、人工多少钱、真实节省多少',
    ],
    done: '能拿出一张表：每项改动的成本贡献、质量影响、实施成本；总成本下降 50% 以上而评测通过率不降；能报出"每个工单 $0.032，人工 $2.4，自动化率 62%，净节省 $1.32/工单"这样的数字。',
  },

  further: [
    { text: 'Anthropic · Prompt Caching 文档（前缀命中的精确规则）' },
    { text: 'OpenAI Cookbook · Cost optimization 与模型路由实践' },
    { text: '知识地图 06 推理与部署 · 成本部分（/guide/06-inference）' },
  ],
}
