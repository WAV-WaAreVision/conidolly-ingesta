import Link from "next/link"
import { Campo, CLASES_DE_CAMPO } from "@/components/campo"
import { Boton } from "@/components/ui/boton"
import { clasesDeBoton } from "@/components/ui/clases-de-boton"
import { ESTADOS_DE_MATERIAL, type FiltrosDeMateriales, hayFiltros } from "@/lib/ingesta/filtros"
import { TIPOS_DE_MATERIAL } from "@/lib/ingesta/modelo"
import { ESTADO, ETIQUETA_DE_TIPO } from "./estado-de-material"

interface Propiedades {
  filtros: FiltrosDeMateriales
  categorias: { id: string; nombre: string }[]
  autores: string[]
}

/** A plain GET form: the filters live in the URL, so they survive a refresh and work without scripts. */
export function FiltrosDeLaLista({ filtros, categorias, autores }: Propiedades) {
  return (
    <form
      // The selects are uncontrolled: a new key remounts them so "Quitar filtros" really empties them.
      key={JSON.stringify(filtros)}
      method="get"
      action="/"
      aria-label="Filtros"
      className="grid gap-3 rounded-lg border border-linea bg-superficie p-4"
    >
      <Campo id="filtro-categoria" etiqueta="Categoría">
        <select
          id="filtro-categoria"
          name="categoria"
          defaultValue={filtros.categoria ?? ""}
          className={CLASES_DE_CAMPO}
        >
          <option value="">Todas</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id="filtro-autor" etiqueta="Autor">
        <select id="filtro-autor" name="autor" defaultValue={filtros.autor ?? ""} className={CLASES_DE_CAMPO}>
          <option value="">Todos</option>
          {autores.map((autor) => (
            <option key={autor} value={autor}>
              {autor}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id="filtro-tipo" etiqueta="Tipo">
        <select id="filtro-tipo" name="tipo" defaultValue={filtros.tipo ?? ""} className={CLASES_DE_CAMPO}>
          <option value="">Todos</option>
          {TIPOS_DE_MATERIAL.map((tipo) => (
            <option key={tipo} value={tipo}>
              {ETIQUETA_DE_TIPO[tipo]}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id="filtro-estado" etiqueta="Estado">
        <select id="filtro-estado" name="estado" defaultValue={filtros.estado ?? ""} className={CLASES_DE_CAMPO}>
          <option value="">Todos</option>
          {ESTADOS_DE_MATERIAL.map((estado) => (
            <option key={estado} value={estado}>
              {ESTADO[estado]?.texto ?? estado}
            </option>
          ))}
        </select>
      </Campo>
      <Boton type="submit" variante="linea">
        Filtrar
      </Boton>
      {hayFiltros(filtros) ? (
        <Link href="/" className={clasesDeBoton({ variante: "callado", tamano: "chico" })}>
          Quitar filtros
        </Link>
      ) : null}
    </form>
  )
}
