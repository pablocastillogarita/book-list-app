// Palabras: buscar palabras que no conozco con Gemini, guardarlas por libro
// y sincronizarlas entre dispositivos con un Gist privado de GitHub.
// Las claves (Gemini y GitHub) se guardan solo en este navegador; nunca van en el código.
(function () {
  "use strict";

  var K_DATOS = "mis-libros-palabras";   // { items: { id: palabra } }
  var K_CLAVES = "mis-libros-claves";    // { gemini, github, gistId, modelo }
  var GIST_FILE = "mis-libros-palabras.json";
  var MODELO_DEF = "gemini-flash-lite-latest";

  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]; }); };
  var norm = function (s) { return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); };
  var $ = function (id) { return document.getElementById(id); };

  function leer(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function escribir(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var datos = leer(K_DATOS, { items: {} });
  if (!datos.items) datos = { items: {} };
  var claves = leer(K_CLAVES, {});
  var LIBROS = [], porClave = {}, abrirLibro = function () {}, oyentes = [];

  function claveLibro(b) { return b ? b.titulo + " — " + b.autor : ""; }
  function guardarLocal() { escribir(K_DATOS, datos); oyentes.forEach(function (f) { f(); }); }
  function guardarClaves() { escribir(K_CLAVES, claves); }
  function lista() {
    return Object.keys(datos.items).map(function (k) { return datos.items[k]; }).filter(function (p) { return !p.borrada; });
  }
  function delLibro(b) { var k = claveLibro(b); return lista().filter(function (p) { return p.libro === k; }); }
  function nuevoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ---------- Gemini ----------
  var ESQUEMA = {
    type: "OBJECT",
    properties: {
      existe: { type: "BOOLEAN" },
      palabra: { type: "STRING" },
      significados: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: { tipo: { type: "STRING" }, significado: { type: "STRING" }, ejemplo: { type: "STRING" } },
          required: ["tipo", "significado", "ejemplo"]
        }
      },
      nota: { type: "STRING" }
    },
    required: ["existe", "palabra", "significados"]
  };

  function instrucciones(palabra, libro, frase) {
    return [
      "Sos un diccionario para un lector adulto hispanohablante de Costa Rica.",
      "Explicá la palabra «" + palabra + "» con palabras sencillas, como se la explicarías a un amigo.",
      "Prohibido usar fórmulas de diccionario como «acción y efecto de», «perteneciente o relativo a», «que tiene la cualidad de», o definir con otra palabra igual de difícil.",
      libro ? "La encontré leyendo «" + libro + "». Poné primero el significado que más probablemente tiene en ese libro." : "",
      frase ? "La frase donde aparece es: «" + frase + "». El primer significado tiene que ser el de esa frase." : "",
      "Da de 1 a 3 significados, solo los que de verdad se usan; no inventes acepciones raras.",
      "Cada significado: «tipo» (sustantivo, verbo, adjetivo, adverbio, expresión…), «significado» en una o dos oraciones cortas, y «ejemplo» con una oración natural y cotidiana que use la palabra.",
      "En «palabra» poné la forma de diccionario (si viene conjugada o en plural, el infinitivo o el singular).",
      "Si la palabra no existe o está mal escrita, poné existe=false, significados vacío, y en «nota» sugerí la palabra correcta.",
      "Si hay algo útil extra (origen curioso, que es un regionalismo, un sinónimo fácil), ponelo en «nota» en una oración; si no, dejá «nota» vacía."
    ].filter(Boolean).join("\n");
  }

  async function llamarGemini(modelo, cuerpo) {
    var r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(modelo) + ":generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": claves.gemini },
      body: JSON.stringify(cuerpo)
    });
    var j = null; try { j = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, json: j };
  }

  // Si el modelo por defecto deja de existir, busca el Flash-Lite más nuevo disponible.
  async function otroModelo() {
    var r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": claves.gemini } });
    if (!r.ok) return null;
    var j = await r.json();
    var ms = (j.models || []).filter(function (m) {
      return (m.supportedGenerationMethods || []).indexOf("generateContent") !== -1 && /flash/.test(m.name) && !/image|audio|tts|live|preview|exp/.test(m.name);
    }).map(function (m) { return m.name.replace(/^models\//, ""); });
    ms.sort(function (a, b) { return (/lite/.test(b) - /lite/.test(a)) || b.localeCompare(a, "en", { numeric: true }); });
    return ms[0] || null;
  }

  async function definir(palabra, libro, frase) {
    if (!claves.gemini) throw new Error("FALTA_CLAVE");
    var cuerpo = {
      contents: [{ role: "user", parts: [{ text: instrucciones(palabra, libro, frase) }] }],
      generationConfig: { temperature: 0.3, responseMimeType: "application/json", responseSchema: ESQUEMA }
    };
    var modelo = claves.modelo || MODELO_DEF;
    var res = await llamarGemini(modelo, cuerpo);
    if (!res.ok && (res.status === 404 || (res.status === 400 && /model/i.test(JSON.stringify(res.json || ""))))) {
      var m = await otroModelo();
      if (m && m !== modelo) { res = await llamarGemini(m, cuerpo); if (res.ok) { claves.modelo = m; guardarClaves(); } }
    }
    if (!res.ok) {
      var msg = (res.json && res.json.error && res.json.error.message) || "";
      if (res.status === 429) throw new Error("Llegaste al límite gratis de Gemini por ahora. Probá de nuevo en un rato (o mañana).");
      if (res.status === 400 && /api key|API_KEY/i.test(msg) || res.status === 401 || res.status === 403) throw new Error("Gemini no aceptó la clave. Revisala en Ajustes.");
      throw new Error("Gemini respondió con un error (" + res.status + "). " + msg.slice(0, 140));
    }
    var txt = "";
    try { txt = res.json.candidates[0].content.parts.map(function (p) { return p.text || ""; }).join(""); } catch (e) {}
    var out; try { out = JSON.parse(txt); } catch (e) { throw new Error("No entendí la respuesta de Gemini. Probá otra vez."); }
    return out;
  }

  // ---------- Sincronización con Gist ----------
  var estadoSync = { txt: "", tipo: "" };
  function setEstado(txt, tipo) {
    estadoSync = { txt: txt, tipo: tipo || "" };
    document.querySelectorAll("[data-sync-estado]").forEach(function (el) { el.textContent = txt; el.dataset.tipo = tipo || ""; });
  }
  function gh(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ "Authorization": "Bearer " + claves.github, "Accept": "application/vnd.github+json" }, opts.headers || {});
    return fetch("https://api.github.com" + path, opts);
  }
  async function contenidoGist(g) {
    var f = g.files && g.files[GIST_FILE];
    if (!f) return null;
    var txt = f.content;
    if (f.truncated) txt = await (await fetch(f.raw_url)).text();
    try { return JSON.parse(txt); } catch (e) { return null; }
  }
  async function buscarGist() {
    for (var page = 1; page <= 5; page++) {
      var r = await gh("/gists?per_page=100&page=" + page);
      if (!r.ok) throw r;
      var gs = await r.json();
      for (var i = 0; i < gs.length; i++) if (gs[i].files && gs[i].files[GIST_FILE]) return gs[i].id;
      if (gs.length < 100) break;
    }
    var files = {}; files[GIST_FILE] = { content: JSON.stringify({ items: {} }) };
    var c = await gh("/gists", { method: "POST", body: JSON.stringify({ public: false, description: "Palabras de Mis libros (no borrar)", files: files }) });
    if (!c.ok) throw c;
    return (await c.json()).id;
  }
  function mezclar(a, b) {
    var out = {}, ids = Object.keys(a.items || {}).concat(Object.keys(b.items || {}));
    ids.forEach(function (id) {
      var x = (a.items || {})[id], y = (b.items || {})[id];
      out[id] = !x ? y : !y ? x : ((y.mod || 0) > (x.mod || 0) ? y : x);
    });
    return { items: out };
  }
  function canon(d) {
    var it = (d && d.items) || {};
    return JSON.stringify(Object.keys(it).sort().map(function (k) { return it[k]; }));
  }
  var cadena = Promise.resolve(), pendiente = false;
  function sincronizar() {
    if (!claves.github) { setEstado("Solo en este dispositivo. Poné un token de GitHub en Ajustes para verlas en la compu y el celular.", "local"); return Promise.resolve(); }
    if (pendiente) return cadena;
    pendiente = true;
    cadena = cadena.then(async function () {
      pendiente = false;
      if (!navigator.onLine) { setEstado("Sin conexión: se guardó aquí y se sincroniza al volver.", "local"); return; }
      setEstado("Sincronizando…", "busy");
      try {
        if (!claves.gistId) { claves.gistId = await buscarGist(); guardarClaves(); }
        var r = await gh("/gists/" + claves.gistId);
        if (r.status === 404) { claves.gistId = ""; guardarClaves(); claves.gistId = await buscarGist(); guardarClaves(); r = await gh("/gists/" + claves.gistId); }
        if (!r.ok) throw r;
        var remoto = (await contenidoGist(await r.json())) || { items: {} };
        var mezcla = mezclar(datos, remoto);
        var cambioLocal = canon(mezcla) !== canon(datos);
        var cambioRemoto = canon(mezcla) !== canon(remoto);
        datos = mezcla;
        if (cambioLocal) guardarLocal();
        if (cambioRemoto) {
          var files = {}; files[GIST_FILE] = { content: JSON.stringify(datos) };
          var p = await gh("/gists/" + claves.gistId, { method: "PATCH", body: JSON.stringify({ files: files }) });
          if (!p.ok) throw p;
        }
        setEstado("Sincronizado " + new Date().toLocaleTimeString("es-CR", { hour: "numeric", minute: "2-digit" }), "ok");
      } catch (e) {
        var st = e && e.status;
        if (st === 401 || st === 403) setEstado("GitHub no aceptó el token (o no tiene permiso de gists). Revisalo en Ajustes.", "err");
        else setEstado("No se pudo sincronizar ahora; quedó guardado aquí.", "err");
      }
    });
    return cadena;
  }
  var tSync = null;
  function sincronizarPronto() { clearTimeout(tSync); tSync = setTimeout(sincronizar, 600); }

  // ---------- Operaciones ----------
  function guardarPalabra(res, palabraEscrita, b, frase) {
    var ahora = Date.now();
    var p = {
      id: nuevoId(), palabra: res.palabra || palabraEscrita, escrita: palabraEscrita,
      libro: claveLibro(b), frase: frase || "", significados: res.significados || [], nota: res.nota || "",
      creada: ahora, mod: ahora
    };
    datos.items[p.id] = p; guardarLocal(); sincronizarPronto();
    return p;
  }
  function borrar(id) {
    var p = datos.items[id]; if (!p) return;
    datos.items[id] = { id: id, borrada: true, mod: Date.now() };
    guardarLocal(); sincronizarPronto();
  }
  function existente(palabra, b) {
    var n = norm(palabra), k = claveLibro(b);
    return lista().filter(function (p) { return p.libro === k && (norm(p.palabra) === n || norm(p.escrita) === n); })[0];
  }

  // ---------- HTML ----------
  function tarjeta(p, conLibro) {
    var lb = porClave[p.libro];
    return '<article class="pal" data-pal="' + esc(p.id) + '">' +
      '<div class="pal-top"><h4 class="pal-w">' + esc(p.palabra) + "</h4>" +
        '<button type="button" class="pal-del" data-borrar="' + esc(p.id) + '" aria-label="Borrar ' + esc(p.palabra) + '" title="Borrar">✕</button></div>' +
      (conLibro && p.libro ? '<button type="button" class="pal-libro" ' + (lb ? 'data-abrir-libro="' + lb.id + '"' : "disabled") + ">" + esc(p.libro) + "</button>" : "") +
      '<ol class="pal-defs">' + (p.significados || []).map(function (s) {
        return "<li>" + (s.tipo ? '<span class="pal-tipo">' + esc(s.tipo) + "</span> " : "") + esc(s.significado) +
          (s.ejemplo ? '<span class="pal-ej">' + esc(s.ejemplo) + "</span>" : "") + "</li>";
      }).join("") + "</ol>" +
      (p.nota ? '<p class="pal-nota">' + esc(p.nota) + "</p>" : "") +
      (p.frase ? '<p class="pal-frase">«' + esc(p.frase) + "»</p>" : "") +
      "</article>";
  }

  function formHTML(conSelector, libroSel) {
    var opts = "";
    if (conSelector) {
      opts = '<label class="pal-lbl">Libro<select name="libro"><option value="">(sin libro)</option>' +
        LIBROS.slice().sort(function (a, b) { return a.titulo.localeCompare(b.titulo, "es"); }).map(function (b) {
          return '<option value="' + b.id + '"' + (libroSel === b.id ? " selected" : "") + ">" + esc(b.titulo) + " — " + esc(b.autor) + "</option>";
        }).join("") + "</select></label>";
    }
    return '<form class="pal-form" autocomplete="off">' +
      '<div class="pal-row"><input class="search" name="palabra" type="search" enterkeyhint="search" placeholder="Palabra que no conozco…" aria-label="Palabra" autocapitalize="none" spellcheck="false" required>' +
      '<button class="btn primary" type="submit">Buscar</button></div>' +
      '<details class="pal-mas"><summary>Agregar la frase donde la vi (opcional)</summary>' +
        '<textarea name="frase" rows="2" placeholder="Pegá o escribí la frase del libro: ayuda a dar el significado correcto"></textarea></details>' +
      opts +
      '<div class="pal-msg" role="status" aria-live="polite"></div>' +
      "</form>";
  }

  function montarForm(form, getLibro, alGuardar) {
    var msg = form.querySelector(".pal-msg"), btn = form.querySelector("button[type=submit]");
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var palabra = form.palabra.value.trim().replace(/^[¡¿"'«(]+|[!?.,;:"'»)]+$/g, "");
      var frase = form.frase.value.trim(), b = getLibro();
      if (!palabra) return;
      var ya = !frase && existente(palabra, b);
      if (ya) { msg.innerHTML = "Ya la tenías guardada" + (b ? " en este libro" : "") + ":"; alGuardar(ya, true); return; }
      if (!claves.gemini) { msg.innerHTML = 'Falta la clave de Gemini. <button type="button" class="linkbtn" data-abrir-ajustes>Abrir Ajustes</button>'; return; }
      btn.disabled = true; msg.textContent = "Buscando «" + palabra + "»…";
      try {
        var res = await definir(palabra, b ? claveLibro(b) : "", frase);
        if (res.existe === false || !(res.significados || []).length) {
          msg.textContent = "No encontré «" + palabra + "». " + (res.nota || "Revisá cómo está escrita.");
        } else {
          var p = guardarPalabra(res, palabra, b, frase);
          msg.textContent = "";
          form.palabra.value = ""; form.frase.value = ""; form.querySelector("details").open = false;
          alGuardar(p, false);
        }
      } catch (err) {
        msg.textContent = err.message === "FALTA_CLAVE" ? "Falta la clave de Gemini en Ajustes." : (err.message && !/fetch/i.test(err.message) ? err.message : "No hay conexión para buscar ahora.");
      }
      btn.disabled = false;
    });
  }

  function resaltar(cont, id) {
    var el = cont.querySelector('[data-pal="' + id + '"]');
    if (el) { el.classList.add("nuevo"); el.scrollIntoView({ block: "nearest", behavior: "smooth" }); setTimeout(function () { el.classList.remove("nuevo"); }, 1600); }
  }

  // Sección dentro de la ficha del libro.
  function montarFicha(cont, b) {
    function pintarLista() {
      var ps = delLibro(b).sort(function (x, y) { return y.creada - x.creada; });
      cont.querySelector(".pal-n").textContent = ps.length ? "(" + ps.length + ")" : "";
      cont.querySelector(".pal-list").innerHTML = ps.length ? ps.map(function (p) { return tarjeta(p, false); }).join("")
        : '<p class="pal-vacio">Todavía no buscaste palabras de este libro.</p>';
    }
    cont.innerHTML = '<div class="pal-sec"><h3>Palabras de este libro <span class="pal-n"></span></h3>' + formHTML(false) +
      '<div class="pal-list"></div><p class="pal-sync" data-sync-estado></p></div>';
    cont.querySelector("[data-sync-estado]").textContent = estadoSync.txt;
    montarForm(cont.querySelector("form"), function () { return b; }, function (p) { pintarLista(); resaltar(cont, p.id); });
    cont.addEventListener("click", function (e) {
      var d = e.target.closest("[data-borrar]");
      if (d && confirmarBorrar(d)) { borrar(d.dataset.borrar); pintarLista(); }
    });
    pintarLista();
  }

  // Borrar en dos toques (sin diálogos del navegador).
  function confirmarBorrar(btn) {
    if (btn.dataset.seguro) return true;
    btn.dataset.seguro = "1"; btn.textContent = "¿Borrar?"; btn.classList.add("seguro");
    setTimeout(function () { if (btn.isConnected) { delete btn.dataset.seguro; btn.textContent = "✕"; btn.classList.remove("seguro"); } }, 3000);
    return false;
  }

  // Pestaña Palabras.
  var V = { q: "", libro: "", orden: "recientes", ultimoLibro: "" };
  function renderTab(cont) {
    var sel = V.ultimoLibro === "" ? null : +V.ultimoLibro;
    cont.innerHTML =
      '<div class="card"><h2>Buscar una palabra</h2>' + formHTML(true, sel) + '<div class="pal-nueva"></div></div>' +
      '<div class="card filters-card"><input class="search" id="pq" type="search" placeholder="Buscar en mis palabras…" aria-label="Buscar en mis palabras">' +
        '<div class="filters"><label for="pl">Libro<select id="pl"></select></label>' +
        '<label for="po">Ordenar<select id="po"><option value="recientes">Más recientes</option><option value="az">A–Z</option></select></label></div>' +
        '<div class="count" id="pcount"></div><p class="pal-sync" data-sync-estado></p></div>' +
      '<div class="pal-grid" id="plist"></div>';
    cont.querySelector("[data-sync-estado]").textContent = estadoSync.txt;
    var form = cont.querySelector("form");
    form.libro.addEventListener("change", function () { V.ultimoLibro = this.value; });
    montarForm(form, function () { return form.libro.value === "" ? null : LIBROS[+form.libro.value]; }, function (p, ya) {
      cont.querySelector(".pal-nueva").innerHTML = tarjeta(p, true); if (!ya) pintar();
    });
    $("pq").value = V.q; $("po").value = V.orden;
    $("pq").addEventListener("input", function () { V.q = this.value; pintar(); });
    $("pl").addEventListener("change", function () { V.libro = this.value; pintar(); });
    $("po").addEventListener("change", function () { V.orden = this.value; pintar(); });
    cont.addEventListener("click", function (e) {
      var d = e.target.closest("[data-borrar]");
      if (d) { if (confirmarBorrar(d)) { borrar(d.dataset.borrar); var c = d.closest(".pal-nueva"); if (c) c.innerHTML = ""; pintar(); } return; }
      var l = e.target.closest("[data-abrir-libro]"); if (l) abrirLibro(+l.dataset.abrirLibro);
    });
    pintar();

    function pintar() {
      var todas = lista();
      var libros = {}; todas.forEach(function (p) { if (p.libro) libros[p.libro] = (libros[p.libro] || 0) + 1; });
      var ks = Object.keys(libros).sort(function (a, b) { return a.localeCompare(b, "es"); });
      if (V.libro && !libros[V.libro]) V.libro = "";
      $("pl").innerHTML = '<option value="">Todos</option>' + ks.map(function (k) {
        return '<option value="' + esc(k) + '"' + (k === V.libro ? " selected" : "") + ">" + esc(k) + " (" + libros[k] + ")</option>";
      }).join("");
      var q = norm(V.q);
      var res = todas.filter(function (p) {
        return (!V.libro || p.libro === V.libro) &&
          (!q || norm([p.palabra, p.escrita, (p.significados || []).map(function (s) { return s.significado; }).join(" ")].join(" ")).indexOf(q) !== -1);
      });
      res.sort(V.orden === "az" ? function (a, b) { return a.palabra.localeCompare(b.palabra, "es"); } : function (a, b) { return b.creada - a.creada; });
      $("pcount").textContent = !todas.length ? "" : res.length === todas.length ? todas.length + (todas.length === 1 ? " palabra guardada" : " palabras guardadas") : res.length + " de " + todas.length + " palabras";
      $("plist").innerHTML = res.length ? res.map(function (p) { return tarjeta(p, true); }).join("")
        : '<p class="empty">' + (todas.length ? "Ninguna palabra coincide." : "Todavía no hay palabras. Buscá una arriba o desde la ficha de un libro.") + "</p>";
    }
    tabPintar = pintar;
  }
  var tabPintar = null;

  // Ajustes.
  function montarAjustes(cont) {
    cont.innerHTML =
      '<h2 class="t" id="d-title">Ajustes de palabras</h2>' +
      '<p class="pal-ayuda">Las claves se guardan solo en este navegador. Hay que ponerlas una vez en el celular y una vez en la compu.</p>' +
      '<label class="pal-campo"><span>Clave de Gemini</span><input type="password" id="aj-gem" autocomplete="off" spellcheck="false" placeholder="AIza…"></label>' +
      '<p class="pal-ayuda">Sacala gratis en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> (botón «Create API key»).</p>' +
      '<label class="pal-campo"><span>Token de GitHub (para sincronizar)</span><input type="password" id="aj-gh" autocomplete="off" spellcheck="false" placeholder="ghp_…"></label>' +
      '<p class="pal-ayuda">Crealo en <a href="https://github.com/settings/tokens/new?scopes=gist&description=Mis%20libros%20-%20palabras" target="_blank" rel="noopener">GitHub → Tokens</a>: dejá marcado solo «gist», elegí «No expiration» y tocá «Generate token». Las palabras quedan en un Gist privado de tu cuenta.</p>' +
      '<label class="pal-check"><input type="checkbox" id="aj-ver"> Mostrar claves</label>' +
      '<p class="pal-sync" data-sync-estado></p>' +
      '<div class="sheet-actions"><button type="button" class="btn primary" id="aj-ok">Guardar</button>' +
        '<button type="button" class="btn" id="aj-sync">Sincronizar ahora</button>' +
        '<button type="button" class="btn" id="d-close">Cerrar</button></div>';
    $("aj-gem").value = claves.gemini || ""; $("aj-gh").value = claves.github || "";
    cont.querySelector("[data-sync-estado]").textContent = estadoSync.txt;
    $("aj-ver").addEventListener("change", function () { $("aj-gem").type = $("aj-gh").type = this.checked ? "text" : "password"; });
    function guardar() {
      var g = $("aj-gem").value.trim(), t = $("aj-gh").value.trim();
      if (t !== (claves.github || "")) claves.gistId = "";
      claves.gemini = g; claves.github = t; guardarClaves();
    }
    $("aj-ok").addEventListener("click", function () { guardar(); setEstado("Guardado.", "ok"); sincronizar(); });
    $("aj-sync").addEventListener("click", function () { guardar(); sincronizar(); });
  }

  window.Palabras = {
    init: function (opts) {
      LIBROS = opts.libros || []; abrirLibro = opts.abrirLibro || abrirLibro;
      LIBROS.forEach(function (b) { porClave[claveLibro(b)] = b; });
      sincronizar();
      addEventListener("online", sincronizarPronto);
      document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") sincronizarPronto(); });
    },
    onChange: function (f) { oyentes.push(f); },
    contar: function () { return lista().length; },
    contarLibro: function (b) { return delLibro(b).length; },
    montarFicha: montarFicha,
    renderTab: renderTab,
    repintarTab: function () { if (tabPintar && document.getElementById("plist")) tabPintar(); },
    montarAjustes: montarAjustes,
    _mezclar: mezclar
  };
})();
