import type { Lesson } from './types'

/**
 * 第九课：评测与测试
 *
 * 核心立场：没有评测集，所有优化都是猜。"感觉变好了"不是工程结论。
 */
export const lesson09: Lesson = {
  id: 'L09',
  moduleId: 'eval',
  order: 9,
  path: '/learn/09-evals',
  title: '评测与测试：用数字证明你改好了，还是改坏了',
  subtitle: '改一次 prompt 就说"感觉好多了"——这是玄学，不是工程。',
  minutes: 75,
  level: '进阶',
  outcome: '能建一套 20 条起步、能进 CI、能挡住退化的评测体系，并知道每个指标在骗你什么。',
  goals: [
    '说清为什么"人工看几条"必然得出错误结论',
    '从真实日志里采样建黄金集，而不是自己编测试题',
    '把端到端准确率拆成检索层和生成层，分别度量',
    '正确使用 LLM-as-judge，并识别它的三种系统性偏见',
    '理解 holdout 的意义，避免拿评测集当调参目标',
    '把评测做成 CI 门禁，处理模型输出的随机抖动',
  ],
  prereqs: [
    '学过第七、八课，手上有 RAG 或 Agent 的可运行链路',
    '有至少 100 条真实用户问题（没有就先攒，别编）',
    '会写最基础的断言测试',
  ],

  steps: [
    {
      id: 's1',
      title: '"感觉变好了"是怎么骗你的',
      checkpoint: '你改了一版 prompt，试了 5 个问题，4 个变好了。能上线吗？',
      blocks: [
        {
          type: 'p',
          text: '这是一个真实发生过很多次的事故模式：',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            '你改了一版 prompt，手工试了 5 个问题，4 个明显变好，1 个差不多。判断"改进了"。',
            '上线。三天后客服反馈"答非所问变多了"。',
            '你回看日志，发现新版本在**长问题**和**含否定词的问题**上系统性变差——而你试的那 5 个都是短问题、肯定句。',
            '更糟的是：你没法证明到底是这版 prompt 造成的，还是模型供应商偷偷更新了模型。',
          ],
        },
        {
          type: 'p',
          text: '这个模式里有三个独立的错误：**样本太小**（5 条不足以下结论）、**采样有偏**（都是你自己想得到的问题）、**没有基线**（没有历史数字可对比）。评测体系就是修这三个错误。',
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '一句话原则',
          text: '**任何"改进了"的结论，都必须能说出：在多少条样本上、从多少提升到多少、用的是什么指标。** 说不出来，就还没验证。',
        },
        {
          type: 'analogy',
          title: '和前端性能优化对照',
          text: '你不会说"我感觉加了 `will-change` 之后顺滑了"，你会开 Performance 面板录一段，看 FPS 从 42 到 58。LLM 应用的评测就是它的 Performance 面板——**只不过帧率换成了准确率，录制换成了黄金集。**',
        },
      ],
    },

    {
      id: 's2',
      title: '黄金集：从真实日志里采样，不要自己编',
      checkpoint: '为什么"自己想的 50 个测试问题"是最差的黄金集？',
      blocks: [
        {
          type: 'p',
          text: '自己编的测试题有个致命问题：**你只会想出你能想到的问题**。而线上真实问题是长尾的——错别字、省略主语、混着两个意图、带着情绪、引用上文、夹杂方言。你的系统恰恰是在这些长尾上崩的。',
        },
        {
          type: 'table',
          head: ['采样来源', '优点', '缺点', '占比建议'],
          rows: [
            ['真实用户问题（随机）', '分布真实', '需要脱敏，可能重复', '50%'],
            ['真实失败案例', '直接命中痛点', '需要先有线上数据', '25%'],
            ['边界/对抗样本', '提前发现脆弱点', '不代表真实分布', '15%'],
            ['业务方指定', '覆盖重要场景', '可能偏离实际使用', '10%'],
          ],
        },
        {
          type: 'code',
          lang: 'json',
          title: '一条评测用例该长什么样',
          note: 'goldChunkIds 用来分层度量检索；mustInclude / mustNotInclude 用来做可自动检查的断言；notes 记"为什么这条重要"，防止后人删掉它。',
          code: `{
  "id": "c0017",
  "question": "上个月买的那个还能退吗",
  "context": { "userId": "u_882", "lastOrder": "A1024" },
  "goldChunkIds": ["refund.md#3", "refund.md#4"],
  "mustInclude": ["7 天", "未拆封"],
  "mustNotInclude": ["30 天", "随时"],
  "expectedAction": "answer",
  "notes": "典型省略主语 + 指代上文的问法，早期版本会去查通用退货政策而忽略订单状态",
  "tags": ["指代", "退货", "真实日志"]
}`,
        },
        {
          type: 'p',
          text: '几个实操细节：',
        },
        {
          type: 'list',
          items: [
            '**20 条就能起步。** 不要等"攒够 200 条"才开始——20 条已经能发现 80% 的明显退化。',
            '**必须包含"应该拒答"的用例。** 只测"能答对的"，系统会越来越倾向于硬答。',
            '**必须脱敏。** 手机号、身份证、真实姓名、内部项目代号，进评测集前要替换。评测集通常会进 git。',
            '**每条要能独立运行。** 依赖"上一轮对话"的用例，要么把上下文写进用例，要么单独做多轮评测集。',
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '标注一致性比数量重要',
          text: '如果两个人对同一条用例的"正确答案"判断不一致，这条用例就是废的——它会让你的指标上下抖动而你找不到原因。做法：先两个人独立标 20 条，算一致率，低于 80% 就坐下来把判定标准写清楚，再继续。**判定标准本身是要写下来的文档，不是"大家心里都懂"。**',
        },
      ],
    },

    {
      id: 's3',
      title: '分层度量：检索的锅别让模型背',
      checkpoint: '端到端准确率从 78% 掉到 71%，你怎么知道该改检索还是改 prompt？',
      blocks: [
        {
          type: 'p',
          text: '只看端到端准确率，你永远不知道该动哪里。必须分层：',
        },
        {
          type: 'table',
          head: ['层', '指标', '怎么算', '低于多少该警惕'],
          rows: [
            ['检索层', 'Recall@k', '正确 chunk 是否在 top-k 里', '0.7'],
            ['检索层', 'MRR', '第一个正确结果的排名倒数', '0.5'],
            ['生成层', '忠实度（faithfulness）', '回答的每个断言是否能在材料里找到依据', '0.9'],
            ['生成层', '格式合规率', '是否符合 schema / 长度 / 必含字段', '0.98'],
            ['端到端', '准确率', '人工或 judge 判定回答正确', '业务定'],
            ['端到端', '拒答准确率', '该拒的拒了、不该拒的答了', '0.85'],
          ],
        },
        {
          type: 'flow',
          title: '故障定位：从端到端指标往下钻',
          ascii: `端到端准确率下降
       │
       ├─► 检索 Recall@k 也降了吗？
       │      ├─ 是 → 检索层问题（切分、embedding、索引、权限过滤误杀）
       │      └─ 否 → 往下
       │
       ├─► 忠实度降了吗？
       │      ├─ 是 → 生成层问题（prompt 约束、上下文排序、模型换了）
       │      └─ 否 → 往下
       │
       └─► 格式合规率降了吗？
              ├─ 是 → 结构化输出/校验逻辑问题
              └─ 否 → 可能是评测集本身变了，或模型供应商侧变更`,
        },
        {
          type: 'code',
          lang: 'ts',
          title: '忠实度：用"每个断言是否有依据"来算',
          note: '不要让 judge 直接打 1-5 分（分数不可复现），而是让它做"逐句判定"这种二值任务，再自己聚合。',
          code: `async function faithfulness(answer: string, contexts: string[]): Promise<number> {
  const claims = await splitClaims(answer)   // 拆成独立断言
  if (claims.length === 0) return 1

  const verdicts = await Promise.all(
    claims.map(async (claim) => {
      const res = await judge({
        task: '判断下面的断言能否在给定材料中找到直接依据。',
        input: \`材料：\\n\${contexts.join('\\n---\\n')}\\n\\n断言：\${claim}\`,
        outputSchema: { supported: 'boolean', evidence: 'string' },
      })
      return res.supported
    }),
  )

  return verdicts.filter(Boolean).length / claims.length
}`,
        },
        {
          type: 'callout',
          tone: 'info',
          title: '为什么用"逐句二值判定"而不是"打个分"',
          text: '让模型输出 1~5 分，同一个输入两次调用可能给 4 和 5，你的指标就永远在抖。让它输出 `supported: true/false`，抖动小得多，而且**你能聚合、能定位到具体哪句话没有依据**。**能用分类解决的事，不要用打分。**',
        },
      ],
    },

    {
      id: 's4',
      title: 'LLM-as-judge：能用，但要知道它在骗你什么',
      checkpoint: '同一个回答，加上"以上是我的详细分析"这句废话，judge 打分会变高还是变低？',
      blocks: [
        {
          type: 'p',
          text: '人工评测贵且慢，用模型当裁判是必然选择。但 judge 有三种已被反复验证的系统性偏见：',
        },
        {
          type: 'table',
          head: ['偏见', '表现', '为什么会这样', '怎么缓解'],
          rows: [
            ['长度偏好', '更长、更啰嗦的回答得分更高', '训练数据里"详细"常和"高质量"共现', '在评分标准里明确"简洁不扣分，冗余要扣分"；或对长度做归一化'],
            ['位置偏好', 'A/B 对比时偏爱排在前面的那个', '自回归模型对开头更敏感', '交换顺序跑两次，只有两次一致才算赢'],
            ['自我偏好', '偏爱自己（同家族模型）生成的答案', '分布相似', '用不同家族的模型做 judge，或混人工'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'Pairwise 对比要跑两次并交换顺序',
          code: `async function compare(a: string, b: string, question: string) {
  const [r1, r2] = await Promise.all([
    judgePair({ question, first: a, second: b }),
    judgePair({ question, first: b, second: a }),   // 交换位置
  ])

  // r1 说 first 好 = a 好；r2 说 first 好 = b 好
  const aWins = (r1.winner === 'first' ? 1 : 0) + (r2.winner === 'second' ? 1 : 0)
  const bWins = (r1.winner === 'second' ? 1 : 0) + (r2.winner === 'first' ? 1 : 0)

  if (aWins === 1 && bWins === 1) return 'tie'   // 位置不一致 → 判平局，不计入胜率
  return aWins > bWins ? 'a' : 'b'
}`,
        },
        {
          type: 'p',
          text: '`tie` 的处理是关键：**位置一换结论就变，说明两者其实差不多**。把它算成平局而不是"随机算一边"，胜率才可信。',
        },
        {
          type: 'callout',
          tone: 'danger',
          title: 'judge 最不能做的事：判定事实正确性',
          text: 'judge 自己也可能不知道事实。让它判断"这个回答对不对"，等于让一个同样会幻觉的模型来裁判幻觉。**judge 适合判定：格式是否合规、是否引用了材料、是否包含某个字段、两个回答哪个更贴合问题。** 涉及事实正确性，必须用可验证的依据（材料里有 / 数据库里查得到），或者人工。',
        },
        {
          type: 'p',
          text: '还有一个便宜又有效的校准方法：**抽 30 条，人工标一遍，算 judge 和人工的一致率**。低于 75% 说明你的 judge prompt 需要改，或者这个任务不适合用 judge。这个校准要定期重做，因为 judge 模型也会变。',
        },
      ],
    },

    {
      id: 's5',
      title: 'holdout：别拿考卷当练习册',
      checkpoint: '你用评测集反复调了 20 版 prompt，最后通过率 95%。这个 95% 意味着什么？',
      blocks: [
        {
          type: 'p',
          text: '**几乎什么都不意味。** 你已经把那 20 条用例"背下来"了——通过调整措辞、加特例、在 prompt 里点名某些情况，你让系统在这 20 条上表现很好，但它在新问题上的表现可能一点没变，甚至更差（因为 prompt 里堆了太多特例，泛化能力下降）。',
        },
        {
          type: 'p',
          text: '这是机器学习里最古老的问题，解法也最古老：**分集**。',
        },
        {
          type: 'table',
          head: ['集合', '用途', '占比', '规则'],
          rows: [
            ['开发集（dev）', '调 prompt、调切分、看错误案例', '60%', '随便看，随便改'],
            ['验证集（val）', '每版改动后跑一次，看趋势', '20%', '只看总分，不看具体错例'],
            ['测试集（holdout）', '发版前跑一次', '20%', '**只在决定发版时跑，平时锁起来**'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'holdout 泄漏的四种隐蔽形式',
          text: '① 你在开发集上看到某条错误，顺手把它的内容写进了 prompt（等于把答案抄进代码）；② 你把测试集的统计特征用来做决策（"测试集里长问题占 40%，所以我要优化长问题"）；③ 你让同事"帮忙看看测试集为什么过不了"；④ 你把测试集用例贴进了 issue 或群聊。**测试集一旦被"看过"，就不再是 holdout。**',
        },
        {
          type: 'p',
          text: '现实一点的做法：**小团队可以先只有 dev 集，但每次发版前必须留 20 条"从来没跑过"的用例**。这 20 条不要放进自动回归，只在发版前手动跑一次。跑完就退役，再从线上日志补新的进来。',
        },
        {
          type: 'qa',
          q: '那 dev 集上过拟合了怎么办？',
          a: '两个信号：① dev 通过率涨到 95% 以上但线上没有改善；② prompt 里出现了大量"针对某类问题"的特例说明。这时候正确做法是**换一批 dev 用例**（从最近一周的线上日志重新采样），把旧用例降级成回归集。评测集是有保质期的——用户的问题分布会变，三个月前的用例可能已经不代表现在了。',
        },
      ],
    },

    {
      id: 's6',
      title: '回归门禁：让 CI 替你挡住退化',
      checkpoint: '同一版代码跑两次评测，通过率差了 6 个百分点。这算退化吗？',
      blocks: [
        {
          type: 'p',
          text: '模型输出是随机的，所以评测结果本身有噪声。**不处理噪声的门禁只会制造焦虑**：你会因为一次 6 个点的抖动去改本来没问题的代码。',
        },
        {
          type: 'table',
          head: ['噪声来源', '表现', '处理办法'],
          rows: [
            ['采样随机性', '同输入两次输出不同', 'temperature 设 0（仍不完全确定，但抖动小）'],
            ['judge 随机性', 'judge 打分飘', '逐句二值判定 + 多次取多数'],
            ['用例覆盖不足', '样本少，方差大', '样本 ≥ 50；用置信区间判断'],
            ['外部依赖抖动', '检索服务超时导致误判', '区分"错误"和"执行失败"，失败重跑'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '带噪声容忍的回归门禁',
          note: '关键是"和基线比"，不是"和绝对阈值比"。你真正要挡的是"变差了"，而不是"没达到理想值"。',
          code: `type RunResult = { caseId: string; pass: boolean; score: number; error?: string }

async function regressionGate(run: RunResult[], baseline: RunResult[]) {
  const passRate = (rs: RunResult[]) =>
    rs.filter((r) => r.pass).length / rs.length

  const cur = passRate(run)
  const base = passRate(baseline)

  // 只看"变差"的用例，且排除执行失败（那是环境问题，不是质量退化）
  const regressed = run.filter((r) => {
    if (r.error) return false
    const b = baseline.find((x) => x.caseId === r.caseId)
    return b?.pass === true && r.pass === false
  })

  // 规则 1：通过率跌幅超过 3 个点
  if (base - cur > 0.03) {
    return { ok: false, reason: \`通过率 \${(base * 100).toFixed(1)}% → \${(cur * 100).toFixed(1)}%\` }
  }

  // 规则 2：任何一条"原本通过、现在失败"的关键用例（打了 critical 标记）
  const critical = regressed.filter((r) => CRITICAL_IDS.has(r.caseId))
  if (critical.length > 0) {
    return { ok: false, reason: \`关键用例退化：\${critical.map((c) => c.caseId).join(', ')}\` }
  }

  return { ok: true, delta: cur - base, regressed: regressed.map((r) => r.caseId) }
}`,
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '把"关键用例"单独标出来',
          text: '20% 的用例承担了 80% 的风险：涉及钱、涉及权限、涉及法律承诺的那些。给它们打 `critical` 标记，**任何一条退化都直接挡住发版**，不管总通过率多高。总通过率是用来观察趋势的，关键用例才是用来守底线的。',
        },
        {
          type: 'p',
          text: '门禁跑在哪：**小项目用 GitHub Actions 就够**（每次 PR 跑，结果贴到 PR 评论里）。成本上，50 条用例 × 每条 2 次调用 × 一次 judge，一次全量大约几十次调用，几毛钱到几块钱。**这个钱必须花**，因为它挡住的是线上事故。',
        },
      ],
    },

    {
      id: 's7',
      title: '评测的运营：成本、频率与线上验证',
      checkpoint: '离线评测全绿，线上还是被投诉了。可能是什么原因？',
      blocks: [
        {
          type: 'p',
          text: '离线评测和线上表现之间永远有 gap，原因通常在这几处：',
        },
        {
          type: 'table',
          head: ['gap 来源', '离线', '线上'],
          rows: [
            ['输入分布', '你采样的历史问题', '今天的新问题（新功能、新活动、新政策）'],
            ['上下文', '用例里写死的 context', '真实会话（有前文、有情绪、有错别字）'],
            ['并发与延迟', '串行跑，不关心耗时', '高峰期超时、降级、限流'],
            ['下游状态', '测试库', '生产库（数据更脏、权限更复杂）'],
            ['用户预期', 'judge 判"回答了问题"', '用户觉得"没解决我的事"'],
          ],
        },
        {
          type: 'p',
          text: '所以线上必须有独立的一层验证。最便宜的三个做法：',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            '**点赞/点踩 + 可选原因**。不要求用户写评价，只要一个 👎 和四个预设原因（答错了 / 没答到点上 / 编的 / 太啰嗦）。',
            '**转人工率**。用户点"转人工"是最强的负反馈信号，比点踩更可信。',
            '**抽检**。每天随机抽 30 条真实对话，人工或 judge 标一遍，看线上准确率。这是唯一能算真实准确率的方法。',
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '不要用"用户没投诉"当质量指标',
          text: '绝大多数不满意的用户不会投诉，他们直接不用了。**沉默不等于满意。** 要主动抽检，要看留存和二次使用率。',
        },
        {
          type: 'p',
          text: '评测的频率建议：**每次改 prompt / 换模型 / 改切分 → 跑全量（几十条，几分钟）**；**每天 → 抽检 30 条线上对话**；**每周 → 从新日志里补 5~10 条用例进 dev 集，淘汰过时的**。这套节奏维护成本很低，但能让你在任何一个改动后 10 分钟内知道"变好还是变坏"。',
        },
        {
          type: 'flow',
          title: '评测体系的完整闭环',
          ascii: `线上日志 ──采样──► dev 集 ──调优──► 改动
   │                  │                    │
   │                  └──回归──────────────┘
   │                                       │
   ├──抽检──► 线上准确率                  ▼
   │                                  val 集（看趋势）
   └──补新用例──► 测试集（锁起来）──► 发版前跑一次`,
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '识别 judge 偏见',
      points: 10,
      prompt: '你用 LLM-as-judge 对比两版回答。A 版准确但只有 2 句话，B 版准确但写了 8 句话（有 6 句是重复和铺垫）。judge 连续 10 次都判 B 更好。最可能的原因？',
      options: [
        { id: 'a', text: 'B 确实更好，信息更丰富' },
        { id: 'b', text: 'judge 的长度偏好：更长的回答在训练数据里常和"高质量"共现，导致系统性偏高' },
        { id: 'c', text: 'judge 模型太小' },
        { id: 'd', text: '需要提高 temperature' },
      ],
      answer: ['b'],
      hints: [
        '注意题干强调"B 多了 6 句重复和铺垫"，而 judge 依然偏好它。',
        '这不是"信息更多"的问题，是评分机制的问题。',
        'judge 的长度偏好是被反复验证的系统性偏见。缓解方法是在评分标准里明确写"简洁不扣分、冗余要扣分"，或者先做长度归一化再比。',
      ],
      explanation: '正确答案是 b。长度偏好是 LLM-as-judge 最常见的偏见。解法是在 rubric 里显式处理长度，而不是相信 judge 的"综合判断"。',
      approach: [
        '先检查两个回答的客观差异（长度、格式）',
        '怀疑系统性偏见，而不是"模型更懂"',
        '在评分标准里显式写清"冗余扣分"',
        '抽 30 条人工校准，算 judge 与人工一致率',
      ],
      knowledge: ['LLM-as-judge', '长度偏好', 'rubric 设计'],
      pitfalls: [
        '把 judge 的分数当客观真值',
        '只跑一次就下结论',
      ],
    },
    {
      id: 'e2',
      type: 'multi',
      title: '黄金集的建法',
      points: 15,
      prompt: '下面哪些是建评测集的正确做法？（多选）',
      options: [
        { id: 'a', text: '从真实用户日志里随机采样，占大头' },
        { id: 'b', text: '只收录"系统能答对"的用例，保证通过率好看' },
        { id: 'c', text: '包含一定比例"应该拒答"的负例' },
        { id: 'd', text: '入集前做脱敏，替换手机号、真实姓名等' },
        { id: 'e', text: '用同一套用例反复调 prompt，直到通过率 100%' },
      ],
      answer: ['a', 'c', 'd'],
      hints: [
        '想评测集的目的：它要能反映线上真实分布，还要能暴露脆弱点。',
        'b 会让指标虚高且失去诊断能力；e 是典型的过拟合。',
        'a 保证分布真实；c 保证系统不会越来越倾向于硬答；d 是合规要求（评测集通常进 git）。b 是自欺欺人，e 是把考卷当练习册。',
      ],
      explanation: 'a、c、d 正确。b 和 e 都会让评测失去意义——一个掩盖问题，一个制造过拟合。',
      approach: [
        '主要从真实日志采样，保证分布真实',
        '混入失败案例和对抗样本，覆盖脆弱点',
        '一定包含"该拒答"的负例',
        '脱敏后进 git，并标注每条为什么重要',
        '保留 holdout，不参与调优',
      ],
      knowledge: ['黄金集', '负例', '脱敏', 'holdout'],
      pitfalls: [
        '只收好消息',
        '拿全部用例反复调参',
        '把含 PII 的原始日志直接提交',
      ],
    },
    {
      id: 'e3',
      type: 'fill',
      title: '算一次分层指标',
      points: 15,
      prompt: '50 条用例。检索层：40 条的正确 chunk 出现在 top-10 里。生成层：这 40 条里有 32 条回答忠实（每个断言都有依据）。端到端：全部 50 条里有 30 条被判定正确。填出三个指标。',
      templateLang: 'text',
      template: `Recall@10      = {{r1}} / 50 = {{r2}}   ({{r3}}%)
忠实度         = 32 / {{f1}} = {{f2}}   ({{f3}}%)
端到端准确率   = 30 / 50 = {{e1}}   ({{e2}}%)

诊断：Recall 偏低 → 先修{{d1}}；忠实度 {{d2}} → 生成层尚可`,
      blanks: [
        { id: 'r1', label: '命中的用例数', accept: ['40'], width: 50 },
        { id: 'r2', label: 'Recall 小数', accept: ['0.8', '.8'], width: 60 },
        { id: 'r3', label: 'Recall 百分比（整数）', accept: ['80'], width: 50 },
        { id: 'f1', label: '忠实度的分母（检索命中的条数）', accept: ['40'], width: 50 },
        { id: 'f2', label: '忠实度小数', accept: ['0.8', '.8'], width: 60 },
        { id: 'f3', label: '忠实度百分比', accept: ['80'], width: 50 },
        { id: 'e1', label: '端到端准确率小数', accept: ['0.6', '.6'], width: 60 },
        { id: 'e2', label: '端到端百分比', accept: ['60'], width: 50 },
        { id: 'd1', label: '该先修哪一层', accept: ['检索', '检索层'], width: 70 },
        { id: 'd2', label: '忠实度这个数字说明生成层怎么样', accept: ['尚可', '正常', '还行', '不差'], width: 70 },
      ],
      hints: [
        '注意忠实度的分母不是 50，而是"检索命中的条数"——没检索到正确材料，就谈不上忠实。',
        '端到端 60% 远低于"检索 80% × 忠实 80% = 64%"这个理论上限，说明还有别的损失（比如拒答误杀、格式问题）。',
        'Recall@10 = 40/50 = 0.8。忠实度 = 32/40 = 0.8。端到端 = 30/50 = 0.6。诊断：检索层是主要瓶颈（20% 的用例根本没搜到），应该先修切分/embedding/混合检索，而不是去改 prompt。',
      ],
      explanation: '三个数字是 0.8 / 0.8 / 0.6。关键洞察是：端到端准确率的上限被检索卡死在 80%，先修生成层收益有限。**永远先修最靠前的瓶颈层。**',
      approach: [
        'Recall@k = 命中的用例数 / 总用例数',
        '忠实度 = 忠实条数 / 检索命中的条数（分母不是总数）',
        '端到端 = 判定正确的条数 / 总用例数',
        '比较各层数字，找最靠前的瓶颈',
      ],
      knowledge: ['Recall@k', '忠实度', '分层度量', '瓶颈定位'],
      pitfalls: [
        '忠实度用总数当分母（会低估真实质量）',
        '只看端到端数字就动手改 prompt',
      ],
    },
    {
      id: 'e4',
      type: 'code',
      title: '实现回归门禁',
      points: 20,
      prompt: '实现 `gate(run, baseline, opts)`。`run` 和 `baseline` 是 `[{caseId, pass, error?}]`。返回 `{ ok, reason?, delta }`。规则：① 排除带 `error` 的条目（环境问题不算质量退化）；② 通过率跌幅 > `opts.maxDrop`（默认 0.03）判失败；③ 任何 `opts.critical` 里的用例从通过变失败，直接判失败。',
      starter: `function gate(run, baseline, opts = {}) {
  const maxDrop = opts.maxDrop ?? 0.03
  const critical = new Set(opts.critical ?? [])
  // TODO
  return { ok: true, delta: 0 }
}

return gate`,
      checks: [
        {
          name: '完全一致时通过',
          expr: "result([{caseId:'a',pass:true}], [{caseId:'a',pass:true}]).ok === true",
        },
        {
          name: '跌幅超阈值判失败',
          expr: "(() => { const b = [1,2,3,4,5].map(i=>({caseId:'c'+i,pass:true})); const r = b.map((x,i)=>({...x, pass: i < 3})); return result(r, b).ok === false })()",
        },
        {
          name: '跌幅在阈值内通过',
          expr: "(() => { const b = Array.from({length:100},(_,i)=>({caseId:'c'+i,pass:true})); const r = b.map((x,i)=>({...x, pass: i >= 2})); return result(r, b).ok === true })()",
        },
        {
          name: '带 error 的条目不计入',
          expr: "(() => { const b = Array.from({length:10},(_,i)=>({caseId:'c'+i,pass:true})); const r = b.map((x,i)=> i===0 ? {caseId:x.caseId, pass:false, error:'timeout'} : x); return result(r, b).ok === true })()",
        },
        {
          name: '关键用例退化直接失败',
          expr: "(() => { const b = Array.from({length:100},(_,i)=>({caseId:'c'+i,pass:true})); const r = b.map((x,i)=> i===0 ? {caseId:x.caseId, pass:false} : x); return result(r, b, {critical:['c0']}).ok === false })()",
        },
        {
          name: 'delta 反映通过率变化',
          expr: "(() => { const b = Array.from({length:10},(_,i)=>({caseId:'c'+i,pass:true})); const r = b.map((x,i)=>({...x, pass: i < 8})); const g = result(r, b); return Math.abs(g.delta - (-0.2)) < 1e-9 })()",
        },
      ],
      solution: `function gate(run, baseline, opts = {}) {
  const maxDrop = opts.maxDrop ?? 0.03
  const critical = new Set(opts.critical ?? [])

  const clean = (rs) => rs.filter((r) => !r.error)
  const rate = (rs) => (rs.length ? rs.filter((r) => r.pass).length / rs.length : 1)

  const runClean = clean(run)
  const baseClean = clean(baseline)

  const cur = rate(runClean)
  const base = rate(baseClean)
  const delta = cur - base

  const regressed = runClean.filter((r) => {
    const b = baseClean.find((x) => x.caseId === r.caseId)
    return b && b.pass === true && r.pass === false
  })

  const hitCritical = regressed.filter((r) => critical.has(r.caseId))
  if (hitCritical.length > 0) {
    return { ok: false, delta, reason: '关键用例退化：' + hitCritical.map((r) => r.caseId).join(', ') }
  }

  if (base - cur > maxDrop) {
    return { ok: false, delta, reason: '通过率下降 ' + ((base - cur) * 100).toFixed(1) + ' 个点' }
  }

  return { ok: true, delta, regressed: regressed.map((r) => r.caseId) }
}`,
      hints: [
        '先写两个小工具函数：过滤 error、算通过率。',
        '注意通过率要在过滤后的数组上算，否则分母被环境问题污染。',
        '完整实现：`clean` 过滤掉带 error 的；`rate` 算通过率；`regressed` 找"基线通过、现在失败"的；先查 critical（优先级最高），再查总跌幅；`delta` 用过滤后的数字算。',
      ],
      explanation: '门禁的本质是"和基线比"，不是和绝对阈值比。排除 error 是为了区分"质量退化"和"环境抖动"，否则一次下游超时就能让你的 CI 红一片。',
      approach: [
        '过滤掉带 error 的条目（环境问题不是质量退化）',
        '在过滤后的数据上算通过率和 delta',
        '找出"基线通过、现在失败"的回归集合',
        '先检查 critical 用例（一票否决）',
        '再检查总跌幅是否超阈值',
      ],
      knowledge: ['回归门禁', '噪声容忍', '关键用例', '基线对比'],
      pitfalls: [
        '用绝对阈值（"通过率低于 80% 就失败"）而不是和基线比',
        '把 error 算成失败，导致 CI 被环境问题刷红',
        '忘记 critical 用例的优先级',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 15,
    questions: [
      {
        id: 'q1',
        stem: '为什么"试了 5 个问题感觉变好了"不足以判断改进？',
        options: [
          { id: 'a', text: '5 个太少，且通常是你自己想的问题（有偏），还没有基线可对比' },
          { id: 'b', text: '因为模型会随机输出' },
          { id: 'c', text: '因为应该试 6 个' },
          { id: 'd', text: '因为要等用户反馈' },
        ],
        answer: 'a',
        why: '三个独立问题：样本小、采样有偏、无基线。评测体系就是同时修这三个。',
        stepId: 's1',
      },
      {
        id: 'q2',
        stem: '评测集里为什么必须有"应该拒答"的用例？',
        options: [
          { id: 'a', text: '为了增加难度' },
          { id: 'b', text: '否则系统会越来越倾向于硬答知识库覆盖不到的问题' },
          { id: 'c', text: '为了减少用例数量' },
          { id: 'd', text: 'judge 需要负例才能工作' },
        ],
        answer: 'b',
        why: '只测"能答对的"，优化压力全在"多答"，系统就会编。拒答用例是唯一能约束这个方向的样本。',
        stepId: 's2',
      },
      {
        id: 'q3',
        stem: '端到端准确率下降，Recall@10 没变，忠实度降了。该改哪里？',
        options: [
          { id: 'a', text: '检索链路（切分、embedding）' },
          { id: 'b', text: '生成层（prompt 约束、上下文排序、模型选择）' },
          { id: 'c', text: '评测集' },
          { id: 'd', text: '数据库索引' },
        ],
        answer: 'b',
        why: '检索没变说明材料找对了，忠实度降说明模型没照着材料答。问题在生成层。',
        stepId: 's3',
      },
      {
        id: 'q4',
        stem: '用 LLM-as-judge 判定"回答是否符合事实"，最大的风险是什么？',
        options: [
          { id: 'a', text: '太慢' },
          { id: 'b', text: 'judge 自己也会幻觉，等于让同样会编的模型来裁判编造' },
          { id: 'c', text: '太贵' },
          { id: 'd', text: '不支持中文' },
        ],
        answer: 'b',
        why: '事实正确性必须有可验证的依据（材料里有、数据库查得到）或人工。judge 只适合判格式、引用、贴合度这类可观察的性质。',
        stepId: 's4',
      },
      {
        id: 'q5',
        stem: 'Pairwise 对比时，A/B 交换顺序后结论反了。应该怎么算？',
        options: [
          { id: 'a', text: '算 A 赢（第一次的结果更可信）' },
          { id: 'b', text: '算平局，不计入胜率' },
          { id: 'c', text: '再跑第三次决定' },
          { id: 'd', text: '随机算一边' },
        ],
        answer: 'b',
        why: '顺序一换结论就变，说明两者差异小于位置偏见的影响，判平局才是诚实的。',
        stepId: 's4',
      },
      {
        id: 'q6',
        stem: '你在评测集上把通过率调到 95%，上线后没有改善。最可能的原因？',
        options: [
          { id: 'a', text: '模型不够强' },
          { id: 'b', text: '对评测集过拟合了——prompt 里堆了针对这批用例的特例，泛化能力下降' },
          { id: 'c', text: '评测指标选错了' },
          { id: 'd', text: '线上流量太小' },
        ],
        answer: 'b',
        why: '把考卷当练习册的典型后果。信号是：dev 通过率极高但线上无改善，且 prompt 里出现大量特例说明。解法是换一批 dev 用例。',
        stepId: 's5',
      },
      {
        id: 'q7',
        stem: '回归门禁里，为什么要把带 error 的条目排除在通过率计算之外？',
        options: [
          { id: 'a', text: '为了让数字好看' },
          { id: 'b', text: '因为下游超时是环境问题，不是质量退化；混进去会让门禁被无关抖动刷红' },
          { id: 'c', text: '因为 error 条目一定通过了' },
          { id: 'd', text: '因为 judge 无法处理 error' },
        ],
        answer: 'b',
        why: '门禁要挡的是"变差了"。把环境问题算成质量退化，会让团队对门禁失去信任，最后把门禁关掉。',
        stepId: 's6',
      },
      {
        id: 'q8',
        stem: '线上准确率该怎么测？',
        options: [
          { id: 'a', text: '看用户有没有投诉' },
          { id: 'b', text: '看点赞数' },
          { id: 'c', text: '每天随机抽 30 条真实对话，人工或 judge 标注，同时监控转人工率' },
          { id: 'd', text: '用离线评测集的结果代替' },
        ],
        answer: 'c',
        why: '沉默不等于满意，点赞率受 UI 影响大。抽检是唯一能算真实准确率的方法，转人工率是最强的负反馈信号。',
        stepId: 's7',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统：评测体系',
    contributes:
      '这一课让项目从"能跑"变成"能改"。产出物是一套 50 条的评测集 + 分层指标脚本 + CI 门禁，后面每一课改动都要过这道闸。',
    tasks: [
      '从真实日志采样 50 条用例（含 10 条应拒答的负例、5 条历史失败案例），脱敏后存成 JSONL',
      '给每条标注 goldChunkIds、mustInclude、mustNotInclude、expectedAction、tags、notes',
      '实现分层评测脚本：Recall@10、MRR、忠实度（逐句二值判定）、格式合规率、端到端准确率',
      '实现 LLM-as-judge 的 pairwise 对比（交换顺序跑两次，不一致判平局）',
      '用 30 条人工标注校准 judge，算一致率，低于 75% 就改 judge prompt',
      '实现回归门禁：排除 error、对比基线、关键用例一票否决',
      '接进 GitHub Actions，PR 上自动跑并把结果贴成评论',
      '留 20 条 holdout，只在发版前手动跑',
    ],
    done: '随便改一版 prompt，能在 10 分钟内拿到"Recall 0.86 / 忠实度 0.91 / 端到端 0.78，比基线 +4 个点，无关键用例退化"这样一份报告；故意改坏一处（比如把检索 top-k 从 10 降到 3），门禁能红并指出退化的是哪几条。',
  },

  further: [
    { text: 'RAGAS 文档 · faithfulness / answer relevancy 的判定方式' },
    { text: '论文 · Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena（位置/长度/自我偏好）' },
    { text: 'OpenAI Evals 仓库 · 用例格式与 grader 设计' },
    { text: '知识地图 07 评测（/guide/07-evals）' },
  ],
}
