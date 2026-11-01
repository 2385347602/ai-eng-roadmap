import type { Lesson } from './types'

/**
 * 第二十三课：企业架构
 *
 * 核心立场：demo 证明"能做"，企业环境问的是"敢不敢让一千个人用"。
 * 这一课讲的都是 demo 阶段完全不会遇到、但企业采购第一轮就会问的东西。
 */
export const lesson23: Lesson = {
  id: 'L23',
  moduleId: 'enterprise',
  order: 23,
  path: '/learn/23-enterprise',
  title: '企业架构：从"能跑"到"敢让一千个人用"',
  subtitle: 'demo 里没有 SSO、没有权限、没有审计、没有账单分摊——企业第一轮就会问这些。',
  minutes: 65,
  level: '实战',
  outcome: '能设计一套能在企业里落地的架构：集成、隔离、合规、平台化、立项五件事都想清楚。',
  goals: [
    '说清企业环境相比 demo 多出的五道关',
    '设计 SSO、权限、审计、数据四条集成链路',
    '在多租户场景下选择正确的隔离级别',
    '处理数据驻留、留存、跨境等合规约束',
    '用 AI 网关做统一的密钥管理、限流、成本分摊',
    '写一份能过评审的立项材料（含 ROI 测算）',
  ],
  prereqs: [
    '学过第十一、十二课，理解安全与部署',
    '学过第十课，能算成本归因',
    '接触过企业系统（SSO、工单、内部权限体系）',
  ],

  steps: [
    {
      id: 's1',
      title: '五道关：demo 与企业之间的差距',
      checkpoint: '你的 demo 很好用，但 IT 部门第一句话会问什么？',
      blocks: [
        {
          type: 'table',
          head: ['关', 'demo 里', '企业里', '不过会怎样'],
          rows: [
            ['身份', '邮箱注册 / 无登录', 'SSO（OIDC/SAML/LDAP）+ 组织架构同步', '采购直接否'],
            ['权限', '所有人看所有数据', '按角色/部门/项目授权，最小权限', '数据泄露风险'],
            ['审计', '没有', '谁在什么时候访问了什么，可导出', '合规不过'],
            ['数据', '存在自己的库', '数据驻留、留存期限、删除权、跨境', '法务不过'],
            ['运营', '一个 API Key 所有人用', '按部门分摊成本、统一限流、密钥轮换', '财务和运维都不过'],
          ],
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '第一句话通常是"能接我们的 SSO 吗"',
          text: '这不是技术问题，是**采购流程问题**。企业不会为每个工具单独维护一套账号——离职员工账号不回收就是安全事故。所以"能不能接 SSO"经常是能不能进门的门槛，而不是加分项。**先做 SSO，再谈功能。**',
        },
        {
          type: 'p',
          text: '另一个常见误区：**以为"企业版"就是加个计费**。实际上企业版的工作量 80% 在"身份、权限、审计、数据"这四件事上，功能反而可能比个人版更少（因为要控制风险）。',
        },
        {
          type: 'analogy',
          title: '和"个人网盘 vs 企业网盘"对照',
          text: '个人网盘的核心是"存和取"；企业网盘的核心是"谁能看、谁看过、离职后怎么办、审计怎么导"。**功能没多，约束多了一个数量级。** AI 应用走的是同一条路。',
        },
      ],
    },

    {
      id: 's2',
      title: '四条集成链路',
      checkpoint: '接了 SSO 就够了吗？',
      blocks: [
        {
          type: 'p',
          text: '不够。SSO 只解决"你是谁"，还要解决"你能干什么""你干过什么""数据从哪来"。四条链路缺一不可：',
        },
        {
          type: 'table',
          head: ['链路', '标准做法', '关键细节'],
          rows: [
            ['身份（SSO）', 'OIDC / SAML，用企业 IdP', '**必须支持账号停用同步**，否则离职员工还能用'],
            ['组织（目录）', 'SCIM 或定时同步部门/汇报关系', '组织架构变了，权限要跟着变'],
            ['权限（授权）', 'RBAC（角色）+ ABAC（属性）混合', '权限判断必须在数据层，不能只在前端'],
            ['审计（日志）', '结构化事件 + 可导出 + 保留 6~12 个月', '**要能回答"谁在什么时候看了哪条数据"**'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '权限模型：RBAC + 资源级约束',
          note: '关键：角色决定"能做什么动作"，属性决定"能对哪些资源做"。两层都要有，只有 RBAC 会漏掉"同角色但不同部门"的情况。',
          code: `type Role = 'viewer' | 'editor' | 'admin'

type Principal = {
  userId: string
  tenantId: string
  roles: Role[]
  deptIds: string[]
  projectIds: string[]
}

type Resource = {
  tenantId: string
  ownerId: string
  deptId: string
  projectId?: string
  visibility: 'private' | 'dept' | 'project' | 'tenant'
}

function canRead(p: Principal, r: Resource): boolean {
  // ① 租户隔离是硬边界，任何角色都不能跨
  if (p.tenantId !== r.tenantId) return false

  // ② 管理员在本租户内全通
  if (p.roles.includes('admin')) return true

  // ③ 自己的资源
  if (r.ownerId === p.userId) return true

  // ④ 按可见性
  switch (r.visibility) {
    case 'private':
      return false
    case 'dept':
      return p.deptIds.includes(r.deptId)
    case 'project':
      return !!r.projectId && p.projectIds.includes(r.projectId)
    case 'tenant':
      return true
  }
}`,
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '审计日志最容易做假',
          text: '很多系统的"审计日志"只记了"某用户调用了某接口"。这在合规检查时**过不了**——人家要的是"谁在什么时候访问了哪条业务数据"。所以审计要记**资源标识**（文档 id、客户 id），不只是接口路径。而且**审计日志要防篡改**（append-only、单独存储、不能让应用账号删改）。',
        },
        {
          type: 'p',
          text: '还有一个实践细节：**权限变更要即时生效**。如果权限缓存在 JWT 里、有效期 24 小时，那"撤销某人的访问权"要等一天才生效——这在安全事件里是不可接受的。做法：JWT 只放 userId 和 tenantId，**权限每次从缓存/数据库查**（带 30 秒缓存），撤销时主动失效。',
        },
      ],
    },

    {
      id: 's3',
      title: '多租户：三种隔离级别，三种成本',
      checkpoint: 'SaaS 产品，客户要求"数据物理隔离"。你怎么做？',
      blocks: [
        {
          type: 'table',
          head: ['级别', '形态', '隔离强度', '成本', '适合'],
          rows: [
            ['共享库共享表', '所有租户一张表，带 tenant_id', '弱（靠代码保证）', '最低', '中小客户、SaaS 标准版'],
            ['共享库独立 schema', '每租户一个 schema', '中', '中', '中大客户'],
            ['独立实例', '每租户一套部署', '强', '高（运维成本线性增长）', '金融、医疗、大客户定制'],
          ],
        },
        {
          type: 'code',
          lang: 'sql',
          title: '共享表方案的三个必做',
          code: `-- ① 所有表都带 tenant_id，且放在索引最左
CREATE TABLE documents (
  id        bigserial PRIMARY KEY,
  tenant_id bigint NOT NULL,
  ...
);
CREATE INDEX documents_tenant_idx ON documents (tenant_id, created_at DESC);

-- ② 用行级安全（RLS）做兜底，即使代码漏了条件也挡住
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.tenant_id')::bigint);

-- ③ 每次请求开头设置上下文
-- SET LOCAL app.tenant_id = '123';
-- 注意用 SET LOCAL（事务级），不要用 SET（会话级，连接池会串）`,
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '共享表方案最怕"忘加条件"',
          text: '一个 `SELECT * FROM documents WHERE id = $1` 忘了 `tenant_id`，就是跨租户泄露。**靠代码规范不够，要有机制兜底**：① RLS（数据库层强制）；② CI 里静态检查"所有查询必须含 tenant_id"；③ 集成测试里用两个租户互相访问，断言拿不到。**三层里至少要有两层。**',
        },
        {
          type: 'p',
          text: '回答 checkpoint：客户要求物理隔离，通常意味着要**独立实例**（或至少独立 schema + 独立密钥）。这时候架构要支持"一套代码，多种部署形态"——配置化（数据库连接、密钥、存储桶都从配置读），而不是为每个客户拉一个分支。**一旦开始为客户拉分支，你就失去了升级能力。**',
        },
      ],
    },

    {
      id: 's4',
      title: '合规：四个绕不过去的约束',
      checkpoint: '"数据不能出境"具体意味着什么？',
      blocks: [
        {
          type: 'table',
          head: ['约束', '含义', '工程影响'],
          rows: [
            ['数据驻留', '数据必须存在指定地域', '模型 API 要选区域；向量库不能跨区复制'],
            ['留存期限', '日志/对话保存 N 天后必须删', '自动清理任务 + 可验证的删除'],
            ['删除权', '用户可要求删除全部数据', '跨存储删除（主库/向量/缓存/备份）'],
            ['跨境传输', '数据出境需评估或禁止', '**调用境外模型 API = 数据出境**'],
          ],
        },
        {
          type: 'callout',
          tone: 'danger',
          title: '最容易忽略的一条：调境外 API 就是数据出境',
          text: '你把用户的问题发给境外模型服务商，就是一次跨境数据传输。**这不需要"导出文件"，一次 HTTP 请求就够了。** 所以在受监管行业（金融、医疗、政务），要么用境内模型服务，要么用私有部署。**这个判断要在选型阶段做，不能等法务审核时才发现。**',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '删除：跨四个存储',
          code: `async function deleteUserData(userId: string) {
  // ① 主库（级联删）
  await db.query('DELETE FROM messages WHERE user_id = $1', [userId])
  await db.query('DELETE FROM documents WHERE owner_id = $1', [userId])

  // ② 向量库（最容易被漏）
  await db.query('DELETE FROM chunks WHERE doc_id NOT IN (SELECT id FROM documents)')

  // ③ 缓存
  await redis.del(\`answer:\${userId}:*\`)          // 按前缀扫
  await semanticCache.deleteByUser(userId)

  // ④ 备份：不能直接删，标记 + 到期清理
  await db.query(
    \`INSERT INTO deletion_requests (user_id, requested_at, backup_purge_after)
     VALUES ($1, now(), now() + interval '35 days')\`,
    [userId],
  )

  // ⑤ 审计：记录"谁在什么时候删了什么"，但审计日志本身不含个人数据
  audit.log({ action: 'user_data_deleted', userId, at: new Date() })
}`,
        },
        {
          type: 'p',
          text: '还有一个实操建议：**把"数据分类分级"做在前面**。哪些是公开、内部、机密、个人敏感，先定清楚。因为后面所有设计（能不能进 prompt、能不能记日志、能不能出网）都依赖这个分类。**没有分类，每个功能都要重新讨论一遍"这个能不能发出去"。**',
        },
      ],
    },

    {
      id: 's5',
      title: '平台化：一个 AI 网关解决 80% 的重复问题',
      checkpoint: '公司里 5 个团队都在调模型 API，会发生什么？',
      blocks: [
        {
          type: 'p',
          text: '会发生：5 份密钥散落各处、5 套限流各管各的、成本无法归集、出了事不知道谁在调、模型升级要改 5 个地方。**解法不是"发个规范让大家遵守"，是"提供一个网关让大家用"。**',
        },
        {
          type: 'table',
          head: ['网关能力', '解决什么', '不做会怎样'],
          rows: [
            ['统一密钥管理', '密钥只在网关，业务方不接触', '密钥泄露在 5 个仓库里'],
            ['统一限流', '按团队/应用配额', '一个团队跑批把全公司额度用光'],
            ['成本归集', '按 app / 团队 / 用户打标', '账单来了没人认'],
            ['模型路由', '按任务选模型，统一降级', '各团队自己写一套重试逻辑'],
            ['审计', '谁在调什么，统一记录', '出问题无法追溯'],
            ['统一日志与 trace', '跨应用可对比', '每个团队各搞一套'],
          ],
        },
        {
          type: 'code',
          lang: 'ts',
          title: '网关的最小接口设计',
          note: '关键：业务方只拿到一个内部 token，不接触上游密钥；所有调用带 app 标签，用于成本归集。',
          code: `// 业务方调用（OpenAI 兼容，降低迁移成本）
POST https://ai-gateway.internal/v1/chat/completions
Authorization: Bearer <内部 token>
X-App-Id: kb-qa
X-Feature: answer
X-User-Id: u_882

// 网关内部做：
// 1. 校验内部 token → 解析出 appId / tenantId / 配额
// 2. 查该 app 允许用哪些模型（防止用最贵的）
// 3. 限流（按 app / 用户 / 全局三层）
// 4. 选模型（按路由策略，或按请求里的 tier 参数）
// 5. 注入上游密钥（业务方看不到）
// 6. 记录 usage、成本、延迟、prompt 版本
// 7. 失败时按降级链重试
// 8. 返回（流式则透传 SSE）

// 成本报表直接来自网关日志，不用各团队上报
SELECT app_id, feature, sum(cost_usd) FROM gateway_logs
 WHERE day = current_date GROUP BY 1, 2 ORDER BY 3 DESC;`,
        },
        {
          type: 'callout',
          tone: 'tip',
          title: '网关的价值不在技术，在治理',
          text: '技术上它只是个代理，200 行就能写。**它的价值是把"分散在各团队的隐性成本"变成"可见的、可管理的账"。** 有了这张账，你才能回答"AI 到底给公司省了多少钱"——而这正是立项和续预算的关键。**没有网关的公司，AI 投入永远是笔糊涂账。**',
        },
        {
          type: 'p',
          text: '推广网关的现实策略：**别一开始就强制**。先做出一个"更好用"的版本（自动带 trace、自动重试、有成本看板），让两个团队自愿用起来，做出效果，再推给其他团队。**强制推行的内部平台，通常死于"业务方绕过它"。**',
        },
      ],
    },

    {
      id: 's6',
      title: '立项：怎么算 ROI 才有人信',
      checkpoint: '"AI 能提升效率"为什么说服不了财务？',
      blocks: [
        {
          type: 'p',
          text: '因为它不可验证。财务要的是"投入 X，节省 Y，Y 怎么算出来的"。所以 ROI 必须落到**可测量的单位经济**上（第十八课）：',
        },
        {
          type: 'code',
          lang: 'ts',
          title: '一份能过评审的 ROI 测算',
          code: `// 场景：客服工单自动回复
const baseline = {
  ticketsPerMonth: 12_000,
  avgHandleMinutes: 8,          // 人工处理一个工单 8 分钟
  agentHourlyCost: 18,          // 美元
}
const baselineCost = (baseline.ticketsPerMonth * baseline.avgHandleMinutes / 60) * baseline.agentHourlyCost
// = 12000 * 8/60 * 18 = $28,800/月

const project = {
  automationRate: 0.55,         // 55% 能自动处理（实测，不是估的）
  reworkRate: 0.12,             // 自动处理里 12% 需要人工返工
  costPerTicket: 0.032,         // 单次 AI 成本
  buildCost: 60_000,            // 一次性建设（人月）
  monthlyOps: 2_500,            // 模型 + 基础设施 + 维护
}

const handled = baseline.ticketsPerMonth * project.automationRate
const aiCost = handled * project.costPerTicket + project.monthlyOps
const savedLabor = (handled / 60) * baseline.avgHandleMinutes * baseline.agentHourlyCost
const reworkCost = (handled * project.reworkRate / 60) * baseline.avgHandleMinutes * baseline.agentHourlyCost

const monthlyNet = savedLabor - reworkCost - aiCost
// = 12672 - 1520 - 2710 = $8,442/月
const paybackMonths = project.buildCost / monthlyNet
// = 60000 / 8442 = 7.1 个月`,
        },
        {
          type: 'table',
          head: ['评审会问的问题', '你该准备好的答案'],
          rows: [
            ['自动化率怎么来的？', '试点数据：跑了 4 周、2000 个工单、人工标注准确率'],
            ['返工率多少？', '试点里统计的"自动回复后仍需人工介入"的比例'],
            ['质量会不会下降？', '评测集通过率 + 客户满意度对比'],
            ['成本会不会涨？', '单工单成本 + 峰值预算 + 上限机制'],
            ['失败了怎么办？', '降级方案（回退到人工）+ 灰度范围 + 回滚时间'],
            ['谁来维护？', '明确的 owner + 维护工作量估算'],
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: '最容易被问倒的是"试点数据"',
          text: '很多立项材料里的"预计提升 40%"是拍脑袋的。**评审时一句"这个 40% 怎么来的"就能问倒。** 正确做法：先做 2~4 周的小范围试点，拿到真实数字（自动化率、返工率、满意度），再写立项。**试点成本很低，但它是唯一能让你在评审会上站得住的东西。**',
        },
        {
          type: 'qa',
          q: '如果算下来 ROI 不好看，怎么办？',
          a: '三个方向：**① 缩小范围**——只做最高频、最标准化的那类工单（自动化率可能是 80% 而不是 55%），ROI 立刻变好；**② 换指标**——如果省不了人力，也许能省"首次响应时间"（客户满意度提升），那是另一个价值维度；**③ 老实说不好看**——有些场景确实不划算，比如低频、高复杂度、强合规要求的场景。**诚实地报告"这个场景不适合"，比硬做一个失败的项目更能建立信任。** 而且它会让你下一个立项更容易被批准。',
        },
      ],
    },
  ],

  exercises: [
    {
      id: 'e1',
      type: 'choice',
      title: '企业第一道关',
      points: 10,
      prompt: '你的 AI 工具在部门内试用效果很好，现在要推广到全公司。IT 部门最先会卡住的是什么？',
      options: [
        { id: 'a', text: '界面不够好看' },
        { id: 'b', text: '能不能接公司 SSO（以及离职账号能不能自动失效）' },
        { id: 'c', text: '模型不够强' },
        { id: 'd', text: '响应速度' },
      ],
      answer: ['b'],
      hints: [
        '想"一千个人用"和"十个人用"的差别在哪。',
        '企业不会为每个工具单独维护账号体系，离职员工账号不回收就是安全事故。',
        'b 是对的：SSO 是采购门槛，不是加分项。而且**必须支持账号停用同步**——只做登录不做停用同步，等于离职员工还能继续用。',
      ],
      explanation: '正确答案是 b。身份集成是企业采购的第一道门槛，功能反而不是。',
      approach: [
        '先接 OIDC/SAML，用企业 IdP',
        '同步组织架构（SCIM 或定时同步）',
        '支持账号停用 → 会话立即失效',
        '再做权限、审计、数据合规',
      ],
      knowledge: ['SSO', '身份集成', '企业采购'],
      pitfalls: [
        '只做登录不做停用同步',
        '以为"企业版"就是加计费',
      ],
    },
    {
      id: 'e2',
      type: 'multi',
      title: '多租户隔离',
      points: 15,
      prompt: '用"共享表 + tenant_id"方案做多租户，哪些是必须做的？（多选）',
      options: [
        { id: 'a', text: '所有表都带 tenant_id，且放在索引最左列' },
        { id: 'b', text: '用 PostgreSQL 行级安全（RLS）做兜底，即使代码漏了条件也挡住' },
        { id: 'c', text: '每次请求用 `SET LOCAL app.tenant_id` 设置上下文（事务级，不是会话级）' },
        { id: 'd', text: '在集成测试里用两个租户互相访问，断言拿不到对方数据' },
        { id: 'e', text: '只在前端隐藏其他租户的数据就够了' },
      ],
      answer: ['a', 'b', 'c', 'd'],
      hints: [
        '想"代码可能写漏"这个前提。',
        'e 是典型的错误——前端隐藏不影响接口返回数据。',
        'a 保证查询效率；b 是数据库层兜底；c 提供租户上下文（用 SET 会话级会在连接池里串租户）；d 是自动化验证。e 完全无效——攻击者直接调接口就绕过了。',
      ],
      explanation: 'a、b、c、d 都要做。核心思路是"多层兜底"，因为单靠代码规范一定会漏。',
      approach: [
        '表结构层：tenant_id 必带且在索引最左',
        '数据库层：RLS 强制隔离',
        '请求层：SET LOCAL 设置上下文',
        '测试层：跨租户访问断言',
        'CI 层：静态检查所有查询是否含 tenant_id',
      ],
      knowledge: ['多租户', 'RLS', '租户隔离', '连接池'],
      pitfalls: [
        '用 `SET` 而不是 `SET LOCAL`（连接池会串租户）',
        '只靠前端隐藏',
        '只靠代码规范，没有机制兜底',
      ],
    },
    {
      id: 'e3',
      type: 'fill',
      title: '删除权的跨存储清理',
      points: 15,
      prompt: '用户要求删除自己的数据。补全跨存储清理的五个位置。',
      templateLang: 'ts',
      template: `async function deleteUserData(userId) {
  await db.query('DELETE FROM messages WHERE user_id = $1', [userId])   // ① {{d1}}
  await db.query('DELETE FROM {{d2}} WHERE ...')                        // ② 向量库
  await redis.del('answer:' + userId + ':*')                            // ③ {{d3}}
  await markBackupPurge(userId)                                         // ④ {{d4}}
  audit.log({ action: 'user_data_deleted', userId })                    // ⑤ {{d5}}
}

// 最容易漏的是 {{d6}} —— 它能反推出语义`,
      blanks: [
        { id: 'd1', label: '① 是什么', accept: ['主库', '主数据库', '业务表', '关系库', '数据库'], width: 100 },
        { id: 'd2', label: '② 哪张表（存向量的）', accept: ['chunks', 'embeddings', 'vectors'], width: 100 },
        { id: 'd3', label: '③ 是什么', accept: ['缓存', '答案缓存', 'cache'], width: 90 },
        { id: 'd4', label: '④ 备份怎么处理', accept: ['标记到期清理', '标记', '标记删除', '到期清理'], width: 130 },
        { id: 'd5', label: '⑤ 是什么', accept: ['审计', '审计日志', '留痕'], width: 90 },
        { id: 'd6', label: '最容易漏的位置', accept: ['向量', '向量库', 'embedding', '向量数据'], width: 110 },
      ],
      hints: [
        '数据通常存在四个地方：主库、向量库、缓存、备份。',
        '向量不是"原文"，但它能反推出语义。',
        '① 主库（业务表）② chunks（向量表）③ 缓存 ④ 标记到期清理（备份不能直接删）⑤ 审计日志 ⑥ 向量。**最容易漏的就是向量——很多人只删了主表就以为删干净了。**',
      ],
      explanation: '删除权是合规检查的重点。漏任何一处都算未完成删除，而向量库和缓存是最常被漏的两处。',
      approach: [
        '主库：级联删业务数据',
        '向量库：删掉对应的 embedding',
        '缓存：按前缀清（含语义缓存）',
        '备份：标记 + 到期清理（不能直接删）',
        '审计：记录删除动作本身（不含个人数据）',
      ],
      knowledge: ['删除权', '跨存储清理', '向量数据'],
      pitfalls: [
        '只删主表',
        '忘了语义缓存',
        '直接删备份（可能破坏恢复能力）',
      ],
    },
    {
      id: 'e4',
      type: 'code',
      title: '实现资源访问判定',
      points: 20,
      prompt: '实现 `canRead(principal, resource)`。`principal` 含 `{ userId, tenantId, roles, deptIds, projectIds }`，`resource` 含 `{ tenantId, ownerId, deptId, projectId, visibility }`。规则：① 跨租户一律 false；② `admin` 角色在本租户内 true；③ 自己的资源 true；④ 按 visibility：`private` false、`dept` 看 deptIds、`project` 看 projectIds、`tenant` true。',
      starter: `function canRead(principal, resource) {
  // TODO
  return false
}

return canRead`,
      checks: [
        {
          name: '跨租户一律拒绝',
          expr: "result({userId:'u1',tenantId:'t1',roles:['admin'],deptIds:[],projectIds:[]}, {tenantId:'t2',ownerId:'u1',deptId:'d1',visibility:'tenant'}) === false",
        },
        {
          name: 'admin 本租户全通',
          expr: "result({userId:'u1',tenantId:'t1',roles:['admin'],deptIds:[],projectIds:[]}, {tenantId:'t1',ownerId:'u9',deptId:'d9',visibility:'private'}) === true",
        },
        {
          name: '自己的资源可读',
          expr: "result({userId:'u1',tenantId:'t1',roles:[],deptIds:[],projectIds:[]}, {tenantId:'t1',ownerId:'u1',deptId:'d1',visibility:'private'}) === true",
        },
        {
          name: 'private 别人不可读',
          expr: "result({userId:'u1',tenantId:'t1',roles:[],deptIds:['d1'],projectIds:[]}, {tenantId:'t1',ownerId:'u2',deptId:'d1',visibility:'private'}) === false",
        },
        {
          name: 'dept 同部门可读',
          expr: "result({userId:'u1',tenantId:'t1',roles:[],deptIds:['d1'],projectIds:[]}, {tenantId:'t1',ownerId:'u2',deptId:'d1',visibility:'dept'}) === true",
        },
        {
          name: 'dept 跨部门不可读',
          expr: "result({userId:'u1',tenantId:'t1',roles:[],deptIds:['d1'],projectIds:[]}, {tenantId:'t1',ownerId:'u2',deptId:'d2',visibility:'dept'}) === false",
        },
        {
          name: 'project 成员可读',
          expr: "result({userId:'u1',tenantId:'t1',roles:[],deptIds:[],projectIds:['p1']}, {tenantId:'t1',ownerId:'u2',deptId:'d2',projectId:'p1',visibility:'project'}) === true",
        },
        {
          name: 'tenant 级同租户可读',
          expr: "result({userId:'u1',tenantId:'t1',roles:[],deptIds:[],projectIds:[]}, {tenantId:'t1',ownerId:'u2',deptId:'d2',visibility:'tenant'}) === true",
        },
      ],
      solution: `function canRead(principal, resource) {
  // ① 租户是硬边界
  if (!principal || !resource) return false
  if (principal.tenantId !== resource.tenantId) return false

  // ② 管理员
  if ((principal.roles || []).includes('admin')) return true

  // ③ 自己的
  if (resource.ownerId === principal.userId) return true

  // ④ 按可见性
  switch (resource.visibility) {
    case 'private':
      return false
    case 'dept':
      return (principal.deptIds || []).includes(resource.deptId)
    case 'project':
      return !!resource.projectId && (principal.projectIds || []).includes(resource.projectId)
    case 'tenant':
      return true
    default:
      return false
  }
}`,
      hints: [
        '判断顺序很重要：租户 → 管理员 → 自己 → 可见性。',
        '注意 `private` 的语义是"只有 owner 能看"，不是"同部门能看"。',
        '完整实现：先判空和跨租户（一律 false）；再判 admin；再判 owner；最后 switch visibility。**default 返回 false**——未知的可见性类型必须拒绝，不能放行。',
      ],
      explanation: '权限判定的三条铁律：租户是硬边界（先判）、未知情况默认拒绝、判断顺序固定（否则逻辑会互相覆盖）。',
      approach: [
        '先判空和跨租户，直接拒绝',
        'admin 在本租户内放行',
        'owner 放行',
        '按 visibility 分支判断',
        '未知 visibility 返回 false',
      ],
      knowledge: ['RBAC/ABAC', '租户隔离', '默认拒绝'],
      pitfalls: [
        '先判 owner 再判租户（跨租户的 owner 也能读）',
        '把 private 当成 dept 处理',
        'default 分支返回 true',
      ],
    },
  ],

  test: {
    passScore: 80,
    minutes: 12,
    questions: [
      {
        id: 'q1',
        stem: '企业采购第一道门槛通常是？',
        options: [
          { id: 'a', text: '功能多少' },
          { id: 'b', text: '能不能接 SSO 且支持账号停用同步' },
          { id: 'c', text: '价格' },
          { id: 'd', text: '界面' },
        ],
        answer: 'b',
        why: '身份集成是采购流程的前提。只做登录不做停用同步，离职员工还能继续用，等于安全事故。',
        stepId: 's1',
      },
      {
        id: 'q2',
        stem: '审计日志要能回答的核心问题是？',
        options: [
          { id: 'a', text: '系统 QPS 多少' },
          { id: 'b', text: '谁在什么时候访问了哪条业务数据' },
          { id: 'c', text: '有多少用户注册' },
          { id: 'd', text: '平均响应时间' },
        ],
        answer: 'b',
        why: '只记"调用了某接口"过不了合规检查。必须记资源标识，且日志要防篡改（append-only、单独存储）。',
        stepId: 's2',
      },
      {
        id: 'q3',
        stem: '共享表多租户方案里，为什么用 `SET LOCAL` 而不是 `SET`？',
        options: [
          { id: 'a', text: 'LOCAL 更快' },
          { id: 'b', text: '`SET` 是会话级，连接池复用连接时会把租户上下文串到下一个请求' },
          { id: 'c', text: 'LOCAL 语法更短' },
          { id: 'd', text: '没区别' },
        ],
        answer: 'b',
        why: '连接池里一个连接会被多个请求复用。会话级设置会残留，导致 A 租户的请求带着 B 租户的上下文跑。',
        stepId: 's3',
      },
      {
        id: 'q4',
        stem: '"数据不能出境"对架构最直接的影响是？',
        options: [
          { id: 'a', text: '不能导出 Excel' },
          { id: 'b', text: '调用境外模型 API 就是数据出境，必须换境内服务或私有部署' },
          { id: 'c', text: '不能备份' },
          { id: 'd', text: '不能用云服务' },
        ],
        answer: 'b',
        why: '一次 HTTP 请求把用户问题发给境外服务商，就是跨境传输。这个判断要在选型阶段做。',
        stepId: 's4',
      },
      {
        id: 'q5',
        stem: 'AI 网关最大的价值是？',
        options: [
          { id: 'a', text: '技术上更先进' },
          { id: 'b', text: '把分散在各团队的隐性成本变成可见、可管理的账，支撑治理和决策' },
          { id: 'c', text: '让调用更快' },
          { id: 'd', text: '减少代码量' },
        ],
        answer: 'b',
        why: '技术上它只是个代理。价值在统一密钥、限流、成本归集、审计——这些让"AI 投入值不值"能被回答。',
        stepId: 's5',
      },
      {
        id: 'q6',
        stem: '立项材料里最容易被问倒的是？',
        options: [
          { id: 'a', text: '技术架构' },
          { id: 'b', text: '"预计提升 40%"这个数字怎么来的' },
          { id: 'c', text: '团队规模' },
          { id: 'd', text: '上线时间' },
        ],
        answer: 'b',
        why: '拍脑袋的数字一问就倒。正确做法是先做 2~4 周试点，拿到真实的自动化率、返工率、满意度再写材料。',
        stepId: 's6',
      },
    ],
  },

  project: {
    title: '项目一 · 知识库问答系统：企业化改造',
    contributes:
      '这一课把项目从"部门内试用"推进到"可以在公司推广"：身份、权限、审计、多租户、成本归集全部补齐。',
    tasks: [
      '接入 OIDC SSO：登录、token 校验、账号停用同步（停用后会话立即失效）',
      '实现 RBAC + 资源级权限：role 决定动作，visibility 决定可见范围，判定顺序固定',
      '共享表多租户改造：所有表加 tenant_id、建索引、开 RLS、用 SET LOCAL 设上下文',
      '写跨租户集成测试：两个租户互相访问，断言全部拿不到',
      '实现审计日志：记录 userId、action、resourceId、时间，append-only 存储，支持按资源反查',
      '实现删除权：跨主库/向量/缓存/备份四处清理，并验证删干净',
      '做一个迷你 AI 网关：统一密钥、按 app 限流、按 app+feature 归集成本',
      '写一份立项材料：试点数据、单位经济、ROI 测算、风险与降级方案',
    ],
    done: '两个租户的账号互相访问对方文档全部失败；离职账号停用后 30 秒内无法再调用；审计日志能回答"谁在什么时候看了文档 42"；用户点删除后主库/向量/缓存都查不到数据；网关报表能按部门报出本月成本。',
  },

  further: [
    { text: 'PostgreSQL 文档 · Row Security Policies' },
    { text: 'NIST SP 800-207 · Zero Trust Architecture（权限设计的底层思路）' },
    { text: '知识地图 10 工程架构（/guide/10-architecture）' },
  ],
}
