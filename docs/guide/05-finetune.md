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
