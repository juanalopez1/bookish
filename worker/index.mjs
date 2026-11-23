import core from '../src/core.js';
import authMod from '../src/auth.js';
import { init, loadDb, saveDb, loadSession, saveSessions } from './d1store.mjs';

const { createApi } = core;
const auth = authMod.makeAuth();
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const tokenOf = (cookie) => (cookie || '').split(';').map((x) => x.trim()).find((x) => x.startsWith('bookish_session='))?.slice(16) || '';

async function handleApi(request, env) {
  const url = new URL(request.url);
  const text = ['GET', 'HEAD'].includes(request.method) ? '' : await request.text();
  const cookie = request.headers.get('cookie') || '';
  const token = tokenOf(cookie);
  await init(env.DB);
  const uid0 = await loadSession(env.DB, token);
  // Si dos personas guardan a la vez, la segunda reintenta con los datos nuevos.
  for (let attempt = 0; attempt < 4; attempt++) {
    const { db, raw, version } = await loadDb(env.DB);
    const sessions = new Map(uid0 ? [[token, uid0]] : []);
    const before = new Map(sessions);
    let status = 200, headers = {}, out = '';
    const req = { method: request.method, headers: { cookie }, async *[Symbol.asyncIterator]() { yield text; } };
    const res = {
      secure: url.protocol === 'https:',
      setHeader(k, v) { headers[k] = v; },
      writeHead(s, h) { status = s; headers = { ...headers, ...h }; },
      end(b) { out = b || ''; },
    };
    const api = createApi({ db, sessions, persist: async () => {}, auth });
    await api(req, res, url);
    if (!(await saveDb(env.DB, db, raw, version))) continue;
    const added = new Map([...sessions].filter(([t, u]) => before.get(t) !== u));
    const removed = [...before.keys()].filter((t) => !sessions.has(t));
    await saveSessions(env.DB, added, removed);
    return new Response(out, { status, headers });
  }
  return json(503, { error: 'Hay mucha actividad en este momento. Probá de nuevo.' });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await handleApi(request, env);
    } catch (e) {
      console.error(e);
      return json(500, { error: 'Algo salió mal. Probá de nuevo.' });
    }
  },
};
