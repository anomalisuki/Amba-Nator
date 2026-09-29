const BASE = 'https://id.akinator.com';

function getCookieHeader(req) {
  return req.headers.cookie || '';
}

module.exports = async (req, res) => {
  try {
    const rawPath = req.url.split('?')[0];
    const path = rawPath.replace(/^\/api/, '') || '/';
    const target = BASE + path;

    const headers = {
      'Accept': '*/*',
      'Origin': BASE,
      'Referer': BASE + '/game',
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
      'X-Requested-With': 'XMLHttpRequest'
    };

    const cookie = getCookieHeader(req);
    if (cookie) headers.Cookie = cookie;

    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      body = Buffer.concat(chunks);
      if (body.length) headers['Content-Type'] =
        req.headers['content-type'] || 'application/x-www-form-urlencoded; charset=UTF-8';
    }

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: body && body.length ? body : undefined,
      redirect: 'manual'
    });

    const responseBody = await upstream.arrayBuffer();

    res.statusCode = upstream.status;

    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);

    const setCookies = typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : [];

    if (setCookies.length) {
      res.setHeader('Set-Cookie', setCookies);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Akinator-Proxy', 'vercel');
    res.end(Buffer.from(responseBody));
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      status: false,
      error: 'Proxy error',
      message: err.message
    }));
  }
};