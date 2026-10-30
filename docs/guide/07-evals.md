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

## 本章对应的面试题

共 20 题，见 [15 · 面试题库 · F 组](/guide/15-interview#f-评测-20-题-第二重灾区)。

这一章是"做过"和"做好过"的分界。如果面试只能准备一个知识点，就准备这里——因为它决定了你所有其他回答的可信度。

三个必答题：**F1 怎么评测没有标准答案的任务**、**F2 LLM-judge 的偏差怎么处理**、**F3 评测集多少条、怎么来的**。

