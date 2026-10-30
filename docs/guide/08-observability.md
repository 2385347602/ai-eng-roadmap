# 08 · 可观测与运维

> **投入权重：5%** · 出事的时候，能不能在 5 分钟内定位到"是检索错了还是模型抽风"，全靠这一层。

## 为什么它比看起来重要

AI 系统的故障特别隐蔽：接口 200、响应正常、内容全错。传统监控（QPS、错误率、CPU）完全抓不到。用户投诉"它今天答得不对"，而你打开日志只看到一堆 200。

可观测性就是让"答得不对"这件事变得可查。它的核心是 trace——把一次请求的每一步（prompt 组装、检索、模型调用、工具调用）都记录下来，能完整回放。

## Trace

- **Trace 的概念** <span class="prio prio-must">必须</span> — 一次请求的完整链路：prompt 组装 → 检索 → 模型调用 → 工具调用 → 输出。每步都要留痕。
- **OpenTelemetry GenAI 语义约定** <span class="prio prio-imp">重要</span> — 行业标准字段命名，接哪家平台都通用。
- **Langfuse** <span class="prio prio-must">必须</span> — 开源自部署首选，trace + 评测 + 成本一体。
- **LangSmith** <span class="prio prio-imp">重要</span> — LangChain 官方，体验好但绑定生态。
- **Arize Phoenix / Helicone** <span class="prio prio-imp">重要</span> — 开源可观测方案，按需选。
- **会话回放** <span class="prio prio-must">必须</span> — 能完整重放用户那次对话，包括检索到的原文。排查问题的必备能力。

## 日志与成本

- **全量 prompt/response 记录** <span class="prio prio-must">必须</span> — 必须存，但要脱敏。这是后续做数据集和归因的原料。
- **PII 脱敏** <span class="prio prio-must">必须</span> — 手机号、身份证、邮箱入库前脱敏。合规硬要求。
- **token 统计与成本分摊** <span class="prio prio-must">必须</span> — 按用户/租户/功能维度统计，才能知道谁在烧钱。
- **延迟分解** <span class="prio prio-must">必须</span> — 排队/检索/首 token/生成 各占多少，优化才知道往哪打。
- **错误分类** <span class="prio prio-must">必须</span> — 超时/限流/内容审核/格式错误/工具失败。分类后才能定告警。
- **采样策略** <span class="prio prio-imp">重要</span> — 全量存成本高，可采样，但错误与差评必须 100% 留存。

## 版本与发布

- **三类版本管理** <span class="prio prio-must">必须</span> — prompt 版本 / 模型版本 / 索引版本。三者任一变更都要能回滚。
- **灰度发布** <span class="prio prio-must">必须</span> — 按用户比例放量，观察指标再全量。
- **回滚策略** <span class="prio prio-must">必须</span> — 配置化切换，不依赖重新部署。
- **告警设计** <span class="prio prio-imp">重要</span> — 错误率、P95 延迟、成本突增、审核拦截率异常。
- **变更记录** <span class="prio prio-imp">重要</span> — 每次上线记下"改了什么"，否则指标波动时无法归因。

## 反馈闭环

- **显式反馈** <span class="prio prio-must">必须</span> — 点赞/点踩/评分。设计要轻，别打断流程。
- **隐式反馈** <span class="prio prio-must">必须</span> — 复制、采纳、编辑后发送、重新生成、中途打断。比显式更真实。
- **badcase 归因流程** <span class="prio prio-must">必须</span> — 收集 → 分类（检索/生成/理解/格式）→ 修 → 回归测试。要有固定节奏。
- **数据飞轮** <span class="prio prio-imp">重要</span> — 用户反馈 → 评测集 → 优化 → 更好体验 → 更多使用。这是长期壁垒。
- **归因的责任人** <span class="prio prio-imp">重要</span> — 没有人负责的 badcase 池会迅速腐烂。要指定轮值。
