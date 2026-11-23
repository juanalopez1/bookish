// Guarda la base de Bookish en D1: cada colección (users, readings, lists…) es una fila con su JSON.
// Es un paso intermedio simple; más adelante se puede pasar a tablas propias.
const COLLECTIONS = ['users', 'shelves', 'readings', 'posts', 'follows', 'likes', 'comments', 'postLikes', 'postComments', 'lists', 'listLikes', 'listComments'];
const SESSION_MS = 30 * 24 * 3600 * 1000;
const INIT = [
  'CREATE TABLE IF NOT EXISTS docs (name TEXT PRIMARY KEY, json TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY, v INTEGER NOT NULL, token TEXT)',
  'INSERT OR IGNORE INTO meta (id, v, token) VALUES (1, 0, \'\')',
  'CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS sessions_created ON sessions (created_at)',
];
let ready = null;
export function init(DB) {
  if (!ready) ready = DB.batch(INIT.map((q) => DB.prepare(q))).catch((e) => { ready = null; throw e; });
  return ready;
}
// Lee todas las colecciones y la versión en una sola consulta atómica.
export async function loadDb(DB) {
  const [docs, meta] = await DB.batch([DB.prepare('SELECT name, json FROM docs'), DB.prepare('SELECT v FROM meta WHERE id = 1')]);
  const raw = {}, db = {};
  for (const r of docs.results) raw[r.name] = r.json;
  for (const k of COLLECTIONS) db[k] = raw[k] ? JSON.parse(raw[k]) : [];
  return { db, raw, version: meta.results[0]?.v ?? 0 };
}
// Guarda solo lo que cambió. Si alguien más guardó en el medio, devuelve false (hay que reintentar).
export async function saveDb(DB, db, raw, version) {
  const dirty = COLLECTIONS.map((k) => [k, JSON.stringify(db[k])]).filter(([k, j]) => j !== (raw[k] ?? '[]'));
  if (!dirty.length) return true;
  const token = crypto.randomUUID();
  const res = await DB.batch([
    DB.prepare('UPDATE meta SET v = v + 1, token = ? WHERE id = 1 AND v = ?').bind(token, version),
    ...dirty.map(([k, j]) => DB.prepare('INSERT INTO docs (name, json) SELECT ?, ? WHERE (SELECT token FROM meta WHERE id = 1) = ? ON CONFLICT (name) DO UPDATE SET json = excluded.json').bind(k, j, token)),
  ]);
  return res[0].meta.changes === 1;
}
export async function loadSession(DB, token) {
  if (!token) return null;
  const r = await DB.prepare('SELECT user_id FROM sessions WHERE token = ? AND created_at > ?').bind(token, Date.now() - SESSION_MS).first();
  return r ? r.user_id : null;
}
export async function saveSessions(DB, added, removed) {
  const st = [];
  for (const [t, u] of added) st.push(DB.prepare('INSERT OR REPLACE INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').bind(t, u, Date.now()));
  for (const t of removed) st.push(DB.prepare('DELETE FROM sessions WHERE token = ?').bind(t));
  if (added.size) st.push(DB.prepare('DELETE FROM sessions WHERE created_at < ?').bind(Date.now() - SESSION_MS));
  if (st.length) await DB.batch(st);
}
export { COLLECTIONS };
