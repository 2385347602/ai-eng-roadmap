# 07 · 评测 Evals

> **投入权重：12%** · 这是"demo"和"产品"的唯一分界线，也是绝大多数转岗者跳过的一层。
> 跳过它，你永远不知道自己是在变好还是变坏。

## 为什么它是分水岭

传统开发里，你改一行代码，跑测试就知道有没有坏。AI 应用里，你改一个词，输出可能全变，而且"变好还是变坏"没法靠眼看。

没有评测系统的团队，工作方式是这样的：改 prompt → 试几个例子 → 感觉好像好点了 → 上线 → 用户投诉 → 再改 → 不知道上次改的对不对。这是一个闭环失败的循环，做三个月也不会有积累。

有评测系统的团队：改 prompt → 跑 200 条评测集 → 看指标差异 → 决定采纳或回滚。**区别不在于聪明程度，在于有没有反馈信号。**

## 体系

- **为什么评测是分水岭** <span class="prio prio-must">必须</span> — 没有评测，所有优化都是玄学；有评测，才能做 A/B、才能回滚、才能向老板证明价值。
- **三个层次** <span class="prio prio-must">必须</span> — 组件级（检索/生成分开测）、端到端（整体任务）、线上（真实用户指标）。
- **评测驱动开发循环** <span class="prio prio-must">必须</span> — 先写评测集 → 再改 prompt/架构 → 跑分 → 决定是否采纳。反过来做就是瞎调。
- **评测集的维护** <span class="prio prio-must">必须</span> — 线上 badcase 持续回流进评测集，让它随业务演进。
- **评测的成本意识** <span class="prio prio-imp">重要</span> — 每次跑全量评测都花钱。要能按需跑子集，全量只在发版前跑。

## 数据集

- **黄金测试集构建** <span class="prio prio-must">必须</span> — 50~200 条覆盖核心场景的真实问题，人工标注标准答案。起步不要贪多。
- **边界与对抗样本** <span class="prio prio-must">必须</span> — 空输入、超长输入、多语言混写、恶意注入、歧义问题。
- **难度分层** <span class="prio prio-imp">重要</span> — 简单/中等/困难各占一定比例，否则指标被简单题稀释。
- **样本代表性** <span class="prio prio-must">必须</span> — 从真实日志采样，不要自己编题。自编题会系统性偏简单。
- **标准答案的形态** <span class="prio prio-imp">重要</span> — 有些任务没有唯一答案（写作），这时标"必须包含的要点"和"必须避免的错误"。
- **数据集版本管理** <span class="prio prio-imp">重要</span> — 改了评测集就不能和历史分数直接比。要记录版本。

## LLM-as-a-Judge

- **原理** <span class="prio prio-must">必须</span> — 用强模型给输出打分。规模化评测的唯一现实手段。
- **位置偏差** <span class="prio prio-must">必须</span> — 倾向选第一个。解法：交换顺序各跑一次取平均。
- **长度偏差** <span class="prio prio-must">必须</span> — 倾向给长答案高分。解法：评分标准里显式要求"简洁不扣分"。
- **自我偏好** <span class="prio prio-must">必须</span> — 同一家模型评自己会偏高。解法：用不同厂模型做 judge。
- **评分标准要可执行** <span class="prio prio-must">必须</span> — "回答质量 1-5 分"是废的，"是否引用了给定材料、是否有编造、是否回答了问题"才可用。
- **与人工对齐** <span class="prio prio-must">必须</span> — judge 上线前要用 50 条人工标注校准，看一致率。**低于 80% 不可信**（这是经验阈值，具体看任务容忍度）。
- **Pairwise vs Pointwise** <span class="prio prio-imp">重要</span> — 两两比较更稳（人也是这样判断的），绝对打分更省。
- **Judge 的 prompt 也是 prompt** <span class="prio prio-imp">重要</span> — 它同样需要版本管理和评测。别用一个没验证过的 judge 去评生产系统。

## 人工评估

- **标注流程设计** <span class="prio prio-must">必须</span> — 明确任务定义、评分维度、边界案例，先试标 20 条再全量。
- **标注一致性** <span class="prio prio-imp">重要</span> — Cohen kappa 等指标衡量。一致性低说明标准不清，先改标准。
- **成本控制** <span class="prio prio-imp">重要</span> — 人工评估贵，只用于校准 judge 和关键决策点。

## 工具

- **promptfoo** <span class="prio prio-must">必须</span> — 配置化跑 prompt 回归测试，CI 友好，上手最快。
- **DeepEval** <span class="prio prio-must">必须</span> — Python 单测风格，指标齐全。
- **RAGAS** <span class="prio prio-must">必须</span> — RAG 专用指标体系，直接可用。
- **LangSmith Evals** <span class="prio prio-imp">重要</span> — 与 LangChain 生态集成好。
- **Braintrust / Arize Phoenix** <span class="prio prio-imp">重要</span> — 商业与开源的可观测+评测一体方案。
- **传统指标为什么失效** <span class="prio prio-must">必须</span> — BLEU / ROUGE 只看词重叠，语义正确但换个说法就判错。别用。

## 线上指标

- **采纳率** <span class="prio prio-must">必须</span> — 生成的代码/文案被直接采用的比例。最硬的产品指标。
- **任务完成率** <span class="prio prio-must">必须</span> — 用户是否真的完成了目标，而不只是"聊了几句"。
- **人工介入率** <span class="prio prio-must">必须</span> — 需要人工纠正的比例。Agent 场景核心指标。
- **重试率与放弃率** <span class="prio prio-imp">重要</span> — 反复重新生成说明效果差。
- **成本/请求** <span class="prio prio-must">必须</span> — 单位经济模型的基础。
- **延迟分位 P50/P95/P99** <span class="prio prio-must">必须</span> — 平均值会骗人，必须看分位。
- **A/B 实验设计** <span class="prio prio-imp">重要</span> — 分流、样本量、显著性。别用"我感觉"代替实验。
- **北极星指标的陷阱** <span class="prio prio-imp">重要</span> — 只优化采纳率会导致输出变短变保守。要配一组制衡指标。

## Tool Calling 评测

工具调用是 Agent 的地基。**地基歪了，上面评测什么都是假的。** 这一层可以拆成五个可量化指标，每个都能单独跑。

- **Tool Selection Accuracy（工具选择准确率）** <span class="prio prio-must">必须</span> — 给定问题，模型选对工具的比例。**这是最基础也最容易被忽略的指标**，工具一多就掉。
- **参数正确率** <span class="prio prio-must">必须</span> — 选对工具但参数填错等于失败。要逐字段比对：必填项缺失率、类型错误率、枚举越界率、日期格式错误率。
- **错误恢复率** <span class="prio prio-must">必须</span> — 工具返回错误后，模型能否根据错误信息修正参数重试。**这是区分"能跑"和"能上生产"的关键指标**，很多 demo 在这一项上是 0。
- **无效调用率** <span class="prio prio-must">必须</span> — 调用了不存在或不适用的工具。说明工具描述写得不清楚，或者工具太多。
- **重复调用率** <span class="prio prio-imp">重要</span> — 相同参数重复调用同一工具。浪费钱，说明模型没读到上一步结果。
- **不必要调用率** <span class="prio prio-imp">重要</span> — 明明可以直接回答却去调工具。反映 system prompt 里"什么时候该用工具"没说清。
- **权限违规测试** <span class="prio prio-must">必须</span> — 构造诱导性输入，看模型会不会调它没权限的工具。**这是安全评测，不是效果评测**，必须单列。
- **并行调用的正确性** <span class="prio prio-imp">重要</span> — 有依赖关系的调用被并行发出去了吗？会导致参数互相缺失。
- **怎么测** <span class="prio prio-must">必须</span> — 构造 `(问题, 期望工具, 期望参数)` 三元组，跑批比对。**不需要真实执行工具**，mock 掉就能测选择层。

## Agent 评测

Agent 的路径不唯一，所以不能只比最终答案。要同时测"结果"和"过程"。

- **Step Success Rate（单步成功率）** <span class="prio prio-must">必须</span> — 每一步做对的比例。**这个数字直接决定十步任务的成败**（0.95^10 ≈ 0.6）。
- **Completion Rate（任务完成率）** <span class="prio prio-must">必须</span> — 端到端达成目标的比例。最硬的结果指标。
- **Loop Detection（循环检测）** <span class="prio prio-must">必须</span> — 有没有反复做同一件事。指标：平均步数、重复动作占比、触达最大步数上限的比例。
- **Tool Efficiency（工具效率）** <span class="prio prio-imp">重要</span> — 完成同一任务用的工具调用次数。**和"人工最少需要几步"对比**，多出来的就是浪费。
- **人工接管率** <span class="prio prio-must">必须</span> — 需要人介入才能继续的比例。Agent 场景的核心产品指标。
- **中断恢复成功率** <span class="prio prio-imp">重要</span> — 从 checkpoint 恢复后能否正确继续。**必须专门造一个"跑到一半杀掉进程"的测试**，否则上线才发现恢复是坏的。
- **成本-成功率关系** <span class="prio prio-must">必须</span> — 只报成功率是耍流氓。要报"成功率 / 单任务成本"，并画出曲线：加钱能不能换到准确率？换不到就说明瓶颈不在模型。
- **过程合理性** <span class="prio prio-imp">重要</span> — 结果对了但路径荒谬（比如删库重建），也是失败。用 LLM-judge 评轨迹，或用规则检查"是否调用了禁止工具"。
- **轨迹回放** <span class="prio prio-must">必须</span> — 每次评测要能回放完整轨迹（每步的输入输出）。**不能回放的评测系统没有排障价值**。
- **评测环境的确定性** <span class="prio prio-must">必须</span> — 工具要 mock 或指向测试环境，数据要可重置。**否则同一个用例跑两次结果不同，评测就没意义**。

## 本章对应的面试题

共 20 题，见 [15 · 面试题库 · F 组](/guide/15-interview#f-评测-20-题-第二重灾区)。

这一章是"做过"和"做好过"的分界。如果面试只能准备一个知识点，就准备这里——因为它决定了你所有其他回答的可信度。

三个必答题：**F1 怎么评测没有标准答案的任务**、**F2 LLM-judge 的偏差怎么处理**、**F3 评测集多少条、怎么来的**。

**加分回答**：主动提"我们除了最终答案，还测了工具选择准确率和错误恢复率，因为十步任务里单步 95% 只剩六成"。这句话能直接把话题引到你最熟的地方。

