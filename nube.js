// Nube: entrar con Google (Firebase) para guardar en tu cuenta las palabras, el libro que estoy
// leyendo, los filtros y la clave de Gemini, y verlos igual en el celular y la compu.
// Firebase se carga solo si nube-config.js tiene la configuración. Sin conexión o sin sesión,
// la app sigue funcionando con lo guardado en este dispositivo.
(function () {
  "use strict";

  var BASE = "https://www.gstatic.com/firebasejs/12.19.0/";
  var K_USUARIO = "mis-libros-usuario";   // último usuario que entró (para mostrarlo sin conexión)
  var cfg = window.NUBE_CONFIG;
  var configurada = !!(cfg && cfg.apiKey && cfg.projectId);

  function leer(k, def) { try { return JSON.parse(localStorage.getItem(k)) || def; } catch (e) { return def; } }
  function escribir(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var recordado = leer(K_USUARIO, null);   // { uid, nombre, correo }
  var fb = null, carga = null, usuario = null, estadoListo = false, oyentes = [], errorEntrar = "";
  var resolverListo, listo = new Promise(function (r) { resolverListo = r; });

  function avisar() { oyentes.forEach(function (f) { try { f(); } catch (e) {} }); }
  function resumen(u) { return u ? { uid: u.uid, nombre: u.displayName || "", correo: u.email || "" } : null; }

  function cargar() {
    if (!configurada) return Promise.reject(new Error("SIN_CONFIG"));
    if (!carga) {
      carga = Promise.all([
        import(BASE + "firebase-app.js"),
        import(BASE + "firebase-auth.js"),
        import(BASE + "firebase-firestore-lite.js")
      ]).then(function (m) {
        var app = m[0].initializeApp(cfg);
        fb = { A: m[1], F: m[2], auth: m[1].getAuth(app), db: m[2].getFirestore(app) };
        fb.auth.languageCode = "es";
        m[1].getRedirectResult(fb.auth).catch(function (e) { errorEntrar = mensaje(e); avisar(); });
        m[1].onAuthStateChanged(fb.auth, function (u) {
          var antes = usuario && usuario.uid;
          usuario = u; estadoListo = true;
          recordado = resumen(u); escribir(K_USUARIO, recordado);
          resolverListo(u);
          if ((u && u.uid) !== antes) avisar();
        });
        return fb;
      }).catch(function (e) {
        carga = null;                      // sin conexión: se reintenta la próxima vez
        throw e;
      });
    }
    return carga;
  }

  function mensaje(e) {
    var c = (e && e.code) || "";
    if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return "";
    if (c === "auth/unauthorized-domain") return "Firebase todavía no acepta esta dirección. Agregala en Firebase → Authentication → Settings → Authorized domains.";
    if (c === "auth/network-request-failed") return "No hay conexión para entrar ahora.";
    if (c === "auth/operation-not-allowed") return "Falta activar Google en Firebase → Authentication → Sign-in method.";
    return "No se pudo entrar con Google" + (c ? " (" + c.replace("auth/", "") + ")" : "") + ".";
  }

  // Espera a saber si hay sesión. Devuelve el usuario, o null si no hay sesión.
  // Si no se puede cargar Firebase (sin conexión), lanza error.
  function usuarioActual() {
    return cargar().then(function () { return estadoListo ? usuario : listo; });
  }

  async function entrar() {
    errorEntrar = "";
    var f;
    try { f = await cargar(); } catch (e) { errorEntrar = "No hay conexión para entrar ahora."; avisar(); return; }
    var prov = new f.A.GoogleAuthProvider();
    prov.setCustomParameters({ prompt: "select_account" });
    try {
      await f.A.signInWithPopup(f.auth, prov);
    } catch (e) {
      // Algunas apps instaladas no dejan abrir ventanas: probamos yendo y volviendo de Google.
      if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) {
        try { await f.A.signInWithRedirect(f.auth, prov); return; } catch (e2) { e = e2; }
      }
      errorEntrar = mensaje(e); avisar();
    }
  }

  async function salir() {
    try { var f = await cargar(); await f.A.signOut(f.auth); } catch (e) {}
    usuario = null; recordado = null; escribir(K_USUARIO, null); avisar();
  }

  // Lee el documento de la cuenta, deja que `cambiar(remoto)` arme la versión nueva y la guarda,
  // todo en una transacción (así dos dispositivos a la vez no se pisan).
  // `cambiar` devuelve el objeto a guardar, o null si no hay nada que subir.
  async function transaccion(cambiar) {
    var u = await usuarioActual();
    if (!u) throw new Error("SIN_SESION");
    var F = fb.F, ref = F.doc(fb.db, "usuarios", u.uid);
    return F.runTransaction(fb.db, async function (t) {
      var snap = await t.get(ref);
      var nuevo = cambiar(snap.exists() ? snap.data() : null);
      if (nuevo) t.set(ref, nuevo, { merge: true });
    });
  }

  window.Nube = {
    configurada: function () { return configurada; },
    // true si este dispositivo tiene (o tenía, si está sin conexión) una sesión abierta.
    activa: function () { return configurada && !!(usuario || (!estadoListo && recordado)); },
    quien: function () { return resumen(usuario) || (!estadoListo ? recordado : null); },
    error: function () { return errorEntrar; },
    usuario: usuarioActual,
    entrar: entrar,
    salir: salir,
    transaccion: transaccion,
    onChange: function (f) { oyentes.push(f); },
    iniciar: function () { if (configurada) cargar().catch(function () {}); }
  };
})();
