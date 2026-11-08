# Lista de libros

App web ("Mis libros") con todos los libros de `datos/LISTA DE LIBROS.xlsx`: título, autor,
género, dificultad, extensión, si lo tengo y de qué trata.

- **Inicio:** resumen (cuántos tengo, por dificultad, extensión y género) y un libro al azar.
- **Libros:** buscador, filtros y orden (también tocando el título de cada columna).
  Tocar un libro abre su ficha.
- **Autores** y **Géneros:** tocar uno muestra sus libros.
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
| `manifest.webmanifest`, `sw.js`, `pwa.js` | Hacen que se pueda instalar y abrir sin conexión |
| `icon.svg`, `icon-*.png` | Iconos de la app |

Si cambias archivos de la app y quieres forzar que el celular los vuelva a bajar, sube el
número de `CACHE` en `sw.js` (por ejemplo `mis-libros-v2`).

## EPUBs

Ver `epubs/LEEME.md`.
