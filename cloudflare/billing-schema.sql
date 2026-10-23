CREATE TABLE IF NOT EXISTS billing_accounts (
 user_id TEXT PRIMARY KEY, email TEXT NOT NULL,
 permanent_points INTEGER NOT NULL DEFAULT 0 CHECK(permanent_points >= 0),
 subscription_points INTEGER NOT NULL DEFAULT 0 CHECK(subscription_points >= 0),
 period_end INTEGER NOT NULL DEFAULT 0, period_start INTEGER NOT NULL DEFAULT 0,
 permanent_access INTEGER NOT NULL DEFAULT 0, subscription_id TEXT,
 customer_id TEXT, subscription_status TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_ledger (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL,
 delta INTEGER NOT NULL, permanent_delta INTEGER NOT NULL DEFAULT 0,
 subscription_delta INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS billing_ledger_user ON billing_ledger(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS billing_checkins (user_id TEXT NOT NULL, day TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,day));
CREATE TABLE IF NOT EXISTS billing_usage (
 user_id TEXT NOT NULL, request_id TEXT NOT NULL, kind TEXT NOT NULL, fingerprint TEXT NOT NULL,
 status TEXT NOT NULL, permanent_spent INTEGER NOT NULL DEFAULT 0, subscription_spent INTEGER NOT NULL DEFAULT 0,
 period_end INTEGER NOT NULL DEFAULT 0, response TEXT, response_status INTEGER, created_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,request_id)
);
CREATE TABLE IF NOT EXISTS billing_exports (user_id TEXT NOT NULL, fingerprint TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,fingerprint));
CREATE TABLE IF NOT EXISTS saved_jobs (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,company TEXT NOT NULL,role TEXT NOT NULL,snapshot TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS saved_jobs_user ON saved_jobs(user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS billing_purchases (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,plan TEXT NOT NULL,product_id TEXT NOT NULL,checkout_id TEXT,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS billing_orders (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,plan TEXT NOT NULL,points INTEGER NOT NULL,subscription_id TEXT,period_end INTEGER NOT NULL DEFAULT 0,period_start INTEGER NOT NULL DEFAULT 0,customer_id TEXT,amount INTEGER NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,grant_state INTEGER NOT NULL DEFAULT 0,transaction_id TEXT);
CREATE TABLE IF NOT EXISTS billing_webhooks (id TEXT PRIMARY KEY,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS billing_fulfillments (purchase_id TEXT NOT NULL,order_id TEXT NOT NULL,PRIMARY KEY(purchase_id,order_id));
CREATE TABLE IF NOT EXISTS billing_payment_reviews (event_id TEXT PRIMARY KEY,order_id TEXT NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL);
