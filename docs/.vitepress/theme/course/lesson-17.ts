import type { Lesson } from './types'

/**
 * 第十七课：推理与部署
 *
 * 核心立场：模型不是黑盒，它有明确的显存账本和时间账本。
 * 算不清这两笔账，就没法做容量规划，也没法判断该自建还是用 API。
 */
export const lesson17: Lesson = {
  id: 'L17',
  moduleId: 'infer',
  order: 17,
  path: '/learn/17-inference',
  title: '推理与部署：算清显存、延迟和吞吐这三笔账',
  subtitle: '为什么同样 4000 token，第一个字要等 800ms，后面却越吐越快？',
  minutes: 70,
  level: '进阶',
  outcome: '能算清一个模型的显存占用、首字延迟和吞吐上限，并据此判断自建还是用 API。',
  goals: [
    '拆解一次推理的时间：prefill 与 decode 的本质差异',
    '用公式算出权重、KV cache、激活各占多少显存',
    '理解连续批处理为什么能把吞吐提高一个数量级',
    '判断量化到什么程度还能接受，以及怎么验证',
    '在 vLLM / SGLang / llama.cpp / 云 API 之间做出选择',
    '做一份能落地的容量规划',
  ],
  prereqs: [
    '学过第五课，理解 token 与上下文窗口',
    '学过第十二课，会算并发和容量',
    '了解 GPU 显存的基本概念（不清楚也行，这一课会讲）',
  ],

  steps: [
    {
      id: 's1',
      title: '一次推理的两个阶段，本质完全不同',
      checkpoint: '为什么输出 100 个 token 比输入 100 个 token 慢得多？',
      blocks: [
        {
          type: 'p',
          text: '很多人以为"处理 token"是均匀的。实际上推理分两个阶段，计算模式完全不同：',
        },
        {
          type: 'flow',
          title: 'Prefill 与 Decode',
          ascii: `【Prefill：处理输入】并行，一次算完
输入 "请总结这段文字：..." （3812 token）
   │
   ▼
一次性把所有 token 送进模型 → 产出第一个 token
耗时 ≈ 输入长度 × 每 token 成本，但可以并行
→ 这就是 TTFT（Time To First Token）

【Decode：生成输出】串行，一个一个来
第 1 个 token → 第 2 个 token → ... → 第 402 个 token
每个都要完整跑一遍模型
耗时 ≈ 输出长度 × 每 token 成本
→ 每 token 时间叫 TPOT（Time Per Output Token）

总延迟 = TTFT + TPOT × 输出长度`,
        },
        {
          type: 'table',
          head: ['', 'Prefill', 'Decode'],
          rows: [
            ['计算模式', '矩阵乘矩阵（大 GEMM）', '矩阵乘向量（小 GEMV）'],
            ['并行度', '高，所有输入 token 同时算', '低，一次只能出一个'],
            ['瓶颈', '算力（FLOPS）', '**显存带宽**（要把权重全读一遍）'],
            ['GPU 利用率', '高（70%+）', '低（常低于 20%）'],
            ['可优化', '前缀缓存、更快的注意力', '批处理（把多个请求拼一起）'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '这解释了三件事',
          text: '① **为什么输出比输入贵 2~4 倍**——decode 阶段 GPU 大量空转，只能靠"多请求一起跑"摊薄；② **为什么流式输出体感快**——TTFT 才是用户感知的"开始回答"，后面是匀速吐；③ **为什么"缩短输出"比"缩短输入"更能降延迟**——输出是串行的，少 100 个 token 就少 100 次完整前向。',
        },
        {
          type: 'p',
          text: '还有一个反直觉的点：**输入很长时，TTFT 会显著上升，但 TPOT 基本不变**。所以"长上下文"的代价主要体现在首字延迟上。如果你的产品是"上传 50 页文档然后对话"，用户会明显感觉"第一次回答要等很久，后面就快了"。',
        },
      ],
    },

    {
      id: 's2',
      title: '显存账本：三块，缺一不可',
      checkpoint: '一个 70B 模型用 FP16 加载，光权重就要多少显存？',
      blocks: [
        {
          type: 'p',
          text: '显存不是"模型多大就占多大"。三块加起来才是真实占用：',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '显存计算',
          code: `// 1. 权重：参数量 × 每参数字节数
//    FP16 = 2 字节，INT8 = 1 字节，INT4 = 0.5 字节
const weightGB = (params: number, bytesPerParam: number) =>
  (params * bytesPerParam) / 1e9

weightGB(70e9, 2)   // 140 GB   ← 单卡 80G 装不下，需要多卡

// 2. KV cache：推理时每个 token 的键值对
//    2（K 和 V）× 层数 × KV 头数 × 头维度 × 序列长度 × 批大小 × 字节数
const kvCacheGB = (
  layers: number, kvHeads: number, headDim: number,
  seqLen: number, batch: number, bytes = 2,
) => (2 * layers * kvHeads * headDim * seqLen * batch * bytes) / 1e9

// Llama-3-70B：80 层，8 个 KV 头（GQA），头维度 128
kvCacheGB(80, 8, 128, 8192, 1)     // 1.34 GB / 请求
kvCacheGB(80, 8, 128, 8192, 32)    // 42.9 GB ← 32 并发就吃掉 43G！

// 3. 激活 + 框架开销：通常留 10~20%
//    实际可用 = 总显存 - 权重 - KV cache - 开销`,
        },
        {
          type: 'table',
          head: ['模型', '参数量', 'FP16 权重', 'INT8 权重', 'INT4 权重'],
          rows: [
            ['7B', '7e9', '14 GB', '7 GB', '3.5 GB'],
            ['13B', '13e9', '26 GB', '13 GB', '6.5 GB'],
            ['32B', '32e9', '64 GB', '32 GB', '16 GB'],
            ['70B', '70e9', '140 GB', '70 GB', '35 GB'],
            ['405B', '405e9', '810 GB', '405 GB', '203 GB'],
          ],
        },
        {
          type: 'callout',
          tone: 'danger',
          title: 'KV cache 是最容易被低估的那块',
          text: '很多人算完权重觉得"80G 卡够用了"，上线后发现只能跑 2 个并发。因为 **KV cache 随"序列长度 × 批大小"线性增长**。8K 上下文、32 并发，一个 70B 模型就要 43G 的 KV cache。**容量规划必须算这一块，否则会做出"能加载但跑不动"的系统。**',
        },
        {
          type: 'p',
          text: '几个能省 KV cache 的技术，值得知道名字：**GQA/MQA**（减少 KV 头数，Llama-3 就是 8 个 KV 头而非 64 个，省 8 倍）、**PagedAttention**（像操作系统分页一样管理 KV cache，减少碎片，vLLM 的核心创新）、**KV cache 量化**（FP16 → INT8，省一半，质量损失很小）。',
        },
      ],
    },

    {
      id: 's3',
      title: '批处理：decode 阶段唯一的救星',
      checkpoint: '为什么把 32 个请求一起跑，吞吐能提高 10 倍但单请求延迟只增加一点？',
      blocks: [
        {
          type: 'p',
          text: 'decode 阶段 GPU 在"等显存带宽"，算力大量闲置。批处理就是把多个请求的权重读取**合并成一次**——同一份权重读一遍，服务 32 个请求，带宽利用率提升 32 倍。',
        },
        {
          type: 'table',
          head: ['方式', '做法', '问题'],
          rows: [
            ['无批处理', '一次一个请求', 'GPU 利用率 < 20%，吞吐极低'],
            ['静态批处理', '攒够 N 个一起跑，全跑完才接下一批', '短请求被长请求拖住（队头阻塞）'],
            ['连续批处理', '每生成一个 token 就检查有没有新请求/已完成的', '实现复杂，但吞吐和延迟都好'],
          ],
        },
        {
          type: 'flow',
          title: '连续批处理（Continuous Batching）',
          ascii: `时间 →
静态批处理：
  [A(需 20 tok)][B(需 200 tok)][C(需 30 tok)] 一起开始
  A 完成 ────────────────┐ 但位置被占着，新请求进不来
  C 完成 ──────────────────┤
  B 完成 ──────────────────────────────────┘  总耗时 = 最长的那个

连续批处理：
  [A][B][C] 开始
  A 完成 → 立刻让 D 补进来
  C 完成 → 立刻让 E 补进来
  B 完成 → 立刻让 F 补进来
  总耗时 ≈ 总 token 数 / 吞吐，没有空等`,
        },
        {
          type: 'callout',
          tone: 'info',
          title: '吞吐与延迟的权衡',
          text: '批越大，吞吐越高，但**单请求延迟也越高**（因为每轮要算更多）。这个权衡有个甜点：通常批大小在 16~64 之间，吞吐能到峰值的 80%，而 TPOT 只增加 20~40%。**超过这个范围，延迟涨得比吞吐快。** 具体数值要看模型和硬件，必须实测。',
        },
        {
          type: 'p',
          text: '还有一个实践细节：**长请求会拖累整批**。一个需要生成 4000 token 的请求，会让同批其他请求多等很久。做法是**按预估输出长度分池**——短回答走一个池（低延迟优先），长生成走另一个池（吞吐优先）。云厂商的 API 内部通常就这么做。',
        },
      ],
    },

    {
      id: 's4',
      title: '量化：省一半显存，损失多少质量',
      checkpoint: 'INT4 量化后模型明显变笨，最可能的原因是什么？',
      blocks: [
        {
          type: 'table',
          head: ['精度', '每参数字节', '70B 权重', '质量损失', '适合'],
          rows: [
            ['FP16/BF16', '2', '140 GB', '基线', '生产环境默认'],
            ['FP8', '1', '70 GB', '很小（<1%）', '新卡首选，几乎无损'],
            ['INT8', '1', '70 GB', '小（1~2%）', '成熟方案，广泛可用'],
            ['INT4 (GPTQ/AWQ)', '0.5', '35 GB', '中（2~5%）', '显存紧张、对质量不极敏感'],
            ['INT4 (激进)', '0.5', '35 GB', '大（5~15%）', '只在演示/个人使用'],
          ],
        },
        {
          type: 'p',
          text: '量化不是"数字越小越好"。两个关键区分：',
        },
        {
          type: 'list',
          items: [
            '**权重量化 vs 激活量化**：只量化权重（W4A16）损失小；连激活一起量化（W4A4）损失大得多。多数"INT4 模型"是前者。',
            '**量化算法**：GPTQ / AWQ 会做"校准"（用一批样本调整量化参数），比朴素的 round-to-nearest 好很多。**同一个 INT4，不同算法的质量能差一倍。**',
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '量化后必须验证的三件事',
          code: `// 1. 通用能力没崩（用你的评测集，不是公开 benchmark）
const base = await evalSuite(model, 'golden-50')
const quant = await evalSuite(quantModel, 'golden-50')
assert(quant.passRate >= base.passRate - 0.03)   // 掉 3 个点以内可接受

// 2. 长上下文没崩（量化对长序列的影响更大）
const longCtx = await evalSuite(quantModel, 'long-context-20')
assert(longCtx.passRate >= 0.8)

// 3. 结构化输出没崩（最容易出问题的地方）
const jsonOk = await testStructuredOutput(quantModel, 50)
assert(jsonOk.validRate >= 0.98)`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '量化最容易破坏的两件事',
          text: '① **结构化输出（JSON / 工具调用参数）**——精度下降会让模型"漏一个括号"或"多一个逗号"，格式合规率从 99% 掉到 90%；② **长上下文的中间部分**——"lost in the middle"在量化后会加重。所以量化后**必须重跑这两项的评测**，不能只看通用问答。',
        },
      ],
    },

    {
      id: 's5',
      title: '引擎选型：五个选项，五个场景',
      checkpoint: '你要在本机跑一个 7B 模型做离线批处理，该用什么？',
      blocks: [
        {
          type: 'table',
          head: ['引擎', '特点', '适合', '不适合'],
          rows: [
            ['vLLM', 'PagedAttention + 连续批处理，生态最成熟', '生产部署、高并发、OpenAI 兼容 API', '单机个人使用（偏重）'],
            ['SGLang', 'RadixAttention（前缀共享），结构化输出快', '大量共享前缀（few-shot）、Agent 场景', '生态比 vLLM 小'],
            ['TensorRT-LLM', 'NVIDIA 官方，极致性能', '固定模型、追求极限吞吐', '编译复杂、迭代慢'],
            ['llama.cpp', 'CPU/GPU 混合，GGUF 量化，极轻量', '本机、边缘设备、离线批处理', '高并发服务'],
            ['Ollama', 'llama.cpp 的易用封装', '本地开发、快速试用', '生产环境'],
          ],
        },
        {
          type: 'p',
          text: '选型决策其实很短：',
        },
        {
          type: 'flow',
          title: '三问选引擎',
          ascii: `Q1: 需要对外提供高并发服务吗？
    ├─ 是 → Q2
    └─ 否 → llama.cpp / Ollama（本机、离线、边缘）

Q2: 有大量共享前缀（长 system prompt / few-shot）吗？
    ├─ 是 → SGLang（RadixAttention 能把前缀成本降到接近 0）
    └─ 否 → vLLM（最稳、最通用）

Q3: 追求极限吞吐且模型固定不变吗？
    ├─ 是 → TensorRT-LLM
    └─ 否 → vLLM`,
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '前缀缓存是最被低估的优化',
          text: '如果你的 system prompt 有 3000 token（含 few-shot），每次请求都要重算一遍 prefill，那是巨大的浪费。**vLLM 的 automatic prefix caching 和 SGLang 的 RadixAttention 都能复用这部分**，TTFT 能降 50% 以上。前提是**前缀必须完全一致**——system prompt 里不要放时间戳、用户名、随机 id。',
        },
        {
          type: 'p',
          text: '还有一个现实问题：**自建需要人维护**。GPU 驱动、CUDA 版本、模型更新、监控、故障处理——这些是持续的运维成本。如果团队没有 GPU 运维经验，用云 API 通常更划算，即使单价看起来更贵。',
        },
      ],
    },

    {
      id: 's6',
      title: '自建还是 API：算清这笔账',
      checkpoint: '每天 100 万 token，自建一个 7B 模型划算还是用 API？',
      blocks: [
        {
          type: 'p',
          text: '这个问题没有通用答案，但有一个可算的框架：',
        },
        {
          type: 'code',
          lang: 'ts',
          title: 'TCO 对比框架',
          code: `// 自建成本（月）
const selfHosted = {
  gpu: 2.5 * 24 * 30,          // 一张 A100 按 $2.5/小时 → $1800/月
  storage: 100,                 // 模型权重 + 日志
  ops: 0.2 * 20000,             // 0.2 个运维人力 → $4000/月
  total: 0,                     // = 5900
}

// API 成本（月）
const apiCost = (tokensPerDay: number, pricePerM: number) =>
  (tokensPerDay * 30 / 1e6) * pricePerM

apiCost(1e6, 0.5)     // $15/月
apiCost(1e8, 0.5)     // $1500/月
apiCost(1e9, 0.5)     // $15000/月  ← 这时候自建才划算

// 关键结论：自建的盈亏平衡点通常在
// 每天 5 亿 ~ 10 亿 token 的量级
// 而且要加上"你的需求 API 满足不了"这个前提`,
        },
        {
          type: 'table',
          head: ['决策因素', '倾向 API', '倾向自建'],
          rows: [
            ['用量', '小（每天 < 1 亿 token）', '大（每天 > 10 亿 token）'],
            ['数据合规', '允许出网 / 可用私有部署', '必须完全内网'],
            ['延迟要求', '常规（>500ms TTFT）', '极致（需要定制优化）'],
            ['模型需求', '通用能力够用', '需要微调 / 私有模型'],
            ['团队', '没有 GPU 运维经验', '有 ML 平台团队'],
            ['迭代速度', '想快速试错', '模型固定、追求稳定'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '自建最常见的三个误判',
          text: '① **只算 GPU 钱，不算人力**——GPU 运维、模型更新、监控告警，至少要 0.2~0.5 个人；② **只算平均吞吐，不算峰值**——为了峰值买卡，平时闲置 80%；③ **低估了"模型迭代"的成本**——API 出新模型你换个名字就行，自建要重新下载、量化、验证、部署。',
        },
        {
          type: 'p',
          text: '还有一个折中方案值得考虑：**混合**。核心高频、对成本敏感的走自建小模型；长尾、复杂的走 API 大模型。这样既控制了成本，又保留了能力上限。这也是第十八课"模型路由"的基础。',
        },
        {
          type: 'qa',
          q: '容量规划具体该怎么做？',
          a: '四步：① **算峰值并发**（不是平均 QPS），用利特尔法则 `并发 = RPS × 平均耗时`；② **算单请求显存**（权重摊销 + KV cache × 上下文长度）；③ **算最大并发数** = 可用显存 / 单请求显存；④ **验证**：拿真实流量压测，看 P95 延迟是否可接受。如果并发不够，三个方向：加卡、量化、缩短上下文。**先做①②③再买卡，别反过来。**',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '延迟归因',
      points: 10,
      prompt: '你的应用 TTFT 是 800ms，输出 400 token 共耗时 3.2 秒。想优化"用户感知的等待"，最有效的做法是？',
      options: [
        { id: 'a', text: '优化 decode 速度，把 TPOT 从 8ms 降到 6ms' },
        { id: 'b', text: '降低 TTFT：把 3000 token 的 system prompt 改成前缀缓存，或缩短检索材料' },
        { id: 'c', text: '换更大的模型' },
        { id: 'd', text: '增加 max_tokens' },
      ],
      answer: ['b'],
      hints: [
        '用户感知的"等待"是从发出请求到看见第一个字。',
        'TTFT 800ms 里有很大一部分是 3000 token 的 prefill。',
        'b 是对的：用户感知的等待就是 TTFT。把 3000 token 的前缀缓存住，TTFT 能降到 200ms 以下，体感差异巨大。a 优化的是"吐字速度"，感知提升有限（8ms → 6ms 只省 0.8 秒）；c 可能让 TTFT 更差；d 会让总时间更长。',
      ],
      explanation: '正确答案是 b。**感知延迟 = TTFT**，总延迟是"耐心"问题。先优化 TTFT，再考虑吞吐。',
      approach: [
        '区分感知延迟（TTFT）和总延迟',
        'TTFT 主要来自 prefill：输入越长越慢',
        '优化手段：前缀缓存、缩短检索材料、减少 few-shot',
        'decode 速度影响总时长，但不影响"开始回答"的体感',
      ],
      knowledge: ['TTFT', 'TPOT', '前缀缓存', '感知延迟'],
      pitfalls: [
        '把 TTFT 和总延迟混为一谈',
        '只优化 decode（收益小）',
      ],
    },
    {
      id: 'e2',
      type: 'multi',
      title: '显存都去哪了',
      points: 15,
      prompt: '部署一个 70B 模型（FP16）做 8K 上下文、32 并发的服务，显存被哪些部分占用？（多选）',
      options: [
        { id: 'a', text: '模型权重，约 140 GB' },
        { id: 'b', text: 'KV cache，约 43 GB（8K × 32 并发）' },
        { id: 'c', text: '激活值和框架开销，通常留 10~20%' },
        { id: 'd', text: '上下文越长，KV cache 越大' },
        { id: 'e', text: '批大小不影响显存' },
      ],
      answer: ['a', 'b', 'c', 'd'],
      hints: [
        '三块：权重、KV cache、激活/开销。',
        'e 明显错误——KV cache 随批大小线性增长。',
        'a 是权重（70e9 × 2 字节）；b 是 KV cache（随序列长度和并发线性增长）；c 是必须预留的开销；d 是对的（上下文翻倍，KV cache 翻倍）；e 错，批大小直接乘在 KV cache 上。',
      ],
      explanation: 'a、b、c、d 正确。这三块加起来才是真实占用，只算权重会严重低估。',
      approach: [
        '权重 = 参数量 × 每参数字节',
        'KV cache = 2 × 层数 × KV头数 × 头维度 × 序列长度 × 批大小 × 字节',
        '激活/开销留 10~20%',
        '总和不能超过可用显存',
      ],
      knowledge: ['显存计算', 'KV cache', '批大小'],
      pitfalls: [
        '只算权重，上线发现只能跑 2 个并发',
        '忘了 KV cache 随上下文线性增长',
      ],
    },
    {
      id: 'e3',
      type: 'fill',
      title: '算一次 KV cache',
      points: 15,
      prompt: '一个模型：64 层，8 个 KV 头（GQA），头维度 128，FP16（2 字节）。算 4096 上下文、单请求的 KV cache；再算 16 并发。',
      templateLang: 'text',
      template: `单 token 的 KV cache
  = 2 × 64 层 × 8 头 × 128 维 × 2 字节
  = {{perToken}} 字节
  = {{perTokenKB}} KB

4096 上下文，单请求
  = {{perTokenKB}} KB × 4096
  = {{singleMB}} MB

16 并发
  = {{singleMB}} MB × 16
  = {{batchGB}} GB`,
      blanks: [
        { id: 'perToken', label: '单 token 字节数', accept: ['262144', '262,144'], width: 100 },
        { id: 'perTokenKB', label: '换算成 KB', accept: ['256'], width: 70 },
        { id: 'singleMB', label: '单请求 MB', accept: ['1024', '1,024'], width: 70 },
        { id: 'batchGB', label: '16 并发 GB', accept: ['16'], width: 60 },
      ],
      hints: [
        '公式：2（K 和 V）× 层数 × KV 头数 × 头维度 × 字节数 = 每个 token 的字节数。',
        '2 × 64 × 8 × 128 × 2 = 262144 字节 = 256 KB。',
        '262144 字节 = 256 KB/token。4096 × 256 KB = 1024 MB = 1 GB/请求。16 并发 = 16 GB。**注意这只是 KV cache，还没算权重。** 如果权重是 13B FP16 = 26 GB，总需求 42 GB —— 一张 48G 卡刚好，一张 24G 卡跑不了。',
      ],
      explanation: '单 token 256 KB，单请求 1 GB，16 并发 16 GB。这个数字说明：**上下文长度和并发数对显存的影响是乘性的**，8K 上下文 32 并发就是 32 GB，比很多模型的权重还大。',
      approach: [
        '套公式算单 token 字节数',
        '乘以序列长度得单请求占用',
        '乘以并发数得总占用',
        '加上权重和开销，看是否超出可用显存',
      ],
      knowledge: ['KV cache', '显存计算', 'GQA'],
      pitfalls: [
        '忘记乘 2（K 和 V 各一份）',
        '忘记 GQA 的 KV 头数远小于注意力头数',
        '只算 KV cache 忘了权重',
      ],
    },
    {
      id: 'e4',
      type: 'code',
      title: '实现显存估算',
      points: 20,
      prompt: '实现 `planCapacity(cfg)`，返回 `{ weightGB, kvGB, totalGB, fits }`。`cfg` 含 `params`（参数量）、`bytesPerParam`、`layers`、`kvHeads`、`headDim`、`seqLen`、`batch`、`gpuGB`、`overheadRatio`（默认 0.15）。`fits` 表示 `totalGB <= gpuGB`。所有 GB 按 1e9 字节算，保留两位小数。',
      starter: `function planCapacity(cfg) {
  // TODO
  return { weightGB: 0, kvGB: 0, totalGB: 0, fits: false }
}

return planCapacity`,
      checks: [
        {
          name: '权重计算正确',
          expr: "result({params:7e9,bytesPerParam:2,layers:32,kvHeads:8,headDim:128,seqLen:4096,batch:1,gpuGB:80}).weightGB === 14",
        },
        {
          name: 'KV cache 计算正确',
          expr: "(() => { const r = result({params:7e9,bytesPerParam:2,layers:32,kvHeads:8,headDim:128,seqLen:4096,batch:1,gpuGB:80}); return Math.abs(r.kvGB - 0.54) < 0.01 })()",
        },
        {
          name: '总量含开销',
          expr: "(() => { const r = result({params:7e9,bytesPerParam:2,layers:32,kvHeads:8,headDim:128,seqLen:4096,batch:1,gpuGB:80}); return Math.abs(r.totalGB - (14 + 0.54) * 1.15) < 0.05 })()",
        },
        {
          name: '能装下时 fits 为 true',
          expr: "result({params:7e9,bytesPerParam:2,layers:32,kvHeads:8,headDim:128,seqLen:4096,batch:1,gpuGB:80}).fits === true",
        },
        {
          name: '装不下时 fits 为 false',
          expr: "result({params:70e9,bytesPerParam:2,layers:80,kvHeads:8,headDim:128,seqLen:8192,batch:32,gpuGB:80}).fits === false",
        },
        {
          name: '批大小影响 KV cache',
          expr: "(() => { const a = result({params:7e9,bytesPerParam:2,layers:32,kvHeads:8,headDim:128,seqLen:4096,batch:1,gpuGB:80}); const b = result({params:7e9,bytesPerParam:2,layers:32,kvHeads:8,headDim:128,seqLen:4096,batch:10,gpuGB:80}); return Math.abs(b.kvGB - a.kvGB * 10) < 0.01 })()",
        },
      ],
      solution: `function planCapacity(cfg) {
  const round2 = (n) => Math.round(n * 100) / 100
  const overhead = cfg.overheadRatio ?? 0.15

  const weightGB = (cfg.params * cfg.bytesPerParam) / 1e9
  const kvGB = (2 * cfg.layers * cfg.kvHeads * cfg.headDim * cfg.seqLen * cfg.batch * cfg.bytesPerParam) / 1e9

  const totalGB = round2((weightGB + kvGB) * (1 + overhead))

  return {
    weightGB: round2(weightGB),
    kvGB: round2(kvGB),
    totalGB,
    fits: totalGB <= cfg.gpuGB,
  }
}`,
      hints: [
        '两个公式：权重 = params × bytesPerParam；KV = 2 × layers × kvHeads × headDim × seqLen × batch × bytesPerParam。',
        '总量要把权重和 KV 加起来再乘 (1 + 开销比例)。',
        '完整实现：写一个 `round2` 辅助；算 weightGB；算 kvGB（注意乘 2，注意乘 batch）；totalGB = (weight + kv) × (1 + overhead)；fits 用 `<=` 比较。所有除以 1e9 换算成 GB。',
      ],
      explanation: '这个函数是容量规划的第一块砖。算完之后你会立刻发现：**上下文长度和并发数是乘性关系**，8K×32 的 KV cache 可能比权重还大。',
      approach: [
        '权重 = 参数量 × 每参数字节 / 1e9',
        'KV = 2 × 层 × KV头 × 头维 × 序列长 × 批 × 字节 / 1e9',
        '总量 = (权重 + KV) × (1 + 开销比例)',
        '和 GPU 显存比较得 fits',
      ],
      knowledge: ['容量规划', '显存计算', 'KV cache'],
      pitfalls: [
        'KV 公式忘了乘 2 或乘 batch',
        '忘记留开销余量（不留会 OOM）',
        '用 GiB（1024³）和 GB（1e9）混算导致偏差',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 12,
    questions: [
      {
        id: 'q1',
        stem: '为什么输出 token 比输入 token 贵？',
        options: [
          { id: 'a', text: '输出更长' },
          { id: 'b', text: 'decode 阶段是串行的，每次只出一个 token，GPU 利用率低；prefill 是并行的' },
          { id: 'c', text: '输出需要加密' },
          { id: 'd', text: '没有区别' },
        ],
        answer: 'b',
        why: 'prefill 并行算完所有输入，decode 一个一个出，每次都要把权重读一遍。所以 decode 阶段 GPU 大量空转。',
        stepId: 's1',
      },
      {
        id: 'q2',
        stem: '用户感知的"等待"主要由哪个指标决定？',
        options: [
          { id: 'a', text: '总延迟' },
          { id: 'b', text: 'TTFT（首字延迟）' },
          { id: 'c', text: 'TPOT' },
          { id: 'd', text: '吞吐量' },
        ],
        answer: 'b',
        why: '流式输出下，用户看到第一个字就开始读了。优化 TTFT 的体感收益远大于优化吐字速度。',
        stepId: 's1',
      },
      {
        id: 'q3',
        stem: '70B 模型 FP16 部署，为什么算完权重 140G 还不够？',
        options: [
          { id: 'a', text: '还有操作系统占用' },
          { id: 'b', text: '还要算 KV cache（随序列长度和并发线性增长）以及激活/框架开销' },
          { id: 'c', text: '要预留一半' },
          { id: 'd', text: '够了' },
        ],
        answer: 'b',
        why: '8K 上下文 32 并发的 KV cache 能到 40G 以上。只算权重会做出"能加载但跑不动"的系统。',
        stepId: 's2',
      },
      {
        id: 'q4',
        stem: '连续批处理相比静态批处理，主要优势是？',
        options: [
          { id: 'a', text: '模型更准' },
          { id: 'b', text: '请求完成就立刻让新请求补进来，避免短请求被长请求拖住' },
          { id: 'c', text: '显存更省' },
          { id: 'd', text: '不需要 GPU' },
        ],
        answer: 'b',
        why: '静态批处理要等整批跑完才能接新请求，队头阻塞严重。连续批处理每轮都能动态调整批次。',
        stepId: 's3',
      },
      {
        id: 'q5',
        stem: '量化后最需要重新验证的两项能力是？',
        options: [
          { id: 'a', text: '数学和写作' },
          { id: 'b', text: '结构化输出（JSON/工具参数）和长上下文的中间部分' },
          { id: 'c', text: '翻译和摘要' },
          { id: 'd', text: '不需要验证' },
        ],
        answer: 'b',
        why: '精度下降最容易破坏格式的严格性（漏括号、多逗号）和长序列的注意力分布。这两项必须专门测。',
        stepId: 's4',
      },
      {
        id: 'q6',
        stem: '自建模型最常见的成本误判是？',
        options: [
          { id: 'a', text: '高估了 GPU 价格' },
          { id: 'b', text: '只算 GPU 钱，不算运维人力、峰值闲置和模型迭代成本' },
          { id: 'c', text: '低估了电费' },
          { id: 'd', text: '没算带宽' },
        ],
        answer: 'b',
        why: 'GPU 运维、模型更新、监控告警至少占 0.2~0.5 人力。为峰值买卡导致平时闲置，是更隐蔽的成本。',
        stepId: 's6',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统：推理层决策',
    contributes:
      '这一课产出一份可交付的容量规划与选型文档，并用数据证明"用 API 还是自建"的选择是对的。',
    tasks: [
      '用真实流量算峰值并发（利特尔法则），记录 TTFT 和 TPOT 的当前基线',
      '写一个容量规划脚本：输入模型参数、上下文长度、并发数，输出显存需求和能否装下',
      '做一次前缀缓存实验：把 system prompt 里所有动态内容移到末尾，测 TTFT 变化',
      '对比三个方案的成本：全用 API、自建 7B、混合（简单走自建、复杂走 API）',
      '做一次量化验证：把模型 INT8 化，跑评测集，记录结构化输出合规率的变化',
      '写一份选型文档：结论 + 数据 + 风险 + 什么条件下需要重新评估',
    ],
    done: '能拿出"峰值 33 并发、需要 43G 显存、单卡 48G 够用"这样的具体数字；能说出"前缀缓存让 TTFT 从 800ms 降到 210ms"；选型文档里每个结论都有对应数据支撑。',
  },

  further: [
    { text: '论文 · Efficient Memory Management for Large Language Model Serving with PagedAttention（vLLM）' },
    { text: '论文 · SGLang: Efficient Execution of Structured Language Model Programs（RadixAttention）' },
    { text: '知识地图 06 推理与部署（/guide/06-inference）' },
  ],
}
