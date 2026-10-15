// Общий код для обращения к Claude API. Ключ берётся из переменной окружения
// ANTHROPIC_API_KEY на сервере и никогда не попадает в браузер посетителя.

const API_URL = 'https://api.anthropic.com/v1/messages';

// Простая защита от слишком частых запросов: не больше LIMIT запросов
// с одного адреса за минуту (в пределах одного запущенного сервера).
const LIMIT = Number(process.env.REQUESTS_PER_MINUTE || 8);
const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > LIMIT;
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 3_000_000) throw new Error('too_big'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

// Достаёт JSON из ответа модели, даже если он обёрнут в ```json … ```
function parseJSON(text) {
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  return null;
}

async function askClaude({ model, content, maxTokens }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { const e = new Error('no_key'); e.code = 'no_key'; throw e; }
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
  });
  if (!r.ok) {
    const e = new Error('api_' + r.status);
    e.code = r.status === 429 ? 'rate_limited' : 'api_error';
    e.detail = (await r.text()).slice(0, 300);
    throw e;
  }
  const data = await r.json();
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return parseJSON(text);
}

function guard(handler) {
  return async (req, res) => {
    if (req.method !== 'POST') return send(res, 405, { error: 'Только POST' });
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();
    if (tooMany(ip)) return send(res, 429, { error: 'rate_limited' });
    let body;
    try { body = await readBody(req); } catch { return send(res, 400, { error: 'bad_request' }); }
    try {
      const out = await handler(body);
      if (!out) return send(res, 502, { error: 'empty' });
      send(res, 200, out);
    } catch (e) {
      console.error(e.message, e.detail || '');
      const status = e.code === 'rate_limited' ? 429 : e.code === 'bad_request' ? 400 : 502;
      send(res, status, { error: e.code || 'error' });
    }
  };
}

const clip = (s, n) => String(s ?? '').slice(0, n);

module.exports = { askClaude, guard, clip };
