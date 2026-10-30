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
