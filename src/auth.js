'use strict';
// Contraseñas con PBKDF2 (WebCrypto), que anda igual en Node y en Cloudflare Workers.
// Si en Workers Free aparece el error "exceeded CPU time", bajá ITER (las cuentas viejas siguen funcionando,
// porque cada hash guarda sus propias iteraciones).
const ITER = 60000;
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (h) => Uint8Array.from(String(h).match(/../g) || [], (x) => parseInt(x, 16));
async function pbkdf2(password, saltHex, iter) {
  const key = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(saltHex), iterations: iter }, key, 256));
}
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; }
// legacyVerify(password, user) sirve para cuentas creadas con la versión anterior (scrypt); solo existe en el servidor Node.
function makeAuth({ legacyVerify } = {}) {
  return {
    async hash(password) {
      const salt = hex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
      return { salt, passwordHash: hex(await pbkdf2(password, salt, ITER)), algo: 'pbkdf2-sha256:' + ITER };
    },
    async verify(password, u) {
      const m = /^pbkdf2-sha256:(\d+)$/.exec(u.algo || '');
      if (m) return same(await pbkdf2(password, u.salt, +m[1]), unhex(u.passwordHash));
      return legacyVerify ? legacyVerify(password, u) : false;
    },
  };
}
module.exports = { makeAuth };
