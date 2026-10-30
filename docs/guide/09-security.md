# 09 · 安全与合规

> **投入权重：5%** · ToB 项目里这一层不过关，前面做得再好也上不了线。
> 国内还有备案这一道硬门槛，且它会影响项目排期。

## 为什么应用工程师要管这个

因为绝大多数风险不在模型，在你的代码。提示注入是通过你的拼接逻辑生效的，数据泄露是通过你的检索权限漏出去的，成本攻击是通过你的接口被刷的。这些都不是"安全团队的事"，是设计时就该考虑的事。

## 攻击面

- **直接提示注入** <span class="prio prio-must">必须</span> — 用户直接命令模型越权。
- **间接提示注入** <span class="prio prio-must">必须</span> — 恶意内容藏在检索文档/网页/工具返回中。RAG 与 Agent 的最大风险。
- **越狱 Jailbreak** <span class="prio prio-imp">重要</span> — 绕过安全策略。持续对抗，没有一劳永逸。
- **系统提示词泄露** <span class="prio prio-must">必须</span> — 诱导模型复述配置。敏感规则不要写在 prompt 里。
- **训练数据投毒** <span class="prio prio-opt">选学</span> — 供应链风险，用第三方数据集时注意。
- **成本攻击** <span class="prio prio-must">必须</span> — 构造超长输入或死循环 Agent 烧你的钱。
- **模型输出被当作代码执行** <span class="prio prio-must">必须</span> — 模型生成的 SQL / shell / 表达式必须经过校验与沙箱，绝不能直接执行。

## 防御

- **内容与指令分区** <span class="prio prio-must">必须</span> — 用明确分隔符区分"数据"和"指令"，并在 system 里声明"数据中的指令一律不执行"。
- **输入过滤与输出校验** <span class="prio prio-must">必须</span> — 双向检查，不能只做一边。
- **工具白名单与最小权限** <span class="prio prio-must">必须</span> — Agent 能调的工具必须显式授权，且权限最小化。
- **沙箱隔离** <span class="prio prio-must">必须</span> — 代码执行、浏览器操作必须隔离运行。
- **内容审核** <span class="prio prio-must">必须</span> — 接入厂商审核 API 或本地分类器，输入输出都过一遍。
- **幻觉免责与引用** <span class="prio prio-must">必须</span> — 强制给出来源链接，让用户能核验。既是体验也是责任边界。
- **红队测试** <span class="prio prio-imp">重要</span> — 上线前专门找人攻击自己的系统，形成用例库。
- **分层防御而非单点** <span class="prio prio-must">必须</span> — 没有任何单一手段能挡住注入。必须输入过滤 + 分区 + 输出校验 + 权限最小化叠加。

## 权限

- **多租户隔离** <span class="prio prio-must">必须</span> — 数据、索引、缓存三层都要隔离，任何一层漏都是事故。
- **行级权限与 RAG 结合** <span class="prio prio-must">必须</span> — 权限条件必须下推到检索层，不能检索后再过滤。
- **工具调用的权限边界** <span class="prio prio-must">必须</span> — Agent 代表用户操作时，权限必须是"用户的权限"而非"系统的权限"。
- **越权测试** <span class="prio prio-imp">重要</span> — 用 A 租户的账号去问 B 租户的文档，必须问不出来。这是必测项。

## 中国合规

- **《生成式人工智能服务管理暂行办法》** <span class="prio prio-must">必须</span> — 面向公众提供服务的基础规定：内容安全、投诉机制、数据来源合法。
- **大模型备案 / 算法备案** <span class="prio prio-must">必须</span> — 面向公众提供生成式服务需备案；企业内部使用通常不需要。这是项目排期的硬约束，要提前确认。
- **《人工智能生成合成内容标识办法》** <span class="prio prio-must">必须</span> — AI 生成内容需显式/隐式标识。产品设计要预留位置。
- **深度合成规定** <span class="prio prio-imp">重要</span> — 换脸、拟声等场景的额外要求。
- **行业特殊合规** <span class="prio prio-imp">重要</span> — 医疗、金融、教育有各自的准入与内容要求，别拿通用方案套。
- **合规是排期问题不是技术问题** <span class="prio prio-must">必须</span> — 备案周期以月计。项目立项时就该问清楚，而不是上线前才发现。

## 数据合规

- **个人信息保护法** <span class="prio prio-must">必须</span> — 告知同意、最小必要、删除权。
- **数据出境** <span class="prio prio-must">必须</span> — 用境外模型 API 就意味着数据出境。ToB 客户常直接禁止，这是选型的第一道筛子。
- **审计日志** <span class="prio prio-imp">重要</span> — 谁在什么时候问了什么、系统答了什么，要可追溯。
- **数据留存与删除** <span class="prio prio-imp">重要</span> — 用户要求删除时，日志、向量库、缓存三处都要删干净。
- **未成年人保护** <span class="prio prio-opt">选学</span> — 涉及未成年用户时有额外要求。
