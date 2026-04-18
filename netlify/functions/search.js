const https = require('https');
 
function callAnthropic(apiKey, nomeProduto) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: 'Estime o preco medio de venda no varejo brasileiro do produto: "' + nomeProduto + '". Responda APENAS com JSON: {"preco_medio": 150.00, "faixa_min": 120.00, "faixa_max": 180.00, "fonte": "estimativa de mercado"}'
      }]
    });
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { reject(new Error('Parse failed: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(payload);
    req.end();
  });
}
 
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key nao configurada.' }) };
  }
  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Body invalido.' }) }; }
  const { nomeProduto } = body;
  if (!nomeProduto) {
    return { statusCode: 400, body: JSON.stringify({ error: 'nomeProduto obrigatorio.' }) };
  }
  try {
    const { status, body: data } = await callAnthropic(apiKey, nomeProduto);
    if (status !== 200) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Anthropic status ' + status, detail: data }) };
    }
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) };
  } catch(err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
