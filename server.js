const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { createApi, EMPTY_DB } = require('./src/core.js');
const { makeAuth } = require('./src/auth.js');
const scrypt = promisify(crypto.scrypt);
const ROOT = __dirname, PUBLIC = path.join(ROOT, 'public'), DATA_FILE = path.join(ROOT, 'data', 'bookish.json');
const PORT = Number(process.env.PORT || 4173), sessions = new Map();
let db = EMPTY_DB();
async function load() { try { Object.assign(db, JSON.parse(await fs.readFile(DATA_FILE, 'utf8'))); } catch (e) { if (e.code !== 'ENOENT') throw e; await persist(); } }
async function persist() { await fs.mkdir(path.dirname(DATA_FILE), { recursive: true }); const tmp = DATA_FILE + '.tmp'; await fs.writeFile(tmp, JSON.stringify(db, null, 2)); await fs.rename(tmp, DATA_FILE); }
// Cuentas viejas (scrypt) siguen entrando en el servidor local.
const legacyVerify = async (password, u) => { if (!u.salt || !u.passwordHash) return false; const h = (await scrypt(password, u.salt, 64)); const o = Buffer.from(u.passwordHash, 'hex'); return h.length === o.length && crypto.timingSafeEqual(h, o); };
function fail(res, status, message) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: message })); }
const api = createApi({ db, sessions, persist, auth: makeAuth({ legacyVerify }) });
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url);let file=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));let full=path.resolve(PUBLIC,file);if(!full.startsWith(PUBLIC+path.sep)&&full!==PUBLIC)return fail(res,403,'No autorizado.');try{const data=await fs.readFile(full);const ext=path.extname(full);res.writeHead(200,{'Cache-Control':'no-cache','Content-Type':ext==='.html'?'text/html; charset=utf-8':ext==='.css'?'text/css; charset=utf-8':ext==='.js'?'text/javascript; charset=utf-8':ext==='.webmanifest'?'application/manifest+json':ext==='.png'?'image/png':ext==='.svg'?'image/svg+xml':'application/octet-stream'});res.end(data)}catch{fail(res,404,'No encontramos esa página.')}}catch(e){console.error(e);fail(res,500,'Algo salió mal. Probá de nuevo.')}});
load().then(()=>server.listen(PORT,()=>console.log(`Bookish está en http://localhost:${PORT}`))).catch(e=>{console.error(e);process.exit(1)});

