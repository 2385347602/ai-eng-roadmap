# 05 · 微调与对齐

> **投入权重：5%** · 刻意压低权重。九成需求用 RAG + prompt 解决，微调是最后手段。
> 但你要知道什么时候真的必须微调，以及它有多贵。

## 为什么权重这么低

微调是转岗者最容易高估的技能。原因很直观：它听起来最"AI"，最像算法工程师干的事，也最容易在简历上写。但真实项目里，微调解决的是很窄的一类问题：固定风格、固定格式、领域黑话、以及把大模型能力压进小模型降本。

如果你发现"模型不懂我们业务"，八成是检索没做好、prompt 没写清、或者评测集根本没建。这时候去微调，等于用最贵的方式解决一个本来免费的 bug。

## 决策

- **微调 / RAG / Prompt 决策树** <span class="prio prio-must">必须</span> — 知识不足→RAG；格式不稳→结构化输出或微调；风格不对→微调；降本→蒸馏小模型。
- **必须微调的四种情况** <span class="prio prio-must">必须</span> — 固定输出风格、极短 prompt 要求（降本）、领域黑话、把大模型能力蒸馏进小模型。
- **不该微调的典型误判** <span class="prio prio-must">必须</span> — "模型不懂我们业务"——八成是检索没做好，不是模型不行。
- **微调的隐性成本** <span class="prio prio-must">必须</span> — 数据标注 + 训练 + 评估 + 每次基座升级要重做。这条常被低估。
- **对照实验原则** <span class="prio prio-must">必须</span> — 决定微调前，先用同等时间做一版 RAG + prompt 方案，两者对比。没有对照就没有结论。

## 数据

- **SFT 数据格式** <span class="prio prio-must">必须</span> — chat 格式（多轮）vs instruct 格式（单轮）。按推理时的真实格式构造，格式不一致会掉效果。
- **质量远大于数量** <span class="prio prio-must">必须</span> — 500 条高质量 > 50000 条脏数据。先去重、去噪、去矛盾。
- **数据多样性** <span class="prio prio-must">必须</span> — 覆盖边界情况与不同表达方式，否则模型学成复读机。
- **合成数据生成** <span class="prio prio-imp">重要</span> — 用强模型生成 + 人工校验。当前主流做法，但要注意"模型味"污染。
- **标注流程与规范** <span class="prio prio-imp">重要</span> — 先写标注手册，再做一致性检验（双人标注比对），否则数据不可用。
- **训练集与评测集隔离** <span class="prio prio-must">必须</span> — 同一来源的样本不能跨集，否则指标虚高。
- **数据配比** <span class="prio prio-imp">重要</span> — 混入 10~30% 通用数据，防止灾难性遗忘。
- **数据长度分布** <span class="prio prio-imp">重要</span> — 训练数据长度要接近推理时的实际长度，差距过大会导致截断或效果下降。

## 方法

- **LoRA 原理** <span class="prio prio-must">必须</span> — 低秩分解，只训练少量参数。理解 rank / alpha 的物理意义。
- **LoRA 超参** <span class="prio prio-must">必须</span> — rank 8~64、alpha 常为 rank 的 2 倍、dropout 0.05。小数据用小 rank。
- **QLoRA** <span class="prio prio-must">必须</span> — 4bit 量化基座 + LoRA，单卡可微调大模型。个人开发者首选。
- **全参微调** <span class="prio prio-opt">选学</span> — 成本高，仅在数据量大且需要深度改造时用。
- **学习率与 warmup** <span class="prio prio-imp">重要</span> — LoRA 常用 1e-4 ~ 2e-4，warmup 3~5%。
- **灾难性遗忘** <span class="prio prio-must">必须</span> — 微调后通用能力下降。解法：混入通用数据 + 保留通用评测集。
- **DPO / ORPO / KTO** <span class="prio prio-imp">重要</span> — 偏好优化，不需要奖励模型。适合"风格对齐"而非"知识注入"。
- **蒸馏** <span class="prio prio-imp">重要</span> — 强模型生成高质量回答训练小模型，降本主力。
- **过拟合识别** <span class="prio prio-must">必须</span> — 训练 loss 降但验证集不降，或输出开始千篇一律。

## 对齐与强化学习（了解即可）

这一层你大概率不会自己跑，但**面试问"为什么推理模型要用 RL"答不出来，会显得只懂上层**。知道每样东西解决什么问题就够了。

- **RLHF 三段式** <span class="prio prio-imp">重要</span> — SFT → 训奖励模型（人类偏好打分）→ 用 PPO 优化策略。**问题：训练不稳定、要四个模型同时在显存里、贵**。
- **Reward Model（奖励模型）** <span class="prio prio-imp">重要</span> — 学会"人类更喜欢哪个回答"。它的偏差会被策略模型放大（reward hacking）。**这就是"过度讨好"和"过度拒答"的来源**。
- **PPO** <span class="prio prio-opt">选学</span> — 经典 RL 算法，需要 critic 模型和价值估计。工程复杂。
- **DPO** <span class="prio prio-must">必须</span> — 直接用偏好对（chosen / rejected）优化，**跳过奖励模型和 RL 循环**。工程上简单得多，是当前开源微调主流。
- **ORPO / KTO / SimPO** <span class="prio prio-imp">重要</span> — DPO 的变体：ORPO 把 SFT 和偏好优化合成一步；KTO 只需要"好/坏"标签不需要成对；SimPO 去掉参考模型省显存。
- **GRPO** <span class="prio prio-imp">重要</span> — DeepSeek 用的方法：**同一问题采样多个答案，用组内相对得分当优势**，省掉 critic 模型。**这是推理模型（R1 系）能训出来的关键**。
- **可验证奖励（RLVR）** <span class="prio prio-imp">重要</span> — 数学题对答案、代码跑单测——**奖励来自程序验证而不是人类偏好**。这是推理能力提升的核心机制，也是"为什么数学和代码先突破"的原因。
- **对齐税（Alignment Tax）** <span class="prio prio-imp">重要</span> — 对齐后模型变"安全"但也变"保守"，创造性和多样性下降。**产品上表现为"回答越来越像模板"**。
- **过度拒答** <span class="prio prio-imp">重要</span> — 安全训练过度导致正常问题被拒。**这是 ToB 落地最常见的抱怨**，解法是补充"该答的必须答"的正样本。
- **你实际会做的** <span class="prio prio-must">必须</span> — 不是训 RL，而是**构造偏好数据跑 DPO**：同一个问题收集"好答案/差答案"对，几百到几千条，DPO 一轮。这是应用工程师能独立完成的对齐工作。

## 工具链

- **LLaMA-Factory** <span class="prio prio-must">必须</span> — 国内最常用的一站式微调框架，WebUI 友好。
- **Unsloth** <span class="prio prio-imp">重要</span> — 显存与速度优化明显，单卡友好。
- **Axolotl** <span class="prio prio-opt">选学</span> — 配置化，适合批量实验。
- **PEFT / TRL / DeepSpeed** <span class="prio prio-imp">重要</span> — 底层库，需要定制时用。
- **合并与导出** <span class="prio prio-imp">重要</span> — LoRA 合并回基座、转 GGUF 供本地推理。

## 评估

- **微调效果评估** <span class="prio prio-must">必须</span> — 必须同时看"目标任务提升"和"通用能力保持"两组指标。
- **与 RAG 方案对比** <span class="prio prio-must">必须</span> — 花同样时间做 RAG 是不是更好？先做这个对照实验再决定微调。
- **回归测试** <span class="prio prio-imp">重要</span> — 微调模型上线前要跑完整评测集，不能只看几个样例。
- **成本对比** <span class="prio prio-imp">重要</span> — 自部署小模型的固定成本 vs 调 API 的边际成本，要算出交叉点。
