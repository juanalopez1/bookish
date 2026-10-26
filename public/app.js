const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
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
const avatar = (u, cls = "avatar") =>
  `<div class="${cls}">${esc((u?.displayName || u?.username || "b").trim().charAt(0).toUpperCase())}</div>`;
const stars = (n) =>
  n
    ? `<span class="stars">${"★".repeat(Math.floor(n))}${n % 1 ? "½" : ""}${"☆".repeat(5 - Math.ceil(n))}</span>`
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
const fmtDay = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("es-UY", { day: "numeric", month: "long" }) : "";
const bookRef = (b, key) => encodeURIComponent(JSON.stringify({ key: key || b.key || b.id || "", title: b.title || "", author: b.author || "", cover: b.cover || "" }));
const bookOfReading = (r) => ({ key: r.bookId, title: r.book?.title, author: r.book?.author, cover: r.book?.cover });
const commentHtml = (c) => `<div class="comment">${c.userId === me?.id ? `<button class="comment-del" data-del-comment="${esc(c.id)}" aria-label="Borrar comentario">×</button>` : ""}<strong>${esc(c.user?.displayName || c.user?.username)}:</strong> ${esc(c.text)}</div>`;
const refreshPage = () => renderPage(currentPage, currentPage === "shelf" ? lastShelfTab : undefined);
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
  const [r, s, p] = await Promise.all([
    api("/api/readings"),
    api("/api/shelf"),
    api("/api/profile"),
  ]);
  myReadings = r.readings;
  myShelf = s.shelf;
  myLists = p.lists;
  const yr = new Date().getFullYear(),
    n = myReadings.filter((x) =>
      (x.finishedAt || "").startsWith(String(yr)),
    ).length;
  $("#year-read").textContent = n;
  const goal = me?.goal || 0;
  $("#year-progress").style.width = (goal ? Math.min((n / goal) * 100, 100) : 0) + "%";
  $("#year-goal").innerHTML = goal
    ? `${n >= goal ? "¡Meta cumplida!" : `Meta: ${goal} libros · te faltan ${goal - n}`} <button class="text-btn" data-action="edit-profile">Cambiar</button>`
    : '<button class="text-btn" data-action="edit-profile">Definir mi meta del año</button>';
  const open = myReadings.filter((x) => !x.finishedAt);
  $("#rail-reading").innerHTML =
    `<div class="rail-title-row"><h3>Leyendo ahora</h3></div>` +
    (open.length
      ? open.slice(0, 3).map((x) => `<div class="rail-read">${cover(x.book?.cover, x.book?.title || "Libro", bookRef(x.book || {}, x.bookId))}<div><strong>${esc(x.book?.title || "")}</strong><small class="quiet">Desde ${fmtDay(x.startedAt || x.createdAt)}</small></div><button class="follow-mini" data-finish="${x.id}">Terminé</button></div>`).join("")
      : '<div class="quiet">No tenés ningún libro en curso.</div><button class="button small primary" data-action="new-reading" style="margin-top:10px">Empezar un libro</button>');
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
            `<div class="mini-person">${avatar(u)}<div class="mini-person-info"><strong>${esc(u.displayName)}</strong><small>@${esc(u.username)} · ${u.readings} lecturas</small></div><button class="follow-mini" data-follow="${esc(u.username)}">Seguir</button></div>`,
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
let lastShelfTab = "all";
async function renderPage(page, shelfTab) {
  currentPage = page;
  $$("[data-page]").forEach((b) =>
    b.classList.toggle("active", b.dataset.page === page),
  );
  const root = $("#main-inner");
  try {
    if (page === "home") {
      const d = await api("/api/feed"),
        feed = d.items || [];
      root.innerHTML = `<section class="hero-card"><div class="eyebrow">UN LUGAR PARA TUS HISTORIAS</div><h2>Hola, ${esc(me.displayName.split(" ")[0])} ☁️</h2><p>¿Qué libro te está acompañando hoy?</p><button class="button primary" data-action="new-post">✎ Compartir algo</button> <button class="button" data-action="new-reading">＋ Registrar lectura</button></section>${readingNowHtml()}<div class="section-heading"><h2>Tu actividad lectora</h2><button data-page="discover">Encontrar lectoras →</button></div>${feed.length ? feed.map((i) => (i.type === "post" ? postActivity(i.data) : activity(i.data))).join("") : empty("📚", "Tu feed está listo para llenarse", "Seguí a gente lectora para ver qué están leyendo, sus reseñas y publicaciones.", '<button class="button primary" data-page="discover">Encontrar gente</button>')}</section>`;
    } else if (page === "diary") {
      root.innerHTML =
        heading(
          "TUS PÁGINAS",
          "Diario lector",
          "Cada lectura, con su propia historia.",
          '<button class="button primary" data-action="new-reading">＋ Registrar lectura</button>',
        ) +
        readingNowHtml() +
        (myReadings.length
          ? myReadings
              .map((r) =>
                activity({
                  ...r,
                  user: me,
                  likes: r.likes || 0,
                  comments: r.comments || [],
                }),
              )
              .join("")
          : empty(
              "✍️",
              "Todavía no hay lecturas",
              "Cuando termines un libro, registralo acá con tu opinión y las fechas.",
              '<button class="button primary" data-action="new-reading">Registrar mi primera lectura</button>',
            ));
    } else if (page === "shelf" || page === "wishlist") {
      const tab = shelfTab || (page === "wishlist" ? "wish" : "all"),
        inShelf = (b) => b.ownership !== "wishlist",
        isRead = (b) => b.physicalStatus === "read",
        filters = {
          all: inShelf,
          read: (b) => inShelf(b) && isRead(b),
          unread: (b) => inShelf(b) && !isRead(b),
          wish: (b) => b.ownership === "wishlist",
        },
        tabs = [
          ["all", "Todos"],
          ["read", "Leídos"],
          ["unread", "Sin leer"],
          ["wish", "Wishlist"],
        ],
        items = myShelf.filter(filters[tab]);
      lastShelfTab = tab;
      root.innerHTML =
        heading(
          "MIS LIBROS",
          "Tu estantería",
          "",
          '<button class="button primary" data-action="search-book">＋ Agregar libro</button>',
        ) +
        `<div class="shelf-tabs">${tabs
          .map(
            ([k, l]) =>
              `<button class="shelf-tab${k === tab ? " active" : ""}" data-shelf-tab="${k}">${l} · ${myShelf.filter(filters[k]).length}</button>`,
          )
          .join("")}</div>` +
        (items.length
          ? `<div class="book-grid">${items.map(shelfCard).join("")}<button class="shelf-add" data-action="search-book">＋ Agregar libro</button></div>`
          : empty(
              tab === "wish" ? "♡" : "▥",
              tab === "wish" ? "Tu wishlist está en blanco" : "Acá no hay libros todavía",
              tab === "wish"
                ? "Buscá un libro para guardarlo en tu wishlist."
                : "Agregá los libros que tenés, prestados o en tu lista de deseos.",
              '<button class="button primary" data-action="search-book">Buscar libros</button>',
            ));
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
      root.innerHTML = `<div class="profile-cover">${avatar(me, "avatar profile-avatar")}<button class="button profile-edit" data-action="edit-profile">Editar perfil</button></div><div class="profile-headline"><div><h1>${esc(p.displayName)}</h1><div class="profile-handle">@${esc(p.username)}</div></div></div><p class="profile-bio">${esc(p.bio) || "Sumá una pequeña bio para que la comunidad te conozca."}</p><div class="profile-stats"><span><strong>${p.readings}</strong> lecturas</span><span><strong>${p.followers}</strong> seguidores</span><span><strong>${p.followingCount}</strong> siguiendo</span><span><strong>${avg ? avg.toFixed(1) : "—"}</strong> promedio</span></div><div class="section-heading"><h2>Actividad</h2><button data-page="diary">Ver diario →</button></div>${items.length ? items.map((x) => x.html).join("") : empty("📖", "Todavía no hay actividad", "Tu perfil va a guardar tus lecturas y publicaciones.")}`;
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
function readingNowHtml() {
  const open = myReadings.filter((r) => !r.finishedAt);
  if (!open.length) return "";
  return `<div class="section-heading"><h2>Leyendo ahora</h2></div><div class="now-row">${open
    .map((r) => {
      const b = r.book || {}, ref = bookRef(b, r.bookId);
      return `<div class="now-card">${cover(b.cover, b.title || "Libro", ref)}<div class="now-info"><strong data-open-book="${ref}">${esc(b.title || "")}</strong><small>${esc(b.author || "")}</small><small>Desde el ${fmtDay(r.startedAt || r.createdAt)}</small><button class="button primary small" data-finish="${r.id}">✓ Terminé</button></div></div>`;
    })
    .join("")}</div>`;
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
  return `<article class="activity-card" data-reading="${r.id}"><div class="activity-top">${avatar(u)}<div class="activity-by"><strong>${esc(u.displayName || u.username)}</strong> ${open ? "empezó a leer" : "terminó un libro"}<small>${when(date)} ${r.format === "audio" ? "· Audiolibro" : r.format === "ebook" ? "· Ebook" : "· Papel"}${r.reread ? " · Relectura" : ""}</small></div><span class="activity-tag">${r.medium === "library" ? "Biblioteca" : r.medium === "borrowed" ? "Prestado" : r.medium === "app" ? "En app" : "Propio"}</span></div><div class="activity-body">${cover(book.cover, title, ref)}<div class="review-copy"><div class="book-name" data-open-book="${ref}">${esc(title)}</div><div class="book-author">${esc(book.author || "Autoría desconocida")}</div>${stars(+r.rating)}${open ? `<div class="reading-since">Leyéndolo desde el ${fmtDay(r.startedAt || r.createdAt)}</div>` : ""}${review}</div></div><div class="activity-actions"><button class="action-btn ${r.liked ? "liked" : ""}" data-like="${r.id}">${r.liked ? "♥" : "♡"} ${r.likes || 0} Me gusta</button><button class="action-btn" data-focus-comment="${r.id}">☷ ${r.comments?.length || 0} comentarios</button>${mine && open ? `<button class="action-btn strong" data-finish="${r.id}">✓ Terminé</button>` : ""}${mine ? `<button class="action-btn" data-edit-reading="${r.id}">✎ Editar</button>` : ""}</div><div class="comments" id="comments-${r.id}">${(r.comments || []).slice(-3).map(commentHtml).join("")}<form class="comment-form" data-comment="${r.id}"><input name="text" placeholder="Dejá un comentario…" maxlength="800"><button>Enviar</button></form></div></article>`;
}
function sharedBook(book) {
  if (!book) return "";
  const ref = bookRef(book);
  return `<div class="shared-book">${cover(book.cover, book.title || "Libro", ref)}<div><strong data-open-book="${ref}">${esc(book.title || "")}</strong><small>${esc(book.author || "")}</small></div></div>`;
}
function originalPostContent(o) {
  if (o.kind === "quote")
    return `<blockquote>${esc(o.text)}</blockquote>${sharedBook(o.book)}`;
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
    content = `<div class="shared-post"><div class="shared-by">${avatar(ou)}<div><strong>${esc(ou.displayName || ou.username)}</strong><small>@${esc(ou.username || "")}</small></div></div>${originalPostContent(o)}</div>`;
  } else if (p.kind === "quote") {
    content = `<blockquote>${esc(p.text)}</blockquote>${sharedBook(p.book)}`;
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
  return `<article class="activity-card post-card${p.kind === "quote" ? " quote-card" : ""}" data-post="${p.id}"><div class="activity-top">${avatar(u)}<div class="activity-by"><strong>${esc(u.displayName || u.username)}</strong> ${p.kind === "repost" ? "reposteó" : p.kind === "quote" ? "guardó una frase" : "compartió algo"}<small>${when(p.createdAt)}</small></div>${p.kind === "quote" ? "" : `<span class="activity-tag">${p.kind === "repost" ? "Repost" : "Nota"}</span>`}</div>${p.kind === "repost" && p.text ? `<div class="repost-note">${esc(p.text)}</div>` : ""}${content}<div class="activity-actions"><button class="action-btn ${p.liked ? "liked" : ""}" data-like-post="${p.id}">${p.liked ? "♥" : "♡"} ${p.likes || 0} Me gusta</button><button class="action-btn" data-focus-post-comment="${p.id}">☷ ${p.comments?.length || 0} comentarios</button><button class="action-btn" data-repost="${p.id}">↻ Repostear</button>${mine ? `<button class="action-btn" data-edit-post="${p.id}">✎ Editar</button><button class="action-btn" data-del-post="${p.id}">🗑 Borrar</button>` : ""}</div><div class="comments" id="post-comments-${p.id}">${comments}<form class="comment-form" data-post-comment="${p.id}"><input name="text" placeholder="Dejá un comentario…" maxlength="800"><button>Enviar</button></form></div></article>`;
}
function shelfCard(b) {
  const own =
    {
      owned: "En mi estante",
      wishlist: "Wishlist",
      borrowed: "Prestado",
      gone: "Ya no lo tengo",
    }[b.ownership] || "En mi estante";
  return `<article class="shelf-book">${cover(b.cover, b.title, bookRef(b))}<strong data-open-book="${bookRef(b)}">${esc(b.title)}</strong><small>${esc(b.author || "Autoría desconocida")}</small><span class="status-label">${own}${b.ownership === "owned" ? " · " + (b.physicalStatus === "read" ? "Leído" : "Sin leer") : ""}</span><div style="margin-top:9px"><button class="text-btn" data-edit-shelf="${esc(b.id)}">Editar</button></div></article>`;
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
const ratingPicker = (v = 0) =>
  `<div class="rating-picker" id="rate-stars">${[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => `<span data-rating="${n}" title="${n} estrellas">${n <= v ? "★" : "☆"}</span>`).join("")}</div><input type="hidden" name="rating" value="${v}">`;
function bindRating() {
  const box = $("#rate-stars");
  if (!box) return;
  box.addEventListener("click", (e) => {
    let n = +e.target.dataset.rating;
    if (!n) return;
    const input = $("input[name=rating]");
    if (+input.value === n) n = 0;
    box.querySelectorAll("span").forEach((s) => (s.textContent = +s.dataset.rating <= n ? "★" : "☆"));
    input.value = n;
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
    `<div class="modal-book">${cover(book.cover, book.title)}<div><strong>${esc(book.title)}</strong><small>${esc(book.author || "")}</small></div></div><form><input type="hidden" name="bookTitle" value="${esc(book.title)}"><input type="hidden" name="bookAuthor" value="${esc(book.author || "")}"><input type="hidden" name="bookCover" value="${esc(book.cover || "")}"><input type="hidden" name="bookKey" value="${esc(key)}">${seg}<div class="form-row"><div class="field"><label for="f-start">Empecé</label><input id="f-start" name="startedAt" type="date" required max="${today()}" value="${r?.startedAt || today()}"></div><div class="field only-finished"><label for="f-end">Terminé</label><input id="f-end" name="finishedAt" type="date" required max="${today()}" value="${r?.finishedAt || today()}"></div></div><p class="hint only-finished">Por defecto va la fecha de hoy. Si te olvidaste de marcarlo en su momento, elegí el día en que lo terminaste.</p><div class="field only-finished"><label>Tu puntuación · de ½ a 5</label>${ratingPicker(r?.rating || 0)}</div><div class="field only-finished"><label for="f-review">Tu reseña</label><textarea id="f-review" name="review" maxlength="3000" placeholder="¿Qué te dejó esta lectura?">${esc(r?.review || "")}</textarea></div><div class="field only-finished"><label><input type="checkbox" name="spoilers" ${r?.spoilers ? "checked" : ""}> Esta reseña contiene spoilers</label></div><div class="field only-finished"><label><input type="checkbox" name="reread" ${(r ? r.reread : again) ? "checked" : ""}> Es una relectura</label></div><details class="more"><summary>Más detalles</summary><div class="form-row"><div class="field"><label>Formato</label><select name="format">${[["paper", "Papel"], ["ebook", "Ebook"], ["audio", "Audiolibro"]].map(([v, l]) => `<option value="${v}" ${(r?.format || "paper") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div><div class="field"><label>¿De dónde?</label><select name="medium">${[["own", "Lo tengo"], ["borrowed", "Prestado"], ["library", "Biblioteca"], ["app", "App / Kindle"]].map(([v, l]) => `<option value="${v}" ${(r?.medium || "own") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div></div></details><div class="modal-actions">${editing ? '<button type="button" class="button danger" id="del-reading">Borrar</button>' : ""}<button class="button" type="button" data-close>Cancelar</button><button class="button primary">${finishing ? "Terminé" : editing ? "Guardar cambios" : "Guardar"}</button></div></form>`,
    async (fd) => {
      const t = (fd.get("bookTitle") || "").trim();
      if (!t) throw Error("Escribí el título del libro.");
      const fin = (r ? status : fd.get("status") || "reading") === "finished",
        startedAt = fd.get("startedAt") || "",
        finishedAt = fin ? fd.get("finishedAt") || "" : "";
      if (!startedAt) throw Error("Elegí la fecha de inicio.");
      if (fin && !finishedAt) throw Error("Elegí la fecha en que lo terminaste.");
      if (fin && finishedAt < startedAt) throw Error("La fecha de fin no puede ser anterior a la de inicio.");
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
  $$("input[name=status]").forEach((i) => i.addEventListener("change", sync));
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
function editPost(p) {
  openModal(
    p.kind === "repost" ? "Editar tu nota" : "Editar publicación",
    "TU PUBLICACIÓN",
    `<form><div class="field"><label for="f-post">Texto</label><textarea id="f-post" name="text" maxlength="1600" ${p.kind === "repost" ? "" : "required"}>${esc(p.text)}</textarea></div><div class="modal-actions"><button type="button" class="button" data-close>Cancelar</button><button class="button primary">Guardar</button></div></form>`,
    async (fd) => {
      await api("/api/posts/" + p.id, { method: "PATCH", body: JSON.stringify({ text: fd.get("text") }) });
      toast("Publicación actualizada");
      refreshPage();
    },
  );
}
async function bookPage(ref, o = {}) {
  const key = ref.key || ref.id || "",
    book = { key, title: ref.title, author: ref.author, cover: ref.cover };
  openModal(ref.title || "Libro", "FICHA DEL LIBRO", '<div class="quiet" style="padding:30px 0">Cargando ficha…</div>', async () => {});
  $("#modal .modal").classList.add("wide");
  const works = key.startsWith("/works/"),
    getJson = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [info, work, olr] = await Promise.all([
    api("/api/book?id=" + encodeURIComponent(key)).catch(() => ({})),
    works ? getJson("https://openlibrary.org" + key + ".json") : null,
    works ? getJson("https://openlibrary.org" + key + "/ratings.json") : null,
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
    cnt = info.count || 0;
  let desc = typeof work?.description === "string" ? work.description : work?.description?.value || "";
  desc = desc.split(/\r?\n-{3,}/)[0].replace(/\[([^\]]+)\]\[\d+\]/g, "$1").replace(/\(\[source\][^)]*\)/gi, "").trim();
  const subjects = (work?.subjects || []).slice(0, 6),
    ol = olr?.summary?.average ? `<small>Open Library: ${olr.summary.average.toFixed(1)} ★ · ${olr.summary.count} puntuaciones</small>` : "",
    reviews = (info.reviews || [])
      .map((r) => `<article class="bk-review">${avatar(r.user || {})}<div><div><strong>${esc(r.user?.displayName || r.user?.username || "")}</strong> ${stars(+r.rating)} <small class="quiet">${when(r.finishedAt || r.createdAt)}</small></div>${r.spoilers && r.userId !== me.id ? `<details class="spoiler"><summary>Reseña con spoilers · tocá para verla</summary><div>${esc(r.review)}</div></details>` : `<p>${esc(r.review)}</p>`}</div></article>`)
      .join("");
  $("#modal-content").innerHTML = `<div class="bk-sheet"><div class="bk-head">${cover(ref.cover, ref.title || "Libro")}<div><h1>${esc(ref.title || "")}</h1><div class="bk-author">${esc(ref.author || "Autoría desconocida")}</div>${cnt ? `<div class="big-rating"><strong>${avg.toFixed(1)}</strong><div>${stars(Math.round(avg * 2) / 2)}<small>${cnt} ${cnt === 1 ? "puntuación" : "puntuaciones"} en Bookish</small></div></div>` : '<div class="big-rating"><small>Todavía sin puntuaciones en Bookish</small></div>'}<small class="quiet">${info.readers || 0} ${info.readers === 1 ? "persona lo leyó" : "personas lo leyeron"} · ${info.readingNow || 0} leyéndolo ahora</small>${ol ? `<div>${ol}</div>` : ""}${subjects.length ? `<div class="chips">${subjects.map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : ""}</div></div>${desc ? `<p class="synopsis" id="synopsis">${esc(desc)}</p>${desc.length > 320 ? '<button class="text-btn" id="syn-more">Leer más</button>' : ""}` : `<p class="quiet" style="margin-top:14px">${works ? "Todavía no hay sinopsis para este libro en Open Library." : "Este libro se cargó a mano, así que no tiene sinopsis."}</p>`}<div class="bk-actions"><button class="chip-btn ${wish ? "on" : ""}" data-bk="wish">${wish ? "♥" : "♡"} Quiero leerlo</button><button class="chip-btn ${owned ? "on" : ""}" data-bk="own">▥ Lo tengo</button>${open ? '<button class="button primary" data-bk="finish">✓ Terminé</button>' : '<button class="button primary" data-bk="start">Empecé a leerlo</button>'}<button class="button" data-bk="log">Ya lo leí</button><button class="button" data-bk="list">☷ Agregar a lista</button></div>${o.lists ? `<div class="bk-lists">${(info.lists || []).map((l) => `<button class="chip-btn ${l.has ? "on" : ""}" data-bk-list="${l.id}">${l.has ? "✓" : "＋"} ${esc(l.title)}</button>`).join("") || '<span class="quiet">Todavía no tenés listas.</span>'}<button class="chip-btn" data-bk="newlist">＋ Nueva lista</button></div>` : ""}<div class="field"><label>Tu puntuación</label><div class="rating-picker" id="bk-stars">${[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => `<span data-rating="${n}" title="${n} estrellas">${n <= (last?.rating || 0) ? "★" : "☆"}</span>`).join("")}</div></div>${mine.length ? `<h3 class="bk-section">Tus lecturas</h3>${mine.map((r) => `<div class="bk-mine"><span>${r.finishedAt ? `Terminado el ${fmtDay(r.finishedAt)}` : `Leyendo desde el ${fmtDay(r.startedAt || r.createdAt)}`}${r.reread ? " · relectura" : ""} ${stars(+r.rating)}</span><button class="text-btn" data-edit-reading="${r.id}">Editar</button></div>`).join("")}` : ""}<h3 class="bk-section">Reseñas</h3>${reviews || '<p class="quiet">Todavía no hay reseñas de este libro.</p>'}</div>`;
  const again = (x) => bookPage(ref, x),
    reload = async (x) => {
      await loadOwn();
      again(x);
    },
    shelfPost = (ownership, physicalStatus) => {
      const s = myShelf.find((x) => x.id === key);
      return api("/api/shelf", { method: "POST", body: JSON.stringify({ book, ownership, physicalStatus, edition: s?.edition || "", location: s?.location || "" }) });
    };
  $("#modal-content").onclick = async (e) => {
    const star = e.target.closest("#bk-stars [data-rating]"),
      bk = e.target.closest("[data-bk]")?.dataset.bk,
      bl = e.target.closest("[data-bk-list]"),
      er = e.target.closest("[data-edit-reading]");
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
        await reload(o);
      } else if (bk === "wish") {
        if (wish) await api("/api/shelf", { method: "DELETE", body: JSON.stringify({ id: key }) });
        else await shelfPost("wishlist", "unread");
        await reload(o);
      } else if (bk === "own") {
        if (owned) await api("/api/shelf", { method: "DELETE", body: JSON.stringify({ id: key }) });
        else await shelfPost("owned", done.length ? "read" : "unread");
        await reload(o);
      } else if (bk === "start") {
        await api("/api/readings", { method: "POST", body: JSON.stringify({ book, startedAt: today(), finishedAt: "", format: "paper", medium: "own" }) });
        toast("¡A leer! Empezaste hoy");
        await reload(o);
      } else if (bk === "finish") readingForm(book, { finish: open, after: () => again(o) });
      else if (bk === "log") readingForm(book, { status: "finished", after: () => again(o) });
      else if (bk === "list") again({ lists: !o.lists });
      else if (bk === "newlist") newList();
      else if (bl) {
        await api("/api/lists/" + bl.dataset.bkList + "/books", { method: "POST", body: JSON.stringify({ book }) });
        await reload({ lists: true });
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
  if (lastShelfTab === "wish") return { ownership: "wishlist", physicalStatus: "unread", label: "Sumar a tu wishlist" };
  return { ownership: "owned", physicalStatus: lastShelfTab === "read" ? "read" : "unread", label: "Sumar a mis libros" };
}
async function quickAdd(book, dest) {
  try {
    await api("/api/shelf", {
      method: "POST",
      body: JSON.stringify({ book, ownership: dest.ownership, physicalStatus: dest.physicalStatus, edition: "", location: "" }),
    });
    await loadOwn();
    $("#modal").classList.remove("open");
    toast(dest.ownership === "wishlist" ? "A tu wishlist" : "Libro agregado a tu estantería");
    renderPage(currentPage, lastShelfTab);
  } catch (err) {
    toast(err.message);
  }
}
function searchBookModal(dest) {
  openModal(
    dest ? dest.label : "Encontrá un libro",
    "CATÁLOGO ABIERTO",
    `<p style="font-size:11px;color:var(--muted)">Buscamos en Open Library para que encuentres la ficha correcta.</p><div class="search-bar"><input id="modal-book-q" placeholder="Título o autora…"><button class="button primary" id="modal-book-search">Buscar</button></div><div class="results-row" id="modal-book-results"></div><div class="field"><label>¿No aparece?</label><button class="button" id="manual-book">Agregar título manualmente</button></div>`,
    async () => {},
  );
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
      } else if (dest) quickAdd(b, dest);
      else {
        $("#modal").classList.remove("open");
        bookChoice(b);
      }
    }
  };
  $("#manual-book").onclick = () => {
    $("#modal").classList.remove("open");
    bookChoice({}, dest);
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
        `<div class="profile-headline">${avatar(p)}<div style="flex:1;margin-left:10px"><h1 style="font-size:20px">${esc(p.displayName)}</h1><div class="profile-handle">@${esc(p.username)}</div></div>${p.username === me.username ? "" : `<button class="button small ${p.following ? "" : "soft"}" data-follow="${esc(p.username)}">${p.following ? "Siguiendo" : "Seguir"}</button>`}</div><p class="profile-bio">${esc(p.bio || "Todavía no agregó una bio.")}</p><div class="profile-stats"><span><strong>${p.readings}</strong> lecturas</span><span><strong>${p.followers}</strong> seguidores</span></div><div class="section-heading"><h2>Actividad reciente</h2></div>${
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
  if (action === "search-book") searchBookModal(shelfDest());
  if (action === "edit-profile") editProfile();
  if (action === "new-list") newList();
  const like = e.target.closest("[data-like]");
  if (like) {
    try {
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
  if (open) profileView(open.dataset.openProfile);
  const shelfTabBtn = e.target.closest("[data-shelf-tab]");
  if (shelfTabBtn) renderPage("shelf", shelfTabBtn.dataset.shelfTab);
  const edit = e.target.closest("[data-edit-shelf]");
  if (edit) {
    const b = myShelf.find((x) => x.id === edit.dataset.editShelf);
    if (b) editShelf(b);
  }
});
document.addEventListener("submit", async (e) => {
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
  openModal(
    "Editar libro",
    "TU COLECCIÓN",
    `<div class="modal-book">${cover(b.cover, b.title)}<div><strong>${esc(b.title)}</strong><small>${esc(b.author || "")}</small></div></div><form><div class="field"><label>Estado de colección</label><select name="ownership"><option value="owned" ${b.ownership === "owned" ? "selected" : ""}>Lo tengo</option><option value="wishlist" ${b.ownership === "wishlist" ? "selected" : ""}>Wishlist</option><option value="borrowed" ${b.ownership === "borrowed" ? "selected" : ""}>Prestado</option><option value="gone" ${b.ownership === "gone" ? "selected" : ""}>Ya no lo tengo</option></select></div><div class="field"><label>¿Leído?</label><select name="physicalStatus"><option value="unread" ${b.physicalStatus === "unread" ? "selected" : ""}>Sin leer</option><option value="read" ${b.physicalStatus === "read" ? "selected" : ""}>Leído</option></select></div><div class="form-row"><div class="field"><label>Edición</label><input name="edition" value="${esc(b.edition || "")}"></div><div class="field"><label>¿Dónde lo guardás?</label><input name="location" value="${esc(b.location || "")}"></div></div><div class="modal-actions"><button type="button" class="button" data-close>Cancelar</button><button type="button" class="button danger" id="shelf-remove">Quitar</button><button class="button primary">Guardar</button></div></form>`,
    async (fd) => {
      await api("/api/shelf", {
        method: "POST",
        body: JSON.stringify({
          book: { id: b.id, title: b.title, author: b.author, cover: b.cover },
          ownership: fd.get("ownership"),
          physicalStatus: fd.get("physicalStatus"),
          edition: fd.get("edition"),
          location: fd.get("location"),
        }),
      });
      await loadOwn();
      toast("Estantería actualizada");
      refreshPage();
    },
  );
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
