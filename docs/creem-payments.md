# Creem 支付接入

当前代码已具备结账、签名通知、发积分、订单到账查询及账单管理。2026-10-24 已使用 Creem 官方测试卡完成实际沙盒积分包付款，网站收到通知并发放 800 永久积分；刷新返回页和重发通知没有重复发放。该测试订单全额退款后，网站通过真实退款通知回收对应的 800 积分，其他余额保留。账单门户可正常打开。同一笔月订阅结账在原浏览器多次报错，但在隔离浏览器成功：卡片令牌创建 201、付款确认/完成 200，真实通知发放 2,000 订阅积分。原浏览器失败的具体原因尚未确定。

月订阅门户取消续费发出真实 `subscription.canceled`，门户仍显示未来周期结束日；验收发现旧代码会立即截短已付费周期并清空积分。现已修正为保留服务器已确认的付费周期，取消通知不能延长周期或恢复已退款/暂停权益；159 项测试通过。该修复已发布到 Worker，版本 `0d6cd3fc-1b4d-404c-95f3-e894c0c70cec`，发布前下载并确认线上 AI 模块无差异，发布后核对兼容日期仍为 `2025-06-01`、全部绑定保留、`CREEM_TEST_MODE=true`。修复发布后的取消复测及订阅退款验收仍待完成，不能提前声称全部支付验收通过。

本次在用户授权下，线上 Worker 使用 `CREEM_TEST_MODE=true` 进行联调，尚未启用正式收款。网站已有中英文 `/terms/`、`/privacy/`、`/refunds/`、`/contact/` 页面（中文位于 `/zh/`）；退款规则经用户确认：扣款后 7 天内，未使用的积分包或订阅周期可申请全额退款，已使用订单逐笔审核，强制性消费者权利不受限制。客服邮箱已由用户确认可以收信。

## 商品与积分

| 商品 | Creem 类型 | 美元价格（分） | 权益 |
| --- | --- | --- | --- |
| CheckATS Credit Pack | `onetime` | `990` | 800 永久积分；全部模板、20 个岗位；PDF 每份 10 积分 |
| CheckATS Job Search Pass | `recurring`, `every-month` | `1990` | 每期 2,000 积分；周期内全部模板、20 个岗位及 PDF 不限次导出 |

AI 点评 10 积分，改写 20 积分。优先用当期订阅积分，剩余订阅积分不结转，永久积分不受订阅到期影响。月订阅按 Creem 的实际 `current_period_start_date` / `current_period_end_date` 结算，可能是 28、29、30 或 31 天，因此页面显示“每月自动续费”，不承诺固定 30 天。

通知校验订单基础价格与美元币种，不使用折后实付金额代替基础价格。2026-10-24 已在 Creem 测试模式验证一次性积分包的 100% 单次优惠：实付为零、基础金额仍为 990 美分，真实签名通知正常发放 800 积分；重发通知后余额及入账记录不变。无需删除价格校验。此结果仅覆盖一次性积分包，订阅首期全额折扣仍待单独验证；目前不支持座位数量或商品升级。

## 配置（先测试环境）

1. 在 Creem **测试模式**创建上述两个商品，保存各自 Product ID。
2. 使用独立的测试 Worker、D1、KV 和测试账号；不要把测试密钥配到现有生产 Worker。测试和生产商品 ID、密钥、Webhook 签名密钥都分开保存。
3. Worker 变量：`CREEM_TEST_MODE="true"`、`CREEM_PACK_PRODUCT_ID`、`CREEM_PASS_PRODUCT_ID`。
4. Worker 加密 secrets：`CREEM_API_KEY`、`CREEM_WEBHOOK_SECRET`。不要写入 HTML、Git 或聊天。
5. D1 使用 `cloudflare/billing-schema.sql`，运行时也会以 `CREATE TABLE IF NOT EXISTS` 补齐表。新增的 `billing_fulfillments` 将购买请求与已发放订单关联；`billing_payment_reviews` 保存需要人工核对的部分退款事件。不会删除旧余额或订单。
6. 在 Creem 配置 `https://<测试Worker域名>/api/billing/webhook`，订阅：`checkout.completed`、`subscription.paid`、`subscription.scheduled_cancel`、`subscription.canceled`、`subscription.expired`、`subscription.paused`、`subscription.update`、`refund.created`、`dispute.created`。
7. 现有前端 API 地址位于 `pages-deploy/scripts/billing.js`；沙盒联调时使用单独的本地/测试构建指向测试 Worker。成功返回地址目前固定为 `https://checkats.online/account/`，联调环境需要在测试构建的 Worker 中修改为该测试前端地址，并按需设置 Worker CORS；不接收浏览器自定义返回地址。
8. 测试通过并审核后，再配置独立正式商品和生产密钥，设置 `CREEM_TEST_MODE="false"`。发布前合并远端最新代码，保留线上 AI 点评补丁及原有所有绑定；不要直接用旧分支覆盖生产 Worker。

## 支付与通知规则

- 浏览器只提交套餐类型和随机请求 ID，账号、商品、价格、积分由服务器决定。网络失败重试复用同一个 Creem `request_id`（同一浏览器内保留 30 分钟），并校验本地请求归属。
- 只允许跳转 HTTPS 的 `creem.io` 及其子域；API 请求 15 秒超时，密钥只在 Worker 使用。
- 支付返回页不发积分，也不信任 URL 中的“成功”标志。它请求 `GET /api/billing/checkout/status?purchase_id=...`，由服务器验证账号归属及这笔订单的通知处理状态。
- 积分包由 `checkout.completed` 发放；通行证由 `subscription.paid` 发放，每个订单/账期只发一次。支持两个事件颠倒到达，续费周期覆盖而不累加，旧账期不覆盖新账期。
- 通知用原始正文 HMAC-SHA256 验签；核对商品、订单状态、基础金额/币种及环境模式。处理失败返回非 2xx，供 Creem 重试；重复通知不重复发积分。
- 取消续费 `scheduled_cancel` 和客户门户的 `canceled` 均保留服务器已确认的付费周期及剩余积分，到期后失效；暂停、过期、退款停止订阅权益。状态更新不能凭空增加积分、延长周期，或恢复已撤销权益。
- 全额退款/争议回收最多原订单的可用积分，并撤销相应付费权益。失败/待处理退款不撤销；部分退款记录到 `billing_payment_reviews`，需要人工处理，不能自动按全额撤权。已花掉的积分需要人工核对，不产生负余额，也不自动退款银行卡。
- 未收到对应订单时返回非 2xx；不要从客户邮箱猜测收款账号，也不要因为浏览器刷新就生成“到账成功”。

## 沙盒验收清单

- 积分包到账 800，重复通知/刷新不会再次到账，其他账号无法查询订单。
- 月订阅初次到账及续费各发 2,000，当期剩余清零；注册/签到/积分包余额保留。
- 网络中断后重试、通知延迟和先后顺序变化；返回页显示等待而不是误报成功。
- 取消续费、到期、立即取消、完整/部分退款；账单门户可打开。
- 缺少配置、签名错误、错误金额/币种、测试事件发到正式环境都不授予权益。

本地验证：`npm test`。这验证业务代码，不代表真实 Creem 沙盒已联通。

原生 PDF 目前仍在浏览器生成，积分校验只能限制网站提供的导出入口。若要求严格付费隔离，需要把最终 PDF 生成/下载迁到服务端，这是另一个实现步骤。

参考：[官方 API 文档](https://docs.creem.io/skills/creem-api/REFERENCE)、[官方通知文档](https://docs.creem.io/skills/creem-api/WEBHOOKS)。
