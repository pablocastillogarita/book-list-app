# Lista de libros

App web ("Mis libros") con todos los libros de `datos/LISTA DE LIBROS.xlsx`: título, autor,
género, dificultad, extensión, si lo tengo y de qué trata.

- **Inicio:** resumen (cuántos tengo, por dificultad, extensión y género) y el libro que estoy leyendo.
- **Libros:** buscador, filtros y orden (también tocando el título de cada columna).
  Tocar un libro abre su ficha.
- **Autores** y **Géneros:** tocar uno muestra sus libros.
- **Estoy leyendo:** en la ficha de un libro toca «📖 Lo estoy leyendo». Aparece arriba en
  Inicio con un botón para buscar palabras de ese libro, y se sincroniza igual que las palabras.
- **Palabras:** en la ficha de un libro, escribe una palabra que no conozcas y Gemini te da
  su significado en palabras sencillas, con un ejemplo. Queda guardada con ese libro.
  La pestaña Palabras muestra todas, con buscador y filtro por libro. (Ver abajo cómo activarlo.)
  Con **⬇️ Descargar JSON** bajás tus palabras agrupadas por libro, cada una con `palabra`,
  `significado` y `oracion` (la frase del libro si la guardaste, si no el ejemplo). Si elegiste
  un libro en el filtro, baja solo ese libro.
- **Tu cuenta (entrar con Google):** en ⚙️ Ajustes → «Entrar con Google». Tus palabras, el libro
  que estás leyendo, el tema, los filtros y la clave de Gemini quedan en tu cuenta: en otro
  dispositivo, o si borrás la app y la volvés a instalar, entrás de nuevo y vuelve todo.
  Sin conexión o sin sesión la app funciona igual con lo guardado en el dispositivo.
  (Hay que activarlo una vez: ver «Entrar con Google: configurar Firebase» abajo.)
- Se puede **instalar como app** en el celular o la compu (como la app de presupuesto)
  y abre sin conexión. En el celular: abrir la página y elegir "Agregar a pantalla de inicio"
  (iPhone: botón Compartir; Android: menú ⋮ → Instalar app).

## Ver la página

Abre `index.html` en el navegador (doble clic). No necesita servidor.

Para tenerla online gratis: en GitHub, *Settings → Pages → Deploy from a branch*,
elige la rama `main` y la carpeta `/ (root)`.

## Actualizar la lista

1. Reemplaza `datos/LISTA DE LIBROS.xlsx` por la versión nueva (mismas columnas).
2. Ejecuta `pip install openpyxl` (solo la primera vez) y luego
   `python3 scripts/excel_a_datos.py`.
3. Esto regenera `libros.js`, que es lo que lee la página.

## Archivos de la app

| Archivo | Para qué |
|---|---|
| `index.html` | La app completa |
| `libros.js` | Los datos, generados desde el Excel |
| `palabras.js` | Búsqueda de palabras con Gemini y sincronización (cuenta de Google o Gist) |
| `nube.js`, `nube-config.js` | Entrar con Google y guardar en tu cuenta (Firebase) |
| `firestore.rules` | Reglas de Firestore: cada cuenta solo ve lo suyo |
| `manifest.webmanifest`, `sw.js`, `pwa.js` | Hacen que se pueda instalar y abrir sin conexión |
| `icon.svg`, `icon-*.png` | Iconos de la app |

Si cambias archivos de la app y quieres forzar que el celular los vuelva a bajar, sube el
número de `CACHE` en `sw.js` (por ejemplo `mis-libros-v6`).

## Entrar con Google: configurar Firebase

Se hace una sola vez (unos 10 minutos, gratis; el plan gratis de Firebase sobra para esto).

1. Entrá a https://console.firebase.google.com con tu cuenta de Google y tocá
   **Crear un proyecto**. Nombre: `mis-libros`. Podés desactivar Google Analytics.
2. En el menú **Compilación → Authentication** tocá **Comenzar**. En *Método de acceso* elegí
   **Google**, activalo, elegí tu correo como correo de asistencia y **Guardar**.
3. Todavía en Authentication, pestaña **Configuración → Dominios autorizados → Agregar dominio**
   y poné la dirección donde abrís la app (por ejemplo `pablocastillogarita.github.io`).
4. En **Compilación → Firestore Database** tocá **Crear base de datos** (ubicación: la que
   ofrezca; modo: **producción**). Después, en la pestaña **Reglas**, borrá lo que hay, pegá el
   contenido de `firestore.rules` y tocá **Publicar**.
5. En el engranaje ⚙️ → **Configuración del proyecto**, abajo en *Tus apps* tocá el ícono web
   `</>`, ponele un nombre (`Mis libros`) y **Registrar app**. Te muestra un bloque
   `const firebaseConfig = { apiKey: ..., authDomain: ..., projectId: ..., ... }`.
6. Copiá ese bloque dentro de `nube-config.js`, en lugar de `null`:
   `window.NUBE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "...", ... };`
   (no es una clave secreta: está hecha para ir en la página; tus datos los protegen las reglas).

Listo: en ⚙️ Ajustes aparece «Entrar con Google». La primera vez que entrás, lo que ya tenías en
ese dispositivo (y lo que venía del Gist) se sube a tu cuenta y se mezcla con lo de los demás.
Con sesión iniciada ya no hace falta el token de GitHub.

## Palabras: activar Gemini y la sincronización

Si entraste con Google, la clave de Gemini se pone una sola vez y llega sola a tus otros
dispositivos, y no hace falta el token de GitHub. Si no, en **⚙️ Ajustes** pega dos claves (una
vez en el celular y una vez en la compu; se guardan solo en ese navegador, nunca en el repo):

1. **Clave de Gemini** (gratis): en https://aistudio.google.com/apikey → *Create API key*.
   El plan gratis tiene un límite diario de búsquedas; si se acaba, la app avisa y al día
   siguiente vuelve a funcionar.
2. **Token de GitHub** (para ver las palabras en todos tus dispositivos): en
   https://github.com/settings/tokens/new?scopes=gist marca solo **gist**, elige
   *No expiration* y genera el token. Las palabras se guardan en un Gist privado
   llamado "Palabras de Mis libros" (no lo borres).

Sin token, las palabras se guardan solo en ese dispositivo. Si después le pones el token,
se suben y se mezclan con las de tus otros dispositivos.

## EPUBs

Ver `epubs/LEEME.md`.
