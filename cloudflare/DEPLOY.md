# ATS Resume Optimizer — Cloudflare 部署方案

> 选择：Cloudflare 全家桶。分三个阶段，先验证、再加固、最后做大。

---

## 阶段一：纯静态上线（今天就能做，零成本）

目标：拿到一个能发给朋友测的公开链接。

1. 从 Muse 导出 Demo 的单个 HTML 文件（中文优化版构建完成后执行 `artifact.export`）。
2. 注册 Cloudflare 账号（免费，dash.cloudflare.com，3 分钟）。
3. Workers & Pages → Create → Pages → Upload assets，把 HTML 拖进去。
4. 得到 `https://<name>.pages.dev`，发给朋友测。
5. wes.cv 拿下来后（CodeHost 工单 #CH-474880 处理中）：Pages → Custom domains → 绑定 wes.cv，按提示加 DNS 记录。

**注意**：这个阶段 AI 改写还是 BYOK（用户在页面里粘贴自己的 DeepSeek key），key 只存浏览器内存。适合验证，不适合大规模推广（key 在客户端）。

---

## 阶段二：Worker AI 代理（有验证信号后，key 收回服务端）

目标：浏览器不再碰 key，防刷限流。

文件：`~/workspace/resume-deploy/cloudflare/ai-proxy-worker.js`（已写好）

1. 安装 wrangler：`npm i -g wrangler`，然后 `wrangler login`。
2. 存 key（加密，不进代码）：`wrangler secret put DEEPSEEK_API_KEY`
3. 部署：`wrangler deploy ai-proxy-worker.js --name ats-ai-proxy`
4. 前端改一处：把原来直调 `api.deepseek.com` 的 fetch 改成 POST 到
   `https://ats-ai-proxy.<你的子域>.workers.dev/api/rewrite`，
   body 为 `{ resume, jd, keywords, model }`，不再传 key。
5. Worker 自带简易限流：每个 IP 每天 10 次免费改写（内存版；要持久化换 KV）。

成本：Worker 每月 10 万次请求免费，DeepSeek 按量（一次改写几分钱）。

---

## 阶段三：认真做产品（+ D1 数据库）

- D1（SQLite，免费）存：邮箱留资、扫描历史、用量计数。
- 邮箱收集从"假留资"换成真入库（Worker 写 D1）。
- Turnstile（免费）替代 reCAPTCHA 防机器人。
- 付费：Lemon Squeezy / Stripe（接之前核实大陆主体 KYC）。
- 登录：Cloudflare Access 或自建 JWT（用户量起来再加，现在别做）。

---

## 当前状态

- [x] 阶段一文件：待中文优化版构建完成后导出
- [x] 阶段二 Worker 代码：已写好（`ai-proxy-worker.js`）
- [ ] 你需要做：注册 Cloudflare 账号（免费）
- [ ] 可选：给我 Cloudflare API Token，我直接帮你部署 Pages + Worker
