import type { Lesson } from './types'

/**
 * 第十三课：记忆系统
 *
 * 核心立场：记忆不是"把历史都存下来"，而是"决定什么值得留、什么时候该忘"。
 * 大多数记忆系统的失败原因是记得太多、记得太死。
 */
export const lesson13: Lesson = {
  id: 'L13',
  moduleId: 'memory',
  order: 13,
  path: '/learn/13-memory',
  title: '记忆系统：让 AI 记得住，且记得对、忘得掉',
  subtitle: '上下文窗口不是记忆。窗口是"这一次能看到什么"，记忆是"下一次还能想起什么"。',
  minutes: 65,
  level: '进阶',
  outcome: '能为自己的产品设计一套分层的记忆方案，并说清每一层存什么、怎么召回、什么时候删。',
  goals: [
    '区分工作记忆、情节记忆、语义记忆，知道各自的存储和召回方式',
    '用摘要和裁剪管理短期上下文，保住任务又不撑爆窗口',
    '判断什么信息值得写进长期记忆，以及怎么写才不冲突',
    '用时间衰减和重要性加权做召回，而不是简单按相似度',
    '设计遗忘机制：TTL、用户删除、污染清理',
    '识别记忆系统的四种典型故障，并知道什么时候根本不该做记忆',
  ],
  prereqs: [
    '学过第七课，理解向量检索和元数据过滤',
    '学过第十课，能记录 trace 并定位问题',
    '有自己的产品，能说清"用户下次来的时候，希望它记得什么"',
  ],

  steps: [
    {
      id: 's1',
      title: '三种记忆，三种存法',
      checkpoint: '用户上周说"我对花生过敏"，这属于哪种记忆？',
      blocks: [
        {
          type: 'p',
          text: '"记忆"这个词被用得太泛。工程上必须拆开，因为三种记忆的**存储位置、召回方式、生命周期**完全不同。',
        },
        {
          type: 'table',
          head: ['类型', '是什么', '存哪', '怎么召回', '活多久'],
          rows: [
            ['工作记忆', '当前这轮对话的上下文', 'messages 数组', '全量喂给模型', '本次会话'],
            ['情节记忆', '发生过什么（"上次他说预算 5 万"）', '事件表 / 对话摘要', '按时间 + 相关性召回', '数周到数月'],
            ['语义记忆', '关于用户/世界的事实（"他是财务负责人"）', '结构化档案 + 向量', '按实体或相似度召回', '长期，直到被推翻'],
          ],
        },
        {
          type: 'p',
          text: '这个区分解决了一个常见困惑：**为什么我明明把历史都存了，模型还是"不记得"？** 因为存下来 ≠ 召回。工作记忆受窗口限制，情节和语义记忆需要**主动检索**才有用。',
        },
        {
          type: 'analogy',
          title: '和前端状态管理对照',
          text: '工作记忆像组件内的 `ref`——只在当前组件活着的时候有效。情节记忆像 `Pinia` 的 action 历史——能回放，但要主动查。语义记忆像持久化到 localStorage 的偏好设置——跨会话存在，但需要显式读取才有用。**三者混成一个 store，就是灾难。**',
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '先问一个产品问题',
          text: '在设计任何记忆之前，先回答：**"如果它记得这件事，用户会觉得贴心还是毛骨悚然？"** 记得"他偏好简短回答"是贴心；记得"他上周三凌晨问过离婚协议"是毛骨悚然。这个判断决定了你的记忆边界，比任何技术选型都重要。',
        },
      ],
    },

    {
      id: 's2',
      title: '短期记忆：裁剪，而不是"全塞进去"',
      checkpoint: '对话进行到第 40 轮，上下文快满了。删掉最早的 10 轮，会丢什么？',
      blocks: [
        {
          type: 'p',
          text: '最常见的做法是"滚动窗口"：只保留最近 N 轮。它简单，但会丢掉三样东西：**用户的原始目标、已经确认过的约束、已经排除的方案**。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '三层结构：钉住 + 摘要 + 最近',
          note: '关键是"钉住"那一段——它是一份结构化的任务状态，由代码维护，不依赖模型记忆。这样即使裁剪掉 30 轮对话，任务也不会跑偏。',
          code: `type SessionState = {
  goal: string                    // 用户最初要什么，一旦确定就不改
  constraints: string[]           // 已确认的约束（预算、时间、偏好）
  ruledOut: string[]              // 已排除的方案 + 原因
  openQuestions: string[]         // 还没答的问题
}

function buildContext(state: SessionState, summary: string, recent: Msg[]) {
  return [
    {
      role: 'system',
      content: \`<task_state>
目标：\${state.goal}
约束：\${state.constraints.join('；') || '无'}
已排除：\${state.ruledOut.join('；') || '无'}
待确认：\${state.openQuestions.join('；') || '无'}
</task_state>

<conversation_summary>
\${summary}
</conversation_summary>\`,
    },
    ...recent,   // 最近 6~8 轮原文
  ]
}`,
        },
        {
          type: 'table',
          head: ['策略', '做法', '优点', '缺点'],
          rows: [
            ['滚动窗口', '只留最近 N 轮', '简单、确定', '丢目标、丢约束'],
            ['全量摘要', '定期把历史压成一段摘要', '省 token', '摘要会失真，越压越糊'],
            ['钉住 + 摘要 + 最近', '结构化状态常驻 + 中期摘要 + 近期原文', '平衡最好', '需要维护状态机'],
            ['检索式', '历史全存，按当前问题检索相关片段', '不丢信息', '延迟高，可能召回无关内容'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '摘要不能交给模型"自由发挥"',
          text: '让模型"总结一下之前的对话"，它会丢掉它认为不重要的细节——而那往往正是你需要的（比如"用户说过不要用红色"）。**正确做法是让模型按固定字段抽取**（目标/约束/已排除/待确认），而不是自由写一段话。**结构化摘要才能被校验、被增量更新。**',
        },
      ],
    },

    {
      id: 's3',
      title: '长期记忆：写入比读取更难',
      checkpoint: '用户说"我最近换工作了"。旧记忆里写着"在某公司做运营"，该怎么处理？',
      blocks: [
        {
          type: 'p',
          text: '大多数记忆系统的精力都花在"怎么召回"，但真正决定质量的是**写入**：写什么、以什么形式写、冲突怎么办。',
        },
        {
          type: 'p',
          text: '先定"什么值得写"。四条标准，缺一不可：',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            '**稳定**：不是一次性信息。"我下周出差"是事件，不是画像；"我常驻上海"才是。',
            '**有用于未来**：写下来会在下次对话里改变你的行为。不改变行为的信息不要写。',
            '**可推断**：是从用户明确说的事实来的，不是你猜的。猜出来的记忆最危险。',
            '**用户可接受**：如果用户看到"我们记住了这些"，他不会反感。',
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '带冲突消解的写入',
          note: '关键在 supersedes 和 valid_from：旧记忆不是删掉，而是标记失效。这样既能回答"现在是什么"，也能回答"以前是什么"，而且可审计。',
          code: `type Fact = {
  id: string
  userId: string
  key: string          // 'employer' / 'diet.restriction' / 'preferred_length'
  value: string
  confidence: number   // 0~1，来自抽取时的确定性
  sourceMsgId: string  // 可追溯：这句话是哪来的
  validFrom: Date
  validTo: Date | null // null = 当前有效
  supersedes: string | null
}

async function writeFact(userId: string, key: string, value: string, src: string) {
  const current = await db.fact.findFirst({
    where: { userId, key, validTo: null },
  })

  if (current?.value === value) {
    await db.fact.update({ where: { id: current.id }, data: { confidence: bump(current.confidence) } })
    return
  }

  const now = new Date()
  if (current) {
    // 旧事实失效，但不删除
    await db.fact.update({ where: { id: current.id }, data: { validTo: now } })
  }
  await db.fact.create({
    data: { userId, key, value, confidence: 0.8, sourceMsgId: src,
            validFrom: now, validTo: null, supersedes: current?.id ?? null },
  })
}`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '不要覆盖，要版本化',
          text: '直接 `UPDATE facts SET value = ...` 会让你失去两样东西：**审计能力**（用户问"你凭什么觉得我换工作了"）和**纠错能力**（发现记错了想回退）。用 `validFrom / validTo` 做时间版本，成本很低，价值很高。',
        },
        {
          type: 'p',
          text: '还有一条实践：**写入要有阈值**。不是每句话都抽事实，只在"用户明确陈述 + 抽取置信度高"时写。宁可少记，也不要记错——**记错一次，用户对系统的信任就崩了**，而且他会开始逐条检查你说的每句话。',
        },
      ],
    },

    {
      id: 's4',
      title: '召回：相似度不是唯一维度',
      checkpoint: '用户三个月前提过"我在准备考试"，现在问"帮我规划下周末"。这条旧记忆该召回吗？',
      blocks: [
        {
          type: 'p',
          text: '纯按向量相似度召回记忆，会有两个问题：**旧事压过新事**（三个月前的考试计划和今天的周末规划语义很近），**冷门但重要的信息永远召不回**（"对花生过敏"和"推荐餐厅"相似度不高）。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '多维度打分',
          code: `function scoreMemory(m: Memory, query: string, now: Date) {
  const sim = cosine(m.embedding, embedCache.get(query))   // 0~1

  // 时间衰减：半衰期 30 天
  const ageDays = (now.getTime() - m.createdAt.getTime()) / 86400000
  const recency = Math.pow(0.5, ageDays / 30)

  // 重要性：来自写入时的标记 + 访问频次
  const importance = Math.min(1, m.baseWeight * (1 + Math.log1p(m.accessCount) / 5))

  // 硬约束类记忆（过敏、禁用方案）给固定加成
  const pin = m.key.startsWith('constraint.') ? 0.4 : 0

  return 0.55 * sim + 0.25 * recency + 0.20 * importance + pin
}`,
        },
        {
          type: 'table',
          head: ['维度', '作用', '怎么定'],
          rows: [
            ['语义相似度', '相关性', '向量余弦'],
            ['时间衰减', '新鲜度', '半衰期 14~90 天，看业务'],
            ['重要性', '价值', '写入时标权重（约束 > 偏好 > 闲聊）'],
            ['访问频次', '被验证有用', '每次召回 +1，对数压缩'],
            ['硬约束加成', '不能漏', '过敏、禁用、法务要求给固定加分'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '硬约束要走"必带"通道，不要靠打分',
          text: '"对花生过敏"这种信息，**不能赌它排进 top-3**。正确做法是把它作为"always include"的槽位，每次请求都带上（通常只有几条，成本可忽略）。**安全相关的记忆，永远不参与排序竞争。**',
        },
        {
          type: 'p',
          text: '召回的第二个问题是**注入方式**。把记忆拼成一段"以下是关于用户的已知信息"，模型会当成事实陈述；更好的做法是标注来源和时间：`<memory key="employer" since="2026-03-01">某公司</memory>`。这样模型在信息冲突时能判断哪个更新，你排查时也能看到它用了哪条。',
        },
      ],
    },

    {
      id: 's5',
      title: '遗忘：一个必须主动设计的功能',
      checkpoint: '如果系统永远不忘，最坏的结果是什么？',
      blocks: [
        {
          type: 'p',
          text: '最坏的结果不是"存不下"，而是**旧信息持续污染新判断**。三个月前用户随口说"我在考虑离职"，系统一直记着，之后每次职业相关的问题都往这个方向引——用户会觉得"它怎么老觉得我要离职"。',
        },
        {
          type: 'table',
          head: ['遗忘机制', '触发条件', '做法'],
          rows: [
            ['TTL', '时间到期', '情节记忆 90 天，临时偏好 30 天，事实类不设 TTL'],
            ['置信度衰减', '长期未被确认', '每次相关对话没提到，置信度 -0.05；低于 0.3 转"待确认"'],
            ['冲突失效', '被新事实取代', '`validTo` 置为当前时间，不删除'],
            ['用户删除', '用户主动要求', '**物理删除**，包括向量、缓存、备份标记'],
            ['污染清理', '发现错误记忆', '标记 invalid + 记录原因，用于改进抽取规则'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '用户可见、可控的记忆面板',
          note: '这不是"nice to have"。让用户能看见、能改、能删，是记忆功能能不能被接受的前提。',
          code: `// GET /api/memory
{
  "facts": [
    { "id": "f1", "label": "职业", "value": "某公司运营", "since": "2026-03-01", "editable": true },
    { "id": "f2", "label": "饮食限制", "value": "花生过敏", "since": "2026-01-12", "editable": true, "pinned": true }
  ],
  "episodes": [
    { "id": "e1", "summary": "2026-03-18 咨询过报销流程", "expiresAt": "2026-06-16" }
  ]
}

// DELETE /api/memory/:id  → 物理删除，并清掉向量与缓存
// PATCH  /api/memory/:id  → 用户手动纠正（置信度置 1.0，标记 source=user）`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '"删除"要跨存储',
          text: '记忆通常存在四个地方：结构化表、向量库、缓存、日志/trace。用户点删除时，**四处都要清**。只删主表是最常见的合规漏洞——向量里的 embedding 依然能反推出语义。',
        },
      ],
    },

    {
      id: 's6',
      title: '四种典型故障',
      checkpoint: '用户说"我没说过我喜欢简短回答"，但系统记着。这是哪类故障？',
      blocks: [
        {
          type: 'table',
          head: ['故障', '表现', '根因', '修法'],
          rows: [
            ['记错了', '用户否认说过', '抽取时把推测当事实，或指代解析错', '提高写入阈值 + 保留 sourceMsgId 可追溯'],
            ['过度泛化', '"一次抱怨"变成"他讨厌这个功能"', '单次事件被写成稳定偏好', '区分事件与画像，事件不写进事实'],
            ['串味', 'A 用户的记忆出现在 B 的对话里', '缓存 key 没带 userId，或检索没过滤', '所有记忆读写强制带 userId 条件'],
            ['污染累积', '错误记忆被反复引用，越用越"真"', '没有纠错回路', '访问频次不该提升错误记忆的权重；要有人工纠错入口'],
          ],
        },
        {
          type: 'p',
          text: '「记错了」这条要特别说：**模型抽取事实时最常见的错误是把"假设"当"陈述"**。用户说"如果我要换工作的话，可能考虑金融行业"，抽取器可能写成 `career_interest = 金融`。而实际上这是个条件句。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '抽取时要求模型标注确定性',
          code: `const EXTRACT_PROMPT = \`从对话中抽取关于用户的**稳定事实**。

只抽取用户明确陈述的内容。以下情况不要抽取：
- 条件句（"如果我...""假设..."）
- 疑问句（"我是不是该..."）
- 第三方信息（"我朋友说..."）
- 一次性的临时状态（"我今天很累"）

对每条事实给出 certainty：
- stated：用户直接陈述（"我是财务"）
- implied：可从多轮对话稳定推断
- uncertain：只出现过一次或有歧义

输出 JSON：{ facts: [{ key, value, certainty, evidence }] }
evidence 必须是原文片段，不能是你改写的。\``,
        },
        {
          type: 'p',
          text: '然后代码里只写 `certainty === "stated"` 的，`implied` 的存成"待确认"，下次相关对话里自然地问一句"你之前提到在做财务，现在还是吗？"——**确认一次，比猜十次都强。**',
        },
      ],
    },

    {
      id: 's7',
      title: '什么时候不该做记忆',
      checkpoint: '一个"查公司制度"的内部问答机器人，需要记忆吗？',
      blocks: [
        {
          type: 'p',
          text: '记忆是有成本的：存储、召回延迟、隐私风险、维护复杂度、以及"记错了"带来的信任损失。以下场景**不该做**：',
        },
        {
          type: 'list',
          items: [
            '**单次任务型**：用户来问一个问题就走（查制度、查物流、算税费）。记住他上次问了什么没有价值。',
            '**答案与个人无关**：知识库问答的答案不依赖"你是谁"，记忆只会引入噪声。',
            '**高敏感领域**：医疗、法律、金融的身份信息，记住的收益远小于泄露的风险。',
            '**用户没预期**：产品定位是"无痕工具"，突然开始记忆会让人不适。',
          ],
        },
        {
          type: 'p',
          text: '反过来，**该做**的信号很明确：',
        },
        {
          type: 'table',
          head: ['信号', '例子'],
          rows: [
            ['用户重复提供同样的信息', '"我说过了，我们公司用的是飞书"'],
            ['答案依赖用户画像', '推荐、规划、个性化建议'],
            ['跨会话的连续任务', '写了三周的小说、做了两个月的项目'],
            ['需要避免重复犯错', '"上次你推荐的那个方案我们试过，不行"'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '最小可行的记忆',
          text: '如果拿不准，就从**最小的一层**开始：只维护一份 10 条以内的"用户偏好卡片"（称呼、语言、长度偏好、明确的禁忌），全部由用户显式设置，不做自动抽取。这一层的收益/风险比最高，而且几乎不会记错。**等这一层用出价值了，再考虑情节记忆和自动抽取。**',
        },
        {
          type: 'qa',
          q: '那"记忆"和 RAG 到底什么关系？',
          a: '技术上是同一套东西（向量检索 + 元数据过滤），区别在**数据来源和生命周期**。RAG 检索的是"客观知识"（文档），相对静态、共享、不需要遗忘；记忆检索的是"关于这个人的主观信息"，动态、私有、必须能删。所以记忆系统比 RAG 多三样东西：写入管道（抽取+冲突消解）、时间维度（validFrom/validTo）、用户控制（可见可删）。**这也是为什么"直接把对话历史塞进向量库当 RAG"通常效果很差**——它缺少后面这三样。',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '什么值得写进长期记忆',
      points: 10,
      prompt: '用户在对话里说了下面四句话。哪一句最适合写进长期记忆？',
      options: [
        { id: 'a', text: '"我今天有点累"' },
        { id: 'b', text: '"我对青霉素过敏"' },
        { id: 'c', text: '"如果我以后要换工作，可能会考虑金融行业"' },
        { id: 'd', text: '"帮我查一下明天的天气"' },
      ],
      answer: ['b'],
      hints: [
        '用四条标准筛：稳定、有用于未来、可推断、用户可接受。',
        'a 是临时状态；c 是条件句（假设，不是事实）；d 是一次性请求。',
        'b 满足全部四条：稳定（过敏不会变）、有用于未来（推荐药物/餐厅时必须避开）、明确陈述、用户完全能接受被记住。而且它属于"硬约束"，应该走必带通道。',
      ],
      explanation: '正确答案是 b。医学禁忌是长期记忆里价值最高、风险最低的一类。',
      approach: [
        '问：这是稳定属性还是一次性状态？',
        '问：下次对话里它会不会改变我的行为？',
        '问：是用户明确陈述，还是我的推测？',
        '问：用户看到"我们记住了这个"会不会反感？',
      ],
      knowledge: ['写入标准', '硬约束', '条件句陷阱'],
      pitfalls: [
        '把条件句/疑问句抽成事实',
        '把临时状态写成画像',
      ],
    },
    {
      id: 'e2',
      type: 'multi',
      title: '记忆系统的必要设计',
      points: 15,
      prompt: '下面哪些是长期记忆系统的必要设计？（多选）',
      options: [
        { id: 'a', text: '事实带 validFrom / validTo，旧事实标记失效而不是直接删除' },
        { id: 'b', text: '每条事实保留 sourceMsgId，能追溯到原始对话' },
        { id: 'c', text: '所有记忆读写都强制带 userId 条件' },
        { id: 'd', text: '把全部对话历史都抽成事实，越多越好' },
        { id: 'e', text: '提供用户可见的记忆面板，能查看和删除' },
      ],
      answer: ['a', 'b', 'c', 'e'],
      hints: [
        '想三个角度：可审计、可隔离、可控制。',
        'd 是反模式——记太多会导致旧信息持续污染判断。',
        'a 让记忆可版本化和回退；b 让"你凭什么这么认为"可回答；c 防串味（最严重的故障）；e 是合规和用户信任的前提。d 会让噪声压过信号。',
      ],
      explanation: 'a、b、c、e 都是必要设计。d 是典型的过度设计，会让记忆质量下降。',
      approach: [
        '版本化：validFrom/validTo + supersedes',
        '可追溯：每条记忆指向原始消息',
        '强隔离：读写都带 userId / tenantId',
        '用户可控：可见、可改、可删（跨存储清理）',
        '有阈值：只写高确定性的稳定事实',
      ],
      knowledge: ['记忆版本化', '可追溯', '用户隔离', '记忆面板'],
      pitfalls: [
        '直接 UPDATE 覆盖旧值',
        '记忆不隔离，导致串味',
        '没有用户可见入口，出问题无法纠错',
      ],
    },
    {
      id: 'e3',
      type: 'fill',
      title: '设计上下文结构',
      points: 15,
      prompt: '对话到第 40 轮，需要压缩上下文。补全这个三层结构的关键字段。',
      templateLang: 'ts',
      template: `// 第 1 层：钉住的任务状态（由代码维护，不依赖模型记忆）
type SessionState = {
  goal: string            // {{g1}}
  constraints: string[]   // {{g2}}
  ruledOut: string[]      // {{g3}}
  openQuestions: string[] // 还没答的问题
}

// 第 2 层：中期摘要（按固定字段抽取，不自由发挥）
// 第 3 层：最近 {{g4}} 轮原文

// 硬约束类记忆（过敏、法务禁用）走 {{g5}} 通道，不参与相似度排序`,
      blanks: [
        { id: 'g1', label: 'goal 存什么', accept: ['用户最初要什么', '用户目标', '原始目标', '任务目标', '用户最初的目标'], width: 140 },
        { id: 'g2', label: 'constraints 存什么', accept: ['已确认的约束', '约束', '预算时间偏好', '用户确认的约束'], width: 140 },
        { id: 'g3', label: 'ruledOut 存什么', accept: ['已排除的方案', '排除的方案', '已排除', '已否决方案'], width: 130 },
        { id: 'g4', label: '最近保留几轮原文', accept: ['6', '8', '6~8', '6-8', '7', '10'], width: 80 },
        { id: 'g5', label: '硬约束走什么通道', accept: ['必带', 'always include', '固定注入', '必带通道', '始终注入'], width: 120 },
      ],
      hints: [
        '这三层各自解决一个丢失问题：丢目标、丢约束、丢近期细节。',
        '最后一空是第七课和这一课的共同结论：安全相关的信息不能赌排序。',
        'goal 是用户最初要什么（一旦确定不该变）；constraints 是已确认的约束（预算、时间、偏好）；ruledOut 是已排除的方案和原因；最近保留 6~8 轮原文；硬约束走必带通道。',
      ],
      explanation: '这个结构的价值在于：**即使裁剪掉 30 轮对话，任务状态依然完整**。它把"模型要记住的东西"变成了"代码维护的状态"，可靠性从概率变成确定。',
      approach: [
        '把任务状态抽出来，用结构化字段维护',
        '摘要只做"按字段抽取"，不做自由总结',
        '近期原文保留 6~8 轮，保证指代可解析',
        '硬约束单独走必带通道',
      ],
      knowledge: ['上下文压缩', '任务状态', '摘要策略'],
      pitfalls: [
        '只做滚动窗口，丢掉目标和约束',
        '让模型自由写摘要，细节被丢掉',
        '硬约束靠排序，偶尔漏掉',
      ],
    },
    {
      id: 'e4',
      type: 'code',
      title: '实现时间衰减打分',
      points: 20,
      prompt: '实现 `decay(baseScore, ageDays, halfLifeDays)`：返回按半衰期衰减后的分数，`ageDays` 为 0 时不衰减，每过 `halfLifeDays` 天分数减半。保留浮点精度（不要取整）。',
      starter: `function decay(baseScore, ageDays, halfLifeDays) {
  // TODO
  return baseScore
}

return decay`,
      checks: [
        { name: '当天不衰减', expr: 'Math.abs(result(1, 0, 30) - 1) < 1e-9' },
        { name: '一个半衰期减半', expr: 'Math.abs(result(1, 30, 30) - 0.5) < 1e-9' },
        { name: '两个半衰期四分之一', expr: 'Math.abs(result(1, 60, 30) - 0.25) < 1e-9' },
        { name: '保持基础分的比例', expr: 'Math.abs(result(0.8, 30, 30) - 0.4) < 1e-9' },
        { name: '负天数按 0 处理', expr: 'Math.abs(result(1, -10, 30) - 1) < 1e-9' },
        { name: '结果单调递减', expr: 'result(1, 10, 30) > result(1, 40, 30) && result(1, 40, 30) > result(1, 100, 30)' },
      ],
      solution: `function decay(baseScore, ageDays, halfLifeDays) {
  const age = Math.max(0, ageDays)
  return baseScore * Math.pow(0.5, age / halfLifeDays)
}`,
      hints: [
        '半衰期的数学表达是 0.5 的 (年龄/半衰期) 次方。',
        '负天数要当成 0，否则分数会变大（未来记忆比现在还重要，没道理）。',
        '完整实现：`const age = Math.max(0, ageDays); return baseScore * Math.pow(0.5, age / halfLifeDays)`。一行就够，但要理解为什么用 0.5 的幂而不是线性递减——线性递减会在半衰期后继续掉到负数，指数衰减永远不会。',
      ],
      explanation: '指数衰减是记忆打分的基础。它保证分数永远为正、单调递减、且在任意时间尺度上都可比。线性递减到 0 之后就没法区分"很久以前"和"更久以前"了。',
      approach: [
        '把负年龄归零',
        '用 0.5 的 (age/halfLife) 次方做衰减',
        '乘以基础分',
        '半衰期按业务定：偏好类 30~90 天，事件类 7~14 天',
      ],
      knowledge: ['指数衰减', '半衰期', '记忆打分'],
      pitfalls: [
        '用线性递减（会变成负数或提前归零）',
        '不处理负年龄',
        '对所有记忆用同一个半衰期（偏好和事件的时间尺度不同）',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 12,
    questions: [
      {
        id: 'q1',
        stem: '上下文窗口和记忆的本质区别是？',
        options: [
          { id: 'a', text: '窗口更大' },
          { id: 'b', text: '窗口是"这次能看到什么"，记忆是"下次还能主动想起什么"，后者需要检索' },
          { id: 'c', text: '记忆存在数据库里' },
          { id: 'd', text: '没区别' },
        ],
        answer: 'b',
        why: '存下来不等于能想起。记忆的核心是"在需要的时候被召回"，这需要检索机制。',
        stepId: 's1',
      },
      {
        id: 'q2',
        stem: '为什么摘要不该让模型自由发挥？',
        options: [
          { id: 'a', text: '太慢' },
          { id: 'b', text: '模型会丢掉它认为不重要的细节（如"用户说过不要用红色"），应该按固定字段抽取' },
          { id: 'c', text: '太贵' },
          { id: 'd', text: '模型不会摘要' },
        ],
        answer: 'b',
        why: '自由摘要不可校验、不可增量更新。结构化抽取（目标/约束/已排除/待确认）才能保证关键信息不丢。',
        stepId: 's2',
      },
      {
        id: 'q3',
        stem: '用户说"我换工作了"，旧记忆是"在某公司做运营"。正确处理是？',
        options: [
          { id: 'a', text: '直接 UPDATE 覆盖' },
          { id: 'b', text: '旧事实置 validTo，新建一条 validFrom 为现在的事实，并记录 supersedes' },
          { id: 'c', text: '两条都留着，让模型自己判断' },
          { id: 'd', text: '删掉所有职业相关记忆' },
        ],
        answer: 'b',
        why: '版本化保留审计和纠错能力。直接覆盖会丢失"以前是什么"；两条都留会让模型纠结；全删会丢失仍然有效的信息。',
        stepId: 's3',
      },
      {
        id: 'q4',
        stem: '"对花生过敏"这类信息该怎么处理？',
        options: [
          { id: 'a', text: '参与相似度排序，排进 top-3 就行' },
          { id: 'b', text: '走"必带"通道，每次请求都注入，不参与排序竞争' },
          { id: 'c', text: '存起来但不用，以防万一' },
          { id: 'd', text: '让模型自己记住' },
        ],
        answer: 'b',
        why: '安全相关的记忆不能赌排序。这类信息通常只有几条，全量注入的成本可以忽略。',
        stepId: 's4',
      },
      {
        id: 'q5',
        stem: '系统永远不遗忘，最坏的后果是什么？',
        options: [
          { id: 'a', text: '存储成本上升' },
          { id: 'b', text: '旧信息持续污染新判断，用户觉得"它怎么老觉得我要离职"' },
          { id: 'c', text: '查询变慢' },
          { id: 'd', text: '没有坏处' },
        ],
        answer: 'b',
        why: '存储成本是可控的，语义污染才是致命的。三个月前的一句随口话，会一直影响之后的每次判断。',
        stepId: 's5',
      },
      {
        id: 'q6',
        stem: 'A 用户的记忆出现在 B 用户的对话里，最可能是哪个环节的问题？',
        options: [
          { id: 'a', text: '模型幻觉' },
          { id: 'b', text: '缓存 key 或检索条件没带 userId' },
          { id: 'c', text: '向量维度不对' },
          { id: 'd', text: '摘要写得太长' },
        ],
        answer: 'b',
        why: '串味几乎总是隔离缺失：缓存没带身份、检索没加过滤条件。这是记忆系统里最严重的故障。',
        stepId: 's6',
      },
      {
        id: 'q7',
        stem: '什么情况下不该做记忆功能？',
        options: [
          { id: 'a', text: '用户量大的时候' },
          { id: 'b', text: '单次任务型、答案与个人无关、高敏感领域、用户没预期的时候' },
          { id: 'c', text: '没有向量数据库的时候' },
          { id: 'd', text: '模型上下文不够大的时候' },
        ],
        answer: 'b',
        why: '记忆有存储、延迟、隐私、维护四重成本。收益不明确时，最小可行的"用户偏好卡片"就够了。',
        stepId: 's7',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统：记忆层',
    contributes:
      '这一课给项目加一层克制的记忆：只记"用户偏好卡片"和少量情节摘要，全部用户可见可删。不做自动事实抽取，先把最小闭环跑通。',
    tasks: [
      '建三张表：user_prefs（用户显式设置）、session_state（目标/约束/已排除）、episodes（情节摘要，带 expiresAt）',
      '实现 buildContext：钉住状态 + 中期摘要 + 最近 8 轮原文，替换掉原来的全量历史',
      '实现记忆面板页面：列出所有记住的信息，支持编辑和删除（删除要跨表 + 清缓存）',
      '实现时间衰减打分（半衰期 30 天），并给"硬约束"类记忆加必带通道',
      '实现过期清理任务：episodes 到期自动删，置信度低于阈值的转"待确认"',
      '做一次对照实验：同一批多轮对话，比较"全量历史"和"三层结构"的 token 消耗与回答质量',
    ],
    done: '能报出"上下文 token 下降 62%，回答质量（人工评）没有下降"；在记忆面板里删掉一条偏好后，下一次对话里系统确实不再引用它。',
  },

  further: [
    { text: '论文 · MemGPT: Towards LLMs as Operating Systems（分层记忆的经典设计）' },
    { text: 'Anthropic · Contextual Retrieval 与长上下文实践' },
    { text: '知识地图 22 记忆系统与状态管理（/guide/22-memory）' },
  ],
}
