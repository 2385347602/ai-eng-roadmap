import type { Lesson } from './types'

/**
 * 第五课：LLM 基础
 *
 * 这一课不追求"讲全模型原理"，只讲清楚四件会影响工程决策的事：
 * token 怎么算钱、采样参数改了什么、上下文为什么中间会被忽略、幻觉为什么必然存在。
 * 所有价格与数字都标注为示例值，不是任何厂商的报价。
 */
export const lesson05: Lesson = {
  id: 'L05',
  moduleId: 'llm',
  order: 5,
  path: '/learn/05-llm-basics',
  title: 'LLM 基础：你调的到底是个什么东西',
  subtitle: '它是一个"总要说下一个词"的概率机器。理解这句话，九成的踩坑都能提前避开。',
  minutes: 70,
  level: '入门',
  outcome: '能算清一次调用的成本和延迟，判断一个任务该不该用 LLM，以及为什么"让模型算数学"永远不可靠。',
  goals: [
    '用"下一个 token 预测"解释模型的能力与缺陷来源',
    '估算 token 数、成本、上下文占用，知道中英文的差异',
    '说清 temperature / top_p 到底改了什么，以及为什么它们不能保证格式',
    '解释"中间遗忘"现象，并知道怎么排布上下文',
    '说清幻觉的三种成因和对应的三类工程手段',
    '用一张 12 项指标表做模型选型，而不是凭感觉',
  ],
  prereqs: [
    '会调用过一次任意 LLM 的 API',
    '知道什么是 HTTP 请求',
    '学过第四课，理解"边界"与"运行时校验"',
  ],

  steps: [
    {
      id: 's1',
      title: '一句话说清模型在做什么',
      checkpoint: '如果模型只是"预测下一个词"，它为什么能写代码？',
      blocks: [
        {
          type: 'p',
          text: '大语言模型做的事，字面上只有一件：**给定前面的文本，算出下一个 token 的概率分布，挑一个，接上去，重复。**',
        },
        {
          type: 'p',
          text: '你看到的"理解""推理""写代码"，是这件事在极大规模上涌现出来的效果。这个认知很重要，因为它直接解释了三件事：为什么模型会编造、为什么同一个问题两次答案不同、为什么它算不准大数乘法。',
        },
        {
          type: 'analogy',
          title: '和 Vue 的响应式类比',
          text: 'Vue 的响应式本质是"读时收集依赖，写时触发更新"——一句简单规则，组合出整个框架的能力。LLM 也一样：一句"预测下一个 token"，组合出写作、翻译、写代码、多步推理。**理解底层规则，你才知道边界在哪。**',
        },
        { type: 'h', text: '三个直接推论' },
        {
          type: 'list',
          ordered: true,
          items: [
            '**它没有数据库。** 它不知道你的笔记内容、今天的股价、你公司的制度。除非你在 prompt 里给它，或者给它一个工具去查。',
            '**它不"计算"，它"续写"。** 它见过 "1+1=" 后面跟 "2"，所以能答对；但 17 位数的乘法它没见过，只能猜。所以数值计算必须交给代码。',
            '**它没有"我不知道"这个默认选项。** 训练目标是"给出最可能的续写"，而"我不知道"在语料里很少跟在问题后面。所以它倾向于编一个像样的答案——这就是幻觉的结构性来源。',
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '这一课最实用的一句',
          text: '**凡是要求"确定性"的地方，都不要指望模型。** 金额计算、权限判断、状态流转、格式校验——这些必须由代码做。模型只负责"生成候选"和"理解模糊输入"。',
        },
      ],
    },

    {
      id: 's2',
      title: 'token：不是字，也不等长',
      checkpoint: '为什么同样一段话，中文的 token 数可能是英文的 1.5~2 倍？',
      blocks: [
        {
          type: 'p',
          text: '模型不处理字符，处理 token。token 是子词片段：英文里 "unbelievable" 可能切成 `un` + `believ` + `able` 三个 token；中文里一个常用字通常是 1 个 token，生僻词可能占 2~3 个。',
        },
        {
          type: 'table',
          head: ['内容', '大致 token 数（经验值）', '说明'],
          rows: [
            ['1 个英文单词', '约 1.3 个 token', '常见词 1 个，长词拆开'],
            ['1 个汉字', '约 1~2 个 token', '常见字 1 个，生僻/组合词更多'],
            ['1000 字中文', '约 1000~1800 token', '取决于用词常见程度'],
            ['1 行代码', '约 8~15 token', '符号多，token 效率低于自然语言'],
            ['1 页 A4 中文', '约 1200~2000 token', '按 800~1000 字估算'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '这些数字只能用来估算',
          text: '不同厂商的分词器完全不同，同一段文本的 token 数可能差 30%。**要精确值就用官方的 tokenizer 或接口返回的 usage 字段**，不要用"字数除以 2"这种规则去算钱。',
        },
        { type: 'h', text: '成本怎么算' },
        {
          type: 'code',
          lang: 'text',
          title: '成本公式（价格用示例值，不代表任何厂商）',
          code: `单次成本 = 输入 token × 输入单价 + 输出 token × 输出单价

示例价格（虚构，仅用于演示量级）：
  输入  $0.5 / 100 万 token
  输出  $1.5 / 100 万 token      ← 输出通常贵 2~4 倍

场景：每天 1 万次请求，每次输入 3000 token（含 RAG 上下文）、输出 500 token
  日成本 = 10000 × (3000×0.5 + 500×1.5) / 1,000,000
         = 10000 × (1500 + 750) / 1,000,000
         = $22.5 / 天  ≈ $675 / 月

关键洞察：输入占了成本的 2/3。所以"少塞点上下文"比"让模型少说两句"更省钱。`,
        },
        {
          type: 'p',
          text: '这个公式有一个反直觉的结论：**RAG 系统里最贵的往往不是回答，而是塞进去的上下文。** 把 top-20 砍到 top-5、把 8000 字上下文压到 3000 字，成本直接降一半，而质量可能不变甚至更好（因为噪音少了）。',
        },
        {
          type: 'qa',
          q: '为什么输出比输入贵？',
          a: '因为计算方式不同。输入是一次性并行处理的（prefill 阶段，可以充分利用 GPU 并行）；输出是逐 token 生成的（decode 阶段，每个 token 都要跑一遍完整前向，且要等上一个算完）。**输出是串行的，输入是并行的**，所以输出贵得多。这也解释了为什么"流式输出"体验好——首 token 之后用户在读的同时，后面的 token 还在生成。',
        },
      ],
    },

    {
      id: 's3',
      title: '采样参数：它们改的是"怎么挑下一个词"',
      checkpoint: '把 temperature 设成 0，输出就一定每次相同吗？',
      blocks: [
        {
          type: 'p',
          text: '模型输出的是一个概率分布，采样参数决定怎么从这个分布里挑。理解这一点，你就不会再问"怎么让模型 100% 输出 JSON"。',
        },
        {
          type: 'table',
          head: ['参数', '作用', '典型用法'],
          rows: [
            ['temperature', '缩放概率分布：低=更保守（总挑最高概率），高=更随机', '抽取/分类 0~0.3，写作 0.7~1.0'],
            ['top_p', '只从累计概率前 p% 的候选里挑', '一般只调一个，不要和 temperature 同时大改'],
            ['top_k', '只从概率最高的 k 个候选里挑', '少见，一般用 top_p 代替'],
            ['max_tokens', '最多生成多少 token', '**必须设**，否则可能跑满上下文烧钱'],
            ['stop', '遇到指定字符串就停', '结构化输出时用来截断'],
            ['seed', '尽量让采样可复现', '测试用，但**不保证跨版本一致**'],
            ['frequency_penalty', '惩罚重复出现的 token', '长文生成防复读'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '按任务选参数',
          code: `// 分类 / 抽取：要稳定，不要创意
const extract = { temperature: 0, max_tokens: 500 }

// 写作 / 头脑风暴：要多样
const draft = { temperature: 0.9, top_p: 0.95, max_tokens: 2000 }

// 代码生成：偏保守
const codegen = { temperature: 0.2, max_tokens: 4000 }

// 无论哪种，都必须设 max_tokens`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: 'temperature=0 不等于确定',
          text: '即使 temperature 为 0，输出仍可能变化，原因有三：① 浮点运算在不同批次/不同硬件上有微小差异；② 厂商可能静默更新模型权重；③ 部分推理服务为了吞吐会做批处理，batch 组成不同会影响数值。**所以永远不要把"输出完全一致"写进测试断言**——要断言"符合 schema"或"包含关键字段"。',
        },
        { type: 'h', text: '那怎么保证格式？' },
        {
          type: 'p',
          text: '答案是：**不要靠 prompt 保证，要靠结构化输出能力 + 运行时校验 + 重试。**',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '三层保障',
          code: `// 1. 用厂商的 structured output / JSON mode（如果有）
const res = await client.chat.completions.create({
  model,
  messages,
  response_format: { type: 'json_schema', json_schema: schema },
})

// 2. 运行时校验（第四课的 zod）
const parsed = MySchema.safeParse(JSON.parse(res.choices[0].message.content))

// 3. 失败重试，把错误喂回去
if (!parsed.success) {
  return retryWith(messages.concat([
    { role: 'assistant', content: raw },
    { role: 'user', content: '你的输出不符合 schema：' + parsed.error.message + '。请只输出合法 JSON。' },
  ]))
}`,
          note: '重试通常 1~2 次就能修好。这也是为什么"结构化输出"必须配一个重试预算，而不是一次失败就报错给用户。',
        },
      ],
    },

    {
      id: 's4',
      title: '上下文窗口：能装多少，和能记住多少是两件事',
      checkpoint: '把 100 页文档全塞进 200k 上下文，效果一定比检索 top-5 好吗？',
      blocks: [
        {
          type: 'p',
          text: '上下文窗口是"一次能看多少 token"。现在动辄 128k、200k，于是很多人第一反应是"那我把整份文档塞进去就行了，不用做 RAG"。',
        },
        {
          type: 'p',
          text: '这个想法有三个问题：**贵、慢、而且不一定准。**',
        },
        { type: 'h', text: '问题一：中间遗忘' },
        {
          type: 'p',
          text: '研究里反复观察到的现象：把关键信息放在长上下文的**开头或结尾**，模型能找到；放在**正中间**，召回率明显下降。这不是模型"笨"，是注意力机制和训练数据分布共同导致的。',
        },
        {
          type: 'flow',
          title: '长上下文里的召回率分布（示意）',
          ascii: `准确率
 高 │ ████                                    ████
    │ ████                                    ████
 中 │ ████          ░░░░░░░░░░░░░░            ████
    │ ████          ░░ 中间容易漏 ░░           ████
 低 │ ████          ░░░░░░░░░░░░░░            ████
    └──────────────────────────────────────────────
      开头              中间                  结尾
                   上下文位置`,
        },
        {
          type: 'code',
          lang: 'ts',
          title: '上下文排布策略',
          code: `function arrangeContext(chunks: Chunk[], budget: number) {
  const selected = pickByScore(chunks, budget)   // 按相关性选，不是按顺序

  // 最相关的放首尾，次要的放中间
  const sorted = [...selected].sort((a, b) => b.score - a.score)
  const head: Chunk[] = []
  const tail: Chunk[] = []
  sorted.forEach((c, i) => (i % 2 === 0 ? head : tail).push(c))

  return [...head, ...tail.reverse()]
}`,
          note: '这个"首尾放重要内容"的技巧成本极低、收益稳定。做 RAG 的人几乎都会踩一次"全塞进去效果反而变差"的坑。',
        },
        { type: 'h', text: '问题二：注意力被稀释' },
        {
          type: 'p',
          text: '上下文里 90% 是无关内容时，模型要在一堆噪音里找信号。它可能找到，也可能被误导——尤其是噪音里有"看起来相关但已经过期"的内容时。',
        },
        {
          type: 'callout',
          tone: 'info',
          title: '正确的心智模型',
          text: '上下文窗口是"工作记忆"，不是"硬盘"。**人的工作记忆也只有 7±2 个组块**——你不会因为图书馆有 10 万本书就把它们全搬进脑子。RAG 的本质是"先检索再思考"，这和人查资料的方式一致。',
        },
        {
          type: 'qa',
          q: '那什么时候真的该用长上下文？',
          a: '三种情况：① 任务本身需要全局视野（"总结这份 80 页合同的全部风险点"）；② 文档总量不大且稳定（一份 20 页的制度手册）；③ 需要跨段落推理（"对比第 3 条和第 17 条是否冲突"）。反过来，如果是"从 5000 篇文档里找答案"，长上下文是错的方向——你该做检索。',
        },
      ],
    },

    {
      id: 's5',
      title: '幻觉：不是 bug，是机制',
      checkpoint: '模型为什么会编造一个不存在的 API 名称？',
      blocks: [
        {
          type: 'p',
          text: '幻觉（hallucination）指模型生成了看似合理但事实错误的内容。它不是"模型不够聪明"，而是"下一个 token 预测"这个机制的必然产物。',
        },
        { type: 'h', text: '三种成因，对应三类手段' },
        {
          type: 'table',
          head: ['成因', '典型表现', '工程手段'],
          rows: [
            ['知识缺失（它真不知道）', '问 2026 年新出的库，它编一个 API', '给工具/给检索，让它查而不是猜'],
            ['知识过期', '用旧版本的 API 写法', '上下文注入最新文档；版本号写进 prompt'],
            ['训练目标导致"必须回答"', '问不存在的事实，它硬编一个', '允许说"不知道"；要求给引用；用低 temperature'],
          ],
        },
        {
          type: 'code',
          lang: 'text',
          title: '三条实用的 prompt 约束',
          code: `1. 明确允许弃权
   "如果资料中没有相关信息，直接回答『资料中未提及』，不要推测。"

2. 强制引用来源
   "每个结论后面标注来源编号 [1][2]，没有来源的结论不要写。"

3. 把"不知道"变成默认
   "你只能使用下面 <资料> 中的内容回答。资料之外的知识一律不使用。"`,
          note: '第 3 条最有效，因为它把任务从"回答"变成了"抽取"——抽取的幻觉率远低于自由回答。',
        },
        {
          type: 'p',
          text: '但 prompt 只能降低概率，不能消除。**工程上必须假设"模型会编"，所以要有验证层**：',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            '**引用可验证**：要求模型输出 `[1]` 这样的引用，代码去核对"编号对应的原文里是否真的有这句话"。对不上就是幻觉。',
            '**结构化输出**：让它填字段而不是自由发挥，字段为空比编一个更容易发现。',
            '**关键事实二次校验**：金额、日期、人名这类，用规则或另一个模型交叉验证。',
            '**可观测**：记录每次回答的检索结果和引用，出问题时能回溯（第 8 课讲）。',
          ],
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '一个必须接受的现实',
          text: '**幻觉率可以降低，不能归零。** 所以产品设计上要留后路：AI 生成的内容要标明"AI 生成，请核对"，关键操作要人工确认。把"绝对准确"写进需求文档的人，最后都会在验收时吵架。',
        },
      ],
    },

    {
      id: 's6',
      title: '能力边界：哪些事它一定做不好',
      checkpoint: '让模型算 "1738 × 2491"，为什么不可靠？',
      blocks: [
        {
          type: 'p',
          text: '知道模型能做什么很容易（它什么都能聊两句），知道它做不好什么才是工程能力。',
        },
        {
          type: 'table',
          head: ['任务', '可靠性', '原因 / 替代方案'],
          rows: [
            ['多位数精确计算', '低', '没有计算器；必须交给代码'],
            ['实时信息（股价、天气）', '零', '训练数据有截止日期；必须用工具查'],
            ['精确计数（"这段有几行"）', '低', 'token 不是字符，数不准；用代码数'],
            ['严格格式（JSON/XML）', '中高', '用 structured output + 校验 + 重试'],
            ['长链逻辑推理（>5 步）', '中', '中间步骤会漂移；拆成多步 + 每步验证'],
            ['事实性问答（无资料）', '中低', '必须配 RAG 或工具'],
            ['文本改写 / 摘要 / 分类', '高', '这是它最擅长的'],
            ['代码生成', '中高', '能跑但常有细节错；必须跑测试'],
            ['翻译', '高', '长文本要分段，注意术语一致'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '正确做法：让模型"决定调什么"，让代码"真正去算"',
          code: `// 反例：指望模型算
"请计算 1738 × 2491，只输出数字"

// 正例：给它一个计算器工具
tools: [{
  name: 'calc',
  description: '计算一个数学表达式，支持 + - * / 和括号',
  parameters: { type: 'object', properties: { expr: { type: 'string' } }, required: ['expr'] },
}]
// 模型输出 { name: 'calc', arguments: { expr: '1738*2491' } }
// 你的代码用 safe-eval 或自写 parser 算出 4328518，再回给模型`,
          note: '这就是 Agent / 工具调用的本质：模型负责"理解意图 + 选工具 + 填参数"，代码负责"确定性地执行"。',
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '一条判断标准',
          text: '问自己："这个任务的正确答案，能不能用代码验证？" 能，就该让代码做或至少让代码验；不能，才完全交给模型。**"可验证"是决定架构的关键属性**，后面的评测课也是围绕它展开的。',
        },
      ],
    },

    {
      id: 's7',
      title: '模型选型：别凭感觉，做一张表',
      checkpoint: '如果任务只需要分类，为什么要用最贵的模型？',
      blocks: [
        {
          type: 'p',
          text: '"用最强的模型"是最省事也最贵的决策。选型应该按任务分层，而不是一刀切。',
        },
        {
          type: 'table',
          head: ['指标', '怎么评', '为什么重要'],
          rows: [
            ['任务准确率', '在你自己的评测集上跑（不要看榜单）', '榜单和你的场景往往不一致'],
            ['输入/输出价格', '按你的实际 token 量算月成本', '差 10 倍很常见'],
            ['TTFT（首 token 延迟）', '流式场景下用户感知的关键', '比总延迟更影响体验'],
            ['TPOT（每 token 时间）', '决定"读起来顺不顺"', '长回答时更明显'],
            ['上下文窗口', '够用就行，别为用不满的容量付费', '大窗口通常更贵'],
            ['结构化输出支持', '是否有 JSON mode / function calling', '决定要不要自己写重试'],
            ['多模态能力', '是否需要读图/读 PDF', '决定要不要额外模型'],
            ['工具调用质量', '并行调用、参数准确率', 'Agent 场景的核心'],
            ['稳定性', 'P95 延迟、错误率、限流阈值', '决定能不能上生产'],
            ['版本策略', '是否锁定版本、更新是否通知', '决定回归测试怎么做'],
            ['数据合规', '数据是否用于训练、存储在哪', '企业客户的硬门槛'],
            ['部署形态', '云 API / 私有化 / 边缘', '决定能不能过客户的安全评审'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '分层路由：贵模型做难题，便宜模型做量大的活',
          code: `async function route(task: Task) {
  // 简单分类、抽取、改写 → 小模型
  if (task.kind === 'classify' || task.kind === 'extract') {
    return smallModel(task)
  }

  // 需要多步推理、写代码 → 大模型
  if (task.kind === 'reason' || task.kind === 'codegen') {
    const r = await bigModel(task)
    // 可选：小模型做二次校验，成本远低于全程用大模型
    return r
  }

  // 兜底：先小模型，置信度低再升级
  const draft = await smallModel(task)
  if (draft.confidence < 0.7) return bigModel(task)
  return draft
}`,
          note: '这就是"模型路由"，是降本最有效的手段之一。前提是你有办法判断"置信度"——通常靠小模型自评或规则。',
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '选型时最常犯的错',
          text: '**看榜单选模型。** 榜单任务和你的任务几乎一定不同。正确做法：从你的真实业务里抽 50~100 条，做成小评测集，跑 2~3 个候选模型，比较准确率 × 成本 × 延迟。这份评测集后面会变成回归测试（第 7 课）。',
        },
      ],
    },

    {
      id: 's8',
      title: '延迟与成本：把账单和体验都算清楚',
      checkpoint: '为什么"流式输出"能让用户觉得快，即使总时间没变？',
      blocks: [
        {
          type: 'p',
          text: 'LLM 的延迟分两段，性质完全不同：',
        },
        {
          type: 'flow',
          title: '一次调用的时间构成',
          ascii: `请求发出
  │
  ├─ 网络 + 排队 ──────► 50~500ms（看厂商负载）
  │
  ├─ Prefill（读输入）──► 与输入长度成正比，但可并行
  │                        3000 token ≈ 100~300ms
  │
  ├─ 首 token 出现  ◄──── TTFT = 上面三段之和
  │                        ← 用户感知"快不快"的分界线
  │
  ├─ Decode（逐个生成）─► 每 token 20~60ms，串行
  │                        500 token ≈ 10~30 秒
  │
  └─ 结束            ◄──── 总延迟 = TTFT + 输出token × TPOT`,
        },
        {
          type: 'p',
          text: '所以"流式"的价值不是让总时间变短，而是**把 TTFT 变成用户感知的等待时间**。1.5 秒出现第一个字，和 15 秒后一次性出现全文，体验差一个数量级。',
        },
        { type: 'h', text: '五个降本手段，按性价比排序' },
        {
          type: 'table',
          head: ['手段', '典型降幅', '代价'],
          rows: [
            ['砍上下文（top-k 从 20 到 5）', '40~60%', '可能损失召回，要评测'],
            ['模型路由（简单任务走小模型）', '50~80%', '要能判断任务难度'],
            ['前缀缓存（system prompt 复用）', '20~50%（输入部分）', '需要稳定的前缀结构'],
            ['批处理（离线任务）', '30~50%', '有延迟，不适合实时'],
            ['输出约束（max_tokens、要求简洁）', '10~30%', '可能信息不足'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '前缀缓存：让 system prompt 和文档前缀稳定不变',
          code: `// 反例：每次都把时间戳塞在最前面
const messages = [
  { role: 'system', content: '当前时间：' + new Date().toISOString() + '\\n' + LONG_RULES },
  ...
]
// 前缀每次都变 → 缓存永远不命中

// 正例：稳定内容在前，变动内容在后
const messages = [
  { role: 'system', content: LONG_RULES },                    // 稳定，可缓存
  { role: 'system', content: '当前时间：' + now },             // 变动，放后面
  ...history,
  { role: 'user', content: question },
]`,
          note: '多数厂商的缓存是"前缀匹配"：从第一个 token 开始，遇到不同就失效。所以把不变的内容放前面，是免费的优化。',
        },
        {
          type: 'callout',
          tone: 'info',
          title: '最后一句：把成本做成可观测的',
          text: '不要在月底看账单才知道超支。**每次调用都记录 input_tokens / output_tokens / 模型名 / 功能模块**，按天聚合。这样你才能回答"哪个功能最烧钱"，也才能在涨价时快速定位。第 8 课会把这件事做完整。',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '上下文窗口的真实含义',
      prompt: '关于上下文窗口，下面哪个说法**最准确**？',
      points: 10,
      options: [
        { id: 'a', text: '窗口越大，模型对每条信息的记忆就越牢' },
        { id: 'b', text: '窗口决定一次能输入多少 token，但信息在窗口中的位置会影响召回率' },
        { id: 'c', text: '窗口等于模型的参数规模' },
        { id: 'd', text: '只要不超过窗口，模型一定能用上所有信息' },
      ],
      answer: ['b'],
      hints: [
        '回想"中间遗忘"现象：同样的信息放在开头、中间、结尾，效果一样吗？',
        '窗口是容量上限，不是注意力保证。',
        '正确答案 B。窗口只是"一次能塞多少 token"的上限，它不保证模型对每条信息给予同等注意力。实践中开头和结尾的信息更容易被用到，正中间容易被漏掉。A、D 都把"能装下"误当成"能记住"；C 混淆了上下文窗口和参数量，两者无关。',
      ],
      explanation:
        '上下文窗口是工作记忆的容量，不是硬盘。容量变大不改变"注意力有限"这个事实。',
      approach: [
        '区分"容量"和"有效利用"',
        '关键信息放首尾',
        '超长文档优先考虑检索而不是全塞',
      ],
      knowledge: ['上下文窗口', '中间遗忘', '上下文排布'],
      pitfalls: [
        '以为"窗口大就不用做 RAG" —— 成本、延迟、准确率三项都更差',
      ],
    },

    {
      id: 'e2',
      type: 'multi',
      title: '哪些事不该交给模型',
      prompt: '下面哪些任务**不应该**完全交给 LLM 处理？（多选）',
      points: 15,
      options: [
        { id: 'a', text: '计算订单总价（含折扣、税费）' },
        { id: 'b', text: '判断当前用户有没有权限删除这条记录' },
        { id: 'c', text: '把一段用户反馈改写成更礼貌的表达' },
        { id: 'd', text: '统计这段文本有多少个字' },
        { id: 'e', text: '根据文档内容回答用户问题' },
      ],
      answer: ['a', 'b', 'd'],
      hints: [
        '判断标准：这个任务的正确答案能不能用代码确定性地算出/验证？能，就不该交给模型。',
        'E 看起来"该交给模型"，但注意它有个前提：根据文档内容。这是 RAG 的典型场景，属于模型擅长的。',
        '正确答案 A、B、D。A：金额必须由代码算，模型算多位数乘法不可靠。B：权限判断是确定性规则，必须由代码执行（模型只能解释规则，不能作为判定者）。D：字符计数是确定性计算，模型连"这段有几个字"都数不准。C 和 E 是模型擅长的：改写是语言任务，基于给定文档回答是抽取任务（配合 RAG 效果很好）。',
      ],
      explanation:
        '模型负责"模糊输入的理解"和"自然语言的生成"，代码负责"确定性的计算与判断"。混淆这两者是最常见的架构错误。',
      approach: [
        '列出任务',
        '标注每个任务是否可确定性验证',
        '可验证的交给代码，不可验证的交给模型',
      ],
      knowledge: ['能力边界', '确定性 vs 概率性', '工具调用'],
      pitfalls: [
        '让模型做权限判断 —— 它会被 prompt 注入绕过，这是安全事故',
      ],
    },

    {
      id: 'e3',
      type: 'fill',
      title: '填空：算清一次调用的成本',
      prompt:
        '每天 2 万次请求，每次输入 2000 token、输出 400 token。示例价格：输入 $0.5 / 百万 token，输出 $1.5 / 百万 token。补全计算过程。',
      points: 20,
      templateLang: 'text',
      template: `单次输入成本 = 2000 × 0.5 / 1,000,000 = \${{in1}}
单次输出成本 = 400 × {{outPrice}} / 1,000,000 = \${{out1}}
单次总成本   = \${{sum1}}
日成本       = 20000 × {{sum2}} = \${{day}}

结论：输入占总成本的 {{pct}}%`,
      blanks: [
        { id: 'in1', label: '单次输入成本（美元，小数）', accept: ['0.001'], placeholder: '0.001', width: 8 },
        { id: 'outPrice', label: '输出单价（每百万 token）', accept: ['1.5'], placeholder: '1.5', width: 6 },
        { id: 'out1', label: '单次输出成本', accept: ['0.0006'], placeholder: '0.0006', width: 8 },
        { id: 'sum1', label: '单次总成本', accept: ['0.0016'], placeholder: '0.0016', width: 8 },
        { id: 'sum2', label: '单次总成本（乘日请求数用）', accept: ['0.0016'], placeholder: '0.0016', width: 8 },
        { id: 'day', label: '日成本（美元）', accept: ['32'], placeholder: '32', width: 6 },
        { id: 'pct', label: '输入占总成本的百分比（取整）', accept: ['62', '63', '62.5'], placeholder: '62', width: 6 },
      ],
      hints: [
        '先算单次：输入 2000 token × $0.5/百万 = 0.001 美元；输出 400 × $1.5/百万 = 0.0006 美元。',
        '单次合计 0.0016 美元，乘 2 万次 = 32 美元/天。',
        '完整答案：输入 0.001、输出 0.0006、单次 0.0016、日成本 32 美元。输入占比 = 0.001 / 0.0016 ≈ 62.5%，取整 62%。**这个结论很重要：输入 token 更多，即使单价更低，总花费仍然更大。所以优化成本的第一刀是砍上下文。**',
      ],
      explanation:
        '成本 = 输入 token × 输入单价 + 输出 token × 输出单价。RAG 场景下输入通常是输出的 5~10 倍，所以上下文体积是成本主因。',
      approach: [
        '分别算输入和输出的单次成本',
        '相加得单次总成本',
        '乘日请求量得日成本',
        '比较两部分占比，决定优化方向',
      ],
      knowledge: ['token 成本', '成本结构', '上下文优化'],
      pitfalls: [
        '只算输出成本 —— 在 RAG 场景会低估 2~3 倍',
        '忘记按百万 token 换算 —— 差 6 个数量级',
      ],
    },

    {
      id: 'e4',
      type: 'code',
      title: '编程：写一个 token 估算与成本计算函数',
      prompt:
        '实现 `estimate(text, outputTokens)`：粗略估算 token 数并算出成本。规则：中日韩字符按 1.6 token/字，其余字符按 0.28 token/字；成本按输入 $0.5/M、输出 $1.5/M。检查项全部通过才算对。',
      points: 25,
      starter: `function estimate(text, outputTokens) {
  // 1. 统计"中日韩字符"数量和"其余字符"数量
  //    中日韩范围：\\u4e00-\\u9fff（常用汉字）、\\u3040-\\u30ff（日文假名）、\\uac00-\\ud7af（韩文）
  // 2. inputTokens = cjk * 1.6 + other * 0.28，向上取整
  // 3. cost = inputTokens * 0.5/1e6 + outputTokens * 1.5/1e6
  // 返回 { inputTokens, cost }，cost 保留 6 位小数

  return { inputTokens: 0, cost: 0 }
}

// —— 检查用 ——
return {
  pure: estimate('hello', 100),
  chinese: estimate('你好世界', 100),
  mixed: estimate('你好 hello', 0),
  empty: estimate('', 0),
}`,
      checks: [
        { name: '纯英文 5 字符 → 2 token（0.28×5=1.4 向上取整）', expr: 'result.pure.inputTokens === 2' },
        { name: '4 个汉字 → 7 token（1.6×4=6.4 向上取整）', expr: 'result.chinese.inputTokens === 7' },
        { name: '混合文本按两类分别计算', expr: 'result.mixed.inputTokens === 5' },
        { name: '空字符串返回 0 token', expr: 'result.empty.inputTokens === 0' },
        { name: '成本计算正确（2 token 输入 + 100 token 输出）', expr: 'Math.abs(result.pure.cost - (2*0.5/1e6 + 100*1.5/1e6)) < 1e-9' },
      ],
      solution: `function estimate(text, outputTokens) {
  const s = String(text ?? '')
  let cjk = 0
  let other = 0
  for (const ch of s) {
    const code = ch.codePointAt(0)
    const isCJK =
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0xac00 && code <= 0xd7af)
    if (isCJK) cjk++
    else other++
  }
  const inputTokens = Math.ceil(cjk * 1.6 + other * 0.28)
  const cost = inputTokens * 0.5 / 1e6 + outputTokens * 1.5 / 1e6
  return { inputTokens, cost: Number(cost.toFixed(6)) }
}`,
      hints: [
        '用 for...of 遍历字符串（它按码点迭代，能正确处理中文和 emoji），比 s.split("") 安全。',
        '判断中日韩用码点区间比较。汉字是 0x4e00~0x9fff，日文假名 0x3040~0x30ff，韩文 0xac00~0xd7af。',
        '完整实现见下。注意三点：① 用 for...of 而不是按索引遍历（emoji 是双码元）② 用 Math.ceil 向上取整 ③ 最后 toFixed(6) 避免浮点误差导致检查失败。**真实项目里不要用这种估算去算钱**，用接口返回的 usage 字段。',
      ],
      explanation:
        '这个函数的意义不是"精确"，而是让你在写代码时对量级有感觉：一段 1000 字中文大约 1600 token，塞 20 段就是 3 万 token。',
      approach: [
        '按码点遍历字符串',
        '用码点区间区分 CJK 和其余字符',
        '分别乘系数后向上取整',
        '按单价算成本并控制小数位',
      ],
      knowledge: ['token 估算', 'Unicode 码点', '成本计算'],
      pitfalls: [
        '用 s.length 统计 —— 中文没问题，但 emoji 会被算成 2',
        '用 Math.round 而不是 Math.ceil —— 估算偏小，预算会不够',
        '把这个估算当精确值去对账 —— 必须以接口返回的 usage 为准',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 10,
    questions: [
      {
        id: 'q1',
        stem: 'LLM 的本质是什么？',
        options: [
          { id: 'a', text: '一个知识库检索系统' },
          { id: 'b', text: '给定前文预测下一个 token 的概率模型' },
          { id: 'c', text: '一个规则引擎' },
          { id: 'd', text: '一个数据库' },
        ],
        answer: 'b',
        why: '所有能力（写作、翻译、写代码）都是"预测下一个 token"的涌现效果。这个认知解释了为什么它会编造、为什么两次结果不同、为什么算不准大数乘法。',
        stepId: 's1',
      },
      {
        id: 'q2',
        stem: '为什么输出 token 比输入 token 贵？',
        options: [
          { id: 'a', text: '输出质量更高' },
          { id: 'b', text: '输入可以并行处理（prefill），输出必须逐个串行生成（decode）' },
          { id: 'c', text: '输出更占存储' },
          { id: 'd', text: '厂商定价策略，没有技术原因' },
        ],
        answer: 'b',
        why: 'Prefill 阶段整段输入可并行计算，GPU 利用率高；decode 阶段每个 token 都要等前一个生成完，是串行的。所以同样数量的 token，输出成本高得多。',
        stepId: 's2',
      },
      {
        id: 'q3',
        stem: 'temperature = 0 能保证输出完全一致吗？',
        options: [
          { id: 'a', text: '能，完全确定' },
          { id: 'b', text: '不能，浮点差异、模型更新、批处理都会带来变化' },
          { id: 'c', text: '只有本地部署时能' },
          { id: 'd', text: '只有不设 max_tokens 时能' },
        ],
        answer: 'b',
        why: 'temperature=0 只是"总选最高概率"，但浮点运算顺序、batch 组成、厂商静默更新权重都会影响结果。所以测试断言应该写"符合 schema / 包含关键字段"，而不是"等于某个字符串"。',
        stepId: 's3',
      },
      {
        id: 'q4',
        stem: '"中间遗忘"现象说明什么？',
        options: [
          { id: 'a', text: '上下文窗口太小' },
          { id: 'b', text: '信息在长上下文中的位置会影响召回，中间位置更容易被忽略' },
          { id: 'c', text: '模型只能处理开头的内容' },
          { id: 'd', text: 'token 数量超过 8k 就没用了' },
        ],
        answer: 'b',
        why: '实测中开头和结尾的信息更容易被用到。所以 RAG 里要把最相关的片段放首尾，次要的放中间——成本极低、收益稳定。',
        stepId: 's4',
      },
      {
        id: 'q5',
        stem: '要降低幻觉，下面哪个手段**最有效**？',
        options: [
          { id: 'a', text: '提高 temperature 让它更自由' },
          { id: 'b', text: '把任务从"自由回答"改成"只从给定资料里抽取"，并要求标注引用' },
          { id: 'c', text: '在 prompt 里写"请不要编造"' },
          { id: 'd', text: '换一个更大的模型' },
        ],
        answer: 'b',
        why: '抽取任务的幻觉率远低于自由回答，因为模型的工作从"生成"变成了"定位"。加引用还能让代码事后核对"这句话在原文里存在吗"。C 有一定作用但不可靠，A 会让幻觉更严重。',
        stepId: 's5',
      },
      {
        id: 'q6',
        stem: '为什么不能让模型判断"当前用户有没有权限删除这条记录"？',
        options: [
          { id: 'a', text: '模型太慢' },
          { id: 'b', text: '权限是确定性规则，模型判断可被 prompt 注入绕过，是安全事故' },
          { id: 'c', text: '模型不认识用户 ID' },
          { id: 'd', text: '成本太高' },
        ],
        answer: 'b',
        why: '模型是概率系统，不是判定器。把权限交给它，等于把安全边界建立在"它这次没被绕过"上。正确做法是代码执行规则，模型只负责解释规则。',
        stepId: 's6',
      },
      {
        id: 'q7',
        stem: '模型选型时最不该做的判断是？',
        options: [
          { id: 'a', text: '在自己的业务数据上跑小评测集' },
          { id: 'b', text: '比较准确率 × 成本 × 延迟' },
          { id: 'c', text: '看公开榜单排名选最强的' },
          { id: 'd', text: '检查是否有 structured output 支持' },
        ],
        answer: 'c',
        why: '榜单任务和你的任务几乎一定不同。唯一可靠的选型依据是在你自己的数据上测。而且"最强"通常也"最贵最慢"，对简单任务是不必要的开销。',
        stepId: 's7',
      },
      {
        id: 'q8',
        stem: 'RAG 场景下，降本的第一优先级通常是？',
        options: [
          { id: 'a', text: '减少输出长度' },
          { id: 'b', text: '减少塞进上下文的 token 数' },
          { id: 'c', text: '换更便宜的模型' },
          { id: 'd', text: '降低 temperature' },
        ],
        answer: 'b',
        why: 'RAG 里输入通常是输出的 5~10 倍，输入占成本大头。把 top-k 从 20 砍到 5、把上下文从 8000 字压到 3000 字，成本降一半，质量往往还更好（噪音少了）。',
        stepId: 's8',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统的后端骨架',
    contributes:
      '这一课给你判断"哪里该用模型、哪里该用代码"的依据，以及成本/延迟的量级感。项目里所有 LLM 调用点都要在这里定下参数和预算。',
    tasks: [
      '给项目加一个 llm/client.ts，封装调用、记录 usage、统一超时与重试',
      '为三类任务分别配置参数（抽取 0、改写 0.9、代码 0.2），写进配置而不是散在代码里',
      '实现 token 估算与成本统计，按天聚合到一张 model_usage 表',
      '把"金额计算""权限判断"这类逻辑显式标注为"不用模型"，写进架构文档',
    ],
    done: '能在控制台看到每次调用的 token 数和成本，并回答"昨天哪个功能最烧钱"。',
  },

  further: [
    { text: 'OpenAI / Anthropic 官方文档 · Pricing 与 Tokenizer' },
    { text: '论文 · Lost in the Middle: How Language Models Use Long Contexts' },
    { text: '论文 · Survey on Hallucination in Large Language Models' },
  ],
}
