# 20 · 网络、系统与分布式基础

> **投入权重：5%** · 补的一章。不需要背操作系统教材，但这些知识决定你**能不能定位生产故障**。
>
> 现实是：AI 应用 90% 的线上问题不在模型，在超时、连接、代理、流式缓冲、内存这些地方。

## HTTP 与连接

- **HTTP/1.1 与 HTTP/2 的差别** <span class="prio prio-must">必须</span> — 队头阻塞、多路复用、头部压缩。**流式场景下 HTTP/1.1 的 6 连接限制会卡住并发。**
- **长连接与 Keep-Alive** <span class="prio prio-must">必须</span> — 默认开启，但中间代理可能提前断。AI 长响应必须配心跳。
- **SSE 的协议本质** <span class="prio prio-must">必须</span> — 就是"一个不结束的 HTTP 响应，按 `\n\n` 分段"。它不是新协议，所以不需要特殊服务端支持，但**极容易被代理缓冲**。
- **`X-Accel-Buffering: no`** <span class="prio prio-must">必须</span> — Nginx 默认会缓冲响应，流式会变成"等全部生成完才吐"。这个头是必加的。
- **超时的四个位置** <span class="prio prio-must">必须</span> — 客户端、反向代理（proxy_read_timeout）、应用、上游 API。**任何一层短了都会中断流式**，排查时要逐层看。
- **DNS 解析** <span class="prio prio-imp">重要</span> — A/CNAME/TTL。内网服务用私有 DNS。**解析失败和网络不通的表现很像，别误判。**
- **TLS 握手与证书** <span class="prio prio-imp">重要</span> — 证书链、SNI、自动续期（certbot）。证书过期是最低级的线上事故，但每年都有人犯。
- **CORS 的真实机制** <span class="prio prio-must">必须</span> — 预检请求、`Access-Control-Allow-Origin`、携带凭证时不能写 `*`。**流式接口的 CORS 预检失败会表现成"请求没发出去"。**
- **反向代理的作用** <span class="prio prio-must">必须</span> — TLS 终止、负载均衡、静态资源、限流、缓冲。理解它在链路中的位置。
- **gRPC 什么时候用** <span class="prio prio-opt">选学</span> — 内部服务间高性能调用。AI 应用里少见，模型 API 基本都是 REST。

## 代理与网络出口（踩过的坑）

- **HTTP_PROXY 大小写都要设** <span class="prio prio-must">必须</span> — 很多库只读大写，很多只读小写。**只设一个会出现"某些请求走代理某些不走"的诡异现象。**
- **`NO_PROXY` 的作用** <span class="prio prio-must">必须</span> — 内网地址和 localhost 必须排除，否则内网请求被送去代理然后失败。
- **代理与 SSE** <span class="prio prio-must">必须</span> — 正向代理可能缓冲流式响应。要验证代理是否透传。
- **内网域名解析到私网地址** <span class="prio prio-imp">重要</span> — 如果域名解析出 10.x / 172.16-31.x / 192.168.x，说明只有内网可达，跟代理配置无关。**先 `nslookup` 再怀疑网络。**
- **出口 IP 白名单** <span class="prio prio-imp">重要</span> — 企业网络常限制出站目标。表现为"某些 API 通、某些超时"，不是全断。

## Linux 基础

- **进程与端口** <span class="prio prio-must">必须</span> — `ps` / `top` / `ss -tlnp` / `lsof -i`。**"端口被占用"和"服务没起来"要能一眼分开。**
- **文件描述符限制** <span class="prio prio-imp">重要</span> — `ulimit -n`。高并发下 fd 耗尽的表现是"连不上但 CPU 不高"。
- **内存与 OOM** <span class="prio prio-must">必须</span> — `free -h` / `dmesg | grep -i oom`。Node 进程被 OOM killer 杀掉时没有堆栈，只能从这里看。
- **磁盘与 inode** <span class="prio prio-imp">重要</span> — `df -h` 和 `df -i`。日志写满磁盘是常见事故。
- **日志位置** <span class="prio prio-must">必须</span> — `/var/log/`、journalctl、容器日志。出问题第一件事是找日志。
- **systemd 管理服务** <span class="prio prio-imp">重要</span> — unit 文件、`Restart=always`、`Environment=`、日志到 journald。
- **信号处理** <span class="prio prio-must">必须</span> — SIGTERM（优雅关闭）、SIGKILL（无法捕获）、SIGHUP（重载配置）。
- **网络诊断** <span class="prio prio-must">必须</span> — `curl -v` 看握手、`traceroute` 看路径、`tcpdump` 抓包、`nc -zv` 测端口。
- **时间与时区** <span class="prio prio-imp">重要</span> — 服务器 UTC、数据库 timestamptz、前端本地化。**混用会导致"消息时间差 8 小时"这种低级但难查的 bug。**

## 容器

- **镜像分层与多阶段构建** <span class="prio prio-must">必须</span> — 构建阶段装依赖，运行阶段只拷产物。能把镜像从 1G 降到 150M。
- **`.dockerignore`** <span class="prio prio-must">必须</span> — 不写会把 `node_modules` 和 `.git` 打进镜像，构建慢十倍。
- **Volume 与数据持久化** <span class="prio prio-must">必须</span> — 容器删了数据就没了，数据库必须挂卷。
- **网络模式** <span class="prio prio-imp">重要</span> — bridge 下容器间用服务名互访，`localhost` 指的是容器自己。
- **健康检查** <span class="prio prio-must">必须</span> — `HEALTHCHECK` 或 compose 的 healthcheck，编排系统靠它判断就绪。
- **资源限制** <span class="prio prio-imp">重要</span> — `--memory` / `--cpus`。不限制的话一个容器能把宿主机拖死。
- **compose 编排本地栈** <span class="prio prio-must">必须</span> — app + postgres + redis + nginx 一键起。**这是你交付项目的标配。**

## Kubernetes（会用即可，不必会运维）

面试写"熟悉 K8s"会被追问，写"能写 Deployment、会看 Pod 日志"更安全。**目标是"能上线、能排障"，不是"能搭集群"。**

- **Pod / Deployment / Service 三件套** <span class="prio prio-must">必须</span> — Pod 是最小单位，Deployment 管副本与滚动更新，Service 给 Pod 一个稳定入口。**这三者的关系必须能画出来**。
- **Ingress** <span class="prio prio-imp">重要</span> — 外部流量入口，本质是 Nginx/Traefik 的配置抽象。**SSE 的 `proxy_buffering off` 要写在 Ingress 的 annotation 里**，这是 AI 应用上 K8s 最容易漏的一条。
- **ConfigMap / Secret** <span class="prio prio-must">必须</span> — 配置与密钥分离。**Secret 默认只是 base64，不是加密**，要用 KMS 或 external-secrets。
- **资源 requests / limits** <span class="prio prio-must">必须</span> — requests 决定调度，limits 决定上限。**limits 设得比 requests 高太多会导致节点过载**。
- **liveness / readiness / startup 探针** <span class="prio prio-must">必须</span> — liveness 失败重启，readiness 失败摘流量，startup 用于慢启动。**AI 服务启动要加载模型，必须配 startupProbe，否则会被反复重启**。
- **滚动更新与回滚** <span class="prio prio-must">必须</span> — `maxSurge` / `maxUnavailable`，`kubectl rollout undo`。**没有回滚方案就不要上线**。
- **HPA 自动扩缩** <span class="prio prio-imp">重要</span> — 按 CPU/内存/QPS 扩。**LLM 服务扩 Pod 没用**（瓶颈在模型侧），要扩的是 worker。
- **持久卷 PVC** <span class="prio prio-imp">重要</span> — 有状态服务要挂卷。**AI 应用尽量无状态，状态放 PG/对象存储**。
- **看日志与进容器** <span class="prio prio-must">必须</span> — `kubectl logs -f`、`kubectl exec -it`、`kubectl describe pod`（看 Events）。**`describe` 是排障第一命令**，镜像拉取失败、探针失败、OOMKilled 都在这里。
- **GPU 调度** <span class="prio prio-opt">选学</span> — 自部署模型才需要。device plugin、节点亲和、GPU 共享。
- **不要自己搭集群** <span class="prio prio-must">必须</span> — 用云托管（ACK/TKE/EKS）或 Serverless 容器。**自建 K8s 是专职岗位，不是应用工程师的活**。

## DevOps 与交付流水线

- **CI/CD 的最小闭环** <span class="prio prio-must">必须</span> — push → lint → 单测 → 构建镜像 → 推送仓库 → 部署到 staging → 冒烟测试 → 手动批准 → 生产。**能画出这条链就够**。
- **流水线要跑什么** <span class="prio prio-must">必须</span> — 类型检查、lint、单测、构建。**AI 应用额外加一条：prompt 回归测试**（见 [07 · 评测](/guide/07-evals)）。
- **构建缓存** <span class="prio prio-imp">重要</span> — 依赖层单独一层，代码层后置。**没有缓存时一次构建 8 分钟，有缓存 40 秒**，差别决定你一天能提交几次。
- **环境一致性** <span class="prio prio-must">必须</span> — 同一个镜像跑遍 dev/staging/prod，差异只在配置。**"测试环境好的，生产不行"九成是环境不一致**。
- **数据库迁移** <span class="prio prio-must">必须</span> — 迁移脚本进仓库、随版本执行、**必须可回滚或向前兼容**。禁止手工改生产库。
- **灰度与特性开关** <span class="prio prio-must">必须</span> — 新 prompt / 新模型按用户比例放量。**开关是"秒级止损"的唯一手段**。
- **制品与版本号** <span class="prio prio-must">必须</span> — 镜像 tag 用 git commit sha，**永远不要用 `latest`**。出问题要能定位到确切代码。
- **密钥注入** <span class="prio prio-must">必须</span> — 走 CI 的 secret 管理或 KMS，**不要写进 Dockerfile、不要进镜像层**。
- **监控告警** <span class="prio prio-must">必须</span> — 见 [08 · 可观测](/guide/08-observability)。**告警要能叫醒人，也要能不叫醒人**——只报"需要人做决定"的事。
- **日常运维清单** <span class="prio prio-imp">重要</span> — 磁盘、证书到期、备份是否成功、队列积压、慢查询 Top10。**做成每日巡检脚本，别靠记忆**。
- **审计日志** <span class="prio prio-imp">重要</span> — 谁在什么时候部署了什么、改了哪个配置。**合规要求，也是事故复盘的依据**。

## 分布式基础（够用就行）

- **幂等** <span class="prio prio-must">必须</span> — 同一个请求执行多次结果相同。实现：幂等键 + 唯一约束 / 状态机判断。**AI 场景的重试、超时重发都依赖它。**
- **至少一次投递** <span class="prio prio-must">必须</span> — 消息队列默认语义。所以消费端必须幂等，不能假设"只来一次"。
- **重试与指数退避** <span class="prio prio-must">必须</span> — 1s、2s、4s、8s，加抖动（jitter）避免同时重试打爆。
- **熔断** <span class="prio prio-must">必须</span> — 连续失败 N 次后直接拒绝，过一段时间半开试探。**上游模型挂了时，不熔断会拖垮整个服务。**
- **限流** <span class="prio prio-must">必须</span> — 令牌桶/漏桶/滑动窗口。按用户、按租户、按接口分别限。
- **降级** <span class="prio prio-must">必须</span> — 主模型超时切备用、AI 不可用退回搜索/模板。**降级方案要在设计时就定，不是出事时想。**
- **最终一致性** <span class="prio prio-imp">重要</span> — 索引更新、成本统计这类可以异步，但要能对账。
- **分布式锁** <span class="prio prio-imp">重要</span> — 防重复索引、防重复执行同一任务。Redis 实现要校验持有者。
- **CAP 的实际含义** <span class="prio prio-opt">选学</span> — 网络分区时在一致性和可用性之间选。多数业务选可用性 + 最终一致。

## 排障方法论（这一节最实用）

线上出问题，按这个顺序查，能覆盖 90% 的情况：

1. **是全挂还是部分挂** —— 全挂看 DNS/证书/网络出口；部分挂看特定用户/特定模型/特定区域
2. **是慢还是错** —— 慢看连接池、上游延迟、N+1 查询；错看日志里的错误分类
3. **什么时候开始的** —— 对齐发布记录、配置变更、上游状态页
4. **能不能复现** —— 用 trace 里的 requestId 重放
5. **影响面多大** —— 看错误率曲线和影响用户数，决定是回滚还是热修

**AI 应用特有的坑**：接口 200、响应正常、内容全错。这种情况所有传统监控都抓不到，只能靠 trace + 评测。这就是为什么第 08 章（可观测）和第 07 章（评测）权重给得高。

## 验收标准

能独立回答这几个问题就算过关：

- 流式响应在 Nginx 后面变成一次性返回，怎么查？
- 服务 CPU 不高但连不上，可能是什么原因？
- 模型 API 偶尔超时，怎么设计才能不影响用户体验？
- 发布时怎么做到零请求丢失？
