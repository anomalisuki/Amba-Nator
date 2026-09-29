const BASE = 'https://id.akinator.com';

const CREDIT = {
  Creator: 'IzzXd',
  Saluran: 'https://whatsapp.com/channel/0029VbCv97v9Bb5tC5cZFl0K'
};

const THEMES = {
  1: ['Karakter', 1],
  2: ['Hewan', 14],
  3: ['Benda', 2]
};

const CHOICES = [
  ['1', 'Ya', 0],
  ['2', 'Tidak', 1],
  ['3', 'Tidak tahu', 2],
  ['4', 'Mungkin', 3],
  ['5', 'Mungkin tidak', 4]
];

function json(res, status, body, extraHeaders = {}) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  Object.entries(extraHeaders).forEach(([k, v]) => res.setHeader(k, v));
  return res.end(JSON.stringify(body));
}

function parseCookiesFromResponse(headers) {
  const raw = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : (headers.get('set-cookie') ? [headers.get('set-cookie')] : []);
  const jar = {};
  for (const item of raw) {
    const first = item.split(';')[0];
    const i = first.indexOf('=');
    if (i > 0) jar[first.slice(0, i).trim()] = first.slice(i + 1).trim();
  }
  return jar;
}

function mergeCookies(oldCookie, newJar) {
  const jar = {};
  for (const part of String(oldCookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) jar[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  Object.assign(jar, newJar);
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

function cookieHeader(req) {
  const raw = req.body?.cookie || req.headers.cookie || '';
  return String(raw).slice(0, 8000);
}

async function request(path, method = 'POST', form = {}, cookie = '') {
  const headers = {
    'accept': '*/*',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',
    'x-requested-with': 'XMLHttpRequest',
    'origin': BASE,
    'referer': BASE + '/game'
  };
  if (cookie) headers.cookie = cookie;

  const options = { method, headers };
  if (method !== 'GET') {
    headers['content-type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
    options.body = new URLSearchParams(form).toString();
  }

  const response = await fetch(BASE + path, options);
  const text = await response.text();
  return {
    status: response.status,
    body: text,
    cookie: mergeCookies(cookie, parseCookiesFromResponse(response.headers))
  };
}

function parseJSON(body) {
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('Response dari Akinator bukan JSON.');
  }
}

function extract(source, patterns) {
  for (const re of patterns) {
    const m = source.match(re);
    if (m?.[1]) return m[1];
  }
  return '';
}

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function startGame(sid) {
  let cookie = '';
  const home = await request('/', 'GET', {}, cookie);
  cookie = home.cookie;
  const res = await request('/game', 'POST', { sid: String(sid), cm: 'false' }, cookie);
  cookie = res.cookie;
  const body = res.body;

  const session = extract(body, [
    /session:\s*'([^']+)'/i,
    /localStorage\.setItem\(['"]session['"],\s*['"]([^'"]+)['"]\)/i,
    /name=["']session["'][^>]*value=["']([^"']+)["']/i
  ]);
  const identifiant = extract(body, [
    /localStorage\.setItem\(['"]identifiant['"],\s*['"]([^'"]+)['"]\)/i,
    /name=["']identifiant["'][^>]*value=["']([^"']+)["']/i
  ]);
  const question = stripHtml(extract(body, [
    /id=["']question-label["'][^>]*>([\s\S]*?)<\//i,
    /id=["']question-label["'][^>]*>([\s\S]*?)<\/div>/i
  ]));

  if (!session || !question) {
    throw new Error('Gagal memulai game atau membaca pertanyaan dari Akinator.');
  }

  return {
    session,
    identifiant,
    step: Number(extract(body, [
      /localStorage\.setItem\(['"]step['"],\s*['"](\d+)['"]\)/i
    ])) || 1,
    num: 1,
    progression: 0,
    stepLastProposition: '',
    question,
    cookie
  };
}

function handle(data, state) {
  if (data.completion === 'KO') throw new Error('Session game sudah kedaluwarsa.');
  if (data.completion === 'SOUNDLIKE') return { lost: true };

  if (data.id_proposition) {
    state.step = Number(data.step ?? state.step);
    state.stepLastProposition = String(state.step);
    return {
      guess: {
        id: data.id_proposition,
        id_base: data.id_base_proposition,
        name: data.name_proposition,
        description: data.description_proposition,
        photo: data.photo,
        pseudo: data.pseudo
      }
    };
  }

  if (data.question) state.question = data.question;
  if (data.step !== undefined) state.step = Number(data.step);
  if (data.progression !== undefined) state.progression = Number(data.progression);
  return {};
}

async function answer(state, answerId) {
  const res = await request('/answer', 'POST', {
    step: String(state.step),
    progression: String(state.progression),
    sid: String(state.sid),
    cm: 'false',
    answer: String(answerId),
    step_last_proposition: state.stepLastProposition,
    session: state.session
  }, state.cookie);
  state.cookie = res.cookie;
  const result = handle(parseJSON(res.body), state);
  if (!result.guess && !result.lost) state.num += 1;
  return result;
}

async function back(state) {
  const res = await request('/cancel_answer', 'POST', {
    step: String(state.step),
    progression: String(state.progression),
    sid: String(state.sid),
    cm: 'false',
    session: state.session
  }, state.cookie);
  state.cookie = res.cookie;
  handle(parseJSON(res.body), state);
  state.num = Math.max(1, state.num - 1);
  return { ok: true };
}

async function exclude(state) {
  const res = await request('/exclude', 'POST', {
    step: String(state.step),
    sid: String(state.sid),
    cm: 'false',
    progression: String(state.progression),
    session: state.session,
    forward_answer: '1'
  }, state.cookie);
  state.cookie = res.cookie;
  const result = handle(parseJSON(res.body), state);
  if (!result.guess && !result.lost) state.num += 1;
  return result;
}

async function confirm(state, guess) {
  await request('/choice', 'POST', {
    sid: String(state.sid),
    pid: String(guess.id),
    identifiant: state.identifiant,
    charac_name: guess.name || '',
    charac_desc: guess.description || '',
    session: state.session,
    step: String(state.step)
  }, state.cookie);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ...CREDIT, status: false, error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'object' && req.body ? req.body : {};
    const action = body.action;

    if (action === 'start') {
      const themeKey = String(body.theme || '1');
      const theme = THEMES[themeKey];
      if (!theme) return json(res, 400, { status: false, error: 'Tema tidak valid.' });
      const state = await startGame(theme[1]);
      state.sid = theme[1];
      return json(res, 200, {
        ...CREDIT,
        status: true,
        theme: theme[0],
        state: {
          sid: state.sid,
          session: state.session,
          identifiant: state.identifiant,
          step: state.step,
          num: state.num,
          progression: state.progression,
          stepLastProposition: state.stepLastProposition,
          question: state.question,
          cookie: state.cookie
        }
      });
    }

    const state = body.state;
    if (!state?.session || !state?.sid || !state?.cookie) {
      return json(res, 400, { status: false, error: 'State game tidak lengkap.' });
    }

    if (action === 'answer') {
      const choice = CHOICES.find(c => c[0] === String(body.answer));
      if (!choice) return json(res, 400, { status: false, error: 'Jawaban tidak valid.' });
      const result = await answer(state, choice[2]);
      return json(res, 200, { ...CREDIT, status: true, state, result });
    }

    if (action === 'back') {
      const result = await back(state);
      return json(res, 200, { ...CREDIT, status: true, state, result });
    }

    if (action === 'exclude') {
      const result = await exclude(state);
      return json(res, 200, { ...CREDIT, status: true, state, result });
    }

    if (action === 'confirm') {
      if (!body.guess?.id) return json(res, 400, { status: false, error: 'Data tebakan tidak lengkap.' });
      await confirm(state, body.guess);
      return json(res, 200, {
        ...CREDIT,
        status: true,
        theme: body.theme || 'Karakter',
        total_questions: state.num,
        result: {
          name: body.guess.name,
          description: body.guess.description,
          photo: body.guess.photo,
          pseudo: body.guess.pseudo
        }
      });
    }

    return json(res, 400, { ...CREDIT, status: false, error: 'Action tidak dikenal.' });
  } catch (error) {
    console.error(error);
    return json(res, 500, { ...CREDIT, status: false, error: error.message || 'Terjadi kesalahan.' });
  }
};
