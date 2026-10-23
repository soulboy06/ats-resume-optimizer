# Creem 支付接入

当前代码已具备结账、签名通知、发积分、订单到账查询及账单管理；尚未配置真实商品或密钥，也未进行真实 Creem 沙盒支付。所有本地支付测试使用虚构数据和模拟的服务响应。

## 商品与积分

| 商品 | Creem 类型 | 美元价格（分） | 权益 |
| --- | --- | --- | --- |
| CheckATS Credit Pack | `onetime` | `990` | 800 永久积分；全部模板、20 个岗位；PDF 每份 10 积分 |
| CheckATS Job Search Pass | `recurring`, `every-month` | `1990` | 每期 2,000 积分；周期内全部模板、20 个岗位及 PDF 不限次导出 |

AI 点评 10 积分，改写 20 积分。优先用当期订阅积分，剩余订阅积分不结转，永久积分不受订阅到期影响。月订阅按 Creem 的实际 `current_period_start_date` / `current_period_end_date` 结算，可能是 28、29、30 或 31 天，因此页面显示“每月自动续费”，不承诺固定 30 天。

目前不提供优惠券、座位数量或商品升级；通知校验基础价格与美元币种。若开启全额优惠审核码或其他折扣，需要先补充折扣订单验证与相应权益规则，不能直接删除价格校验。

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
- 取消续费 `scheduled_cancel` 保留已付费周期；立即取消、暂停、过期停止订阅权益。状态更新不能凭空增加积分或延长周期。
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
