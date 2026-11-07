# Lista de libros

Página web con todos los libros de `datos/LISTA DE LIBROS.xlsx`: título, autor,
género, dificultad, extensión, si lo tengo y de qué trata. Tiene buscador,
filtros (género, dificultad, extensión, lo tengo) y orden.

## Ver la página

Abre `index.html` en el navegador (doble clic). No necesita servidor.

Para tenerla online gratis: en GitHub, *Settings → Pages → Deploy from a branch*,
elige la rama `main` y la carpeta `/ (root)`.

## Actualizar la lista

1. Reemplaza `datos/LISTA DE LIBROS.xlsx` por la versión nueva (mismas columnas).
2. Ejecuta `pip install openpyxl` (solo la primera vez) y luego
   `python3 scripts/excel_a_datos.py`.
3. Esto regenera `libros.js`, que es lo que lee la página.

## EPUBs

Ver `epubs/LEEME.md`.
