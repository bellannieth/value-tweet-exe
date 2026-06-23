

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'method not allowed' }) };
  const key = process.env.ANTHROPIC_API_KEY;
  const proxyKey = process.env.PROXY_KEY;
  if (proxyKey) {
    const provided = (event.headers && (event.headers['x-proxy-key'] || event.headers['x-proxykey']));
    if (!provided || provided !== proxyKey) return { statusCode: 401, body: JSON.stringify({ error: 'missing or invalid proxy key' }) };
  }
  if (!key) return { statusCode: 500, body: JSON.stringify({ error: 'server missing ANTHROPIC_API_KEY' }) };
  try {
    const body = JSON.parse(event.body || '{}');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    return { statusCode: r.status, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
};
