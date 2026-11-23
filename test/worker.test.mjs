// Prueba el Worker en Node con una D1 simulada sobre SQLite. No reemplaza probar en Cloudflare de verdad.
import { DatabaseSync } from 'node:sqlite';
import worker from '../worker/index.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const sql = new DatabaseSync(':memory:');
const stmt = (q, args = []) => ({
  bind: (...a) => stmt(q, a),
  async all() { return { results: sql.prepare(q).all(...args), meta: {} }; },
  async first() { return sql.prepare(q).get(...args) ?? null; },
  async run() { const r = sql.prepare(q).run(...args); return { meta: { changes: Number(r.changes) } }; },
  _q: q, _a: args,
});
const DB = {
  prepare: (q) => stmt(q),
  async batch(list) {
    sql.exec('BEGIN');
    try {
      const out = [];
      for (const s of list) {
        if (/^\s*select/i.test(s._q)) out.push({ results: sql.prepare(s._q).all(...s._a), meta: {} });
        else out.push({ results: [], meta: { changes: Number(sql.prepare(s._q).run(...s._a).changes) } });
      }
      sql.exec('COMMIT');
      return out;
    } catch (e) { sql.exec('ROLLBACK'); throw e; }
  },
};
const env = { DB, ASSETS: { fetch: async (r) => new Response('<html>estático ' + new URL(r.url).pathname + '</html>') } };
const jar = {};
const call = async (who, method, path, body) => {
  const r = await worker.fetch(new Request('https://bookish.test' + path, { method, headers: { 'Content-Type': 'application/json', cookie: jar[who] || '' }, body: body ? JSON.stringify(body) : undefined }), env);
  const sc = r.headers.get('set-cookie'); if (sc) jar[who] = sc.split(';')[0].replace(/=$/, '=');
  const txt = await r.text(); let d = {}; try { d = JSON.parse(txt); } catch {}
  return { s: r.status, d, h: r.headers, txt };
};
let fails = 0;
const ok = (c, n) => { if (!c) fails++; console.log(c ? 'OK  ' : 'FAIL', n); };

let r = await call('x', 'GET', '/');
ok(r.txt.includes('estático'), 'estáticos pasan a ASSETS');
r = await call('x', 'GET', '/api/me');
ok(r.s === 200 && r.d.user === null, 'sin sesión: /api/me');
r = await call('a', 'POST', '/api/register', { username: 'ana', email: 'a@a.com', password: '12345678', displayName: 'Ana' });
ok(r.s === 201 && /Secure/.test(r.h.get('set-cookie')), 'registro + cookie Secure');
r = await call('a', 'GET', '/api/me');
ok(r.d.user?.username === 'ana', 'sesión persiste en D1');
r = await call('a', 'POST', '/api/register', { username: 'ana', email: 'z@z.com', password: '12345678' });
ok(r.s === 409, 'usuario repetido');
jar.a2 = '';
r = await call('a2', 'POST', '/api/login', { login: 'ana', password: 'mala' });
ok(r.s === 401, 'clave incorrecta');
r = await call('a2', 'POST', '/api/login', { login: 'ana', password: '12345678' });
ok(r.s === 200, 'login correcto');
await call('b', 'POST', '/api/register', { username: 'beto', email: 'b@b.com', password: '12345678' });
// lectura y lista
r = await call('a', 'POST', '/api/readings', { book: { key: '/works/1', title: 'Libro 1', author: 'X', cover: '' }, startedAt: '2026-11-01', finishedAt: '2026-11-10', rating: 4.5, format: 'paper', medium: 'own' });
ok(r.s === 200 || r.s === 201, 'registrar lectura ' + r.s);
r = await call('a', 'POST', '/api/lists', { title: 'Top', ranked: true });
const lid = r.d.list.id; ok(r.s === 201, 'crear lista');
r = await call('a', 'POST', `/api/lists/${lid}/books`, { book: { key: '/works/1', title: 'Libro 1', author: 'X' } });
ok(r.d.list.count === 1, 'agregar libro a la lista');
// concurrencia: dos escrituras a la vez no se pisan
const [c1, c2, c3] = await Promise.all([
  call('a', 'POST', '/api/lists', { title: 'Concurrente A' }),
  call('b', 'POST', '/api/lists', { title: 'Concurrente B' }),
  call('a', 'POST', `/api/lists/${lid}/like`),
]);
const ma = (await call('a', 'GET', '/api/lists?scope=mine')).d.lists, mb = (await call('b', 'GET', '/api/lists?scope=mine')).d.lists;
ok(c1.s === 201 && c2.s === 201 && c3.s === 200, 'las 3 escrituras concurrentes respondieron bien');
ok(ma.some((l) => l.title === 'Concurrente A') && mb.some((l) => l.title === 'Concurrente B') && ma.find((l) => l.id === lid)?.likes === 1, 'ninguna escritura se perdió');
// logout
r = await call('a', 'POST', '/api/logout');
r = await call('a', 'GET', '/api/me');
ok(r.d.user === null, 'logout borra la sesión en D1');
r = await call('a2', 'GET', '/api/me');
ok(r.d.user?.username === 'ana', 'otra sesión sigue activa');
console.log('filas en docs:', sql.prepare('select count(*) c from docs').get().c, '| sesiones:', sql.prepare('select count(*) c from sessions').get().c);

// importar JSON local → D1
fs.writeFileSync('/tmp/seed-src.json', JSON.stringify({ users: [{ id: 'u1', username: 'juana', email: 'j@j.com', displayName: "Juana O'Neil", bio: '', createdAt: 'x', passwordHash: 'viejo', salt: 'viejo' }], readings: [], lists: [] }));
const seed = execFileSync('node', ['scripts/importar-json.js', '/tmp/seed-src.json', '--password', 'ClaveNueva123'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
sql.exec(seed);
r = await call('j', 'POST', '/api/login', { login: 'juana', password: 'ClaveNueva123' });
ok(r.s === 200 && r.d.user.displayName === "Juana O'Neil", 'cuenta importada entra con la clave nueva');
r = await call('j2', 'POST', '/api/login', { login: 'ana', password: '12345678' });
ok(r.s === 401, 'el import reemplazó los datos previos (aviso en el script)');
console.log(fails ? `\n${fails} FALLAS` : '\nTODO OK');
process.exit(fails ? 1 : 0);
