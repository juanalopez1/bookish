const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
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
const cover = (src, title) =>
  src
    ? `<img class="book-cover" loading="lazy" src="${esc(src)}" alt="Tapa de ${esc(title)}" onerror="this.onerror=null;const d=document.createElement('div');d.className='book-cover cover-placeholder';d.textContent=this.alt.replace('Tapa de ','');this.replaceWith(d)">`
    : `<div class="book-cover cover-placeholder">${esc(title)}</div>`;
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
  $("#year-progress").style.width = Math.min((n / 24) * 100, 100) + "%";
  $("#year-goal").textContent =
    n >= 24
      ? "¡Qué año lector! ✨"
      : `Meta sugerida: 24 libros · ${24 - n} por descubrir`;
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
async function renderPage(page) {
  currentPage = page;
  $$("[data-page]").forEach((b) =>
    b.classList.toggle("active", b.dataset.page === page),
  );
  const root = $("#main-inner");
  try {
    if (page === "home") {
      const d = await api("/api/feed"),
        feed = d.items || [];
      root.innerHTML = `<section class="hero-card"><div class="eyebrow">UN LUGAR PARA TUS HISTORIAS</div><h2>Hola, ${esc(me.displayName.split(" ")[0])} ☁️</h2><p>¿Qué libro te está acompañando hoy?</p><button class="button primary" data-action="new-post">✎ Compartir algo</button> <button class="button" data-action="new-reading">＋ Registrar lectura</button></section><div class="section-heading"><h2>Tu actividad lectora</h2><button data-page="discover">Encontrar lectoras →</button></div>${feed.length ? feed.map((i) => (i.type === "post" ? postActivity(i.data) : activity(i.data))).join("") : empty("📚", "Tu feed está listo para llenarse", "Seguí a gente lectora para ver qué están leyendo, sus reseñas y publicaciones.", '<button class="button primary" data-page="discover">Encontrar gente</button>')}</section>`;
    } else if (page === "diary") {
      root.innerHTML =
        heading(
          "TUS PÁGINAS",
          "Diario lector",
          "Cada lectura, con su propia historia.",
          '<button class="button primary" data-action="new-reading">＋ Registrar lectura</button>',
        ) +
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
      const wish = page === "wishlist",
        items = myShelf.filter((b) =>
          wish ? b.ownership === "wishlist" : b.ownership !== "wishlist",
        );
      root.innerHTML =
        heading(
          wish ? "TÍTULOS QUE TE ESPERAN" : "TU COLECCIÓN",
          wish ? "Wishlist" : "Mis libros",
          wish
            ? "Libros que algún día van a ser parte de tu historia."
            : "Lo que tenés, lo que ya leíste y lo que está esperando su turno.",
          '<button class="button primary" data-action="search-book">＋ Buscar libros</button>',
        ) +
        (items.length
          ? `<div class="book-grid">${items.map(shelfCard).join("")}</div>`
          : empty(
              wish ? "♡" : "▥",
              wish ? "Tu wishlist está en blanco" : "Tu estantería empieza acá",
              wish
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
      root.innerHTML = `<div class="profile-cover">${avatar(me, "avatar profile-avatar")}<button class="button profile-edit" data-action="edit-profile">Editar perfil</button></div><div class="profile-headline"><div><h1>${esc(p.displayName)}</h1><div class="profile-handle">@${esc(p.username)}</div></div></div><p class="profile-bio">${esc(p.bio) || "Sumá una pequeña bio para que la comunidad te conozca."}</p><div class="profile-stats"><span><strong>${p.readings}</strong> lecturas</span><span><strong>${p.followers}</strong> seguidores</span><span><strong>${p.followingCount}</strong> siguiendo</span><span><strong>${avg ? avg.toFixed(1) : "—"}</strong> promedio</span></div><div class="section-heading"><h2>Actividad</h2><button data-page="diary">Ver diario →</button></div>${items.length ? items.map((x) => x.html).join("") : empty("🌷", "Todavía no hay actividad", "Tu perfil va a guardar tus lecturas y publicaciones.")}`;
    } else if (page === "lists") {
      root.innerHTML =
        heading(
          "TUS COLECCIONES",
          "Listas",
          "Armá listas para cada mood, obsesión o pila de libros.",
        ) +
        `<button class="button primary" data-action="new-list">＋ Crear una lista</button><div id="lists-area" style="margin-top:18px">${myLists.length ? myLists.map((l) => `<article class="list-card"><h3>${esc(l.title)}</h3><p>${esc(l.description || "Sin descripción")} · ${l.books.length} libros</p></article>`).join("") : empty("☷", "Todavía no hay listas", "Creá una para organizar los libros que querés compartir.")}</div>`;
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
function activity(r) {
  const u = r.user || me,
    book = r.book || {},
    title = book.title || "Libro sin título",
    date = r.finishedAt || r.createdAt;
  return `<article class="activity-card" data-reading="${r.id}"><div class="activity-top">${avatar(u)}<div class="activity-by"><strong>${esc(u.displayName || u.username)}</strong> terminó un libro<small>${when(date)} ${r.format === "audio" ? "· Audiolibro" : r.format === "ebook" ? "· Ebook" : "· Papel"}</small></div><span class="activity-tag">${r.medium === "library" ? "Biblioteca" : r.medium === "borrowed" ? "Prestado" : r.medium === "app" ? "En app" : "Propio"}</span></div><div class="activity-body">${cover(book.cover, title)}<div class="review-copy"><div class="book-name">${esc(title)}</div><div class="book-author">${esc(book.author || "Autoría desconocida")}</div>${stars(+r.rating)}${r.review ? `<div style="margin-top:6px">${esc(r.review)}</div>` : ""}</div></div><div class="activity-actions"><button class="action-btn ${r.liked ? "liked" : ""}" data-like="${r.id}">${r.liked ? "♥" : "♡"} ${r.likes || 0} Me gusta</button><button class="action-btn" data-focus-comment="${r.id}">☷ ${r.comments?.length || 0} comentarios</button></div><div class="comments" id="comments-${r.id}">${(
    r.comments || []
  )
    .slice(-3)
    .map(
      (c) =>
        `<div class="comment"><strong>${esc(c.user?.displayName || c.user?.username)}:</strong> ${esc(c.text)}</div>`,
    )
    .join(
      "",
    )}<form class="comment-form" data-comment="${r.id}"><input name="text" placeholder="Dejá un comentario…" maxlength="800"><button>Enviar</button></form></div></article>`;
}
function sharedBook(book) {
  if (!book) return "";
  return `<div class="shared-book">${cover(book.cover, book.title || "Libro")}<div><strong>${esc(book.title || "")}</strong><small>${esc(book.author || "")}</small></div></div>`;
}
function originalPostContent(o) {
  if (o.kind === "quote")
    return `<blockquote>${esc(o.text)}</blockquote>${sharedBook(o.book)}`;
  return `<div class="shared-note">${esc(o.text)}</div>${sharedBook(o.book)}`;
}
function postActivity(p) {
  const u = p.user || me,
    o = p.original;
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
        `<div class="comment"><strong>${esc(c.user?.displayName || c.user?.username)}:</strong> ${esc(c.text)}</div>`,
    )
    .join("");
  return `<article class="activity-card post-card" data-post="${p.id}"><div class="activity-top">${avatar(u)}<div class="activity-by"><strong>${esc(u.displayName || u.username)}</strong> ${p.kind === "repost" ? "reposteó" : "compartió algo"}<small>${when(p.createdAt)}${p.kind === "quote" ? " · Una frase de un libro" : ""}</small></div><span class="activity-tag">${p.kind === "quote" ? "Cita" : p.kind === "repost" ? "Repost" : "Nota"}</span></div>${p.kind === "repost" && p.text ? `<div class="repost-note">${esc(p.text)}</div>` : ""}${content}<div class="activity-actions"><button class="action-btn ${p.liked ? "liked" : ""}" data-like-post="${p.id}">${p.liked ? "♥" : "♡"} ${p.likes || 0} Me gusta</button><button class="action-btn" data-focus-post-comment="${p.id}">☷ ${p.comments?.length || 0} comentarios</button><button class="action-btn" data-repost="${p.id}">↻ Repostear</button></div><div class="comments" id="post-comments-${p.id}">${comments}<form class="comment-form" data-post-comment="${p.id}"><input name="text" placeholder="Dejá un comentario…" maxlength="800"><button>Enviar</button></form></div></article>`;
}
function shelfCard(b) {
  const own =
    {
      owned: "En mi estante",
      wishlist: "Wishlist",
      borrowed: "Prestado",
      gone: "Ya no lo tengo",
    }[b.ownership] || "En mi estante";
  return `<article class="shelf-book">${cover(b.cover, b.title)}<strong>${esc(b.title)}</strong><small>${esc(b.author || "Autoría desconocida")}</small><span class="status-label">${own}${b.ownership === "owned" ? " · " + (b.physicalStatus === "read" ? "Leído" : "Sin leer") : ""}</span><div style="margin-top:9px"><button class="text-btn" data-edit-shelf="${esc(b.id)}">Editar</button></div></article>`;
}
function openModal(title, eyebrow, html, submit) {
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
        renderPage(currentPage);
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
      renderPage(currentPage);
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
function readingForm(book = {}) {
  let val = 0;
  openModal(
    "Registrar lectura",
    "TU DIARIO",
    `<div class="modal-book">${cover(book.cover, book.title || "Un libro")}<div><strong>${esc(book.title || "Elegí un libro")}</strong><small>${esc(book.author || "Podés buscarlo o agregarlo manualmente")}</small></div></div><form><input type="hidden" name="bookTitle" value="${esc(book.title || "")}"><input type="hidden" name="bookAuthor" value="${esc(book.author || "")}"><input type="hidden" name="bookCover" value="${esc(book.cover || "")}"><input type="hidden" name="bookKey" value="${esc(book.key || book.id || "")}"><div class="form-row"><div class="field"><label>Fecha de inicio</label><input name="startedAt" type="date"></div><div class="field"><label>Fecha de fin</label><input name="finishedAt" type="date" value="${new Date().toISOString().slice(0, 10)}"></div></div><div class="form-row"><div class="field"><label>Formato</label><select name="format"><option value="paper">Papel</option><option value="ebook">Ebook</option><option value="audio">Audiolibro</option></select></div><div class="field"><label>¿De dónde?</label><select name="medium"><option value="own">Lo tengo</option><option value="borrowed">Prestado</option><option value="library">Biblioteca</option><option value="app">App / Kindle</option></select></div></div><div class="field"><label>Tu puntuación · de ½ a 5</label><div class="rating-picker" id="rate-stars">${[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => `<span data-rating="${n}" title="${n} estrellas">☆</span>`).join("")}</div><input type="hidden" name="rating" value="0"></div><div class="field"><label>Tu reseña</label><textarea name="review" maxlength="3000" placeholder="¿Qué te dejó esta lectura?"></textarea></div><div class="field"><label><input type="checkbox" name="spoilers"> Esta reseña contiene spoilers</label></div><div class="modal-actions"><button class="button" type="button" data-close>Cancelar</button><button class="button primary">Guardar en mi diario</button></div></form>`,
    async (fd) => {
      const t = fd.get("bookTitle").trim();
      if (!t) throw Error("Escribí el título del libro.");
      await api("/api/readings", {
        method: "POST",
        body: JSON.stringify({
          book: {
            key: fd.get("bookKey"),
            title: t,
            author: fd.get("bookAuthor"),
            cover: fd.get("bookCover"),
          },
          startedAt: fd.get("startedAt"),
          finishedAt: fd.get("finishedAt"),
          format: fd.get("format"),
          medium: fd.get("medium"),
          rating: +fd.get("rating"),
          review: fd.get("review"),
          spoilers: fd.has("spoilers"),
        }),
      });
      await loadOwn();
      toast("Lectura registrada ✨");
      renderPage(currentPage);
    },
  );
  $("#rate-stars").addEventListener("click", (e) => {
    let n = +e.target.dataset.rating;
    if (!n) return;
    $("#rate-stars")
      .querySelectorAll("span")
      .forEach((s) => {
        let x = +s.dataset.rating;
        s.textContent = x <= n ? "★" : "☆";
      });
    $("input[name=rating]").value = n;
  });
}
function searchBookModal() {
  openModal(
    "Encontrá un libro",
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
      $("#modal").classList.remove("open");
      bookChoice(b);
    }
  };
  $("#manual-book").onclick = () => {
    $("#modal").classList.remove("open");
    bookChoice({});
  };
}
function bookChoice(b) {
  openModal(
    b.title ? "¿Qué querés hacer?" : "Agregar un libro",
    "TU ESTANTERÍA",
    `<div class="modal-book">${cover(b.cover, b.title || "Tu libro")}<div><strong>${esc(b.title || "Agregar manualmente")}</strong><small>${esc(b.author || "Podés editar estos datos")}</small></div></div><div class="field"><label>Título</label><input id="choice-title" value="${esc(b.title || "")}" placeholder="Título del libro"></div><div class="field"><label>Autora o autor</label><input id="choice-author" value="${esc(b.author || "")}" placeholder="Nombre"></div><div class="field"><label>Quiero…</label><select id="choice-action"><option value="wishlist">Guardarlo en mi wishlist</option><option value="owned">Sumarlo a mis libros (sin leer)</option><option value="reading">Registrar que lo leí</option></select></div><div class="modal-actions"><button class="button" data-close>Cancelar</button><button class="button primary" id="choice-save">Continuar</button></div>`,
    async () => {},
  );
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
    renderPage(currentPage);
  };
}
function editProfile() {
  openModal(
    "Editar perfil",
    "TU PERFIL",
    `<form class="profile-form"><div class="field"><label>Nombre visible</label><input name="displayName" maxlength="50" value="${esc(me.displayName)}"></div><div class="field"><label>Bio</label><textarea name="bio" maxlength="240" placeholder="Contale algo a tu comunidad">${esc(me.bio || "")}</textarea></div><div class="modal-actions"><button type="button" class="button" data-close>Cancelar</button><button class="button primary">Guardar cambios</button></div></form>`,
    async (fd) => {
      const d = await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: fd.get("displayName"),
          bio: fd.get("bio"),
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
      if (x) bookChoice(JSON.parse(decodeURIComponent(x.dataset.book)));
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
  if (action === "search-book") searchBookModal();
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
        renderPage(currentPage);
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
      renderPage(currentPage);
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
    renderPage(currentPage);
  } catch (err) {
    toast(err.message);
  }
});
function editShelf(b) {
  openModal(
    "Editar libro",
    "TU COLECCIÓN",
    `<div class="modal-book">${cover(b.cover, b.title)}<div><strong>${esc(b.title)}</strong><small>${esc(b.author || "")}</small></div></div><form><div class="field"><label>Estado de colección</label><select name="ownership"><option value="owned" ${b.ownership === "owned" ? "selected" : ""}>Lo tengo</option><option value="wishlist" ${b.ownership === "wishlist" ? "selected" : ""}>Wishlist</option><option value="borrowed" ${b.ownership === "borrowed" ? "selected" : ""}>Prestado</option><option value="gone" ${b.ownership === "gone" ? "selected" : ""}>Ya no lo tengo</option></select></div><div class="field"><label>¿Leído?</label><select name="physicalStatus"><option value="unread" ${b.physicalStatus === "unread" ? "selected" : ""}>Sin leer</option><option value="read" ${b.physicalStatus === "read" ? "selected" : ""}>Leído</option></select></div><div class="form-row"><div class="field"><label>Edición</label><input name="edition" value="${esc(b.edition || "")}"></div><div class="field"><label>¿Dónde lo guardás?</label><input name="location" value="${esc(b.location || "")}"></div></div><div class="modal-actions"><button type="button" class="button" data-close>Cancelar</button><button class="button primary">Guardar</button></div></form>`,
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
      renderPage(currentPage);
    },
  );
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
