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
- **模型选型六维** <span class="prio prio-must">必须</span> — 能力 / 成本 / 延迟 / 上下文 / 多模态 / 合规。做一张打分表，别凭感觉选。
- **多模型策略** <span class="prio prio-imp">重要</span> — 贵模型做难任务，便宜模型做简单任务，路由分流。这是降本最有效的手段之一。
- **版本更新与能力漂移** <span class="prio prio-imp">重要</span> — 厂商静默更新模型会改变行为。必须锁定版本号（如果支持）并保留回归测试。
