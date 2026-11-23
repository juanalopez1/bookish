#!/usr/bin/env node
// Pasa tu data/bookish.json local a SQL para D1.
// Uso: node scripts/importar-json.js data/bookish.json --password "UnaClaveNueva123" > seed.sql
// Las contraseñas viejas no se pueden copiar: todas las cuentas importadas quedan con la clave que pongas acá.
const fs = require('fs');
const { makeAuth } = require('../src/auth.js');
const file = process.argv[2], pi = process.argv.indexOf('--password');
const password = pi > 0 ? process.argv[pi + 1] : '';
if (!file || password.length < 8) { console.error('Uso: node scripts/importar-json.js data/bookish.json --password "al-menos-8-caracteres" > seed.sql'); process.exit(1); }
const COLL = ['users', 'shelves', 'readings', 'posts', 'follows', 'likes', 'comments', 'postLikes', 'postComments', 'lists', 'listLikes', 'listComments'];
(async () => {
  const src = JSON.parse(fs.readFileSync(file, 'utf8')), auth = makeAuth(), q = (s) => "'" + s.replace(/'/g, "''") + "'";
  const out = [
    'CREATE TABLE IF NOT EXISTS docs (name TEXT PRIMARY KEY, json TEXT NOT NULL);',
    'CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY, v INTEGER NOT NULL, token TEXT);',
    "INSERT OR IGNORE INTO meta (id, v, token) VALUES (1, 0, '');",
    'CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL);',
    "UPDATE meta SET v = v + 1, token = 'import' WHERE id = 1;",
  ];
  for (const k of COLL) {
    let rows = src[k] || [];
    if (k === 'users') rows = await Promise.all(rows.map(async (u) => ({ ...u, ...(await auth.hash(password)) })));
    out.push(`INSERT INTO docs (name, json) VALUES (${q(k)}, ${q(JSON.stringify(rows))}) ON CONFLICT (name) DO UPDATE SET json = excluded.json;`);
  }
  console.log(out.join('\n'));
  console.error(`Listo: ${(src.users || []).length} cuenta(s). Entrás con tu usuario y la clave que elegiste. Ojo: esto REEMPLAZA los datos que ya haya en D1.`);
})();
