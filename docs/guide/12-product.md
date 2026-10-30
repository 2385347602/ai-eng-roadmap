# 12 · 产品与场景

> **贯穿全局** · 技术选错的成本可以挽回，场景选错基本等于项目失败。
> 这一层决定你是在做有价值的东西还是在做玩具。

## 判断标准

一个场景值不值得做 AI，我通常看三条：任务本身是不是"模糊输入 → 模糊输出"（确定性的活交给规则引擎更便宜）；错误成本高不高（高的话必须有人工兜底）；有没有验证手段（不能验证的场景，你永远不知道做得好不好）。

三条都过，才值得投入。只过一条的，基本会变成演示品。

## 场景判断

- **适合 LLM 的四类任务** <span class="prio prio-must">必须</span> — 文本理解与生成、非结构化转结构化、多义匹配、开放式建议。
- **不适合的四类** <span class="prio prio-must">必须</span> — 精确计算、强实时、零容错、需要可解释审计。
- **"AI 含量"过高的伪需求** <span class="prio prio-must">必须</span> — 用户真正要的可能是规则引擎或搜索，不是聊天机器人。
- **任务的可验证性** <span class="prio prio-must">必须</span> — 输出能不能被自动或低成本人工验证？不能验证的场景慎入。
- **人机边界设计** <span class="prio prio-must">必须</span> — 哪些环节必须人来定，哪些可以全自动。这条线划错，产品要么危险要么没用。
- **频率与价值密度** <span class="prio prio-imp">重要</span> — 高频低价值（成本扛不住）和低频高价值（用户想不起来）都不好做。

## 产品形态

- **Copilot 型** <span class="prio prio-must">必须</span> — 嵌在现有工作流里做辅助，最容易落地，用户接受度高。
- **Agent 型** <span class="prio prio-must">必须</span> — 端到端完成任务，价值高但可靠性难保证。
- **工作流自动化型** <span class="prio prio-must">必须</span> — 固定流程 + AI 节点，最稳，ToB 主流。
- **知识库问答型** <span class="prio prio-must">必须</span> — RAG 的标准形态，红海但需求真实。
- **结构化抽取型** <span class="prio prio-must">必须</span> — 合同、发票、简历、工单。ROI 最容易算清。
- **内容生产型** <span class="prio prio-imp">重要</span> — 批量生成 + 人工审核。成本优势明显。

## 落地

- **需求验证方法** <span class="prio prio-must">必须</span> — 先用人工 + 现成模型跑 50 个真实样本，看能不能达到及格线，再谈开发。
- **最小可用评测集** <span class="prio prio-must">必须</span> — 项目启动第一周就该有，而不是上线前才做。
- **上线门槛定义** <span class="prio prio-must">必须</span> — 量化：准确率 ≥ X%、P95 延迟 ≤ Ys、成本 ≤ Z 元/次。写下来。
- **用户预期管理** <span class="prio prio-must">必须</span> — 明确告知能力边界，比事后道歉便宜得多。
- **失败时的降级体验** <span class="prio prio-must">必须</span> — 模型不可用时退回搜索/模板/人工，而不是报错白屏。
- **成本与定价模型** <span class="prio prio-must">必须</span> — 按次/按 token/订阅。算清毛利再定。
- **竞品拆解方法** <span class="prio prio-imp">重要</span> — 用同一批问题测竞品，看它哪里强哪里弱。比看宣传页有用。
- **上线后的观察期** <span class="prio prio-imp">重要</span> — 前两周每天看 badcase，比任何评测集都真实。
