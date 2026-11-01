const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
let myPosts = [];
const postCache = new Map();
let me = null,
  currentPage = "home",
  myReadings = [],
  myShelf = [],
  myLists = [],
  ratingValue = 0,
  authMode = "login";
const api = async (path, opt = {}) => {
  const r = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(opt.headers || {}) },
    ...opt,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(data.error || "Algo salió mal.");
  return data;
};
const esc = (s) =>
  String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const cover = (src, title, ref = "") =>
  src
    ? `<img class="book-cover" ${ref ? `data-open-book="${ref}"` : ""} loading="lazy" src="${esc(src)}" alt="Tapa de ${esc(title)}" onerror="this.onerror=null;const d=document.createElement('div');d.className='book-cover cover-placeholder';d.textContent=this.alt.replace('Tapa de ','');if(this.dataset.openBook)d.dataset.openBook=this.dataset.openBook;this.replaceWith(d)">`
    : `<div class="book-cover cover-placeholder" ${ref ? `data-open-book="${ref}"` : ""}>${esc(title)}</div>`;
const svg = (d, size = 18) => `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ico = {
  heart: svg('<path d="M12 20s-7-4.4-7-10a4.2 4.2 0 0 1 7-3 4.2 4.2 0 0 1 7 3c0 5.6-7 10-7 10z"/>'),
  heartFill: svg('<path d="M12 20s-7-4.4-7-10a4.2 4.2 0 0 1 7-3 4.2 4.2 0 0 1 7 3c0 5.6-7 10-7 10z" fill="currentColor"/>'),
  comment: svg('<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>'),
  repost: svg('<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/>'),
  more: svg('<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  quote: svg('<path d="M9 7H6a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3v1a3 3 0 0 1-3 3"/><path d="M19 7h-3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3v1a3 3 0 0 1-3 3"/>'),
  list: svg('<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  book: svg('<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>'),
  pencil: svg('<path d="M4 20l1-4L16 5l3 3L8 19z"/>'),
  trash: svg('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>'),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>'),
  home: svg('<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>'),
  diary: svg('<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 4v16M12 9h4M12 13h4"/>'),
  shelf: svg('<path d="M5 4v16M10 4v16M15 6l4 14"/>'),
  users: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5a3 3 0 0 1 0 6M18 14c2 .8 3 2.6 3 6"/>'),
  user: svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>'),
};
const moreMenu = (items) => `<div class="more-wrap"><button class="action-btn more-btn" data-more aria-haspopup="menu" aria-expanded="false" aria-label="Más opciones">${ico.more}</button><div class="pop-menu" role="menu">${items}</div></div>`;
function pl(u) {
  return u?.username ? ` data-open-profile="${esc(u.username)}"` : "";
}
const avatar = (u, cls = "avatar") =>
  `<div class="${cls}"${pl(u)}>${esc((u?.displayName || u?.username || "b").trim().charAt(0).toUpperCase())}</div>`;
const fmtRate = (n) => String(n).replace(".", ",");
const stars = (n) =>
  n
    ? `<span class="stars" aria-label="${fmtRate(n)} de 5">${[1, 2, 3, 4, 5].map((i) => `<i class="st ${n >= i ? "on" : n === i - 0.5 ? "half" : ""}" style="--k:${i}">★</i>`).join("")}</span>`
    : "";
const when = (d) => {
  if (!d) return "";
  let dt = new Date(d),
    now = new Date(),
    days = Math.floor((now - dt) / 86400000);
  return days === 0
    ? "Hoy"
    : days === 1
      ? "Ayer"
      : days < 7
        ? `Hace ${days} días`
        : dt.toLocaleDateString("es-UY", {
            day: "numeric",
            month: "short",
            year:
              dt.getFullYear() === now.getFullYear() ? undefined : "numeric",
          });
};
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const localDay = (iso) => new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const fmtDay = (d) => d ? new Date(d.length > 10 ? d : d + "T12:00:00").toLocaleDateString("es-UY", { day: "numeric", month: "long" }) : "";
const bookRef = (b, key) => encodeURIComponent(JSON.stringify({ key: key || b.key || b.id || "", title: b.title || "", author: b.author || "", cover: b.cover || "" }));
const bookOfReading = (r) => ({ key: r.bookId, title: r.book?.title, author: r.book?.author, cover: r.book?.cover });
const commentHtml = (c) => `<div class="comment">${c.userId === me?.id ? `<button class="comment-del" data-del-comment="${esc(c.id)}" aria-label="Borrar comentario">×</button>` : ""}<strong${pl(c.user)}>${esc(c.user?.displayName || c.user?.username)}:</strong> ${esc(c.text)}</div>`;
const refreshPage = () => renderPage(currentPage, true);
let popId = null;
const reduceMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
function countTo(el, to, ms = 900, dec = 0) {
  if (!el) return;
  const fmtN = (v) => (dec ? v.toFixed(dec).replace(".", ",") : String(Math.round(v))),
    from = Number(el.dataset.v) || 0;
  el.dataset.v = to;
  if (reduceMotion() || from === to || typeof requestAnimationFrame !== "function") {
    el.textContent = fmtN(to);
    return;
  }
  const t0 = performance.now(),
    step = (t) => {
      const p = Math.min(1, (t - t0) / ms),
        k = 1 - Math.pow(1 - p, 3);
      el.textContent = fmtN(from + (to - from) * k);
      if (p < 1) requestAnimationFrame(step);
    };
  requestAnimationFrame(step);
}
function animateNumbers(root) {
  root?.querySelectorAll?.("[data-count]").forEach((el) => {
    el.dataset.v = 0;
    countTo(el, parseFloat(el.dataset.count) || 0, 800, +el.dataset.dec || 0);
  });
}
function toast(s) {
  const t = $("#toast");
  t.textContent = s;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2100);
}
async function init() {
  try {
    const d = await api("/api/me");
    if (d.user) {
      me = d.user;
      await showApp();
    } else showAuth();
  } catch {
    showAuth();
  }
}
function showAuth() {
  $("#auth-screen").classList.add("visible");
}
async function showApp() {
  $("#auth-screen").classList.remove("visible");
  $("#small-name").textContent = me.displayName;
  $("#small-handle").textContent = "@" + me.username;
  $("#small-avatar").textContent = (me.displayName || me.username)
    .charAt(0)
    .toUpperCase();
  $("#mobile-profile").textContent = (me.displayName || me.username)
    .charAt(0)
    .toUpperCase();
  try {
    await Promise.all([loadOwn(), loadSuggestions()]);
  } catch (e) {
    toast(e.message);
  }
  renderPage("home");
}
async function loadOwn() {
  const [r, s, p, q] = await Promise.all([
    api("/api/readings"),
    api("/api/shelf"),
    api("/api/profile"),
    api("/api/posts"),
  ]);
  myPosts = q.posts || [];
  myReadings = r.readings;
  myShelf = s.shelf;
  myLists = p.lists;
  const yr = new Date().getFullYear(),
    n = myReadings.filter((x) =>
      (x.finishedAt || "").startsWith(String(yr)),
    ).length;
  countTo($("#year-read"), n);
  const goal = me?.goal || 0;
  $("#year-progress").style.width = (goal ? Math.min((n / goal) * 100, 100) : 0) + "%";
  $("#year-goal").innerHTML = goal
    ? `${n >= goal ? "¡Meta cumplida!" : `Meta: ${goal} libros · te faltan ${goal - n}`} <button class="text-btn" data-action="edit-profile">Cambiar</button>`
    : '<button class="text-btn" data-action="edit-profile">Definir mi meta del año</button>';
}
async function loadSuggestions() {
  try {
    const d = await api("/api/users");
    const box = $("#suggestions");
    box.innerHTML =
      d.users
        .slice(0, 4)
        .map(
          (u) =>
            `<div class="mini-person">${avatar(u)}<div class="mini-person-info"${pl(u)}><strong>${esc(u.displayName)}</strong><small>@${esc(u.username)} · ${u.readings} lecturas</small></div><button class="follow-mini" data-follow="${esc(u.username)}">Seguir</button></div>`,
        )
        .join("") ||
      '<div class="quiet">Todavía no hay más personas. Invitá a tus amistades a sumarse.</div>';
  } catch {}
}
function heading(kicker, title, desc, button = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${desc}</p></div>${button}</div>`;
}
function empty(emoji, title, desc, btn = "") {
  return `<div class="empty-state"><div class="empty-emoji">${emoji}</div><h3>${title}</h3><p>${desc}</p>${btn}</div>`;
}
let shelfState = { view: "mine", fmt: "", st: "" };
async function renderPage(page, keep) {
  await renderPageCore(page, keep);
  popId = null;
  const root = $("#main-inner");
  if (!root?.classList) return;
  if (keep) root.classList.remove("enter");
  else {
    root.classList.remove("enter");
    void root.offsetWidth;
    root.classList.add("enter");
  }
  root.querySelectorAll?.(".activity-card,.shelf-book,.now-card,.list-card,.start-card").forEach((el, i) => el.style.setProperty("--i", Math.min(i, 12)));
  animateNumbers(root);
}
async function renderPageCore(page, keep) {
  currentPage = page;
  $$("[data-page]").forEach((b) =>
    b.classList.toggle("active", b.dataset.page === page),
  );
  const root = $("#main-inner");
  try {
    if (page === "home") {
      const d = await api("/api/feed"),
        feed = d.items || [];
      root.innerHTML = `${heading("HOLA, " + esc(me.displayName.split(" ")[0]).toUpperCase(), "Lo que estás leyendo", "")}${readingNowHtml(false) || startCard()}<div class="section-heading"><h2>Tu actividad lectora</h2><button data-page="discover">Encontrar lectoras →</button></div>${feed.length ? feed.map((i) => (i.type === "post" ? postActivity(i.data) : activity(i.data))).join("") : empty("📚", "Tu feed está listo para llenarse", "Seguí a gente lectora para ver qué están leyendo, sus reseñas y publicaciones.", '<button class="button primary" data-page="discover">Encontrar gente</button>')}</section>`;
    } else if (page === "diary") {
      const entries = [
        ...myReadings.map((r) => ({ at: r.createdAt, html: activity({ ...r, user: me, likes: r.likes || 0, comments: r.comments || [] }) })),
        ...myPosts.filter((p) => p.kind === "quote").map((p) => ({ at: p.createdAt, html: postActivity({ ...p, user: me }) })),
      ].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
      root.innerHTML =
        heading(
          "TUS PÁGINAS",
          "Diario lector",
          "Cada lectura, con su propia historia.",
          "",
        ) +
        readingNowHtml() +
        (entries.length
          ? entries.map((x) => x.html).join("")
          : empty("✍️", "Todavía no hay entradas", "Registrá una lectura o guardá una frase mientras leés.", '<button class="button primary" data-action="new-reading">Registrar mi primera lectura</button>'));
    } else if (page === "shelf") {
      shelfState = keep ? { ...shelfState, view: "mine" } : { view: "mine", fmt: "", st: "" };
      const s = shelfState,
        fmtOf = (b) => (b.format === "audio" ? "audio" : b.format === "ebook" || b.format === "digital" ? "ebook" : "paper"),
        tests = {
          "fmt:paper": (b) => fmtOf(b) === "paper",
          "fmt:digital": (b) => fmtOf(b) !== "paper",
          "fmt:ebook": (b) => fmtOf(b) === "ebook",
          "fmt:audio": (b) => fmtOf(b) === "audio",
          "st:read": (b) => b.physicalStatus === "read",
          "st:unread": (b) => b.physicalStatus !== "read",
          "st:borrowed": (b) => b.ownership === "borrowed",
        },
        mineAll = myShelf.filter((b) => b.ownership !== "wishlist"),
        wishAll = myShelf.filter((b) => b.ownership === "wishlist"),
        base = s.view === "wish" ? wishAll : mineAll,
        apply = (list, skip) => list.filter((b) => (skip === "fmt" || !s.fmt || tests["fmt:" + s.fmt](b)) && (skip === "st" || !s.st || tests["st:" + s.st](b))),
        items = apply(base),
        cnt = (list, key) => (s.fmt ? list.filter(tests["fmt:" + s.fmt]) : list).filter(key ? tests[key] : () => true).length,
        chip = (key, label, n, on, cls = "") => `<button class="shelf-tab ${cls}${on ? " active" : ""}" data-sf="${key}" aria-pressed="${on}">${label} · ${n}</button>`;
      root.innerHTML =
        heading("MIS LIBROS", "Tu estantería", "") +
        `<div class="shelf-filters"><div class="shelf-tabs" role="group" aria-label="Estado">${chip("all", "Todos", cnt(mineAll), s.view === "mine" && !s.st)}${chip("st:read", "Leídos", cnt(mineAll, "st:read"), s.view === "mine" && s.st === "read")}${chip("st:unread", "Sin leer", cnt(mineAll, "st:unread"), s.view === "mine" && s.st === "unread")}${chip("st:borrowed", "Prestados", cnt(mineAll, "st:borrowed"), s.view === "mine" && s.st === "borrowed")}</div><label class="fmt-filter"><span class="sr-only">Formato</span><select data-fmt-select aria-label="Formato">${[["", "Todos los formatos"], ["paper", "Papel"], ["digital", "Digital"], ["ebook", "Ebook"], ["audio", "Audiolibro"]].map(([v, l]) => `<option value="${v}" ${s.fmt === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>` +
        (items.length
          ? `<div class="book-grid">${items.map(shelfCard).join("")}<button class="shelf-add" data-action="search-book">＋ Agregar libro</button></div>`
          : base.length
            ? empty("▥", "No hay libros con esos filtros", "Probá sacando alguno.", '<button class="button" data-sf="reset">Ver todos</button>')
            : empty(s.view === "wish" ? "♡" : "▥", s.view === "wish" ? "Tu wishlist está en blanco" : "Todavía no hay libros", s.view === "wish" ? "Buscá un libro para guardarlo en tu wishlist." : "Agregá los libros que tenés, en papel o digitales.", '<button class="button primary" data-action="search-book">Buscar libros</button>'));
    } else if (page === "wishlist") {
      shelfState = { view: "wish", fmt: "", st: "" };
      const wl = myShelf.filter((b) => b.ownership === "wishlist");
      root.innerHTML =
        heading("WISHLIST", "Libros que quiero leer", "") +
        (wl.length
          ? `<div class="book-grid">${wl.map(wishCard).join("")}<button class="shelf-add" data-action="search-book">＋ Agregar libro</button></div>`
          : empty("♡", "Tu wishlist está en blanco", "Guardá acá los libros que querés leer más adelante.", '<button class="button primary" data-action="search-book">Buscar un libro</button>'));
    } else if (page === "discover") {
      root.innerHTML =
        heading(
          "GENTE Y LIBROS",
          "Descubrir",
          "Encontrá personas lectoras y libros para tu próxima lectura.",
        ) +
        `<div class="search-bar"><input id="people-query" placeholder="Buscar por nombre o @usuario…"><button class="button" id="people-search">Buscar</button></div><div id="people-list"></div><div class="section-heading"><h2>Un libro para curiosear</h2></div><div class="search-bar"><input id="book-query" placeholder="Título, autora, tema…"><button class="button primary" id="book-search">Buscar libros</button></div><div id="book-results" class="results-row"></div>`;
      await searchPeople("");
    } else if (page === "profile") {
      const d = await api("/api/profile"),
        p = d.profile,
        avg = myReadings.filter((r) => r.rating).length
          ? myReadings.reduce((a, r) => a + (+r.rating || 0), 0) /
            myReadings.filter((r) => r.rating).length
          : 0,
        items = [
          ...d.readings.map((x) => ({
            type: "reading",
            createdAt: x.createdAt,
            html: activity(x),
          })),
          ...(d.posts || []).map((x) => ({
            type: "post",
            createdAt: x.createdAt,
            html: postActivity(x),
          })),
        ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      root.innerHTML = `<div class="profile-cover">${avatar(me, "avatar profile-avatar")}<button class="button profile-edit" data-action="edit-profile">Editar perfil</button></div><div class="profile-headline"><div><h1>${esc(p.displayName)}</h1><div class="profile-handle">@${esc(p.username)}</div></div></div><p class="profile-bio">${esc(p.bio) || "Sumá una pequeña bio para que la comunidad te conozca."}</p><div class="profile-stats"><span><strong data-count="${p.readings}">${p.readings}</strong> lecturas</span><span><strong data-count="${p.followers}">${p.followers}</strong> seguidores</span><span><strong data-count="${p.followingCount}">${p.followingCount}</strong> siguiendo</span><span><strong>${avg ? avg.toFixed(1) : "—"}</strong> promedio</span></div><div class="section-heading"><h2>Actividad</h2><button data-page="diary">Ver diario →</button></div>${items.length ? items.map((x) => x.html).join("") : empty("📖", "Todavía no hay actividad", "Tu perfil va a guardar tus lecturas y publicaciones.")}`;
    } else if (page === "lists") {
      root.innerHTML =
        heading(
          "TUS COLECCIONES",
          "Listas",
          "Armá listas para cada mood, obsesión o pila de libros.",
        ) +
        `<button class="button primary" data-action="new-list">＋ Crear una lista</button><div id="lists-area" style="margin-top:18px">${myLists.length ? myLists.map((l) => `<article class="list-card"><h3>${esc(l.title)}</h3><p>${esc(l.description || "Sin descripción")} · ${l.books.length} libros</p>${l.books.length ? `<div class="list-covers">${l.books.slice(0, 12).map((b) => cover(b.cover, b.title, bookRef(b))).join("")}</div>` : ""}</article>`).join("") : empty("☷", "Todavía no hay listas", "Creá una para organizar los libros que querés compartir.")}</div>`;
    }
  } catch (e) {
    root.innerHTML = empty(
      "☁️",
      "Uy, algo pasó",
      esc(e.message),
      '<button class="button" onclick="location.reload()">Volver a intentar</button>',
    );
  }
}
function readingNowHtml(withHeading = true) {
  const open = myReadings.filter((r) => !r.finishedAt);
  if (!open.length) return "";
  return `${withHeading ? '<div class="section-heading"><h2>Leyendo ahora</h2></div>' : ""}<div class="now-row">${open
    .map((r) => {
      const b = r.book || {}, ref = bookRef(b, r.bookId),
        lastQ = myPosts.find((p) => p.kind === "quote" && p.book?.key === r.bookId && p.page);
      return `<div class="now-card"><div class="now-top">${cover(b.cover, b.title || "Libro", ref)}<div class="now-info"><strong data-open-book="${ref}">${esc(b.title || "")}</strong><small>${esc(b.author || "")}</small><small>Desde el ${fmtDay(r.startedAt || r.createdAt)}${lastQ ? ` · última frase en la pág. ${esc(lastQ.page)}` : ""}</small><button class="button primary small finish-btn" data-finish="${r.id}">${ico.check} Terminé</button></div></div><form class="quick-quote" data-quick-quote="${r.id}"><input name="text" placeholder="Guardar una frase…" maxlength="1600" aria-label="Frase de ${esc(b.title || "este libro")}"><input name="page" class="qp" inputmode="numeric" maxlength="6" placeholder="pág." aria-label="Página"><label class="qs"><input type="checkbox" name="spoilers"> spoiler</label><button class="button primary small" aria-label="Guardar frase">${ico.plus}</button></form></div>`;
    })
    .join("")}</div>`;
}
function startCard() {
  return `<section class="start-card"><h2>¿Qué libro vas a leer?</h2><p>Buscalo y empezá a guardar tus frases mientras leés.</p><button class="button primary add-btn" data-action="find-book">${ico.search} Buscar un libro</button></section>`;
}
function activity(r) {
  const u = r.user || me,
    book = r.book || {},
    title = book.title || "Libro sin título",
    open = !r.finishedAt,
    mine = r.userId ? r.userId === me.id : u.username === me.username,
    date = open ? r.startedAt || r.createdAt : r.finishedAt || r.createdAt,
    ref = bookRef(book, r.bookId),
    review = r.review
      ? r.spoilers && !mine
        ? `<details class="spoiler"><summary>Reseña con spoilers · tocá para verla</summary><div>${esc(r.review)}</div></details>`
        : `<div style="margin-top:6px">${esc(r.review)}</div>`
      : "";
  return `<article class="activity-card" data-reading="${r.id}"><div class="activity-top">${avatar(u)}<div class="activity-by"><strong${pl(u)}>${esc(u.displayName || u.username)}</strong> ${open ? "empezó a leer" : "terminó un libro"}<small>${when(date)} ${r.format === "audio" ? "· Audiolibro" : r.format === "ebook" ? "· Ebook" : "· Papel"}${r.reread ? " · Relectura" : ""}</small></div><span class="activity-tag">${r.medium === "library" ? "Biblioteca" : r.medium === "borrowed" ? "Prestado" : r.medium === "app" ? "En app" : "Propio"}</span></div><div class="activity-body">${cover(book.cover, title, ref)}<div class="review-copy"><div class="book-name" data-open-book="${ref}">${esc(title)}</div><div class="book-author">${esc(book.author || "Autoría desconocida")}</div>${stars(+r.rating)}${open ? `<div class="reading-since">Leyéndolo desde el ${fmtDay(r.startedAt || r.createdAt)}</div>` : ""}${review}${mine && open ? `<button class="button primary small finish-btn" data-finish="${r.id}">${ico.check} Terminé</button>` : ""}</div></div><div class="activity-actions"><button class="action-btn ${r.liked ? "liked" : ""}${r.id === popId ? " pop" : ""}" data-like="${r.id}" aria-label="Me gusta, ${r.likes || 0}">${r.liked ? ico.heartFill : ico.heart}<span>${r.likes || 0}</span></button><button class="action-btn" data-focus-comment="${r.id}" aria-label="Comentarios, ${r.comments?.length || 0}">${ico.comment}<span>${r.comments?.length || 0}</span></button>${mine ? moreMenu(`<button role="menuitem" data-edit-reading="${r.id}">${ico.pencil} Editar</button><button role="menuitem" class="danger" data-del-reading="${r.id}">${ico.trash} Borrar</button>`) : ""}</div><div class="comments" id="comments-${r.id}">${(r.comments || []).slice(-3).map(commentHtml).join("")}<form class="comment-form" data-comment="${r.id}"><input name="text" placeholder="Dejá un comentario…" maxlength="800"><button>Enviar</button></form></div></article>`;
}
function quoteBlock(p, mine) {
  const inner = `<blockquote>${esc(p.text)}</blockquote>`;
  return p.spoilers && !mine ? `<details class="spoiler"><summary>Frase con spoilers · tocá para verla</summary>${inner}</details>` : inner;
}
function sharedBook(book, page) {
  if (!book) return "";
  const ref = bookRef(book);
  return `<div class="shared-book">${cover(book.cover, book.title || "Libro", ref)}<div><strong data-open-book="${ref}">${esc(book.title || "")}</strong><small>${esc(book.author || "")}${page ? ` · pág. ${esc(page)}` : ""}</small></div></div>`;
}
function originalPostContent(o) {
  if (o.kind === "quote")
    return `${quoteBlock(o, o.userId === me.id)}${sharedBook(o.book, o.page)}`;
  return `<div class="shared-note">${esc(o.text)}</div>${sharedBook(o.book)}`;
}
function postActivity(p) {
  const u = p.user || me,
    o = p.original,
    mine = p.userId === me.id;
  postCache.set(p.id, p);
  let content = "";
  if (p.kind === "repost" && o) {
    const ou = o.user || {};
    content = `<div class="shared-post"><div class="shared-by">${avatar(ou)}<div><strong${pl(ou)}>${esc(ou.displayName || ou.username)}</strong><small>@${esc(ou.username || "")}</small></div></div>${originalPostContent(o)}</div>`;
  } else if (p.kind === "quote") {
    content = `${quoteBlock(p, mine)}${sharedBook(p.book, p.page)}`;
  } else {
    content = `<div class="post-note">${esc(p.text)}</div>${sharedBook(p.book)}`;
  }
  const comments = (p.comments || [])
    .slice(-3)
    .map(
      (c) =>
        commentHtml(c),
    )
    .join("");
  return `<article class="activity-card post-card${p.kind === "quote" ? " quote-card" : ""}" data-post="${p.id}"><div class="activity-top">${avatar(u)}<div class="activity-by"><strong${pl(u)}>${esc(u.displayName || u.username)}</strong> ${p.kind === "repost" ? "reposteó" : p.kind === "quote" ? "guardó una frase" : "compartió algo"}<small>${when(p.createdAt)}${p.spoilers ? " · Spoiler" : ""}</small></div>${p.kind === "quote" ? "" : `<span class="activity-tag">${p.kind === "repost" ? "Repost" : "Nota"}</span>`}</div>${p.kind === "repost" && p.text ? `<div class="repost-note">${esc(p.text)}</div>` : ""}${content}<div class="activity-actions"><button class="action-btn ${p.liked ? "liked" : ""}${p.id === popId ? " pop" : ""}" data-like-post="${p.id}" aria-label="Me gusta, ${p.likes || 0}">${p.liked ? ico.heartFill : ico.heart}<span>${p.likes || 0}</span></button><button class="action-btn" data-focus-post-comment="${p.id}" aria-label="Comentarios, ${p.comments?.length || 0}">${ico.comment}<span>${p.comments?.length || 0}</span></button><button class="action-btn" data-repost="${p.id}" aria-label="Repostear">${ico.repost}</button>${mine ? moreMenu(`<button role="menuitem" data-edit-post="${p.id}">${ico.pencil} Editar</button><button role="menuitem" class="danger" data-del-post="${p.id}">${ico.trash} Borrar</button>`) : ""}</div><div class="comments" id="post-comments-${p.id}">${comments}<form class="comment-form" data-post-comment="${p.id}"><input name="text" placeholder="Dejá un comentario…" maxlength="800"><button>Enviar</button></form></div></article>`;
}
function wishCard(b) {
  const ref = bookRef(b);
  return `<article class="shelf-book wish-book">${cover(b.cover, b.title, ref)}<strong data-open-book="${ref}">${esc(b.title)}</strong><small>${esc(b.author || "Autoría desconocida")}</small><div class="wish-actions"><button class="button primary small" data-start-wish="${esc(b.id)}">${ico.book} Empezar a leer</button>${moreMenu(`<button role="menuitem" data-edit-shelf="${esc(b.id)}">${ico.pencil} Editar</button><button role="menuitem" class="danger" data-del-wish="${esc(b.id)}">${ico.trash} Quitar</button>`)}</div></article>`;
}
function shelfCard(b) {
  const fmt = b.format === "audio" ? "audio" : b.format === "ebook" || b.format === "digital" ? "ebook" : "paper",
    wish = b.ownership === "wishlist",
    read = b.physicalStatus === "read",
    tags = `<span class="tag fmt-${fmt}">${fmt === "audio" ? "Audiolibro" : fmt === "ebook" ? "Ebook" : "Papel"}</span>${wish ? '<span class="tag t-wish">Wishlist</span>' : `<span class="tag ${read ? "t-read" : "t-unread"}">${read ? "Leído" : "Sin leer"}</span>${b.ownership === "borrowed" ? '<span class="tag t-lent">Prestado</span>' : ""}`}`;
  return `<article class="shelf-book">${cover(b.cover, b.title, bookRef(b))}<strong data-open-book="${bookRef(b)}">${esc(b.title)}</strong><small>${esc(b.author || "Autoría desconocida")}</small><div class="tags">${tags}</div><div style="margin-top:9px"><button class="text-btn" data-edit-shelf="${esc(b.id)}">Editar</button></div></article>`;
}
function openModal(title, eyebrow, html, submit) {
  $("#modal .modal").classList.remove("wide");
  $("#modal-title").textContent = title;
  $("#modal-eyebrow").textContent = eyebrow;
  $("#modal-content").innerHTML = html;
  $("#modal").classList.add("open");
  $("#modal-content form")?.addEventListener("submit", async (e) => {
    if (e.target.matches("[data-comment],[data-post-comment]")) return;
    e.preventDefault();
    try {
      await submit(new FormData(e.target), e.target);
      $("#modal").classList.remove("open");
    } catch (err) {
      toast(err.message);
    }
  });
}
function postComposer(repost = null) {
  let selectedBook = null;
  if (repost) {
    const orig = repost.original;
    openModal(
      "Repostear",
      "COMPARTIR CON TU GENTE",
      `<div class="repost-preview">${orig ? postActivity(orig) : ""}</div><form id="post-form"><div class="field"><label>Sumá un comentario (opcional)</label><textarea name="text" maxlength="1600" placeholder="¿Qué te gustaría agregar?"></textarea></div><div class="modal-actions"><button type="button" class="button" data-close>Cancelar</button><button class="button primary">Repostear</button></div></form>`,
      async (fd) => {
        await api("/api/posts", {
          method: "POST",
          body: JSON.stringify({
            kind: "repost",
            originalPostId:
              repost.kind === "repost" && repost.original
                ? repost.original.id
                : repost.id,
            text: fd.get("text"),
          }),
        });
        toast("Reposteado en tu perfil ✨");
        await loadOwn();
        refreshPage();
      },
    );
    return;
  }
  openModal(
    "Compartir algo",
    "UNA NOTA, UNA FRASE, UNA IDEA",
    `<form id="post-form"><div class="field"><label>¿Qué querés compartir?</label><select name="kind" id="post-kind"><option value="note">Una nota o idea</option><option value="quote">Una frase de un libro</option></select></div><div class="field"><label><input type="checkbox" id="link-post-book"> Vincular a un libro (opcional)</label></div><div class="field hidden" id="quote-book-picker"><label id="post-book-label">Libro relacionado</label><div class="search-bar"><input id="post-book-query" placeholder="Buscá el título o la autora…"><button type="button" class="button" id="post-book-search">Buscar</button></div><div id="post-book-selected"></div><div id="post-book-results" class="results-row"></div></div><div class="field"><label id="post-text-label">Tu nota</label><textarea name="text" required maxlength="1600" placeholder="Una idea, una recomendación, algo que te quedó resonando…"></textarea></div><div class="modal-actions"><button type="button" class="button" data-close>Cancelar</button><button class="button primary">Publicar</button></div></form>`,
    async (fd) => {
      const kind = fd.get("kind");
      if (kind === "quote" && !selectedBook)
        throw Error("Elegí el libro al que pertenece la frase.");
      await api("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          kind,
          text: fd.get("text"),
          book: selectedBook,
        }),
      });
      toast(kind === "quote" ? "Frase compartida ✨" : "Nota publicada ✨");
      await loadOwn();
      refreshPage();
    },
  );
  $("#post-kind").onchange = (e) => {
    const quote = e.target.value === "quote";
    $("#link-post-book").checked = quote;
    $("#link-post-book").disabled = quote;
    $("#quote-book-picker").classList.toggle(
      "hidden",
      !quote && !$("#link-post-book").checked,
    );
    $("#post-book-label").textContent = quote
      ? "Libro de la frase"
      : "Libro relacionado";
    $("#post-text-label").textContent = quote ? "La frase" : "Tu nota";
    $("textarea[name=text]").placeholder = quote
      ? "Escribí la frase tal como aparece en el libro…"
      : "Una idea, una recomendación, algo que te quedó resonando…";
  };
  $("#link-post-book").onchange = (e) =>
    $("#quote-book-picker").classList.toggle(
      "hidden",
      !e.target.checked && $("#post-kind").value !== "quote",
    );
  const search = async () => {
    const q = $("#post-book-query").value.trim();
    if (!q) return;
    $("#post-book-results").innerHTML = "<small>Buscando…</small>";
    try {
      const d = await fetch(
        "https://openlibrary.org/search.json?q=" +
          encodeURIComponent(q) +
          "&limit=8&fields=key,title,author_name,cover_i",
      ).then((r) => r.json());
      $("#post-book-results").innerHTML =
        d.docs
          .map((x) => {
            const b = {
              key: x.key,
              title: x.title || "Sin título",
              author: (x.author_name || []).slice(0, 2).join(", "),
              cover: x.cover_i
                ? `https://covers.openlibrary.org/b/id/${x.cover_i}-M.jpg`
                : "",
            };
            return `<div class="search-result" data-post-book="${encodeURIComponent(JSON.stringify(b))}">${cover(b.cover, b.title)}<strong>${esc(b.title)}</strong><small>${esc(b.author)}</small></div>`;
          })
          .join("") || "<small>No encontramos títulos.</small>";
    } catch {
      $("#post-book-results").innerHTML =
        "<small>No pudimos conectar con Open Library.</small>";
    }
  };
  $("#post-book-search").onclick = search;
  $("#post-book-query").onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      search();
    }
  };
  $("#post-book-results").onclick = (e) => {
    const item = e.target.closest("[data-post-book]");
    if (!item) return;
    selectedBook = JSON.parse(decodeURIComponent(item.dataset.postBook));
    $("#post-book-selected").innerHTML =
      `<div class="selected-book">${cover(selectedBook.cover, selectedBook.title)}<div><strong>${esc(selectedBook.title)}</strong><small>${esc(selectedBook.author || "")}</small></div><button type="button" id="remove-post-book">×</button></div>`;
    $("#post-book-results").innerHTML = "";
    $("#remove-post-book").onclick = () => {
      selectedBook = null;
      $("#post-book-selected").innerHTML = "";
    };
  };
}
const starPicker = (v = 0, id = "rate-stars") =>
  `<div class="star-picker" id="${id}" data-value="${v}" role="group" aria-label="Tu puntuación">${[1, 2, 3, 4, 5].map((i) => `<span class="star ${v >= i ? "on" : v === i - 0.5 ? "half" : ""}">★<button type="button" class="hl" data-rating="${i - 0.5}" aria-label="${fmtRate(i - 0.5)} estrellas"></button><button type="button" class="hr" data-rating="${i}" aria-label="${i} ${i === 1 ? "estrella" : "estrellas"}"></button></span>`).join("")}<span class="rate-val">${v ? fmtRate(v) + " / 5" : "Sin puntuar"}</span></div>`;
const paintStars = (box, n, preview = false) => {
  box.querySelectorAll(".star").forEach((s, k) => {
    s.classList.toggle("on", n >= k + 1);
    s.classList.toggle("half", n === k + 0.5);
  });
  if (!preview) box.dataset.value = n;
  const val = box.querySelector(".rate-val");
  if (val) val.textContent = n ? fmtRate(n) + " / 5" : "Sin puntuar";
};
function popStars(box, n) {
  if (!box || !n || reduceMotion()) return;
  box.querySelectorAll(".star").forEach((s, k) => {
    if (k + 1 <= Math.ceil(n)) {
      s.style.setProperty("--k", k);
      s.classList.remove("pop");
      void s.offsetWidth;
      s.classList.add("pop");
    }
  });
  const val = box.querySelector(".rate-val");
  if (val) {
    val.classList.remove("roll");
    void val.offsetWidth;
    val.classList.add("roll");
  }
  setTimeout(() => box.querySelectorAll(".pop").forEach((s) => s.classList.remove("pop")), 900);
}
const ratingPicker = (v = 0) => starPicker(v) + `<input type="hidden" name="rating" value="${v}">`;
function bindRating() {
  const box = $("#rate-stars");
  if (!box) return;
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rating]");
    if (!b) return;
    let n = +b.dataset.rating;
    const input = $("input[name=rating]");
    if (+input.value === n) n = 0;
    input.value = n;
    paintStars(box, n);
    popStars(box, n);
  });
}
function readingForm(book = {}, opts = {}) {
  if (!book.title) {
    searchBookModal({ label: "¿Qué libro es?", pick: (b) => readingForm(b, opts) });
    return;
  }
  const r = opts.finish || opts.edit || null,
    finishing = !!opts.finish,
    editing = !!opts.edit,
    key = book.key || book.id || "",
    again = !r && myReadings.some((x) => x.bookId === key && x.finishedAt),
    status = finishing ? "finished" : editing ? (r.finishedAt ? "finished" : "reading") : opts.status || "reading",
    seg = r
      ? ""
      : `<div class="segmented" role="radiogroup" aria-label="Estado de la lectura"><label><input type="radio" name="status" value="reading" ${status === "reading" ? "checked" : ""}><span>Estoy leyéndolo</span></label><label><input type="radio" name="status" value="finished" ${status === "finished" ? "checked" : ""}><span>Ya lo terminé</span></label></div>`;
  openModal(
    finishing ? "Terminé de leer" : editing ? "Editar lectura" : "Registrar lectura",
    "TU DIARIO",
    `<div class="modal-book">${cover(book.cover, book.title)}<div><strong>${esc(book.title)}</strong><small>${esc(book.author || "")}</small></div></div><form><input type="hidden" name="bookTitle" value="${esc(book.title)}"><input type="hidden" name="bookAuthor" value="${esc(book.author || "")}"><input type="hidden" name="bookCover" value="${esc(book.cover || "")}"><input type="hidden" name="bookKey" value="${esc(key)}">${seg}<div class="field only-finished"><label>Tu puntuación · de 1 a 5 <small class="quiet">(podés usar medias estrellas)</small></label>${ratingPicker(r?.rating || 0)}</div><div class="field only-finished"><label for="f-review">Tu reseña</label><textarea id="f-review" name="review" maxlength="3000" placeholder="¿Qué te dejó esta lectura?">${esc(r?.review || "")}</textarea></div><div class="field only-finished"><label><input type="checkbox" name="spoilers" ${r?.spoilers ? "checked" : ""}> Esta reseña contiene spoilers</label></div><div class="field only-finished"><label><input type="checkbox" name="reread" ${(r ? r.reread : again) ? "checked" : ""}> Es una relectura</label></div><details class="more"><summary>Fechas · hoy por defecto</summary><div class="form-row"><div class="field"><label for="f-start">Empecé</label><input id="f-start" name="startedAt" type="date" max="${today()}" value="${r?.startedAt || (status === "reading" ? today() : "")}"></div><div class="field only-finished"><label for="f-end">Terminé</label><input id="f-end" name="finishedAt" type="date" max="${today()}" value="${r?.finishedAt || today()}"></div></div><p class="hint only-finished">Si no elegís nada, se guarda con la fecha de hoy. Si te olvidaste de marcarlo en su momento, cambiá el día en que lo terminaste.</p></details><details class="more"><summary>Más detalles</summary><div class="form-row"><div class="field"><label>Formato</label><select name="format">${[["paper", "Papel"], ["ebook", "Ebook"], ["audio", "Audiolibro"]].map(([v, l]) => `<option value="${v}" ${(r?.format || "paper") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div><div class="field"><label>¿De dónde?</label><select name="medium">${[["own", "Lo tengo"], ["borrowed", "Prestado"], ["library", "Biblioteca"], ["app", "App / Kindle"]].map(([v, l]) => `<option value="${v}" ${(r?.medium || "own") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div></div></details><div class="modal-actions">${editing ? '<button type="button" class="button danger" id="del-reading">Borrar</button>' : ""}<button class="button" type="button" data-close>Cancelar</button><button class="button primary">${finishing ? "Terminé" : editing ? "Guardar cambios" : "Guardar"}</button></div></form>`,
    async (fd) => {
      const t = (fd.get("bookTitle") || "").trim();
      if (!t) throw Error("Escribí el título del libro.");
      const fin = (r ? status : fd.get("status") || "reading") === "finished";
      let startedAt = fd.get("startedAt") || "";
      const finishedAt = fin ? fd.get("finishedAt") || today() : "";
      if (!fin && !startedAt) startedAt = today();
      if (fin && startedAt && finishedAt < startedAt) throw Error("La fecha de fin no puede ser anterior a la de inicio.");
      const payload = {
        startedAt,
        finishedAt,
        format: fd.get("format"),
        medium: fd.get("medium"),
        rating: fin ? +fd.get("rating") || 0 : r?.rating || 0,
        review: fin ? fd.get("review") || "" : r?.review || "",
        spoilers: fin && fd.has("spoilers"),
        reread: fin && fd.has("reread"),
      };
      if (r) await api("/api/readings/" + r.id, { method: "PATCH", body: JSON.stringify(payload) });
      else
        await api("/api/readings", {
          method: "POST",
          body: JSON.stringify({ book: { key: fd.get("bookKey"), title: t, author: fd.get("bookAuthor"), cover: fd.get("bookCover") }, ...payload }),
        });
      await loadOwn();
      toast(editing ? "Lectura actualizada" : fin ? "¡Lectura registrada!" : "¡A leer! Empezaste hoy");
      if (opts.after) setTimeout(opts.after, 0);
      else refreshPage();
    },
  );
  const sync = () => {
    const fin = (r ? status : $("input[name=status]:checked")?.value) === "finished";
    $$("#modal-content .only-finished").forEach((el) => {
      el.classList.toggle("hidden", !fin);
      el.querySelectorAll("input,textarea").forEach((i) => (i.disabled = !fin));
    });
  };
  const fs = $("#f-start");
  fs?.addEventListener("input", () => (fs.dataset.touched = "1"));
  $$("input[name=status]").forEach((i) =>
    i.addEventListener("change", () => {
      if (fs && !fs.dataset.touched) fs.value = i.value === "reading" ? today() : "";
      sync();
    }),
  );
  sync();
  bindRating();
  $("#del-reading")?.addEventListener("click", async () => {
    if (!confirm("¿Borrar esta lectura? También se borran sus me gusta y comentarios.")) return;
    try {
      await api("/api/readings/" + r.id, { method: "DELETE" });
      await loadOwn();
      $("#modal").classList.remove("open");
      toast("Lectura borrada");
      if (opts.after) setTimeout(opts.after, 0);
      else refreshPage();
    } catch (err) {
      toast(err.message);
    }
  });
}
function quoteForm(book, opts = {}) {
  if (!book?.title) {
    const open = myReadings.filter((r) => !r.finishedAt),
      other = () => searchBookModal({ label: "¿De qué libro es la frase?", pick: (x) => quoteForm(x, opts) });
    if (open.length === 1) book = bookOfReading(open[0]);
    else if (open.length > 1) {
      openModal("¿De qué libro es la frase?", "NUEVA FRASE", `<div class="pick-list">${open.map((r) => `<button type="button" class="g-item" data-qpick="${r.id}">${cover(r.book?.cover, r.book?.title || "Libro")}<div><strong>${esc(r.book?.title || "")}</strong><small>${esc(r.book?.author || "")}</small></div></button>`).join("")}<button type="button" class="g-item" data-qpick="other"><div><strong>Otro libro…</strong></div></button></div>`, async () => {});
      $("#modal-content").onclick = (e) => {
        const b = e.target.closest("[data-qpick]");
        if (!b) return;
        $("#modal").classList.remove("open");
        if (b.dataset.qpick === "other") setTimeout(other, 0);
        else {
          const r = myReadings.find((x) => x.id === b.dataset.qpick);
          if (r) setTimeout(() => quoteForm(bookOfReading(r), opts), 0);
        }
      };
      return;
    } else {
      other();
      return;
    }
  }
  openModal(
    "Guardar una frase",
    "TU DIARIO DE LECTURA",
    `<div class="modal-book">${cover(book.cover, book.title)}<div><strong>${esc(book.title)}</strong><small>${esc(book.author || "")}</small></div></div><form><div class="field"><label for="q-text">La frase</label><textarea id="q-text" name="text" required maxlength="1600" placeholder="La frase que te marcó…"></textarea></div><div class="form-row"><div class="field"><label for="q-page">Página (opcional)</label><input id="q-page" name="page" inputmode="numeric" maxlength="6" placeholder="Ej. 120"></div><div class="field"><label><input type="checkbox" name="spoilers"> Tiene spoilers</label></div></div><div class="modal-actions"><button type="button" class="button" data-close>Cancelar</button><button class="button primary">Guardar frase</button></div></form>`,
    async (fd) => {
      const text = (fd.get("text") || "").trim();
      if (!text) throw Error("Escribí la frase.");
      await api("/api/posts", { method: "POST", body: JSON.stringify({ kind: "quote", text, page: fd.get("page"), spoilers: fd.has("spoilers"), book: { key: book.key || book.id || "", title: book.title, author: book.author, cover: book.cover } }) });
      await loadOwn();
      toast("Frase guardada en tu diario");
      if (opts.after) setTimeout(opts.after, 0);
      else refreshPage();
    },
  );
  const ta = $("#q-text");
  ta?.focus();
  ta?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") $("#modal-content form").requestSubmit();
  });
}
function editPost(p, opts = {}) {
  const isQuote = p.kind === "quote";
  openModal(
    p.kind === "repost" ? "Editar tu nota" : isQuote ? "Editar frase" : "Editar publicación",
    "TU PUBLICACIÓN",
    `<form><div class="field"><label for="f-post">Texto</label><textarea id="f-post" name="text" maxlength="1600" ${p.kind === "repost" ? "" : "required"}>${esc(p.text)}</textarea></div>${isQuote ? `<div class="form-row"><div class="field"><label for="f-page">Página (opcional)</label><input id="f-page" name="page" inputmode="numeric" maxlength="6" value="${esc(p.page || "")}"></div><div class="field"><label><input type="checkbox" name="spoilers" ${p.spoilers ? "checked" : ""}> Tiene spoilers</label></div></div>` : ""}<div class="modal-actions"><button type="button" class="button" data-close>Cancelar</button><button class="button primary">Guardar</button></div></form>`,
    async (fd) => {
      await api("/api/posts/" + p.id, { method: "PATCH", body: JSON.stringify({ text: fd.get("text"), ...(isQuote ? { page: fd.get("page") || "", spoilers: fd.has("spoilers") } : {}) }) });
      await loadOwn();
      toast("Publicación actualizada");
      if (opts.after) setTimeout(opts.after, 0);
      else refreshPage();
    },
  );
}
async function bookPage(ref, o = {}) {
  const popN = o.pop;
  o = { ...o, pop: undefined };
  const key = ref.key || ref.id || "",
    book = { key, title: ref.title, author: ref.author, cover: ref.cover };
  openModal(ref.title || "Libro", "FICHA DEL LIBRO", '<div class="quiet" style="padding:30px 0">Cargando ficha…</div>', async () => {});
  $("#modal .modal").classList.add("wide");
  const works = key.startsWith("/works/"),
    getJson = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [info, work] = await Promise.all([
    api("/api/book?id=" + encodeURIComponent(key)).catch(() => ({})),
    works ? getJson("https://openlibrary.org" + key + ".json") : null,
  ]);
  if ($("#modal-eyebrow").textContent !== "FICHA DEL LIBRO") return;
  const mine = myReadings.filter((r) => r.bookId === key),
    open = mine.find((r) => !r.finishedAt),
    done = mine.filter((r) => r.finishedAt),
    last = done[0] || open,
    shelf = info.shelf,
    wish = shelf?.ownership === "wishlist",
    owned = !!shelf && !wish,
    avg = info.avg || 0,
    cnt = info.count || 0,
    state = open ? "reading" : done.length ? "read" : wish ? "wish" : "",
    copyFmt = owned ? (shelf.format === "audio" ? "audio" : shelf.format === "ebook" || shelf.format === "digital" ? "ebook" : "paper") : "none";
  const qs = info.quotes || [];
  qs.forEach((q) => postCache.set(q.id, q));
  const myQ = qs.filter((q) => q.userId === me.id),
    otherQ = qs.filter((q) => q.userId !== me.id),
    evs = [
      ...mine.flatMap((r) => [
        r.startedAt || !r.finishedAt ? { at: r.startedAt ? r.startedAt + "T00:00:00" : r.createdAt, t: "start", r, day: r.startedAt || localDay(r.createdAt) } : null,
        r.finishedAt ? { at: r.finishedAt + "T23:59:59", t: "end", r, day: r.finishedAt } : null,
      ]).filter(Boolean),
      ...myQ.map((q) => ({ at: q.createdAt, t: "quote", q })),
    ].sort((a, b) => a.at.localeCompare(b.at)),
    journal = evs
      .map((ev) =>
        ev.t === "quote"
          ? `<div class="jr-item"><span class="jr-dot q"></span><div>${quoteBlock(ev.q, true)}<small class="quiet">${fmtDay(localDay(ev.q.createdAt))}${ev.q.page ? " · pág. " + esc(ev.q.page) : ""}${ev.q.spoilers ? " · spoiler" : ""}</small> <button class="text-btn" data-qedit="${ev.q.id}">Editar</button><button class="text-btn" data-qdel="${ev.q.id}">Borrar</button></div></div>`
          : `<div class="jr-item"><span class="jr-dot"></span><div><strong>${ev.t === "start" ? "Empezaste a leerlo" : "Lo terminaste"}</strong> <small class="quiet">${fmtDay(ev.day)}${ev.r.reread ? " · relectura" : ""}</small> ${ev.t === "end" ? stars(+ev.r.rating) : ""} <button class="text-btn" data-edit-reading="${ev.r.id}">Editar</button></div></div>`,
      )
      .join("");
  let desc = typeof work?.description === "string" ? work.description : work?.description?.value || "";
  desc = desc.split(/\r?\n-{3,}/)[0].replace(/\[([^\]]+)\]\[\d+\]/g, "$1").replace(/\(\[source\][^)]*\)/gi, "").trim();
  const subjects = (work?.subjects || []).slice(0, 6),
    reviews = (info.reviews || [])
      .map((r) => `<article class="bk-review">${avatar(r.user || {})}<div><div><strong${pl(r.user)}>${esc(r.user?.displayName || r.user?.username || "")}</strong> ${stars(+r.rating)} <small class="quiet">${when(r.finishedAt || r.createdAt)}</small></div>${r.spoilers && r.userId !== me.id ? `<details class="spoiler"><summary>Reseña con spoilers · tocá para verla</summary><div>${esc(r.review)}</div></details>` : `<p>${esc(r.review)}</p>`}</div></article>`)
      .join("");
  $("#modal-content").innerHTML = `<div class="bk-sheet"><div class="bk-head">${cover(ref.cover, ref.title || "Libro")}<div><h1>${esc(ref.title || "")}</h1><div class="bk-author">${esc(ref.author || "Autoría desconocida")}</div><div class="big-rating tip" tabindex="0" data-tip="Promedio calculado solo con las puntuaciones de Bookish. No incluye otras plataformas.">${cnt ? `<strong data-count="${avg.toFixed(2)}" data-dec="1">${avg.toFixed(1).replace(".", ",")}</strong><div>${stars(Math.round(avg * 2) / 2)}<small>${cnt} ${cnt === 1 ? "puntuación" : "puntuaciones"} en Bookish ⓘ</small></div>` : "<small>Todavía sin puntuaciones en Bookish ⓘ</small>"}</div><small class="quiet">${info.readers || 0} ${info.readers === 1 ? "persona lo leyó" : "personas lo leyeron"} · ${info.readingNow || 0} leyéndolo ahora</small>${subjects.length ? `<div class="chips">${subjects.map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : ""}</div></div>${desc ? `<p class="synopsis" id="synopsis">${esc(desc)}</p>${desc.length > 320 ? '<button class="text-btn" id="syn-more">Leer más</button>' : ""}` : `<p class="quiet" style="margin-top:14px">${works ? "Todavía no hay sinopsis para este libro en Open Library." : "Este libro se cargó a mano, así que no tiene sinopsis."}</p>`}<div class="bk-block"><div class="bk-label">Mi lectura</div><div class="seg-btns" style="grid-template-columns:repeat(3,1fr)" role="group" aria-label="Estado de lectura">${[["wish", "Quiero leerlo"], ["reading", "Leyendo"], ["read", "Leído"]].map(([v, l]) => `<button type="button" class="${state === v ? "on" : ""}" aria-pressed="${state === v}" data-bk="state-${v}">${l}</button>`).join("")}</div></div><div class="bk-block"><div class="bk-label">Mi copia</div><div class="seg-btns" style="grid-template-columns:repeat(4,1fr)" role="group" aria-label="Formato de tu copia">${[["none", "No la tengo"], ["paper", "Papel"], ["ebook", "Ebook"], ["audio", "Audiolibro"]].map(([v, l]) => `<button type="button" class="${copyFmt === v ? "on" : ""}" aria-pressed="${copyFmt === v}" data-bk="copy-${v}">${l}</button>`).join("")}</div>${copyFmt === "paper" ? `<label class="chk"><input type="checkbox" data-bk="lent" ${shelf.ownership === "borrowed" ? "checked" : ""}> Está prestado</label>` : ""}</div><div class="bk-tools"><button class="button" data-bk="list">${ico.list} Agregar a lista</button><button class="button" data-bk="quote">${ico.quote} Guardar una frase</button></div>${o.lists ? `<div class="bk-lists">${(info.lists || []).map((l) => `<button class="chip-btn ${l.has ? "on" : ""}" data-bk-list="${l.id}">${l.has ? "✓" : "＋"} ${esc(l.title)}</button>`).join("") || '<span class="quiet">Todavía no tenés listas.</span>'}<button class="chip-btn" data-bk="newlist">＋ Nueva lista</button></div>` : ""}<div class="field"><label>Tu puntuación</label>${starPicker(last?.rating || 0, "bk-stars")}</div>${journal ? `<h3 class="bk-section">Tu diario de este libro</h3><div class="journal">${journal}</div>` : ""}${otherQ.length ? `<h3 class="bk-section">Frases de otros lectores</h3>${otherQ.map((q) => `<article class="bk-review">${avatar(q.user || {})}<div><strong${pl(q.user)}>${esc(q.user?.displayName || q.user?.username || "")}</strong> <small class="quiet">${q.page ? "pág. " + esc(q.page) : ""}</small>${quoteBlock(q, false)}</div></article>`).join("")}` : ""}<h3 class="bk-section">Reseñas</h3>${reviews || '<p class="quiet">Todavía no hay reseñas de este libro.</p>'}</div>`;
  animateNumbers($("#modal-content"));
  if (popN) popStars($("#bk-stars"), popN);
  const again = (x) => bookPage(ref, x),
    reload = async (x) => {
      await loadOwn();
      again(x);
    },
    shelfPost = (ownership, physicalStatus, format) => {
      const s = myShelf.find((x) => x.id === key);
      return api("/api/shelf", { method: "POST", body: JSON.stringify({ book, ownership, physicalStatus, format, edition: s?.edition || "", location: s?.location || "" }) });
    };
  $("#modal-content").onclick = async (e) => {
    const star = e.target.closest("#bk-stars [data-rating]"),
      bk = e.target.closest("[data-bk]")?.dataset.bk,
      bl = e.target.closest("[data-bk-list]"),
      er = e.target.closest("[data-edit-reading]"),
      qe = e.target.closest("[data-qedit]"),
      qd = e.target.closest("[data-qdel]");
    try {
      if (e.target.id === "syn-more") {
        $("#synopsis").classList.toggle("full");
        e.target.textContent = $("#synopsis").classList.contains("full") ? "Leer menos" : "Leer más";
      } else if (star) {
        const n = +star.dataset.rating;
        if (last) await api("/api/readings/" + last.id, { method: "PATCH", body: JSON.stringify({ rating: last.rating === n ? 0 : n }) });
        else {
          await api("/api/readings", { method: "POST", body: JSON.stringify({ book, startedAt: today(), finishedAt: today(), rating: n, format: "paper", medium: "own" }) });
          toast("Lectura registrada con tu puntuación");
        }
        await reload({ ...o, pop: last && last.rating === n ? 0 : n });
      } else if (bk === "state-wish") {
        if (wish) {
          await api("/api/shelf", { method: "DELETE", body: JSON.stringify({ id: key }) });
          await reload(o);
        } else if (open || done.length) toast("Ya empezaste este libro. Podés cambiarlo editando tu lectura.");
        else if (owned) toast("Ya lo tenés en tu estantería.");
        else {
          await shelfPost("wishlist", "unread");
          await reload(o);
        }
      } else if (bk === "state-reading") {
        if (!open && (!done.length || confirm("Ya lo leíste. ¿Empezar una relectura?"))) {
          await api("/api/readings", { method: "POST", body: JSON.stringify({ book, startedAt: today(), finishedAt: "", format: "paper", medium: "own", reread: done.length > 0 }) });
          toast("¡A leer! Empezaste hoy");
          await reload(o);
        }
      } else if (bk === "state-read") readingForm(book, open ? { finish: open, after: () => again(o) } : { status: "finished", after: () => again(o) });
      else if (bk?.startsWith("copy-")) {
        const f = bk.slice(5);
        if (f === "none") {
          if (owned) {
            await api("/api/shelf", { method: "DELETE", body: JSON.stringify({ id: key }) });
            await reload(o);
          }
        } else {
          await shelfPost(f === "paper" && shelf?.ownership === "borrowed" ? "borrowed" : "owned", done.length || shelf?.physicalStatus === "read" ? "read" : "unread", f);
          await reload(o);
        }
      } else if (bk === "lent") {
        await shelfPost(e.target.checked ? "borrowed" : "owned", shelf?.physicalStatus || "unread");
        await reload(o);
      }
      else if (bk === "list") again({ lists: !o.lists });
      else if (bk === "newlist") newList();
      else if (bl) {
        await api("/api/lists/" + bl.dataset.bkList + "/books", { method: "POST", body: JSON.stringify({ book }) });
        await reload({ lists: true });
      } else if (bk === "quote") quoteForm(book, { after: () => again(o) });
      else if (qe) {
        const p = postCache.get(qe.dataset.qedit);
        if (p) editPost(p, { after: () => again(o) });
      } else if (qd) {
        if (confirm("¿Borrar esta frase?")) {
          await api("/api/posts/" + qd.dataset.qdel, { method: "DELETE" });
          await reload(o);
        }
      } else if (er) {
        const r = myReadings.find((x) => x.id === er.dataset.editReading);
        if (r) readingForm(bookOfReading(r), { edit: r, after: () => again(o) });
      }
    } catch (err) {
      toast(err.message);
    }
  };
}
let gTimer = null,
  gSeq = 0;
async function globalSearch(q) {
  const seq = ++gSeq,
    drop = $("#global-drop");
  drop.classList.add("open");
  drop.innerHTML = '<div class="quiet" style="padding:12px">Buscando…</div>';
  const [books, people] = await Promise.all([
    fetch("https://openlibrary.org/search.json?q=" + encodeURIComponent(q) + "&limit=6&fields=key,title,author_name,cover_i").then((r) => r.json()).then((d) => d.docs || []).catch(() => null),
    api("/api/users?q=" + encodeURIComponent(q)).then((d) => d.users || []).catch(() => []),
  ]);
  if (seq !== gSeq) return;
  const bookItems = (books || []).map((b) => {
    const bk = { key: b.key, title: b.title, author: (b.author_name || [])[0] || "", cover: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-M.jpg` : "" };
    return `<button class="g-item" data-open-book="${bookRef(bk)}">${cover(bk.cover, bk.title)}<div><strong>${esc(bk.title)}</strong><small>${esc(bk.author)}</small></div></button>`;
  });
  drop.innerHTML =
    `<div class="g-title">LIBROS</div>${books === null ? '<div class="quiet" style="padding:8px 10px">No pudimos conectar con Open Library.</div>' : bookItems.join("") || '<div class="quiet" style="padding:8px 10px">Sin resultados.</div>'}` +
    `<div class="g-title">PERSONAS</div>${people.slice(0, 5).map((u) => `<button class="g-item" data-open-profile="${esc(u.username)}">${avatar(u)}<div><strong>${esc(u.displayName)}</strong><small>@${esc(u.username)}</small></div></button>`).join("") || '<div class="quiet" style="padding:8px 10px">Sin resultados.</div>'}`;
}
document.addEventListener("mouseover", (e) => {
  const b = e.target.closest?.(".star-picker [data-rating]");
  if (b) paintStars(b.closest(".star-picker"), +b.dataset.rating, true);
});
document.addEventListener("mouseout", (e) => {
  const box = e.target.closest?.(".star-picker");
  if (box && !box.contains(e.relatedTarget)) paintStars(box, +box.dataset.value || 0);
});
(function authTicker() {
  const items = [...document.querySelectorAll(".auth-ticker .t-item")],
    dots = [...document.querySelectorAll(".auth-ticker .t-dots i")];
  if (items.length < 2 || reduceMotion()) return;
  let i = 0;
  setInterval(() => {
    if (!$("#auth-screen")?.classList.contains("visible")) return;
    items[i].classList.remove("on");
    dots[i]?.classList.remove("on");
    i = (i + 1) % items.length;
    items[i].classList.add("on");
    dots[i]?.classList.add("on");
  }, 3200);
})();
const addMenuHtml = () => `<button role="menuitem" data-action="new-reading">${ico.book} Registrar lectura</button><button role="menuitem" data-action="new-quote">${ico.quote} Guardar una frase</button><button role="menuitem" data-action="add-shelf">${ico.plus} Libro a mi estantería</button><button role="menuitem" data-action="add-wish">${ico.heart} Libro a mi wishlist</button>`;
$$(".add-menu").forEach((m) => (m.innerHTML = addMenuHtml()));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $$(".add-menu.open,.pop-menu.open").forEach((m) => m.classList.remove("open"));
});
document.addEventListener("change", (e) => {
  const fs = e.target.closest?.("[data-fmt-select]");
  if (fs) {
    shelfState = { ...shelfState, fmt: fs.value };
    renderPage("shelf", true);
  }
});
$("#global-q").addEventListener("input", (e) => {
  clearTimeout(gTimer);
  const q = e.target.value.trim();
  if (q.length < 2) {
    $("#global-drop").classList.remove("open");
    return;
  }
  gTimer = setTimeout(() => globalSearch(q), 350);
});
function shelfDest() {
  const s = shelfState,
    format = s.fmt === "ebook" || s.fmt === "audio" ? s.fmt : s.fmt === "digital" ? "ebook" : "paper";
  if (s.view === "wish") return { ownership: "wishlist", physicalStatus: "unread", format, label: "Sumar a tu wishlist" };
  return { ownership: s.st === "borrowed" && format === "paper" ? "borrowed" : "owned", physicalStatus: s.st === "read" ? "read" : "unread", format, label: "Sumar a mis libros" };
}
async function quickAdd(book, dest) {
  try {
    await api("/api/shelf", {
      method: "POST",
      body: JSON.stringify({ book, ownership: dest.ownership, physicalStatus: dest.physicalStatus, format: dest.format, edition: "", location: "" }),
    });
    await loadOwn();
    $("#modal").classList.remove("open");
    toast(dest.ownership === "wishlist" ? "A tu wishlist" : "Libro agregado a tu estantería");
    refreshPage();
  } catch (err) {
    toast(err.message);
  }
}
function searchBookModal(dest) {
  const fmtSeg = dest && !dest.pick && dest.ownership !== "wishlist" ? `<div class="segmented three" role="radiogroup" aria-label="Formato del libro">${[["paper", "Papel"], ["ebook", "Ebook"], ["audio", "Audiolibro"]].map(([v, l]) => `<label><input type="radio" name="dformat" value="${v}" ${(dest.format || "paper") === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>` : "";
  openModal(
    dest ? dest.label : "Encontrá un libro",
    "CATÁLOGO ABIERTO",
    `<p style="font-size:11px;color:var(--muted)">Buscamos en Open Library para que encuentres la ficha correcta.</p>${fmtSeg}<div class="search-bar"><input id="modal-book-q" placeholder="Título o autora…"><button class="button primary" id="modal-book-search">Buscar</button></div><div class="results-row" id="modal-book-results"></div><div class="field"><label>¿No aparece?</label><button class="button" id="manual-book">Agregar título manualmente</button></div>`,
    async () => {},
  );
  const withFmt = () => {
    if (!dest || dest.pick) return dest;
    const format = $("input[name=dformat]:checked")?.value || dest.format || "paper";
    return { ...dest, format, ownership: dest.ownership === "borrowed" && format !== "paper" ? "owned" : dest.ownership };
  };
  const doSearch = async () => {
    const q = $("#modal-book-q").value.trim();
    if (!q) return;
    $("#modal-book-results").innerHTML = "<small>Buscando…</small>";
    try {
      const d = await fetch(
        "https://openlibrary.org/search.json?q=" +
          encodeURIComponent(q) +
          "&limit=10&fields=key,title,author_name,cover_i",
      ).then((r) => r.json());
      $("#modal-book-results").innerHTML =
        d.docs
          .map((x) => {
            const b = {
              key: x.key,
              title: x.title || "Sin título",
              author: (x.author_name || []).slice(0, 2).join(", "),
              cover: x.cover_i
                ? `https://covers.openlibrary.org/b/id/${x.cover_i}-M.jpg`
                : "",
            };
            return `<div class="search-result" data-book="${encodeURIComponent(JSON.stringify(b))}">${cover(b.cover, b.title)}<strong>${esc(b.title)}</strong><small>${esc(b.author)}</small></div>`;
          })
          .join("") || "<small>No encontramos títulos.</small>";
    } catch {
      $("#modal-book-results").innerHTML =
        "<small>No pudimos conectar con Open Library.</small>";
    }
  };
  $("#modal-book-search").onclick = doSearch;
  $("#modal-book-q").onkeydown = (e) => {
    if (e.key === "Enter") doSearch();
  };
  $("#modal-book-results").onclick = (e) => {
    const el = e.target.closest("[data-book]");
    if (el) {
      const b = JSON.parse(decodeURIComponent(el.dataset.book));
      if (dest?.pick) {
        $("#modal").classList.remove("open");
        setTimeout(() => dest.pick(b), 0);
      } else if (dest) quickAdd(b, withFmt());
      else {
        $("#modal").classList.remove("open");
        bookChoice(b);
      }
    }
  };
  $("#manual-book").onclick = () => {
    $("#modal").classList.remove("open");
    bookChoice({}, withFmt());
  };
}
function bookChoice(b, dest) {
  openModal(
    b.title ? "¿Qué querés hacer?" : "Agregar un libro",
    "TU ESTANTERÍA",
    `<div class="modal-book">${cover(b.cover, b.title || "Tu libro")}<div><strong>${esc(b.title || "Agregar manualmente")}</strong><small>${esc(b.author || "Podés editar estos datos")}</small></div></div><div class="field"><label>Título</label><input id="choice-title" value="${esc(b.title || "")}" placeholder="Título del libro"></div><div class="field"><label>Autora o autor</label><input id="choice-author" value="${esc(b.author || "")}" placeholder="Nombre"></div><div class="field"><label>Quiero…</label><select id="choice-action"><option value="wishlist">Guardarlo en mi wishlist</option><option value="owned">Sumarlo a mis libros (sin leer)</option><option value="reading">Registrar que lo leí</option></select></div><div class="modal-actions"><button class="button" data-close>Cancelar</button><button class="button primary" id="choice-save">Continuar</button></div>`,
    async () => {},
  );
  if (dest) {
    $("#choice-action").closest(".field").remove();
    $("#choice-save").textContent = dest.pick ? "Continuar" : "Guardar";
  }
  $("#choice-save").onclick = async () => {
    const book = {
      key:
        b.key ||
        b.id ||
        $("#choice-title").value.toLowerCase().replace(/\W+/g, "-"),
      title: $("#choice-title").value.trim(),
      author: $("#choice-author").value.trim(),
      cover: b.cover || "",
    };
    if (!book.title) {
      toast("El libro necesita título");
      return;
    }
    if (dest?.pick) {
      $("#modal").classList.remove("open");
      setTimeout(() => dest.pick(book), 0);
      return;
    }
    if (dest) {
      await quickAdd(book, dest);
      return;
    }
    const action = $("#choice-action").value;
    if (action === "reading") {
      $("#modal").classList.remove("open");
      readingForm(book);
      return;
    }
    await api("/api/shelf", {
      method: "POST",
      body: JSON.stringify({
        book,
        ownership: action,
        physicalStatus: "unread",
        edition: "",
        location: "",
      }),
    });
    await loadOwn();
    $("#modal").classList.remove("open");
    toast(
      action === "wishlist"
        ? "A tu wishlist ✨"
        : "Libro agregado a tu estantería",
    );
    refreshPage();
  };
}
function editProfile() {
  openModal(
    "Editar perfil",
    "TU PERFIL",
    `<form class="profile-form"><div class="field"><label>Nombre visible</label><input name="displayName" maxlength="50" value="${esc(me.displayName)}"></div><div class="field"><label>Bio</label><textarea name="bio" maxlength="240" placeholder="Contale algo a tu comunidad">${esc(me.bio || "")}</textarea></div><div class="field"><label>Meta de lectura ${new Date().getFullYear()} (libros)</label><input name="goal" type="number" min="0" max="1000" value="${me.goal || ""}" placeholder="Ej. 24"></div><div class="modal-actions"><button type="button" class="button" data-close>Cancelar</button><button class="button primary">Guardar cambios</button></div></form>`,
    async (fd) => {
      const d = await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: fd.get("displayName"),
          bio: fd.get("bio"),
          goal: fd.get("goal"),
        }),
      });
      me = d.user;
      await showApp();
      toast("Perfil actualizado");
    },
  );
}
function newList() {
  openModal(
    "Crear una lista",
    "TUS COLECCIONES",
    `<form><div class="field"><label>Título</label><input name="title" required maxlength="100" placeholder="Ej. libros para un día lluvioso"></div><div class="field"><label>Descripción</label><textarea name="description" maxlength="500" placeholder="¿Qué tienen en común estos libros?"></textarea></div><div class="modal-actions"><button type="button" class="button" data-close>Cancelar</button><button class="button primary">Crear lista</button></div></form>`,
    async (fd) => {
      await api("/api/lists", {
        method: "POST",
        body: JSON.stringify({
          title: fd.get("title"),
          description: fd.get("description"),
          books: [],
        }),
      });
      await loadOwn();
      toast("Lista creada");
      renderPage("lists");
    },
  );
}
async function searchPeople(q) {
  const d = await api("/api/users?q=" + encodeURIComponent(q));
  const el = $("#people-list");
  if (el)
    el.innerHTML =
      d.users
        .map(
          (u) =>
            `<div class="discover-result">${avatar(u)}<div class="discover-info"><strong>${esc(u.displayName)}</strong><small>@${esc(u.username)} · ${u.readings} lecturas · ${u.followers} seguidores</small>${u.bio ? `<small>${esc(u.bio)}</small>` : ""}</div><div class="profile-actions"><button class="button small" data-open-profile="${esc(u.username)}">Ver perfil</button><button class="button small ${u.following ? "" : "soft"}" data-follow="${esc(u.username)}">${u.following ? "Siguiendo" : "Seguir"}</button></div></div>`,
        )
        .join("") ||
      '<div class="quiet" style="padding:18px 0">No encontramos personas con ese nombre.</div>';
}
async function searchBooks(q, into) {
  const out = $(into);
  out.innerHTML = "<small>Buscando libros…</small>";
  try {
    const d = await fetch(
      "https://openlibrary.org/search.json?q=" +
        encodeURIComponent(q) +
        "&limit=12&fields=key,title,author_name,cover_i",
    ).then((r) => r.json());
    out.innerHTML =
      d.docs
        .map((x) => {
          const b = {
            key: x.key,
            title: x.title || "Sin título",
            author: (x.author_name || []).slice(0, 2).join(", "),
            cover: x.cover_i
              ? `https://covers.openlibrary.org/b/id/${x.cover_i}-M.jpg`
              : "",
          };
          return `<div class="search-result" data-book="${encodeURIComponent(JSON.stringify(b))}">${cover(b.cover, b.title)}<strong>${esc(b.title)}</strong><small>${esc(b.author)}</small></div>`;
        })
        .join("") || "<small>No encontramos títulos.</small>";
    out.onclick = (e) => {
      let x = e.target.closest("[data-book]");
      if (x) bookPage(JSON.parse(decodeURIComponent(x.dataset.book)));
    };
  } catch {
    out.innerHTML = "<small>No pudimos conectar con Open Library.</small>";
  }
}
function profileView(username) {
  api("/api/profile?username=" + encodeURIComponent(username))
    .then((d) => {
      const p = d.profile,
        entries = [
          ...d.readings.map((r) => ({ at: r.createdAt, html: activity(r) })),
          ...(d.posts || []).map((x) => ({
            at: x.createdAt,
            html: postActivity(x),
          })),
        ].sort((a, b) => b.at.localeCompare(a.at));
      openModal(
        p.displayName.toUpperCase(),
        "PERFIL LECTOR",
        `<div class="profile-headline">${avatar(p)}<div style="flex:1;margin-left:10px"><h1 style="font-size:20px">${esc(p.displayName)}</h1><div class="profile-handle">@${esc(p.username)}</div></div>${p.username === me.username ? "" : `<button class="button small ${p.following ? "" : "soft"}" data-follow="${esc(p.username)}">${p.following ? "Siguiendo" : "Seguir"}</button>`}</div><p class="profile-bio">${esc(p.bio || "Todavía no agregó una bio.")}</p><div class="profile-stats"><span><strong data-count="${p.readings}">${p.readings}</strong> lecturas</span><span><strong data-count="${p.followers}">${p.followers}</strong> seguidores</span></div><div class="section-heading"><h2>Actividad reciente</h2></div>${
          entries
            .slice(0, 8)
            .map((x) => x.html)
            .join("") || "<small>Sin actividad registrada todavía.</small>"
        }`,
        async () => {},
      );
    })
    .catch((e) => toast(e.message));
}
$("#auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#auth-error").textContent = "";
  const fd = new FormData(e.target),
    mode = authMode;
  try {
    const payload =
      mode === "login"
        ? { login: fd.get("login"), password: fd.get("password") }
        : {
            username: fd.get("login").replace(/^@/, ""),
            email: fd.get("email"),
            password: fd.get("password"),
            displayName: fd.get("displayName"),
          };
    const d = await api(mode === "login" ? "/api/login" : "/api/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    me = d.user;
    await showApp();
  } catch (err) {
    $("#auth-error").textContent = err.message;
  }
});
$$(".auth-tab").forEach(
  (t) =>
    (t.onclick = () => {
      authMode = t.dataset.auth;
      $$(".auth-tab").forEach((x) => x.classList.toggle("active", x === t));
      $("#name-field").classList.toggle("hidden", authMode !== "register");
      $("#email-field").classList.toggle("hidden", authMode !== "register");
      $("#auth-login").placeholder =
        authMode === "login" ? "@tuusuario o tu email" : "@tuusuario";
      $("#auth-submit").innerHTML =
        authMode === "login"
          ? "Entrar a Bookish <span>→</span>"
          : "Crear mi cuenta <span>→</span>";
      $("#auth-form [name=password]").autocomplete =
        authMode === "login" ? "current-password" : "new-password";
      $("#auth-form [name=email]").required = authMode === "register";
      $("#auth-error").textContent = "";
    }),
);
$("#nav").addEventListener("click", (e) => {
  const b = e.target.closest("[data-page]");
  if (b) renderPage(b.dataset.page);
});
$$(".mobile-head [data-page]").forEach(
  (b) => (b.onclick = () => renderPage(b.dataset.page)),
);
$("#mobile-profile").onclick = () => renderPage("profile");
document.addEventListener("click", async (e) => {
  const tgl = e.target.closest("[data-add-toggle],[data-more]");
  $$(".add-menu.open,.pop-menu.open").forEach((m) => {
    if (!tgl || m.previousElementSibling !== tgl) m.classList.remove("open");
  });
  if (tgl) {
    tgl.setAttribute("aria-expanded", tgl.nextElementSibling.classList.toggle("open"));
    return;
  }
  const sf = e.target.closest("[data-sf]");
  if (sf) {
    const [k, v] = sf.dataset.sf.split(":");
    if (k === "reset") shelfState = { view: "mine", fmt: "", st: "" };
    else if (k === "all") shelfState = { ...shelfState, view: "mine", st: "" };
    else if (k === "view") shelfState = { ...shelfState, view: "wish", st: "" };
    else shelfState = { ...shelfState, view: "mine", st: v };
    renderPage("shelf", true);
    return;
  }
  if (!e.target.closest(".topsearch")) $("#global-drop")?.classList.remove("open");
  const ob = e.target.closest("[data-open-book]");
  if (ob) {
    $("#global-drop")?.classList.remove("open");
    try {
      bookPage(JSON.parse(decodeURIComponent(ob.dataset.openBook)));
    } catch {}
    return;
  }
  const fin = e.target.closest("[data-finish]");
  if (fin) {
    const r = myReadings.find((x) => x.id === fin.dataset.finish);
    if (r) readingForm(bookOfReading(r), { finish: r });
    return;
  }
  const er = e.target.closest("[data-edit-reading]");
  if (er && !e.target.closest("#modal-content .bk-sheet")) {
    const r = myReadings.find((x) => x.id === er.dataset.editReading);
    if (r) readingForm(bookOfReading(r), { edit: r });
    return;
  }
  const sw = e.target.closest("[data-start-wish]");
  if (sw) {
    const b = myShelf.find((x) => x.id === sw.dataset.startWish);
    if (b)
      try {
        await api("/api/readings", { method: "POST", body: JSON.stringify({ book: { key: b.id, title: b.title, author: b.author, cover: b.cover }, startedAt: today(), finishedAt: "", format: b.format === "audio" || b.format === "ebook" ? b.format : "paper", medium: "own" }) });
        await loadOwn();
        toast("¡A leer! Lo pasamos a “Leyendo ahora”");
        refreshPage();
      } catch (err) {
        toast(err.message);
      }
    return;
  }
  const dw = e.target.closest("[data-del-wish]");
  if (dw) {
    try {
      await api("/api/shelf", { method: "DELETE", body: JSON.stringify({ id: dw.dataset.delWish }) });
      await loadOwn();
      toast("Quitado de tu wishlist");
      refreshPage();
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const dr = e.target.closest("[data-del-reading]");
  if (dr) {
    if (confirm("¿Borrar esta lectura? También se borran sus me gusta y comentarios.")) {
      try {
        await api("/api/readings/" + dr.dataset.delReading, { method: "DELETE" });
        await loadOwn();
        toast("Lectura borrada");
        refreshPage();
      } catch (err) {
        toast(err.message);
      }
    }
    return;
  }
  const dc = e.target.closest("[data-del-comment]");
  if (dc) {
    if (confirm("¿Borrar tu comentario?")) {
      try {
        await api("/api/comments/" + dc.dataset.delComment, { method: "DELETE" });
        refreshPage();
      } catch (err) {
        toast(err.message);
      }
    }
    return;
  }
  const ep = e.target.closest("[data-edit-post]");
  if (ep) {
    const p = postCache.get(ep.dataset.editPost);
    if (p) editPost(p);
    return;
  }
  const dp = e.target.closest("[data-del-post]");
  if (dp) {
    if (confirm("¿Borrar esta publicación?")) {
      try {
        await api("/api/posts/" + dp.dataset.delPost, { method: "DELETE" });
        toast("Publicación borrada");
        refreshPage();
      } catch (err) {
        toast(err.message);
      }
    }
    return;
  }
  const page = e.target.closest("[data-page]");
  if (page) {
    renderPage(page.dataset.page);
    return;
  }
  const close = e.target.closest("[data-close]");
  if (close) {
    $("#modal").classList.remove("open");
    return;
  }
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (action === "new-reading") readingForm();
  if (action === "new-post") postComposer();
  if (action === "new-quote") quoteForm();
  if (action === "add-shelf") searchBookModal({ ownership: "owned", physicalStatus: "unread", format: "paper", label: "Sumar a mis libros" });
  if (action === "add-wish") searchBookModal({ ownership: "wishlist", physicalStatus: "unread", format: "paper", label: "Sumar a tu wishlist" });
  if (action === "find-book") searchBookModal({ label: "Buscá tu próximo libro", pick: (b) => bookPage(b) });
  if (action === "search-book") searchBookModal(shelfDest());
  if (action === "edit-profile") editProfile();
  if (action === "new-list") newList();
  const like = e.target.closest("[data-like]");
  if (like) {
    try {
      popId = like.dataset.like;
      await api("/api/readings/" + like.dataset.like + "/like", {
        method: "POST",
      });
      if (
        currentPage === "home" ||
        currentPage === "diary" ||
        currentPage === "profile"
      )
        refreshPage();
    } catch (err) {
      toast(err.message);
    }
  }
  const likePost = e.target.closest("[data-like-post]");
  if (likePost) {
    try {
      popId = likePost.dataset.likePost;
      await api("/api/posts/" + likePost.dataset.likePost + "/like", {
        method: "POST",
      });
      refreshPage();
    } catch (err) {
      toast(err.message);
    }
  }
  const focus = e.target.closest("[data-focus-comment]");
  if (focus)
    document
      .querySelector(`#comments-${focus.dataset.focusComment} input`)
      ?.focus();
  const focusPost = e.target.closest("[data-focus-post-comment]");
  if (focusPost)
    document
      .querySelector(
        `#post-comments-${focusPost.dataset.focusPostComment} input`,
      )
      ?.focus();
  const repost = e.target.closest("[data-repost]");
  if (repost) {
    try {
      const d = await api("/api/posts/" + repost.dataset.repost);
      postComposer(d.post);
    } catch (err) {
      toast(err.message);
    }
  }
  const follow = e.target.closest("[data-follow]");
  if (follow) {
    try {
      const following = follow.textContent.includes("Siguiendo");
      await api("/api/follow", {
        method: following ? "DELETE" : "POST",
        body: JSON.stringify({ username: follow.dataset.follow }),
      });
      toast(
        following
          ? "Dejaste de seguir"
          : "Ahora seguís a @" + follow.dataset.follow,
      );
      if (currentPage === "discover")
        searchPeople($("#people-query")?.value || "");
      loadSuggestions();
      if ($("#modal").classList.contains("open"))
        profileView(follow.dataset.follow);
    } catch (err) {
      toast(err.message);
    }
  }
  const open = e.target.closest("[data-open-profile]");
  if (open) {
    $("#global-drop")?.classList.remove("open");
    if (open.dataset.openProfile === me.username) {
      $("#modal").classList.remove("open");
      renderPage("profile");
    } else profileView(open.dataset.openProfile);
  }
  const edit = e.target.closest("[data-edit-shelf]");
  if (edit) {
    const b = myShelf.find((x) => x.id === edit.dataset.editShelf);
    if (b) editShelf(b);
  }
});
document.addEventListener("submit", async (e) => {
  const qq = e.target.closest("[data-quick-quote]");
  if (qq) {
    e.preventDefault();
    const fd = new FormData(qq), text = (fd.get("text") || "").trim(), r = myReadings.find((x) => x.id === qq.dataset.quickQuote);
    if (!text || !r) return;
    try {
      await api("/api/posts", { method: "POST", body: JSON.stringify({ kind: "quote", text, page: fd.get("page") || "", spoilers: fd.has("spoilers"), book: bookOfReading(r) }) });
      await loadOwn();
      toast("Frase guardada en tu diario");
      refreshPage();
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  const readForm = e.target.closest("[data-comment]"),
    postForm = e.target.closest("[data-post-comment]");
  if (!readForm && !postForm) return;
  e.preventDefault();
  const form = readForm || postForm,
    text = new FormData(form).get("text");
  if (!text.trim()) return;
  try {
    if (readForm)
      await api(`/api/readings/${form.dataset.comment}/comments`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
    else
      await api(`/api/posts/${form.dataset.postComment}/comments`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
    refreshPage();
  } catch (err) {
    toast(err.message);
  }
});
function editShelf(b) {
  const fmt = b.format === "audio" ? "audio" : b.format === "ebook" || b.format === "digital" ? "ebook" : "paper",
    wish = b.ownership === "wishlist";
  openModal(
    "Editar libro",
    "TU COLECCIÓN",
    `<div class="modal-book">${cover(b.cover, b.title)}<div><strong>${esc(b.title)}</strong><small>${esc(b.author || "")}</small></div></div><form><div class="form-row"><div class="field"><label for="e-list">Dónde va</label><select id="e-list" name="list"><option value="mine" ${wish ? "" : "selected"}>Mi estantería</option><option value="wish" ${wish ? "selected" : ""}>Wishlist</option></select></div><div class="field"><label for="e-format">Formato</label><select id="e-format" name="format"><option value="paper" ${fmt === "paper" ? "selected" : ""}>Papel</option><option value="ebook" ${fmt === "ebook" ? "selected" : ""}>Ebook</option><option value="audio" ${fmt === "audio" ? "selected" : ""}>Audiolibro</option></select></div></div><div class="form-row"><div class="field"><label for="e-status">Estado</label><select id="e-status" name="physicalStatus"><option value="unread" ${b.physicalStatus === "read" ? "" : "selected"}>Sin leer</option><option value="read" ${b.physicalStatus === "read" ? "selected" : ""}>Leído</option></select></div><div class="field" id="lent-field"><label><input type="checkbox" name="borrowed" ${b.ownership === "borrowed" ? "checked" : ""}> Está prestado</label></div></div><div class="form-row"><div class="field"><label for="e-edition">Edición</label><input id="e-edition" name="edition" value="${esc(b.edition || "")}"></div><div class="field"><label for="e-loc" id="loc-label">${fmt !== "paper" ? "¿En qué app o plataforma?" : "¿Dónde lo guardás?"}</label><input id="e-loc" name="location" value="${esc(b.location || "")}"></div></div><div class="modal-actions"><button type="button" class="button danger" id="shelf-remove">Quitar</button><button type="button" class="button" data-close>Cancelar</button><button class="button primary">Guardar</button></div></form>`,
    async (fd) => {
      const f = fd.get("format");
      await api("/api/shelf", {
        method: "POST",
        body: JSON.stringify({
          book: { id: b.id, title: b.title, author: b.author, cover: b.cover },
          ownership: fd.get("list") === "wish" ? "wishlist" : f === "paper" && fd.has("borrowed") ? "borrowed" : "owned",
          physicalStatus: fd.get("physicalStatus"),
          format: f,
          edition: fd.get("edition"),
          location: fd.get("location"),
        }),
      });
      await loadOwn();
      toast("Estantería actualizada");
      refreshPage();
    },
  );
  const syncFmt = () => {
    const paper = $("#e-format").value === "paper";
    $("#lent-field").classList.toggle("hidden", !paper);
    $("#lent-field input").disabled = !paper;
    $("#loc-label").textContent = paper ? "¿Dónde lo guardás?" : "¿En qué app o plataforma?";
  };
  $("#e-format").addEventListener("change", syncFmt);
  syncFmt();
  $("#shelf-remove").onclick = async () => {
    try {
      await api("/api/shelf", { method: "DELETE", body: JSON.stringify({ id: b.id }) });
      await loadOwn();
      $("#modal").classList.remove("open");
      toast("Quitado de tu estantería");
      refreshPage();
    } catch (err) {
      toast(err.message);
    }
  };
}
$("#logout").onclick = async () => {
  await api("/api/logout", { method: "POST" });
  me = null;
  showAuth();
};
$("#modal-close").onclick = () => $("#modal").classList.remove("open");
$("#modal").onclick = (e) => {
  if (e.target.id === "modal") $("#modal").classList.remove("open");
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $("#modal").classList.remove("open");
});
$("#suggestions").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-follow]");
  if (!b) return;
  await api("/api/follow", {
    method: "POST",
    body: JSON.stringify({ username: b.dataset.follow }),
  });
  b.textContent = "Siguiendo";
  b.disabled = true;
  toast("Ahora seguís a @" + b.dataset.follow);
});
document.addEventListener("click", (e) => {
  if (e.target.id === "people-search") searchPeople($("#people-query").value);
  if (e.target.id === "book-search") {
    const q = $("#book-query").value.trim();
    if (q) searchBooks(q, "#book-results");
  }
});
document.addEventListener("keydown", (e) => {
  if (e.target.id === "people-query" && e.key === "Enter")
    searchPeople(e.target.value);
  if (
    e.target.id === "book-query" &&
    e.key === "Enter" &&
    e.target.value.trim()
  )
    searchBooks(e.target.value.trim(), "#book-results");
});
init();
