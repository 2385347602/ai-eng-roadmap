import type { Lesson } from './types'

/**
 * 第七课：RAG 检索增强
 *
 * 核心立场：RAG 不是"给模型喂文档"，是"先做对搜索，再让模型填空"。
 * 召回率是可以测量的，检索失败和生成失败必须分开归因。
 */
export const lesson07: Lesson = {
  id: 'L07',
  moduleId: 'rag',
  order: 7,
  path: '/learn/07-rag',
  title: 'RAG 检索增强：把"模型不知道"变成"搜得到、答得准"',
  subtitle: 'RAG 的 90% 问题出在检索，不在生成。而绝大多数人只调 prompt。',
  minutes: 80,
  level: '进阶',
  outcome: '能独立设计一套可测量召回率的检索链路，并说清每个环节失效时该怎么定位。',
  goals: [
    '说清 RAG 到底解决什么问题，以及它不解决什么问题',
    '按文档结构切分，而不是按固定字数硬切',
    '判断一个场景该用向量检索、关键词检索，还是两者都要',
    '用 RRF 融合多路召回，并解释为什么它比调权重靠谱',
    '把"答错了"拆成"没搜到"和"搜到了没答对"两种故障',
    '把权限过滤下沉到检索层，避免越权召回',
    '设计增量索引和拒答策略，让系统知道自己不知道',
  ],
  prereqs: [
    '学过第五、六课，理解 token、上下文窗口和 prompt 结构',
    '用过至少一个向量数据库或 pgvector',
    '手上有一批真实文档（产品手册、内部 wiki、合同、工单都行）',
  ],

  steps: [
    {
      id: 's1',
      title: 'RAG 解决的不是"模型不知道"，是"模型不该猜"',
      checkpoint: '同一个问题，什么情况下该用 RAG，什么情况下写进 prompt 就行？',
      blocks: [
        {
          type: 'p',
          text: '新手对 RAG 的理解通常是"模型不知道我们公司的事，所以把文档喂给它"。这个理解不算错，但它会让你在错误的层面优化——你会以为 RAG 是个"喂资料"的动作，实际上 RAG 是一个**检索系统 + 一个填空系统**，而且前者决定了后者的上限。',
        },
        {
          type: 'p',
          text: '更准确的理解：**RAG 是把"开放域生成"降级成"给定材料下的阅读理解"。** 模型不再需要从参数里回忆事实，只需要在你给的材料里找答案、组织语言。这一步降级同时解决了三件事：',
        },
        {
          type: 'table',
          head: ['问题', '不接 RAG 会怎样', '接 RAG 后'],
          rows: [
            ['私有知识', '模型完全没听过，只能编', '材料在上下文里，有据可依'],
            ['知识过期', '训练截止日之后的事一概不知', '改文档即生效，不用重训'],
            ['无法溯源', '"我记得是……" 但给不出出处', '每句能挂到具体 chunk 和链接'],
            ['权限隔离', '无解，模型不知道谁在问', '检索时按用户身份过滤'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'RAG 不解决的问题',
          text: 'RAG 不会让模型变聪明。如果问题需要**推理、计算、多步规划**（"对比这三份合同的责任条款差异并给出风险等级"），检索只是把材料摆上桌，推理仍然靠模型本身。材料对了但模型推不出来，那是模型能力问题，加更多文档没用。',
        },
        {
          type: 'analogy',
          title: '和 Vue 的 computed 对照',
          text: 'RAG 像 `computed`：依赖（文档）变了，结果自动重算，你不用改组件代码。而把知识写进 prompt 像把值硬编码在 `data()` 里——改一次要重新部署一次，还改不干净。**RAG 的本质是把"知识"从"代码"里解耦出来。**',
        },
        {
          type: 'qa',
          q: '那我把整个知识库全塞进 200K 上下文不就行了？还需要检索吗？',
          a: '三个理由让这条路走不通：① 成本——每次请求都为 20 万字付 input token，一天一万次请求就是灾难；② 延迟——prefill 阶段是并行的，但 20 万 token 的 prefill 也要几秒到几十秒；③ 效果——"lost in the middle"，材料越长，中间部分被注意到的概率越低，答案质量反而下降。检索的价值是**把信噪比提上去**，不只是省 token。',
        },
      ],
    },

    {
      id: 's2',
      title: '切分：RAG 效果的第一杀手',
      checkpoint: '为什么"每 500 字切一刀"是最差的切法？',
      blocks: [
        {
          type: 'p',
          text: '如果你的 RAG 效果差，**先去检查切分，别急着换模型**。切分决定了"检索的最小单位"，切错了，后面所有环节都在错误的粒度上工作。',
        },
        {
          type: 'p',
          text: '硬按字数切会制造三种典型事故：',
        },
        {
          type: 'list',
          items: [
            '**切断语义**：一个"退款政策"跨在第 3 块结尾和第 4 块开头，两块单独看都不完整，检索命中哪块都答不全。',
            '**切断表格**：表格被拦腰截断，表头在第 3 块，数据行在第 4 块，模型看到一堆没有列名的数字。',
            '**切断层级**：小标题在第 3 块，正文在第 4 块，检索到的块失去了"这段在讲什么"的上下文。',
          ],
        },
        {
          type: 'table',
          head: ['切分策略', '怎么做', '适合', '不适合'],
          rows: [
            ['固定长度', '每 N 字符切，带 10~20% 重叠', '日志、纯文本、无结构的对话记录', '手册、合同、有层级的文档'],
            ['按结构切', '按标题 / 段落 / 列表项切，保留层级路径', 'Markdown、HTML、Word、PDF 有目录', '无格式的 OCR 文本'],
            ['按语义切', '相邻句子 embedding 相似度骤降处断开', '长篇文章、散文', '短文档（成本不划算）'],
            ['父子块', '小块检索，大块喂给模型', '需要精确命中又要完整上下文', '实现复杂度高，小项目不必'],
            ['按问答对切', '一个 FAQ = 一个块', '客服、帮助中心', '叙述性文档'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '按结构切分，并把标题路径写进块里',
          note: '注意 metadata 里的 headingPath —— 它让"这一段属于哪一章"跟着块一起被检索到，是低成本高收益的一步。',
          code: `type Chunk = {
  id: string
  text: string        // 喂给 embedding 和模型的内容
  headingPath: string[] // ['第 3 章 退款', '3.2 部分退款']
  source: string
  updatedAt: string
}

function splitByHeading(md: string, source: string): Chunk[] {
  const lines = md.split('\\n')
  const chunks: Chunk[] = []
  let path: string[] = []
  let buf: string[] = []

  const flush = () => {
    const text = buf.join('\\n').trim()
    if (text.length > 0) {
      chunks.push({
        id: \`\${source}#\${chunks.length}\`,
        text: path.length ? \`[\${path.join(' > ')}]\\n\${text}\` : text,
        headingPath: [...path],
        source,
        updatedAt: new Date().toISOString(),
      })
    }
    buf = []
  }

  for (const line of lines) {
    const m = /^(#{1,4})\\s+(.*)$/.exec(line)
    if (m) {
      flush()
      const level = m[1].length
      path = path.slice(0, level - 1)
      path[level - 1] = m[2].trim()
    } else {
      buf.push(line)
    }
  }
  flush()

  // 兜底：单个块太长时再按段落二次切分
  return chunks.flatMap((c) =>
    c.text.length <= 1200
      ? [c]
      : splitLong(c),
  )
}`,
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '块大小怎么定',
          text: '没有普适答案，但有判断依据：**块要能独立回答一个问题**。经验区间 300~800 token。太小则上下文不足（模型看不到前提），太大则检索精度下降（一块里混了三件事，命中也是噪声）。带 10~15% 重叠，是为了救"正好切在句子中间"的情况。',
        },
        {
          type: 'p',
          text: '还有两个常被忽略的细节：**一是把标题路径拼进块文本**（上面代码里的 `[第 3 章 退款 > 3.2 部分退款]`），这相当于给每个块加了一句自我说明，embedding 质量会明显提升。**二是保留原始位置信息**（页码、段落号），用户点"查看原文"时要能跳过去，否则他没法验证你说的是不是真的。',
        },
      ],
    },

    {
      id: 's3',
      title: '向量检索：它擅长什么，必然失手什么',
      checkpoint: '用户问"ERR_CONN_REFUSED 怎么解决"，向量检索为什么可能搜不到含这个错误码的文档？',
      blocks: [
        {
          type: 'p',
          text: 'Embedding 把文本压成一个高维向量，语义相近的文本向量距离近。这个机制决定了它的强项和死穴：',
        },
        {
          type: 'table',
          head: ['场景', '向量检索', '原因'],
          rows: [
            ['"怎么退钱" vs 文档写"退款流程"', '✅ 命中', '语义同义，向量接近'],
            ['"ERR_CONN_REFUSED" 精确错误码', '❌ 常常失手', '错误码是罕见 token，embedding 会把它稀释掉'],
            ['产品型号 "XR-2000A"', '❌ 容易失手', '型号无语义，只是字符串'],
            ['"上个季度营收下降" 找财报段落', '✅ 命中', '语义匹配'],
            ['人名 "张伟"', '⚠️ 不稳定', '高频姓名向量区分度低'],
            ['否定句 "不含酒精的产品"', '❌ 经常反了', 'embedding 对否定不敏感，含/不含向量几乎一样'],
          ],
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '否定句是 embedding 的经典陷阱',
          text: '"支持 Windows" 和 "不支持 Windows" 在向量空间里几乎重合。如果你的业务里有大量"是否支持""有无限制"这类查询，纯向量检索会稳定地给你反答案。这不是调参能解决的，必须靠关键词检索兜底。',
        },
        {
          type: 'code',
          lang: 'sql',
          title: 'pgvector 最小可用配置',
          note: 'HNSW 的 m 控制每个节点的连边数（越大越准越占内存），ef_construction 控制建索引时的搜索宽度。查询时用 SET hnsw.ef_search 调召回/速度权衡。',
          code: `CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chunks (
  id           bigserial PRIMARY KEY,
  doc_id       bigint NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tenant_id    bigint NOT NULL,
  content      text   NOT NULL,
  heading_path text[] NOT NULL DEFAULT '{}',
  embedding    vector(1024) NOT NULL,
  tsv          tsvector,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 向量索引：余弦距离
CREATE INDEX chunks_emb_idx ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 关键词索引：给混合检索用
CREATE INDEX chunks_tsv_idx ON chunks USING gin (tsv);

-- 权限过滤走普通 B-tree
CREATE INDEX chunks_tenant_idx ON chunks (tenant_id, doc_id);`,
        },
        {
          type: 'p',
          text: '注意 `vector(1024)` 里的维度必须和你的 embedding 模型一致，**换模型就必须重建整张表的向量**。这是 RAG 系统最容易被低估的迁移成本：dimension 变了，索引全废，只能全量重算。所以选模型时要把"以后可能换"算进去，把 embedding 版本号存进表里。',
        },
        {
          type: 'qa',
          q: '余弦距离、内积、欧氏距离，该选哪个？',
          a: '如果向量已归一化（长度都是 1），三者排序等价，选哪个都对。实践上：**语义检索默认用余弦**；如果模型输出未归一化且你关心"强度"，用内积；欧氏距离在高维空间区分度会退化，不推荐。关键是**建索引和查询必须用同一种算子**（`vector_cosine_ops` 配 `<=>`），混用会静默地给出错误排序。',
        },
      ],
    },

    {
      id: 's4',
      title: '混合检索：向量 + 关键词，用 RRF 融合',
      checkpoint: '两路召回的分数范围完全不同（一路是余弦相似度，一路是 BM25 分数），为什么不能直接相加？',
      blocks: [
        {
          type: 'p',
          text: '既然向量有死穴、关键词有盲区，那就两路都跑。问题在于：**怎么合并两个不可比的分数？**',
        },
        {
          type: 'p',
          text: '最直觉的做法是归一化后加权：`0.7 * 向量分 + 0.3 * BM25 分`。这个做法在实践中很痛苦，因为：',
        },
        {
          type: 'list',
          items: [
            '余弦相似度的分布是**挤在 0.6~0.9 之间的窄带**，BM25 是**0 到几十的开区间**，归一化方式（min-max？z-score？）直接改变排序结果。',
            '权重需要针对每批数据重调，换一个知识库就得重来。',
            '分数分布随查询变化——短查询的 BM25 分布和长查询完全不同，一个固定权重不可能同时适配。',
          ],
        },
        {
          type: 'p',
          text: '**RRF（Reciprocal Rank Fusion）绕开了分数，只看排名。** 公式极其简单：',
        },
        {
          type: 'flow',
          title: 'RRF：每个文档的得分 = 各路排名倒数之和',
          ascii: `score(d) = Σ  1 / (k + rank_i(d))
              i∈路

k = 60（经验值，起平滑作用，防止第 1 名分数过大）

例：k=60
  文档 A：向量第 1 名，关键词第 3 名
    → 1/61 + 1/63 = 0.01639 + 0.01587 = 0.03226

  文档 B：向量第 2 名，关键词第 1 名
    → 1/62 + 1/61 = 0.01613 + 0.01639 = 0.03252   ← B 胜出

  文档 C：只在向量里第 1 名，关键词没出现
    → 1/61 = 0.01639                          ← 单路冠军输给两路都靠前的`,
        },
        {
          type: 'callout',
          tone: 'tip',
          title: 'RRF 为什么好用',
          text: '它**只用排名，不用分数**，所以天然免疫量纲问题；**两路都靠前的文档会被奖励**，这正是你要的"共识"；**没有需要调的参数**（k 用 60 就行），换知识库不用重调。工程上这比"精心调权重"可靠得多。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '两路召回 + RRF 融合',
          code: `async function hybridSearch(query: string, userId: string, topK = 10) {
  const [vecHits, kwHits] = await Promise.all([
    vectorSearch(query, userId, 50),
    keywordSearch(query, userId, 50),
  ])

  const K = 60
  const scores = new Map<string, { chunk: Chunk; score: number }>()

  const add = (hits: Chunk[]) => {
    hits.forEach((chunk, i) => {
      const prev = scores.get(chunk.id)
      const inc = 1 / (K + i + 1)
      if (prev) prev.score += inc
      else scores.set(chunk.id, { chunk, score: inc })
    })
  }

  add(vecHits)
  add(kwHits)

  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((x) => x.chunk)
}`,
        },
        {
          type: 'p',
          text: '这里 `Promise.all` 不是炫技——两路召回是独立的 IO，串行执行会让延迟翻倍。RAG 的端到端延迟里，检索经常占一半以上，**并行化是最便宜的优化**。',
        },
      ],
    },

    {
      id: 's5',
      title: 'Rerank：把 50 条压到 5 条，救回被埋掉的那条',
      checkpoint: '既然已经有 RRF 排序了，为什么还要再花钱跑一次 rerank？',
      blocks: [
        {
          type: 'p',
          text: '前面所有检索都是**双塔（bi-encoder）**结构：文档和查询各自独立编码成向量，然后比距离。这个结构快（文档向量可以离线算好），但有个本质缺陷：**文档编码时不知道你要问什么**。',
        },
        {
          type: 'table',
          head: ['', 'Bi-encoder（召回）', 'Cross-encoder（重排）'],
          rows: [
            ['输入', '查询、文档分别编码', '查询和文档拼在一起送进模型'],
            ['能否离线算', '能，文档向量预计算', '不能，每次查询都要现场算'],
            ['速度', '毫秒级（ANN 索引）', '50 条约 100~500ms'],
            ['精度', '中，语义粗匹配', '高，能判断"是否真的回答了问题"'],
            ['用途', '从百万文档里捞出 50 条', '从 50 条里挑出 5 条'],
          ],
        },
        {
          type: 'p',
          text: '所以标准链路是**两段式**：召回负责"别漏"（recall 优先，多捞一些），重排负责"排准"（precision 优先，精挑）。**召回 50 条、重排留 5 条**是最常见的配置。',
        },
        {
          type: 'flow',
          title: '完整检索链路',
          ascii: `用户问题
   │
   ├──► 向量检索 top-50 ──┐
   │                      ├──► RRF 融合 ──► top-50 ──► Rerank ──► top-5
   └──► 关键词检索 top-50 ┘                                    │
                                                              ▼
                                                    拼进 prompt（带出处）
                                                              │
                                                              ▼
                                                          模型生成
                                                              │
                                                              ▼
                                              校验引用 → 输出 / 拒答`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '什么时候不该上 rerank',
          text: '如果召回结果只有 5~10 条，或者你的场景对延迟极敏感（比如输入联想），rerank 的收益抵不上延迟。另外 rerank 模型也有语言偏向，中文场景要实测，不能拿英文 benchmark 的结论直接用。',
        },
        {
          type: 'p',
          text: '一个容易忽略的收益：rerank 的分数**可以用来做拒答判断**。如果 top-1 的 rerank 分数低于阈值，说明"库里没有相关内容"，这时候应该拒答而不是硬答。这比让模型自己说"我不知道"可靠得多——模型的自我认知很差。',
        },
      ],
    },

    {
      id: 's6',
      title: '召回率怎么测：把"答错了"拆成两种病',
      checkpoint: '用户说"答得不对"，你怎么在 5 分钟内判断是检索的问题还是生成的问题？',
      blocks: [
        {
          type: 'p',
          text: '这是本课最重要的工程习惯：**RAG 出错只有两种原因，必须分开归因，否则你会一直在错误的环节上优化。**',
        },
        {
          type: 'table',
          head: ['故障', '判定方法', '表现', '该改哪里'],
          rows: [
            ['检索失败', '正确文档不在 top-k 里', '答案完全跑偏、答非所问', '切分、embedding、混合检索、rerank'],
            ['生成失败', '正确文档在 top-k 里，但答案错', '答案部分对、漏了条件、编了细节', 'prompt、上下文排序、模型能力'],
            ['双重失败', '文档没搜到，模型还编了一个', '听起来很合理但是假的', '先修检索，再看生成'],
          ],
        },
        {
          type: 'p',
          text: '衡量检索的指标叫 **Recall@k**：对每个测试问题，标好"哪几个 chunk 是能回答它的"，然后看这些 chunk 有多少比例出现在 top-k 里。',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'Recall@k 与 MRR 的最小实现',
          note: '别一上来就搭评测平台。20 条问题、手标正确 chunk id、一个 40 行的脚本，就能让你看清 80% 的问题。',
          code: `type Case = {
  question: string
  goldChunkIds: string[]   // 人工标注：哪些块能回答这个问题
}

function recallAtK(cases: Case[], retrieve: (q: string, k: number) => Promise<string[]>, k: number) {
  return Promise.all(
    cases.map(async (c) => {
      const got = new Set(await retrieve(c.question, k))
      const hit = c.goldChunkIds.filter((id) => got.has(id)).length
      return hit / c.goldChunkIds.length
    }),
  ).then((xs) => xs.reduce((a, b) => a + b, 0) / xs.length)
}

/** MRR：第一个正确结果排在第几位的倒数，衡量"排得准不准" */
function mrr(cases: Case[], retrieve: (q: string, k: number) => Promise<string[]>) {
  return Promise.all(
    cases.map(async (c) => {
      const got = await retrieve(c.question, 10)
      const idx = got.findIndex((id) => c.goldChunkIds.includes(id))
      return idx === -1 ? 0 : 1 / (idx + 1)
    }),
  ).then((xs) => xs.reduce((a, b) => a + b, 0) / xs.length)
}`,
        },
        {
          type: 'callout',
          tone: 'info',
          title: '目标定多少',
          text: 'Recall@10 低于 0.7 说明检索链路有结构性问题（切分或 embedding），先别优化生成。0.85 以上通常够用。MRR 低于 0.5 说明排序不行，该上 rerank。**这些数字要跟改动前比，绝对值的意义有限。**',
        },
        {
          type: 'qa',
          q: '标注 20 条问题要花多久？值得吗？',
          a: '熟练后 1~2 小时。值得，而且是本课性价比最高的投入：没有这 20 条，你改切分策略、换 embedding 模型、加 rerank 全都只能靠"感觉好像好一点"。有这 20 条，每次改动跑一遍，数字上升就是真好，下降就是真坏。**这就是"可复现"和"碰运气"的分界线。**',
        },
      ],
    },

    {
      id: 's7',
      title: '权限过滤：必须在检索时就做，不能事后过滤',
      checkpoint: '为什么"先检索 top-50，再在代码里过滤掉无权访问的文档"是错的？',
      blocks: [
        {
          type: 'p',
          text: '这是 RAG 系统最常见、后果最严重的安全漏洞。错误做法长这样：',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '❌ 错误：先召回再过滤',
          code: `// 看起来很合理，实际有两个致命问题
const hits = await vectorSearch(query, 50)          // 全库搜
const allowed = hits.filter((h) => canRead(userId, h.docId))
const context = allowed.slice(0, 5)

// 问题 1：如果这个用户只能看 10% 的文档，
//         top-50 里可能只有 2 条是他能看的 —— 剩下 48 条白白占用了名额，
//         真正的答案根本没被召回。这不是安全问题，是效果问题，但一样致命。
//
// 问题 2：top-50 里那 48 条无权文档，已经进了你的进程内存、
//         进了日志、可能进了 trace。审计时这就是"越权读取"。`,
        },
        {
          type: 'p',
          text: '正确做法是**把权限条件变成检索的 where 子句**，让数据库在扫描时就排除掉无权数据：',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '✅ 正确：权限进 SQL',
          code: `async function vectorSearch(query: string, userId: string, limit: number) {
  const emb = await embed(query)
  const { rows } = await db.query(
    \`SELECT c.id, c.content, c.heading_path,
            c.embedding <=> $1 AS distance
       FROM chunks c
       JOIN documents d ON d.id = c.doc_id
      WHERE c.tenant_id = $2                    -- 租户隔离
        AND (
              d.owner_id = $3                    -- 自己的
           OR EXISTS (                           -- 或通过授权表共享的
                SELECT 1 FROM doc_acl a
                 WHERE a.doc_id = d.id
                   AND a.user_id = $3
                   AND a.can_read = true
              )
            )
        AND c.embedding <=> $1 < 0.35            -- 距离阈值，顺便过滤噪声
      ORDER BY c.embedding <=> $1
      LIMIT $4\`,
    [emb, tenantId, userId, limit],
  )
  return rows
}`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '三个必须记住的规则',
          text: '① **权限过滤一定要在数据库层**，不能靠应用层 filter；② **租户 id 不能来自请求体**，只能来自服务端解出的身份，否则用户改个字段就能跨租户检索；③ **缓存 key 必须包含用户身份或权限版本**，否则 A 的检索结果会被 B 命中，这是缓存型越权。',
        },
        {
          type: 'p',
          text: '还有一层容易漏：**生成阶段的引用展示**。如果 prompt 里放了 5 条材料，其中一条是用户无权看的（比如因为上面的 bug 混进来的），模型会在回答里复述它的内容。所以"过滤"必须发生在材料进入 prompt 之前，而不是在展示引用时。',
        },
      ],
    },

    {
      id: 's8',
      title: '增量索引与拒答：让系统知道自己不知道',
      checkpoint: '文档更新了，你怎么保证索引里的旧版本不会继续被检索到？',
      blocks: [
        {
          type: 'p',
          text: 'demo 阶段的 RAG 是"全量重建索引"，生产阶段必须解决三件事：**更新、删除、幂等**。',
        },
        {
          type: 'table',
          head: ['操作', '错误做法', '正确做法'],
          rows: [
            ['文档更新', '再插入一份新 chunk', 'chunk id 由 (docId, 块序号, 内容hash) 决定，用 upsert'],
            ['文档删除', '只删 documents 表', 'ON DELETE CASCADE 连带删 chunks，或软删 + 检索时过滤'],
            ['重复消费', '消息重投导致重复索引', '以 content hash 为幂等键，hash 未变则跳过'],
            ['部分失败', '整个文档索引失败就丢弃', '按块记录状态，失败块可重试'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '幂等增量索引',
          note: 'contentHash 是关键：同一份文档被重复推送时，hash 不变就完全跳过 embedding 调用，省钱又避免抖动。',
          code: `import { createHash } from 'node:crypto'

async function indexDocument(docId: string, content: string) {
  const chunks = splitByHeading(content, docId)

  for (const [i, chunk] of chunks.entries()) {
    const contentHash = createHash('sha256').update(chunk.text).digest('hex')

    const existing = await db.query(
      'SELECT id, content_hash FROM chunks WHERE doc_id = $1 AND ord = $2',
      [docId, i],
    )

    if (existing.rows[0]?.content_hash === contentHash) continue // 没变，跳过

    const emb = await embed(chunk.text)
    await db.query(
      \`INSERT INTO chunks (doc_id, ord, content, heading_path, content_hash, embedding, tsv, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, to_tsvector('simple', $3), now())
       ON CONFLICT (doc_id, ord) DO UPDATE
         SET content = EXCLUDED.content,
             embedding = EXCLUDED.embedding,
             content_hash = EXCLUDED.content_hash,
             tsv = EXCLUDED.tsv,
             updated_at = now()\`,
      [docId, i, chunk.text, chunk.headingPath, contentHash, emb],
    )
  }

  // 文档变短了：删掉多余的尾部块
  await db.query('DELETE FROM chunks WHERE doc_id = $1 AND ord >= $2', [docId, chunks.length])
}`,
        },
        {
          type: 'h',
          text: '拒答：比答对更重要的能力',
        },
        {
          type: 'p',
          text: '一个 RAG 系统在知识库覆盖不到的问题上**编答案**，比它答不出来糟糕十倍——因为用户无法分辨。拒答要设计成三层：',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            '**检索层**：top-1 的 rerank 分数低于阈值（比如 0.3）→ 直接返回"知识库里没有相关内容"，不进模型。这是最便宜也最可靠的一层。',
            '**Prompt 层**：明确给出退路——"如果材料中没有直接依据，回答『根据现有资料无法回答』，不要推测"。不给退路，模型就会编。',
            '**校验层**：检查输出里引用的 chunk id 是否真实存在于本次材料中。引用了不存在的 id，说明在编。',
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '拒答率是健康指标，不是失败指标',
          text: '上线后要监控拒答率。**拒答率突然升高**通常是索引坏了或 embedding 服务异常；**拒答率长期为 0** 反而是危险信号——说明阈值形同虚设，系统在硬答所有问题。健康区间通常 5%~15%，取决于知识库覆盖度。',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '切分策略选择',
      points: 10,
      prompt: '你有一份 200 页的产品手册（Markdown 格式，有完整的多级标题），要做客服问答。下面哪种切分方式最合适？',
      options: [
        { id: 'a', text: '每 500 字符切一刀，重叠 50 字符' },
        { id: 'b', text: '按标题层级切分，把标题路径拼进块文本，超长块再按段落二次切分' },
        { id: 'c', text: '整份手册作为一个块，靠长上下文模型硬吃' },
        { id: 'd', text: '按句子切，每句一个块，保证精度最高' },
      ],
      answer: ['b'],
      hints: [
        '先想：这份文档最宝贵的结构信息是什么？',
        'Markdown 的多级标题本身就是作者划好的语义边界。用现成的结构，比用字数猜边界可靠。',
        '按标题切 → 每块语义完整；拼标题路径 → 块自带上下文，embedding 更准；超长块二次切 → 防止单块过大。a 会切断语义和表格，c 会撑爆上下文且引入 lost-in-the-middle，d 粒度太细，一句话往往答不全一个问题。',
      ],
      explanation: '正确答案是 b。文档自带的结构是最可靠的语义边界，按结构切是成本最低、效果最稳的做法。',
      approach: [
        '看文档有没有可靠的结构（标题、段落、列表）',
        '有结构就按结构切，并把层级路径写进块文本',
        '对超长块做二次切分，对过短块做合并',
        '把原文位置（页码/段落号）存进 metadata，供"查看原文"用',
      ],
      knowledge: ['切分策略', 'metadata 设计', '上下文完整性'],
      pitfalls: [
        '迷信"最佳块大小"这类通用数字，不看文档结构',
        '忘记保留标题路径，导致块失去上下文',
        '不保留原文位置，用户无法验证答案',
      ],
    },
    {
      id: 'e2',
      type: 'multi',
      title: '哪些环节是 RAG 的必要组成',
      points: 15,
      prompt: '下面哪些属于一个**可上线的** RAG 系统的必要环节？（多选）',
      options: [
        { id: 'a', text: '权限过滤下沉到检索的 where 条件里' },
        { id: 'b', text: '同时跑向量检索和关键词检索，用 RRF 融合' },
        { id: 'c', text: '有一个标注了正确 chunk 的测试集，能算 Recall@k' },
        { id: 'd', text: '把知识库全部内容拼进系统提示，让模型自己找' },
        { id: 'e', text: '低分时拒答，而不是让模型硬答' },
      ],
      answer: ['a', 'c', 'e'],
      hints: [
        '区分"必要"和"有效但可选"。',
        '混合检索和 rerank 是效果优化，不是所有场景都必须；但权限、可测量、拒答这三件事缺一个就上不了线。',
        'a 缺了就是越权漏洞；c 缺了你就无法判断改动是变好还是变坏；e 缺了系统会在不知道时编答案。b 是优化项（小知识库单路就够），d 是反模式（成本、延迟、lost-in-the-middle 三重问题）。',
      ],
      explanation: 'a、c、e 是必要项。b 是效果优化项，视规模决定；d 是明确的反模式。',
      approach: [
        '先问：不做这件事会不会出安全事故？（权限）',
        '再问：不做这件事我能不能判断系统好坏？（评测集）',
        '再问：不知道的时候系统会不会骗人？（拒答）',
        '剩下的都是"做了更好"，按 ROI 排优先级',
      ],
      knowledge: ['权限下沉', 'Recall@k', '拒答策略', '混合检索'],
      pitfalls: [
        '把"效果优化项"当成"必要项"，一上来就堆复杂架构',
        '认为"知识库不大所以不用权限过滤"——权限和大小无关',
      ],
    },
    {
      id: 'e3',
      type: 'fill',
      title: '手算一次 RRF',
      points: 15,
      prompt: '向量检索返回 `[A, B, C]`（A 第 1），关键词检索返回 `[C, A, D]`（C 第 1）。取 k=60，算出每个文档的 RRF 分数并排序。',
      templateLang: 'text',
      template: `score(A) = 1/(60+{{a1}}) + 1/(60+{{a2}}) = {{a3}}
score(B) = 1/(60+{{b1}})                        = {{b2}}
score(C) = 1/(60+{{c1}}) + 1/(60+{{c2}})        = {{c3}}
score(D) = 1/(60+{{d1}})                        = {{d2}}

排序（从高到低）：{{order}}`,
      blanks: [
        { id: 'a1', label: 'A 在向量里的排名', accept: ['1'], width: 40 },
        { id: 'a2', label: 'A 在关键词里的排名', accept: ['2'], width: 40 },
        { id: 'a3', label: 'score(A) 约等于（保留 5 位小数）', accept: ['0.03252', '0.0325', '0.033'], width: 90 },
        { id: 'b1', label: 'B 在向量里的排名', accept: ['2'], width: 40 },
        { id: 'b2', label: 'score(B)', accept: ['0.01613', '0.0161', '0.016'], width: 80 },
        { id: 'c1', label: 'C 在向量里的排名', accept: ['3'], width: 40 },
        { id: 'c2', label: 'C 在关键词里的排名', accept: ['1'], width: 40 },
        { id: 'c3', label: 'score(C)', accept: ['0.03227', '0.0323', '0.032'], width: 80 },
        { id: 'd1', label: 'D 在关键词里的排名', accept: ['3'], width: 40 },
        { id: 'd2', label: 'score(D)', accept: ['0.01587', '0.0159', '0.016'], width: 80 },
        { id: 'order', label: '最终顺序', accept: ['a c b d', 'a,c,b,d', 'acbd', 'a > c > b > d', 'a>c>b>d'], width: 140 },
      ],
      hints: [
        '公式是 1/(k + rank)，rank 从 1 开始，不是从 0。',
        '两路都出现的文档会拿到两次加分，这就是 RRF 奖励"共识"的机制。',
        'A: 1/61 + 1/62 = 0.016393 + 0.016129 = 0.032522。B: 1/62 = 0.016129。C: 1/63 + 1/61 = 0.015873 + 0.016393 = 0.032266。D: 1/63 = 0.015873。排序是 A > C > B > D。注意 A 和 C 咬得很紧（差 0.0003）——因为它们各拿了一个第 1 名，只是 A 的第二个名次更靠前。',
      ],
      explanation: '答案：A(0.03252) > C(0.03227) > B(0.01613) > D(0.01587)。A 和 C 都是"两路都出现"，但 A 是 1 名 + 2 名，C 是 3 名 + 1 名，所以 A 略胜。B 和 D 只出现在一路，分数只有前者的一半左右——这就是 RRF 奖励共识的效果。',
      approach: [
        '对每个文档，找出它在每一路的排名（没出现就不加分）',
        '套 1/(60+rank) 累加',
        '按总分降序排列',
        '观察：两路都靠前的文档胜出，单路冠军未必赢',
      ],
      knowledge: ['RRF', '混合检索', '排名融合'],
      pitfalls: [
        'rank 从 0 开始算（应该是 1）',
        '把两路分数归一化后相加（那是另一种方法，不是 RRF）',
      ],
    },
    {
      id: 'e4',
      type: 'code',
      title: '实现 RRF 融合',
      points: 20,
      prompt: '实现 `rrf(rankings, k)`：`rankings` 是多路召回结果，每个元素是按相关度降序排列的 id 数组。返回 `[{ id, score }]`，按 score 降序；score 相同时按 id 字典序升序（保证结果稳定可测）。',
      starter: `function rrf(rankings, k = 60) {
  // TODO: 累加 1/(k + rank)，rank 从 1 开始
  return []
}

return rrf`,
      checks: [
        { name: '两路都靠前的文档排第一', expr: "result([['a','b'],['b','c']])[0].id === 'b'" },
        { name: '分数是两路倒数之和', expr: "Math.abs(result([['a','b'],['b','c']])[0].score - (1/61 + 1/62)) < 1e-9" },
        { name: '只出现一路也能算', expr: "result([['x','y']]).length === 2 && Math.abs(result([['x','y']])[1].score - 1/62) < 1e-9" },
        { name: 'k 参数生效', expr: "Math.abs(result([['x']], 0)[0].score - 1) < 1e-9" },
        { name: '空路不影响结果', expr: "result([[], ['y']])[0].id === 'y' && result([[], ['y']]).length === 1" },
        { name: '同分按 id 升序', expr: "(() => { const r = result([['b'],['a']]); return r[0].id === 'a' && r[1].id === 'b' })()" },
      ],
      solution: `function rrf(rankings, k = 60) {
  const scores = new Map()
  for (const list of rankings) {
    list.forEach((id, i) => {
      scores.set(id, (scores.get(id) || 0) + 1 / (k + i + 1))
    })
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}`,
      hints: [
        '用一个 Map 累积分数，key 是 id。',
        '`list.forEach((id, i) => ...)` 里的 i 从 0 开始，而排名从 1 开始，所以是 `k + i + 1`。',
        '完整实现：Map 累加 → 转成数组 → 按 score 降序排，score 相同时用 id 比较。注意 `b.score - a.score` 对浮点数有精度问题，但这里差值足够大，可以用；更严格的做法是 `Math.abs(diff) < 1e-12 ? idCompare : diff`。',
      ],
      explanation: 'RRF 的关键只有两点：排名从 1 开始、只累加倒数不碰原始分数。用 Map 累加天然处理了"某文档只在一路出现"的情况。',
      approach: [
        '建一个 Map<id, score>',
        '遍历每一路，对每个 id 累加 1/(k + 位置 + 1)',
        '转成数组并按分数降序',
        '同分时按 id 排序，保证输出确定（可测试、可复现）',
      ],
      knowledge: ['RRF', 'Map 累加', '排序稳定性'],
      pitfalls: [
        '用 `k + i` 而不是 `k + i + 1`（排名偏了一位）',
        '把原始分数也加进去（那就不是 RRF 了）',
        '不处理同分，导致同一份输入两次运行结果不同',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 15,
    questions: [
      {
        id: 'q1',
        stem: 'RAG 系统回答错误，你第一步应该做什么？',
        options: [
          { id: 'a', text: '换一个更强的模型' },
          { id: 'b', text: '把 prompt 写得更严格' },
          { id: 'c', text: '检查正确文档是否出现在召回结果里' },
          { id: 'd', text: '增加更多知识库文档' },
        ],
        answer: 'c',
        why: 'RAG 出错先归因：没搜到还是搜到了没答对。前者占多数，且换模型、改 prompt 都救不了。',
        stepId: 's6',
      },
      {
        id: 'q2',
        stem: '用户搜"XR-2000A 的保修期"，纯向量检索经常搜不到正确文档。最可能的原因和最佳修法是？',
        options: [
          { id: 'a', text: 'embedding 模型太小 → 换更大的模型' },
          { id: 'b', text: '型号是无语义的罕见字符串，embedding 会稀释它 → 加关键词检索做混合召回' },
          { id: 'c', text: '文档切分太碎 → 增大块大小' },
          { id: 'd', text: '模型不知道这个型号 → 微调模型' },
        ],
        answer: 'b',
        why: '精确字符串（型号、错误码、订单号）是 embedding 的天然盲区，靠语义向量救不回来。关键词检索（BM25）正是为此存在，混合召回才是解法。',
        stepId: 's3',
      },
      {
        id: 'q3',
        stem: 'RRF 相比"归一化后加权求和"的核心优势是什么？',
        options: [
          { id: 'a', text: '计算更快' },
          { id: 'b', text: '只看排名不看分数，免疫不同检索器的量纲差异，且没有需要调的权重' },
          { id: 'c', text: '能提升单路检索的召回率' },
          { id: 'd', text: '不需要向量数据库' },
        ],
        answer: 'b',
        why: 'RRF 的设计动机就是绕开"分数不可比"这个坑。它不提升单路召回，只做融合。',
        stepId: 's4',
      },
      {
        id: 'q4',
        stem: '为什么"先检索 top-50，再在应用层过滤掉无权文档"是错的？',
        options: [
          { id: 'a', text: '性能太差' },
          { id: 'b', text: '会让有权文档占不满名额，导致真正能答的内容根本没被召回；且无权数据已经进了进程和日志' },
          { id: 'c', text: '过滤逻辑太复杂' },
          { id: 'd', text: '只要过滤了就没错' },
        ],
        answer: 'b',
        why: '这是双重问题：效果上召回名额被浪费，安全上无权数据已被读取。权限必须是检索的 where 条件，不是事后过滤器。',
        stepId: 's7',
      },
      {
        id: 'q5',
        stem: 'cross-encoder 重排为什么不能用来做第一轮召回？',
        options: [
          { id: 'a', text: '精度不够' },
          { id: 'b', text: '它需要把查询和文档拼在一起现场计算，无法预计算文档向量，百万级文档跑不动' },
          { id: 'c', text: '不支持中文' },
          { id: 'd', text: '需要 GPU' },
        ],
        answer: 'b',
        why: 'cross-encoder 精度更高但成本也更高：每次查询都要为每个候选文档跑一次前向。所以它只能用在"少量候选重排"这一环。',
        stepId: 's5',
      },
      {
        id: 'q6',
        stem: '你的 RAG 上线后拒答率长期为 0.2%。这意味着什么？',
        options: [
          { id: 'a', text: '系统非常健康，几乎什么都能答' },
          { id: 'b', text: '可能是拒答阈值形同虚设，系统在硬答覆盖不到的问题' },
          { id: 'c', text: '知识库需要扩充' },
          { id: 'd', text: '模型太强了' },
        ],
        answer: 'b',
        why: '真实知识库不可能覆盖 99.8% 的问题。拒答率接近 0 通常说明阈值太低或 prompt 没给退路，系统正在编答案。',
        stepId: 's8',
      },
      {
        id: 'q7',
        stem: '文档更新后，怎样避免旧版本的 chunk 继续被检索到？',
        options: [
          { id: 'a', text: '每次更新都全量重建索引' },
          { id: 'b', text: 'chunk 用 (doc_id, ord) 做唯一键，内容 hash 未变则跳过，变了就 upsert，文档变短时删掉多余尾部块' },
          { id: 'c', text: '在检索时按 updated_at 过滤' },
          { id: 'd', text: '让模型自己判断哪个版本新' },
        ],
        answer: 'b',
        why: '关键是幂等：唯一键 + 内容 hash。全量重建成本高且会造成服务抖动；让模型判断版本是不可靠的。',
        stepId: 's8',
      },
      {
        id: 'q8',
        stem: '用户问"这个产品支持 Windows 吗"，文档里既有"支持 Windows"也有"不支持 Windows 7"。纯向量检索最容易犯什么错？',
        options: [
          { id: 'a', text: '搜不到任何文档' },
          { id: 'b', text: '把否定段落当成肯定段落召回，因为 embedding 对否定不敏感' },
          { id: 'c', text: '返回太多结果' },
          { id: 'd', text: '把中文当成英文' },
        ],
        answer: 'b',
        why: '"支持"和"不支持"在向量空间里几乎重合。这类"是否/有无"查询必须靠关键词检索和 rerank 兜底，这是 embedding 的结构性缺陷。',
        stepId: 's3',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统：检索链路',
    contributes:
      '这一课把项目从"能调模型"推进到"能查资料"。产出物是一个可测量 Recall@k 的检索服务，后面的评测课、可观测课都会拿它当被测对象。',
    tasks: [
      '选 20 份真实文档（产品手册/内部 wiki/合同都行），按标题结构切分并入库',
      '建 pgvector 表 + HNSW 索引 + tsvector 索引，实现向量与关键词双路召回',
      '实现 RRF 融合，再接入一个 rerank 模型，把 top-50 压到 top-5',
      '手工标注 20 个问题及其正确 chunk，跑出 Recall@10 和 MRR 基线数字',
      '把权限过滤写进 SQL 的 where 条件，并用两个不同权限的账号验证不会越权召回',
      '实现幂等增量索引：重复推送同一文档不产生重复块、不重复调 embedding',
      '加拒答：top-1 rerank 分数低于阈值时直接返回"资料中没有相关内容"',
    ],
    done: '能报出"Recall@10 = 0.86，MRR = 0.61"这样的数字；把块大小从 800 调到 500 后重跑，能看到数字上升或下降；换一个低权限账号检索，返回结果里没有一条他无权看的文档。',
  },

  further: [
    { text: 'pgvector 官方 README · HNSW 参数与算子选择' },
    { text: '论文 · Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods' },
    { text: 'Anthropic · Contextual Retrieval（把上下文注入块文本的做法）' },
    { text: '知识地图 03 RAG 检索增强（/guide/03-rag）' },
  ],
}
