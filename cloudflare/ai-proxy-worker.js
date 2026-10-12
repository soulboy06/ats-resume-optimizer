// Cloudflare Worker — DeepSeek AI rewrite proxy for the ATS Resume Optimizer.
// Keeps the DeepSeek API key server-side: the browser never sees it.
//
// Setup:
// 1. wrangler secret put DEEPSEEK_API_KEY (paste the key; stored encrypted)
// 2. wrangler deploy
//
// Request: POST /api/rewrite
// { "resume": "...", "jd": "...", "keywords": ["RAG","高并发"], "model": "deepseek-flash"}
// Response: { "ok": true, "text": "<rewritten full resume>"}
// { "ok": false, "error": "<bilingual message>", "status": 401}

const SYSTEM_PROMPT = `你是一位资深的 ATS 简历优化专家。你的任务是根据目标职位描述（JD）重写简历，使其最大程度通过 ATS 筛选并打动招聘者。

严格要求：
1. 只输出重写后的完整简历正文，不要任何前言、解释或标题如"以下是改写结果"。
2. 保留原简历的所有板块（联系方式、个人总结、工作经历、技能、教育背景等），板块齐全、顺序不变。
3. 重点重写工作经历的每一条 bullet：以强动词开头，自然融入下面给出的缺失关键词，保留所有量化成果（数字、百分比、规模）。
4. 每条 bullet 控制在 1-2 行。把开始的每一句话都写完整，绝不截断。
5. 使用与输入简历相同的语言（中文简历用中文重写）。技术术语保持原样，不要中英互译（例如 RAG、SSE、K8s 保持原样）。`;

// --- simple in-memory rate limit: 10 rewrites / IP / day (per isolate) ---
const RATE = new Map(); // ip -> { count, day}
const DAILY_LIMIT = 10;

function rateLimited(ip) {
const today = new Date().toISOString().slice(0, 10);
const rec = RATE.get(ip);
if (!rec || rec.day!== today) {
RATE.set(ip, { count: 1, day: today});
return false;
}
rec.count += 1;
return rec.count > DAILY_LIMIT;
}

const CORS = {
"Access-Control-Allow-Origin": "*", // tighten to your Pages domain in production
"Access-Control-Allow-Methods": "POST, OPTIONS",
"Access-Control-Allow-Headers": "Content-Type",
};

const errMsg = (status) => ({
401: "DeepSeek key 无效 / Invalid API key (401)",
402: "DeepSeek 余额不足，请充值 / Insufficient balance (402)",
429: "触发限流，稍后重试 / Rate limited (429)",
}[status] || `改写失败 / Rewrite failed (HTTP ${status})`);

export default {
async fetch(request, env) {
if (request.method === "OPTIONS") {
return new Response(null, { headers: CORS});
}
const url = new URL(request.url);
if (url.pathname!== "/api/rewrite" || request.method!== "POST") {
return new Response("Not found", { status: 404, headers: CORS});
}

const ip = request.headers.get("CF-Connecting-IP") || "unknown";
if (rateLimited(ip)) {
return Response.json(
{ ok: false, error: "今日免费改写次数已用完，明天再来 / Daily free limit reached", status: 429},
{ status: 429, headers: CORS}
);
}

let body;
try {
body = await request.json();
} catch {
return Response.json({ ok: false, error: "请求格式错误 / Bad request", status: 400},
{ status: 400, headers: CORS});
}
const { resume = "", jd = "", keywords = [], model = "deepseek-flash"} = body;
if (!resume.trim() ||!jd.trim()) {
return Response.json({ ok: false, error: "简历和 JD 不能为空 / Resume and JD required", status: 400},
{ status: 400, headers: CORS});
}
if (!env.DEEPSEEK_API_KEY) {
return Response.json({ ok: false, error: "服务端未配置 key / Server misconfigured", status: 500},
{ status: 500, headers: CORS});
}

const userContent = `\n${resume}\n\n\n${jd}\n\n\n${(Array.isArray(keywords)? keywords: []).join("、")}\n\n请输出重写后的完整简历：`;

let ds;
try {
ds = await fetch("https://api.deepseek.com/chat/completions", {
method: "POST",
headers: {
"Content-Type": "application/json",
"Authorization": `Bearer ${env.DEEPSEEK_API_KEY}`,
},
body: JSON.stringify({
model,
messages: [
{ role: "system", content: SYSTEM_PROMPT},
{ role: "user", content: userContent},
],
temperature: 0.7,
max_tokens: 8192,
}),
});
} catch {
return Response.json({ ok: false, error: "网络连接失败，请重试 / Network error", status: 502},
{ status: 502, headers: CORS});
}

const data = await ds.json().catch(() => ({}));
if (!ds.ok) {
return Response.json({ ok: false, error: errMsg(ds.status), status: ds.status},
{ status: ds.status, headers: CORS});
}
const text = data?.choices?.[0]?.message?.content?.trim() || "";
const finishReason = data?.choices?.[0]?.finish_reason || "";
if (!text) {
return Response.json({ ok: false, error: "DeepSeek 返回为空，请重试 / Empty response", status: 502},
{ status: 502, headers: CORS});
}
// guard: block suspiciously short outputs (same 40% rule as the demo)
if (text.length < resume.length * 0.4) {
return Response.json({ ok: false, error: "AI 返回的内容似乎不完整，请重试 / Incomplete output, retry", status: 502},
{ status: 502, headers: CORS});
}
return Response.json(
{ ok: true, text, truncated: finishReason === "length", finishReason},
{ headers: CORS}
);
},
};
