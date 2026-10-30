# 01 · LLM 基础

> **投入权重：10%** · 不必会训练，但必须能解释"模型为什么这样表现"。
> 这一层的作用是让你出问题时知道往哪查，而不是瞎调 prompt。

## 学习目标

能做到这三件事就算过关：一、别人问"为什么它记不住我刚说的话"，你能答出上下文窗口与注意力衰减；二、让你估算一次请求的成本，你能给出数量级；三、遇到输出格式错乱，你知道该改 prompt、换 structured output、还是上约束解码。

## 架构

- **Transformer 整体结构** <span class="prio prio-must">必须</span> — Encoder-Decoder 与 Decoder-only 的区别；当前主流全是 Decoder-only，理解这一点才能理解"为什么是自回归生成"。
- **Self-Attention 计算过程** <span class="prio prio-must">必须</span> — Q/K/V 的来历，`softmax(QKᵀ/√d)V` 每一步在做什么。能手推一遍就够，不必背公式。
- **Multi-Head Attention** <span class="prio prio-imp">重要</span> — 多头的意义是让不同头关注不同关系（语法/指代/位置）。理解它才能理解"注意力可视化"类工具在展示什么。
- **位置编码** <span class="prio prio-imp">重要</span> — 绝对位置编码 → 相对位置 → RoPE（当前主流）→ ALiBi。这条演化线直接关系到长上下文外推能力。
- **RMSNorm 与残差连接** <span class="prio prio-opt">选学</span> — 为什么用 RMSNorm 不用 LayerNorm，残差如何让深层网络可训练。
- **FFN / 前馈层** <span class="prio prio-opt">选学</span> — 参数量主要在这里（约占三分之二），MoE 也是在这里做稀疏化。
- **因果掩码** <span class="prio prio-imp">重要</span> — 为什么生成时看不到未来 token。理解它才能理解"为什么不能反向生成"、为什么流式输出天然是单向的。
- **KV Cache** <span class="prio prio-must">必须</span> — 推理加速的核心：缓存历史 K/V 避免重复计算。它同时是显存占用的主要来源，直接决定并发数。部署章节会反复用到。
- **MoE 混合专家** <span class="prio prio-imp">重要</span> — 用稀疏激活换参数量，DeepSeek / Qwen 都在用。理解"总参数 vs 激活参数"的区别，否则会被宣传数字误导。
- **Prefill 与 Decode 两阶段** <span class="prio prio-must">必须</span> — 推理分成两段：**Prefill** 一次性并行处理全部输入（算力密集，决定 TTFT）；**Decode** 逐 token 生成（显存带宽密集，决定 TPOT）。**这两个阶段的瓶颈完全不同，优化手段也不同**——Prefill 靠加算力，Decode 靠减少显存读写。
- **Chunked Prefill** <span class="prio prio-imp">重要</span> — 超长输入会长时间占住 GPU 导致其他请求 TTFT 爆炸。切成小块穿插执行，牺牲一点吞吐换延迟稳定。
- **算力密集 vs 带宽密集** <span class="prio prio-imp">重要</span> — 长输入短输出（RAG、分类）是 Prefill 主导，看算力；短输入长输出（写作、推理）是 Decode 主导，看显存带宽。**这个判断直接决定你该买什么卡、怎么批处理**。

## 模型类型

不是所有"模型"都是聊天模型。**选错类型是新手最常见的低级错误**——比如拿生成模型做分类、拿 embedding 模型做问答。

- **Base（基座模型）** <span class="prio prio-imp">重要</span> — 只会续写，不会对话。适合做微调起点，不适合直接用。
- **Instruction / Chat（指令模型）** <span class="prio prio-must">必须</span> — 经过 SFT/RLHF，会听指令。**日常调用 99% 用这个**。
- **Reasoning（推理模型）** <span class="prio prio-must">必须</span> — 先想再答（o 系列、DeepSeek-R1 系）。**优势在数学/代码/多步逻辑，劣势是慢和贵**。不要拿它做简单分类。
- **推理预算（Reasoning Budget）** <span class="prio prio-imp">重要</span> — 推理模型可以控制"想多久"。**简单任务给低预算能省一大笔**，难题给高预算。这是 2024 年之后新增的重要成本杠杆。
- **过度思考的代价** <span class="prio prio-imp">重要</span> — 推理模型对简单问题会绕远路，反而更差。**要按任务难度路由**，不是全都上最强模型。
- **Embedding 模型** <span class="prio prio-must">必须</span> — 输出向量，用于检索/聚类/去重。**它不能生成文字**，混用是硬伤。
- **Reranker（重排模型）** <span class="prio prio-must">必须</span> — Cross-Encoder 结构，输入 query+doc 输出相关性分数。比向量检索准但慢，**只用在召回后的精排**。
- **VLM（视觉语言模型）** <span class="prio prio-must">必须</span> — 图文输入。详见 [23 · 多模态](/guide/23-multimodal)。
- **Speech 模型** <span class="prio prio-imp">重要</span> — ASR（语音转文字）/ TTS（文字转语音）/ 端到端语音对话。三类完全不同。
- **多模态统一模型** <span class="prio prio-opt">选学</span> — 一个模型同时处理文/图/音/视频。能力全面但单项常不如专用模型。
- **Guard / 审核模型** <span class="prio prio-imp">重要</span> — 专门做内容安全分类，比用大模型判断便宜几十倍。
- **怎么记住** <span class="prio prio-must">必须</span> — 一句话：**生成用 chat/reasoning，检索用 embedding，精排用 reranker，看图用 VLM，安全用 guard。** 面试问"你会用哪些模型"，按这五类答。

## 必要的数学

不用会推导，但**看到这些词不能懵**。面试官问"余弦相似度和点积什么区别"，答不上来说明 RAG 是抄来的。

- **向量与点积** <span class="prio prio-must">必须</span> — 点积衡量方向和长度。**内积检索（`<#>`）比余弦快但受向量长度影响**，归一化后就等价了。
- **范数（L2）** <span class="prio prio-must">必须</span> — 向量长度。归一化 = 除以范数，让所有向量长度变 1，此时点积 = 余弦。
- **余弦相似度** <span class="prio prio-must">必须</span> — 只看方向不看长度，范围 -1~1。**文本 embedding 基本都用它**。
- **欧氏距离（L2 距离）** <span class="prio prio-must">必须</span> — 直线距离。归一化向量下，欧氏距离和余弦单调对应（`d² = 2 - 2cos`）。
- **为什么 embedding 要归一化** <span class="prio prio-must">必须</span> — 不归一化时，长文本的向量范数更大，会系统性地"更相似"。**很多检索效果差就是漏了这一步**。
- **Softmax** <span class="prio prio-must">必须</span> — 把分数变成概率分布。temperature 就是在 softmax 前除以 T。**理解这一点就理解了 temperature 的本质**。
- **交叉熵（Cross-Entropy）** <span class="prio prio-imp">重要</span> — 语言模型的训练损失就是它。困惑度（perplexity）= exp(交叉熵)。
- **梯度下降** <span class="prio prio-opt">选学</span> — 沿梯度反方向更新参数。学习率、batch size、梯度累积的关系，微调时会用到。
- **矩阵乘法** <span class="prio prio-imp">重要</span> — Transformer 里几乎全是它。**理解了"矩阵乘是算力瓶颈"就理解了为什么 GPU 重要**。
- **精度类型** <span class="prio prio-imp">重要</span> — FP32 / FP16 / BF16 / FP8 / INT8 / INT4 的位数与动态范围差异。**BF16 比 FP16 动态范围大，训练更稳**；推理量化见 [06 · 推理](/guide/06-inference)。

## Tokenizer

- **BPE / WordPiece / SentencePiece** <span class="prio prio-imp">重要</span> — 分词算法差异；为什么"数不清 strawberry 有几个 r"是分词问题不是智力问题。
- **中文 token 效率** <span class="prio prio-must">必须</span> — 同一段中文在不同 tokenizer 下的 token 数可能差 1.5 倍，直接决定成本。选型时要拿自己的真实语料实测，不要看宣传。
- **token 与字符的换算** <span class="prio prio-imp">重要</span> — 中文约 1 字 ≈ 1~1.5 token，英文约 1 词 ≈ 1.3 token。粗算用它，精确算用 tiktoken 类库。**这是经验值，不是精确公式，务必用自己语料校准。**
- **特殊 token 与对话模板** <span class="prio prio-imp">重要</span> — BOS/EOS、system/user/assistant 标记。自己拼 prompt 时拼错模板会显著掉效果，尤其是本地模型。
- **token 计费逻辑** <span class="prio prio-must">必须</span> — 输入/输出分开计价，输出通常贵 2~4 倍；缓存命中价更低。做成本模型必须懂。

## 训练流程（了解即可）

- **预训练目标** <span class="prio prio-imp">重要</span> — next token prediction。理解这一点就理解"模型本质是概率续写器"，很多幻觉由此而来。
- **SFT 监督微调** <span class="prio prio-imp">重要</span> — 用指令-回答对做监督学习，让基座模型学会"听话"。第 05 章会深入。
- **RLHF：奖励模型 + PPO** <span class="prio prio-opt">选学</span> — 人类偏好 → 奖励模型 → 强化学习。理解它才能理解"对齐税"和"过度拒答"。
- **DPO / ORPO / KTO** <span class="prio prio-imp">重要</span> — 跳过奖励模型的偏好优化，工程上更简单，微调阶段会用到。
- **Scaling Law** <span class="prio prio-opt">选学</span> — 参数/数据/算力的幂律关系。用途：判断"这事该换更大模型还是改架构"。
- **蒸馏** <span class="prio prio-imp">重要</span> — 大模型生成数据教小模型，是降本主力手段，也是把能力搬进私有模型的主要路径。

## 采样与生成参数

- **temperature** <span class="prio prio-must">必须</span> — 控制分布锐度。事实性任务调低（0~0.3），创意任务调高。注意：temperature=0 也不保证完全可复现。
- **top_p（nucleus sampling）** <span class="prio prio-must">必须</span> — 按累积概率截断。业界惯例是调 temperature 或 top_p 之一，不要同时大改，否则难以归因。
- **top_k** <span class="prio prio-imp">重要</span> — 只从概率最高的 k 个里采样。约束更强，常用于本地小模型。
- **repetition / frequency / presence penalty** <span class="prio prio-imp">重要</span> — 抑制复读。过高会导致语句破碎，调参要小步（0.05 级别）。
- **stop sequences** <span class="prio prio-imp">重要</span> — 提前终止，省钱且能控制格式。多轮 Agent 里常用。
- **logit_bias** <span class="prio prio-opt">选学</span> — 对特定 token 加权/降权。强制或禁止某些词时有用。
- **seed 与可复现性** <span class="prio prio-imp">重要</span> — 部分厂商支持固定种子，但跨版本、跨硬件仍不可复现。别把测试建立在"必然一致"上。
- **beam search vs sampling** <span class="prio prio-opt">选学</span> — 前者求最优序列（翻译类），后者求多样性（对话类）。API 场景基本只用采样。

## 上下文窗口

- **上下文窗口的含义** <span class="prio prio-must">必须</span> — 一次请求能塞入的最大 token 数（输入与输出共享）。不是越大越好，成本与延迟随长度线性上升。
- **Lost in the Middle** <span class="prio prio-must">必须</span> — 关键信息放在长上下文中段时召回显著下降。所以"把文档全塞进去"通常不如精准检索。这是 RAG 存在的理由之一。
- **长上下文外推** <span class="prio prio-opt">选学</span> — YaRN / NTK 插值等把短训练模型拉到长上下文的技术，效果有衰减，宣称的窗口长度不等于有效长度。
- **上下文预算分配** <span class="prio prio-must">必须</span> — system / 检索内容 / 历史对话 / 输出预留，四者抢同一个池子。必须显式分配，不能任其膨胀。
- **上下文膨胀的隐性成本** <span class="prio prio-imp">重要</span> — 每轮都带全部历史，成本是 O(n²) 增长。长会话必须做裁剪或摘要。

## 能力与局限

- **幻觉的机制与分类** <span class="prio prio-must">必须</span> — 事实性幻觉（编事实）与忠实性幻觉（不忠于给定材料）。后者才是 RAG 要解决的核心，前者靠检索也难以完全消除。
- **知识截止** <span class="prio prio-must">必须</span> — 模型不知道训练后的事。任何时效性需求必须外挂检索。
- **算术与精确计数** <span class="prio prio-must">必须</span> — 弱项。涉及数字就让模型输出表达式交给代码算，别让它心算。
- **指令遵循 vs 格式遵循** <span class="prio prio-must">必须</span> — 能听懂要求 ≠ 能稳定输出合法 JSON。后者需要 structured output 或约束解码。
- **多语言能力不均衡** <span class="prio prio-imp">重要</span> — 中文强的模型英文可能弱，反之亦然。跨语言场景要分别测。
- **多模态能力边界** <span class="prio prio-imp">重要</span> — 图像理解对文字密集图（截图/表格）弱，对自然图像强。需要 OCR 兜底。
- **自我认知不可靠** <span class="prio prio-imp">重要</span> — 问模型"你是什么版本"经常答错。版本信息只能从 API 响应或配置里拿。
- **长链推理的误差累积** <span class="prio prio-imp">重要</span> — 推理步数越多，中间步骤出错被放大的概率越高。这是"为什么要把复杂任务拆给代码"的原因。

## 模型族与选型

- **GPT 系列** <span class="prio prio-must">必须</span> — 综合能力强，生态与工具链最全，价格中高。
- **Claude 系列** <span class="prio prio-must">必须</span> — 长文本与代码/写作强，工具调用稳定，适合 Agent。
- **Gemini 系列** <span class="prio prio-must">必须</span> — 超长上下文与多模态强，价格有优势。
- **Qwen 系列** <span class="prio prio-must">必须</span> — 中文与开源生态最完整，尺寸齐全，国内部署首选。
- **DeepSeek 系列** <span class="prio prio-must">必须</span> — 性价比极高，开源权重可自部署，推理能力强。
- **Llama / Mistral 系列** <span class="prio prio-imp">重要</span> — 海外开源基座，微调生态最成熟。
- **国产合规模型（GLM / 豆包 / 混元 / 文心）** <span class="prio prio-imp">重要</span> — 有备案、可开票、数据不出境，ToB 项目常是硬性要求。
- **开源 vs 闭源的取舍** <span class="prio prio-must">必须</span> — 开源换数据主权与成本可控，闭源换能力上限与免运维。判断依据是"数据能不能出境"和"量级够不够摊薄运维成本"。
- **模型选型 12 项指标** <span class="prio prio-must">必须</span> — 别只看"跑分"。做一张打分表，逐项填：

  | # | 指标 | 怎么测 |
  | --- | --- | --- |
  | 1 | 任务准确率 | 自己的评测集跑分，不看公开榜 |
  | 2 | 中文能力 | 中文语料实测，很多模型英文强中文弱 |
  | 3 | 指令/格式遵循 | 让它输出严格 JSON 100 次，数失败几次 |
  | 4 | 工具调用准确率 | 给 10 个工具，测选择与参数正确率 |
  | 5 | 上下文有效长度 | 不是标称长度，测"第 50k token 还能答对吗" |
  | 6 | TTFT 与 TPOT | 实测 P50/P95，不是看宣传 |
  | 7 | 单位成本 | 输入/输出分开算，算到"每千次任务" |
  | 8 | 限流与配额 | RPM/TPM 上限，够不够你的峰值 |
  | 9 | 可用性 SLA | 历史故障率、有没有多区域 |
  | 10 | 数据条款 | 会不会拿去训练、零留存选项 |
  | 11 | 合规资质 | 备案、发票、能否私有化 |
  | 12 | 版本稳定性 | 会不会静默升级，能不能锁版本 |

  **前 4 项决定能不能用，后 8 项决定能不能长期用。** 面试时能报出其中几项实测数字，可信度立刻不一样。
- **多模型策略** <span class="prio prio-imp">重要</span> — 贵模型做难任务，便宜模型做简单任务，路由分流。这是降本最有效的手段之一。
- **版本更新与能力漂移** <span class="prio prio-imp">重要</span> — 厂商静默更新模型会改变行为。必须锁定版本号（如果支持）并保留回归测试。
