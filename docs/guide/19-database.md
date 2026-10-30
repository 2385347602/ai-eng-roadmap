# 19 · 数据库与数据建模

> **投入权重：8%** · 补的一章。AI 应用的数据模型比普通 CRUD 复杂得多——会话、消息、工具调用、Agent 执行记录、知识库、评测结果，全都要能追溯。
>
> 这一章的价值在最后那节：**AI 专属表设计**。面试问"你怎么存会话和工具调用"，能画出表结构的人不多。

## PostgreSQL 基础

- **建表与约束** <span class="prio prio-must">必须</span> — 主键、外键、唯一、非空、CHECK。**约束写在数据库里，不要只写在应用层**——应用有 bug 时数据库是最后一道防线。
- **索引类型** <span class="prio prio-must">必须</span> — B-tree（默认）、GIN（JSONB、数组、全文）、GiST、HNSW（向量）。选错索引类型等于没建。
- **复合索引的顺序** <span class="prio prio-must">必须</span> — 最左前缀原则。`(tenant_id, created_at)` 能服务"按租户查最近"，反过来不行。
- **部分索引** <span class="prio prio-imp">重要</span> — `WHERE deleted_at IS NULL`，只索引有效行，省空间且更快。
- **`EXPLAIN ANALYZE`** <span class="prio prio-must">必须</span> — 看是否走索引、扫描行数、实际耗时。**不会看执行计划就没法优化查询。**
- **事务与隔离级别** <span class="prio prio-must">必须</span> — 默认 Read Committed，需要防幻读时用 Repeatable Read。理解每种级别解决什么问题。
- **行锁与乐观锁** <span class="prio prio-imp">重要</span> — `SELECT ... FOR UPDATE` 与 version 字段。并发更新会话状态时会用到。
- **JSONB** <span class="prio prio-must">必须</span> — 存工具的任意参数、模型的原始响应。**但要清楚边界**：常查询的字段要提成独立列，JSONB 只放不确定结构的部分。
- **数组类型** <span class="prio prio-imp">重要</span> — 存 tag、chunk_ids 这类小集合。
- **全文检索 `tsvector`** <span class="prio prio-must">必须</span> — 中文需要分词扩展（zhparser / pg_jieba）。**这是 BM25 混合检索的基础**，不用额外部署 ES。
- **迁移管理** <span class="prio prio-must">必须</span> — Prisma Migrate / Drizzle Kit / node-pg-migrate。迁移要可回滚，且不能破坏线上。
- **连接池** <span class="prio prio-must">必须</span> — 池大小 = 并发查询数，不是并发请求数。**AI 应用里模型调用慢，连接不能一直占着。**

## pgvector

- **扩展安装与类型** <span class="prio prio-must">必须</span> — `CREATE EXTENSION vector`，`vector(1024)` 指定维度。
- **距离运算符** <span class="prio prio-must">必须</span> — `<->` 欧氏、`<#>` 负内积、`<=>` 余弦距离。**用错运算符结果完全不对，而且不报错。**
- **HNSW 索引** <span class="prio prio-must">必须</span> — `USING hnsw (embedding vector_cosine_ops)`，参数 `m`（每层连接数）和 `ef_construction`（构建时的候选数）。查询时用 `SET hnsw.ef_search`。
- **IVFFlat 索引** <span class="prio prio-imp">重要</span> — 构建快、内存小，但召回依赖 `lists` 参数且需要数据先填充。
- **过滤 + 向量的组合** <span class="prio prio-must">必须</span> — 先 `WHERE tenant_id = ?` 再排序。**pgvector 的过滤是后置的**，选择性差时可能先取 top-k 再过滤导致结果不足。解法：调大 k 或建部分索引。
- **维度与性能** <span class="prio prio-imp">重要</span> — 维度越高索引越大越慢。1024 维是常见折中。
- **批量插入** <span class="prio prio-imp">重要</span> — 用 `COPY` 或批量 INSERT，逐条插会慢几十倍。

## Redis

- **五种数据结构与场景** <span class="prio prio-must">必须</span> — String（缓存、计数器）、Hash（会话）、List（简单队列）、Set（去重）、ZSet（排行榜、延时队列）。
- **TTL 与过期策略** <span class="prio prio-must">必须</span> — 缓存必须设过期，否则内存会满。
- **Cache Aside 模式** <span class="prio prio-must">必须</span> — 读时未命中查库回填，写时删缓存（不是更新缓存）。
- **缓存穿透 / 击穿 / 雪崩** <span class="prio prio-must">必须</span> — 空值缓存、互斥锁、过期时间加随机。**AI 场景里击穿很致命**——一个热门问题缓存失效，几十个请求同时打模型。
- **语义缓存的坑** <span class="prio prio-must">必须</span> — 相似度高不等于答案相同。必须设高阈值 + 排除时效性/数值类查询 + key 带上模型和 prompt 版本。
- **分布式锁** <span class="prio prio-imp">重要</span> — `SET key val NX PX 30000`，释放时校验 val（防误删别人的锁）。
- **限流器** <span class="prio prio-must">必须</span> — 滑动窗口或令牌桶，用 Lua 脚本保证原子性。
- **幂等键存储** <span class="prio prio-must">必须</span> — `SET idem:xxx 1 NX EX 3600`，成功才写入。

## 消息队列

AI 应用里凡是"超过 30 秒"的活都要走队列：文档索引、批量向量化、长任务 Agent、评测跑批、报表生成。**这一块是后端基本功，前端转岗最容易空。**

- **为什么要 MQ 而不是直接调** <span class="prio prio-must">必须</span> — 三个理由：① 解耦（上传接口不用等索引完成）② 削峰（1000 个文档同时上传，worker 按能力消费）③ 可靠（失败了能重试，进程崩了消息还在）。
- **Kafka** <span class="prio prio-must">必须</span> — 高吞吐、可回放（按 offset 重读）、多消费者组。**适合事件流、日志、需要重放的场景**。缺点是运维重、延迟不如轻量队列。
- **RabbitMQ** <span class="prio prio-imp">重要</span> — 路由灵活（exchange / routing key）、延迟低。**适合任务分发**。
- **Redis Stream / BullMQ** <span class="prio prio-must">必须</span> — 已经有 Redis 就别再引入 Kafka。**BullMQ（Node）是 AI 应用最实际的选择**：延迟任务、重试、优先级、并发控制都有。
- **云厂商队列（SQS / RocketMQ / Pulsar）** <span class="prio prio-imp">重要</span> — 免运维。国内 ToB 项目常见 RocketMQ。
- **至少一次 vs 最多一次 vs 恰好一次** <span class="prio prio-must">必须</span> — 现实里几乎都是**至少一次（at-least-once）**，所以**消费端必须幂等**。这是最重要的一条。
- **消费幂等** <span class="prio prio-must">必须</span> — 用业务唯一键（不是消息 ID）去重：`document_id + version`、`task_id + step`。**存一张 `processed_events` 表或 Redis SETNX**。
- **消息顺序** <span class="prio prio-imp">重要</span> — 全局有序代价极高。**做法：按业务键分区（Kafka partition key / RabbitMQ 单队列单消费者），保证"同一个文档的消息有序"就够**。
- **死信队列（DLQ）** <span class="prio prio-must">必须</span> — 重试 N 次仍失败的消息进 DLQ，人工处理。**没有 DLQ，坏消息会永远卡住队列**。
- **重试与退避** <span class="prio prio-must">必须</span> — 指数退避 + 抖动。**别用固定间隔重试**，会把下游打死。
- **积压监控** <span class="prio prio-must">必须</span> — 队列长度、消费速率、最老消息年龄。**这三个指标是"系统快挂了"的最早信号**。
- **事务消息 / Outbox 模式** <span class="prio prio-must">必须</span> — "写库成功但发消息失败"是经典不一致。**解法：在同一个事务里写业务表和 outbox 表，另一个进程轮询 outbox 发消息**。这是最可靠的方案。
- **延迟队列** <span class="prio prio-imp">重要</span> — 定时任务、超时取消、重试等待。Redis ZSet 或 BullMQ 的 delayed job。
- **优先级队列** <span class="prio prio-imp">重要</span> — 付费用户的索引任务插队。**别用一个队列混着跑**，分高/低优先级两个队列。
- **可见性超时（Visibility Timeout）** <span class="prio prio-imp">重要</span> — 消费者拿走消息后如果崩溃，消息要能重新可见。**超时设太短会重复消费，太长会卡住**。
- **本地开发怎么跑** <span class="prio prio-imp">重要</span> — `docker compose up redis` 起 BullMQ 就够。**别为了本地跑通装一整套 Kafka**。

## 高并发设计（面试必问）

不是"能扛多少 QPS"，是"**在有限资源下，怎么让关键请求不被非关键请求拖死**"。

- **先算账再优化** <span class="prio prio-must">必须</span> — QPS × 平均耗时 = 并发数（利特尔法则）。100 QPS × 2 秒 = 需要 200 并发。**算不出来就别谈优化**。
- **瓶颈定位顺序** <span class="prio prio-must">必须</span> — 数据库连接池 → 下游 API 限流 → CPU → 内存 → 磁盘 IO → 网络。**AI 应用九成瓶颈在"等下游模型"，不在自己的代码**。
- **连接池** <span class="prio prio-must">必须</span> — 池大小不是越大越好。**PG 连接数超过 CPU 核数×2~4 后性能反降**。必须设上限 + 排队超时。
- **异步化** <span class="prio prio-must">必须</span> — 能不等就不等。发通知、写日志、算统计全扔队列。**这是提升并发最便宜的手段**。
- **缓存三层** <span class="prio prio-must">必须</span> — 本地内存（进程内，最快但一致性问题）→ Redis（跨实例）→ CDN / 静态。**热点数据放本地，共享数据放 Redis**。
- **读写分离** <span class="prio prio-imp">重要</span> — 读多写少的场景。**注意主从延迟**——写完立刻读可能读不到。
- **分页与游标** <span class="prio prio-must">必须</span> — `OFFSET 100000` 会扫 10 万行。**用游标（`WHERE id > last_id`）**。消息列表、日志列表必用。
- **限流的位置** <span class="prio prio-must">必须</span> — 网关层做粗限流（按 IP/租户），应用层做细限流（按功能/模型）。**只做一层一定漏**。
- **背压（Backpressure）** <span class="prio prio-must">必须</span> — 下游扛不住时要主动降速或拒绝，**不能让请求在内存里堆到 OOM**。
- **隔离（舱壁）** <span class="prio prio-must">必须</span> — 不同租户/功能用独立连接池和线程池。见 [10 · 架构](/guide/10-architecture)。
- **压测** <span class="prio prio-must">必须</span> — k6 / autocannon / wrk。**必须压到系统崩，才知道拐点在哪**。只压到"看起来正常"没有意义。
- **慢查询与 N+1** <span class="prio prio-must">必须</span> — 一个列表接口发出 100 条 SQL 是最常见的性能事故。**用 `EXPLAIN` 看执行计划，别猜**。
- **"降级"比"优化"更有效** <span class="prio prio-imp">重要</span> — 高峰期关掉非核心功能（推荐、富文本、图片生成），比花两周优化 SQL 见效快。

## AI 专属数据模型

这是本章最有价值的部分。下面是一套能支撑真实产品的表设计，**面试时能画出来就是加分项**。

### 核心业务表

```sql
-- 租户（多租户隔离的根）
CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  plan        text NOT NULL DEFAULT 'free',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 用户
CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  email       text NOT NULL,
  password_hash text,
  role        text NOT NULL DEFAULT 'member',   -- owner/admin/member
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
CREATE INDEX ON users (tenant_id);

-- 会话
CREATE TABLE conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  title       text,
  model       text NOT NULL,
  system_prompt_version text,
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX ON conversations (tenant_id, user_id, updated_at DESC);

-- 消息（核心表，字段要克制）
CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            text NOT NULL,          -- user/assistant/tool/system
  content         text,
  tool_calls      jsonb,                  -- assistant 发起的调用
  tool_call_id    text,                   -- tool 角色对应的调用 ID
  token_input     int,
  token_output    int,
  model           text,
  finish_reason   text,
  latency_ms      int,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON messages (conversation_id, created_at);
```

**设计要点**：`tool_calls` 用 JSONB 而不是单独表，因为它的结构随模型厂商变化；但 `tool_call_id` 单独成列，因为要 JOIN 和去重。

### Agent 执行表

```sql
-- 一次 Agent 运行
CREATE TABLE agent_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  conversation_id uuid REFERENCES conversations(id),
  status          text NOT NULL,          -- pending/running/waiting_approval/succeeded/failed/cancelled
  input           jsonb NOT NULL,
  output          jsonb,
  total_steps     int NOT NULL DEFAULT 0,
  total_tokens    int NOT NULL DEFAULT 0,
  total_cost      numeric(12,6) NOT NULL DEFAULT 0,
  error           jsonb,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);
CREATE INDEX ON agent_runs (tenant_id, status, started_at DESC);

-- 每一步（这是 trace 的持久化）
CREATE TABLE agent_steps (
  id          bigserial PRIMARY KEY,
  run_id      uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_no     int NOT NULL,
  type        text NOT NULL,              -- thought/tool_call/observation/answer
  tool_name   text,
  tool_input  jsonb,
  tool_output jsonb,
  error       text,
  tokens      int,
  duration_ms int,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON agent_steps (run_id, step_no);

-- 检查点（断点恢复的关键）
CREATE TABLE agent_checkpoints (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_no     int NOT NULL,
  state       jsonb NOT NULL,             -- 完整可序列化的运行时状态
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON agent_checkpoints (run_id, step_no DESC);

-- 人工审批
CREATE TABLE approvals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      uuid NOT NULL REFERENCES agent_runs(id),
  step_id     bigint NOT NULL REFERENCES agent_steps(id),
  action      jsonb NOT NULL,             -- 将要执行的动作
  preview     text NOT NULL,              -- 人话描述，给审批人看
  risk        text NOT NULL,              -- low/medium/high
  status      text NOT NULL DEFAULT 'pending',
  decided_by  uuid REFERENCES users(id),
  decided_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON approvals (status, created_at);
```

**面试考点**：为什么要有 `agent_checkpoints`？因为"执行到第三步服务器重启"是真实场景，没有检查点就只能从头跑，成本和体验都不可接受。

### 知识库表

```sql
CREATE TABLE documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  title       text NOT NULL,
  source_uri  text,
  mime_type   text,
  content_hash text NOT NULL,             -- 用于增量更新去重
  version     int NOT NULL DEFAULT 1,
  status      text NOT NULL DEFAULT 'pending',  -- pending/parsing/indexed/failed
  error       text,
  metadata    jsonb NOT NULL DEFAULT '{}', -- 部门、密级、生效日期
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE UNIQUE INDEX ON documents (tenant_id, source_uri) WHERE deleted_at IS NULL;

CREATE TABLE document_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL,              -- 冗余存储，用于检索时直接过滤
  parent_id   uuid,                       -- 父子块
  chunk_index int NOT NULL,
  content     text NOT NULL,
  section_path text,                      -- "第三章 > 3.2 退款政策"
  page        int,
  token_count int,
  embedding   vector(1024),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON document_chunks (tenant_id, document_id);
CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops);
```

**三个关键设计**：
1. `content_hash` —— 判断文档是否真变了，避免无意义重建索引
2. `tenant_id` 冗余在 chunks 上 —— 检索时能直接过滤，不用 JOIN
3. `ON DELETE CASCADE` —— 删文档时 chunk 自动清理，避免"删了还在检索到"

### 成本与评测表

```sql
CREATE TABLE model_usage (
  id            bigserial PRIMARY KEY,
  tenant_id     uuid NOT NULL,
  user_id       uuid,
  feature       text NOT NULL,            -- chat/rag/agent/eval
  model         text NOT NULL,
  prompt_tokens int NOT NULL,
  completion_tokens int NOT NULL,
  cached_tokens int DEFAULT 0,
  cost          numeric(12,6) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON model_usage (tenant_id, created_at);
CREATE INDEX ON model_usage (feature, created_at);

CREATE TABLE eval_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_version text NOT NULL,
  prompt_version  text NOT NULL,
  model       text NOT NULL,
  metrics     jsonb NOT NULL,             -- {recall@5: 0.89, faithfulness: 0.93}
  sample_count int NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

**`feature` 这一列是关键**——没有它，你只知道总成本，不知道是聊天贵还是 RAG 贵还是评测贵。

## 验收标准

能从零设计出上面这套表，并且能回答：

- 为什么 `tenant_id` 在 chunks 上冗余？
- 为什么检查点要单独一张表而不是塞进 `agent_steps`？
- 会话列表查询走哪个索引？
- 用户要求删除数据时，要删哪几张表？

答得出来，这一章就过关了。
