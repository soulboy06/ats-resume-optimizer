# Creem 正式接入记录

2026-10-24 已在 Creem **正式模式**创建并通过商品详情页核对以下商品。商品 ID 不是 API 密钥；本文件不保存密钥或身份资料。

| 商品 | 正式 Product ID | 价格 | 权益 |
| --- | --- | --- | --- |
| CheckATS Credit Pack — 800 Credits | `prod_3ISYlX3YrlnZpSCuEFEsr8` | USD 9.90，一次性 | 800 永久积分；30 个模板、20 个岗位；新 PDF 导出 10 分 |
| CheckATS Job Search Pass — Monthly | `prod_5iGBh2lTDJz23hnSEtKimh` | USD 19.90，每月自动续费 | 每期 2,000 分，到期不结转；30 个模板、20 个岗位；有效期内 PDF 导出不限次 |

两个商品均为 SaaS 税务类别，适用税款在结账时另计，无额外用量计费、无试用期。商品介绍包含数字交付、取消续费、积分期限、7 天未使用订单退款及客服说明。默认返回地址为 `https://checkats.online/account/`；实际网站结账仍由服务器附带账号关联和购买请求编号。

## 当前状态

- 沙盒验收结果见 [支付接入记录](creem-payments.md)。
- 正式商品已创建，尚无真实销售。
- 商户介绍已更新。随后再次读取后台首页，业务详情和创建商品均显示完成，进度为 2/3；确认弹窗已不再显示。该状态不代表账户审核已通过，不能推断此前声明由代理提交。
- 用户提交身份验证后，再次读取后台确认进度为 3/3，商店状态为“正在审核”，提示当前无需采取行动、通常在 48 个工作小时内完成。该状态证明流程已提交，不代表最终审核通过。
- 网站继续使用测试收款配置；创建正式商品不代表网站已经启用真实支付。
- 经用户明确授权，正式 API 密钥 `CheckATS production checkout` 已创建，仅授予 `checkouts:write` 和 `customers:write`，未开启完全访问。已在现有 Worker 中加密保存为 **`CREEM_LIVE_API_KEY`**，不替换运行中的 `CREEM_API_KEY`。
- 正式 Webhook `CheckATS — Live Payment Events` 已创建，ID 为 `wh_5KEeurmMHkeGWzmHciEHaN`，订阅下列 9 类事件。签名密钥已在同一 Worker 中加密保存为 **`CREEM_LIVE_WEBHOOK_SECRET`**，不替换运行中的 `CREEM_WEBHOOK_SECRET`。
- 保存后，Cloudflare 界面确认两个新增字段均显示“值已加密”，`CREEM_TEST_MODE` 仍为 `true`，兼容日期仍为 `2025-06-01`。此次仅通过现有 Worker 的变量设置新增独立密钥，没有编辑业务代码。
- 当前代码尚不读取这两个 `CREEM_LIVE_*` 字段，属于暂存。正式 Webhook 尚无投递，正式结账权限和账单门户仍需在允许正式收款后验证，不能宣称已完成生产验收。

## 后续顺序

### 2026-10-25 整改复审

Creem 要求两项修改：明确禁止 AI 点评与改写中的色情/露骨性/NSFW 内容，以及公开与入驻资料一致的运营者法定姓名。已更新中英文服务条款与联系页，运营者为 `weishu yao`；内容禁令覆盖上传、请求、点评、改写和生成。这是公开使用条款的补充，不代表此次新增了自动内容审核系统。

已通过现有 Cloudflare Pages 项目上传 223 个公开文件并完成正式部署，在浏览器逐页确认 `/terms/`、`/zh/terms/`、`/contact/`、`/zh/contact/` 内容生效。随后在 Creem 商店设置核对姓名和网站，勾选两项已经修复的问题并提交复审。收款账户页实际显示“审核中……通常需要24-48小时”。该状态不代表批准，网站仍使用测试收款配置。

证据：`output/playwright/creem/rereview-terms-live-en.png`、`rereview-submitted-20261025.png`。

### 审核通过后

1. 等待当前商店审核结果；如要求补充身份资料，由用户本人操作。审核通过须以后台实际状态为准。
2. 已创建的正式 Webhook 端点为 `https://ats-hr-review.hhjgudhdjugudh878.workers.dev/api/billing/webhook`，订阅 `checkout.completed`、`subscription.paid`、`subscription.scheduled_cancel`、`subscription.canceled`、`subscription.expired`、`subscription.paused`、`subscription.update`、`refund.created`、`dispute.created`。正式配置切换前不向当前测试处理器发送正式模拟事件。
3. 正式密钥已独立加密暂存，审核通过后再将正式商品 ID、API 密钥、Webhook 签名密钥成套切换到运行配置。切换前安排好测试通知的隔离及恢复方案，避免测试与正式密钥混用。任何密钥均不得进入 Git、前端、日志或聊天。
4. 切换前再次读取线上 Worker 配置，保留 AI 服务、D1、KV、兼容日期及其他绑定。不能直接用旧配置覆盖线上设置。确认账户可收款、正式密钥与商品匹配后，才设置 `CREEM_TEST_MODE=false`；在准备阶段保留 `true`。
5. 核对正式结账价格和币种、签名通知及交付状态。涉及真实付款时，先明确允许的订单及总金额，并由用户在网页输入真实支付信息；不能用沙盒结果宣称真实收款已完成。

证据截图位于本地 `output/playwright/creem/`：`live-products-created.png`、`live-store-under-review.png`、`live-key-permissions-prepared.png`、`live-webhook-created.png` 和 `live-secrets-staged-test-mode.png`。截图中不展示密钥明文。
