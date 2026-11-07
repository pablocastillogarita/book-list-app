"""Convierte datos/LISTA DE LIBROS.xlsx en libros.js, que usa la página.

Uso:  python3 scripts/excel_a_datos.py  [ruta/al/excel.xlsx]
Requiere: pip install openpyxl
"""
import json
import sys
from pathlib import Path

import openpyxl

RAIZ = Path(__file__).resolve().parent.parent
EXCEL = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "datos" / "LISTA DE LIBROS.xlsx"
SALIDA = RAIZ / "libros.js"
EPUBS = RAIZ / "epubs"

COLUMNAS = {
    "Libro": "titulo",
    "Autor": "autor",
    "Género": "genero",
    "Dificultad": "dificultad",
    "Largo": "largo",
    "En carpeta": "tengo",
    "¿De qué trata?": "trata",
}


def limpiar(v):
    return str(v).strip() if v is not None else ""


def main():
    ws = openpyxl.load_workbook(EXCEL, data_only=True).worksheets[0]
    filas = list(ws.iter_rows(values_only=True))
    # Busca la fila de encabezados (la que contiene "Libro").
    idx = next(i for i, f in enumerate(filas) if f and "Libro" in [limpiar(c) for c in f])
    encabezados = [limpiar(c) for c in filas[idx]]
    libros = []
    for f in filas[idx + 1:]:
        if not f or not any(f):
            continue
        d = {COLUMNAS[h]: limpiar(v) for h, v in zip(encabezados, f) if h in COLUMNAS}
        if not d.get("titulo"):
            continue
        dif = d.get("dificultad", "").split("/")[0].strip()
        d["dificultad"] = int(dif) if dif.isdigit() else None
        d["tengo"] = d.get("tengo", "").lower() in ("sí", "si", "x", "yes")
        # Si existe epubs/<Título>.epub se enlaza para descargar.
        epub = EPUBS / f"{d['titulo']}.epub"
        if epub.exists():
            d["epub"] = f"epubs/{epub.name}"
        libros.append(d)
    SALIDA.write_text(
        "// Generado por scripts/excel_a_datos.py. No editar a mano.\n"
        "window.LIBROS = " + json.dumps(libros, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )
    print(f"{len(libros)} libros escritos en {SALIDA.name}")


if __name__ == "__main__":
    main()
