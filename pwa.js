// Registra el service worker para que el navegador ofrezca "Instalar app" y la app abra sin conexión.
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
}
