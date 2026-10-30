# 02 · Prompt 与上下文工程

> **投入权重：10%** · 这一层的正确名字是「上下文工程」——你控制的不只是措辞，是整个输入的信息结构。
> 别学成"咒语大全"，那是玄学不是工程。

## 为什么改名

2024 年大家说 Prompt Engineering，2025 年之后更准确的说法是 Context Engineering。区别在于：前者以为关键是"怎么说话"，后者认为关键是"往窗口里放什么、按什么顺序放、放多少"。同一个模型，换一种上下文组织方式，效果差异可以远大于换一个更贵的模型。这个认知转变很重要，因为它把"调 prompt"从玄学变成了可设计的工程问题。

## 结构化

- **Prompt 的本质** <span class="prio prio-must">必须</span> — 不是"命令"，是给条件概率施加约束。所有技巧的本质都是"减少模型猜错的空间"。
- **六要素结构** <span class="prio prio-must">必须</span> — 角色 / 任务 / 上下文 / 约束 / 输出格式 / 示例。缺哪个补哪个，比堆形容词有效得多。
- **System 与 User 的分工** <span class="prio prio-must">必须</span> — 稳定规则进 system（可缓存、更省钱），变量进 user。混着写会导致前缀缓存失效，成本直接翻倍。
- **指令的具体性** <span class="prio prio-must">必须</span> — "简洁一点"是废话，"不超过 3 句话，每句不超过 30 字"才可执行。凡是无法判断"做到没做到"的要求，都要改写。
- **负面指令的陷阱** <span class="prio prio-must">必须</span> — "不要做 X"经常适得其反（提到即激活）。改成"应该做 Y"。
- **分隔符与结构化标记** <span class="prio prio-must">必须</span> — 用 XML 标签或 Markdown 分隔不同来源的内容，能显著降低混淆与注入风险。
- **信息顺序的影响** <span class="prio prio-imp">重要</span> — 首尾位置权重更高。把最重要的约束放最后（近因效应），或首尾各放一次。
- **冗余与自相矛盾** <span class="prio prio-imp">重要</span> — 长 prompt 里前后矛盾是常见 bug。写完后专门做一次"冲突检查"。

## 推理范式

- **Few-shot 示例设计** <span class="prio prio-must">必须</span> — 示例要覆盖边界情况，不只是典型情况。示例顺序会影响结果（近因效应），重要示例放后面。
- **CoT 思维链** <span class="prio prio-must">必须</span> — 让模型先写推理再给结论，对多步任务提升明显；简单任务上反而增加成本与出错面。
- **Zero-shot CoT** <span class="prio prio-imp">重要</span> — "让我们一步步思考"这类触发语。在新一代推理模型上收益已明显下降，别迷信旧教程。
- **Self-Consistency** <span class="prio prio-imp">重要</span> — 多次采样取多数投票。提升准确率，成本线性上升，适合高价值低并发场景。
- **ReAct** <span class="prio prio-must">必须</span> — 思考-行动-观察循环，Agent 的基础范式，第 04 章详述。
- **Reflexion 自我反思** <span class="prio prio-imp">重要</span> — 失败后分析原因再重试。要有明确的失败信号才有用，否则只是重复犯错。
- **Least-to-Most** <span class="prio prio-opt">选学</span> — 把复杂问题拆成子问题依次解决。
- **角色扮演的作用与边界** <span class="prio prio-imp">重要</span> — 能改变语气与知识调用倾向，但不增加模型不具备的能力。别指望"你是资深律师"就真变律师。

## 输出约束

- **JSON 输出与 Schema 设计** <span class="prio prio-must">必须</span> — 字段少、嵌套浅、给枚举值。嵌套三层以上的 schema 出错率会明显上升。
- **JSON Mode / Structured Output** <span class="prio prio-must">必须</span> — 厂商级的结构化输出保证，比在 prompt 里求"请输出 JSON"可靠一个数量级。
- **Function Calling 作为输出约束** <span class="prio prio-must">必须</span> — 本质是"强制模型填参数"，比让它自由写 JSON 更稳。也可用来做分类器（枚举值就是类别）。
- **Grammar-constrained decoding** <span class="prio prio-imp">重要</span> — GBNF / Outlines / JSON Schema 级约束，本地部署时能做到 100% 合法输出。
- **输出解析与容错** <span class="prio prio-must">必须</span> — 永远不要假设模型输出一定合法。写重试、修复、降级三条路径。
- **长度控制** <span class="prio prio-imp">重要</span> — 用 max_tokens 硬约束 + prompt 软引导，双保险。
- **流式输出的解析难点** <span class="prio prio-imp">重要</span> — 结构化输出在流式时是"半截 JSON"，必须用增量解析器，不能等收完再 parse。

## 模板与版本

- **模板化与变量注入** <span class="prio prio-must">必须</span> — 模板与代码分离，变量显式声明。避免字符串拼接导致注入。
- **Prompt 版本管理** <span class="prio prio-must">必须</span> — 每次改动留版本号与改动理由，能回滚。用 git 管，别在代码里硬编码。
- **Prompt 的 A/B 测试** <span class="prio prio-must">必须</span> — 同一批测试集跑两个版本，看指标差异。没有 A/B 的"我觉得更好了"都是错觉。
- **Prompt 与模型版本绑定** <span class="prio prio-must">必须</span> — 换模型必须重跑全部评测。同一个 prompt 在新模型上可能显著变差，这不是模型变笨，是分布变了。
- **Prompt 的复用与组合** <span class="prio prio-imp">重要</span> — 把 prompt 拆成可复用片段（人格/格式/安全规则），按需拼装，而不是每个场景抄一份。

## 注入攻防

- **直接提示注入** <span class="prio prio-must">必须</span> — 用户输入"忽略以上指令"。防御靠分层与输出校验，不靠措辞。
- **间接提示注入** <span class="prio prio-must">必须</span> — 恶意内容藏在检索文档、网页、工具返回值里。这是 RAG 与 Agent 的最大安全风险，也是最容易被忽视的。
- **系统提示词泄露** <span class="prio prio-must">必须</span> — 用户诱导模型复述 system prompt。敏感规则不要写在 prompt 里。
- **防御策略** <span class="prio prio-must">必须</span> — 内容与指令分区、工具白名单、输出侧二次校验、最小权限。没有单一银弹，必须叠层。
- **越狱的持续性** <span class="prio prio-imp">重要</span> — 这是持续对抗，不是一次性修复。要有红队用例库并定期更新。

## 上下文工程

- **Context Engineering 概念** <span class="prio prio-must">必须</span> — 比 prompt engineering 更准确：管理进入上下文窗口的全部信息（指令 / 知识 / 历史 / 工具结果）。
- **上下文压缩** <span class="prio prio-must">必须</span> — 摘要历史、LLMLingua 类压缩、只保留结构化结论。长对话必须做，否则成本失控。
- **上下文污染** <span class="prio prio-must">必须</span> — 错误信息进入上下文后被反复引用放大。需要"事实核对点"和清理机制。
- **上下文隔离** <span class="prio prio-imp">重要</span> — 多 Agent 各自独立上下文，只交换结构化结论，避免互相污染。
- **动态上下文组装** <span class="prio prio-must">必须</span> — 按任务类型决定塞什么，而不是固定模板。这是产品级与 demo 级的分界。
- **上下文的最小充分原则** <span class="prio prio-imp">重要</span> — 够用就停。塞满窗口不会更好，只会更贵更慢更容易迷失。
