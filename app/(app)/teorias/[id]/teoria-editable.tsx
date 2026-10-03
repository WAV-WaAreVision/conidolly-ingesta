"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Campo, CLASES_DE_CAMPO } from "@/components/campo"
import { Boton } from "@/components/ui/boton"
import { etiquetaDeEstadoDeTeoria, type TeoriaLeida } from "@/lib/ingesta/modelo-de-teoria"
import { cn } from "@/lib/utils"
import { guardarTeoriaAccion } from "../acciones"
import { claseDeEstadoDeTeoria } from "../estado-de-teoria"

const SUBTITULO = "font-serif text-title text-balance"

function unidas(titulos: string[]): string {
  if (titulos.length < 2) return titulos.join("")
  return `${titulos.slice(0, -1).join(", ")} y ${titulos.at(-1)}`
}

/** The synthesis to read (arguments with their source and quote, contradictions) and the three fields she can edit. */
export function TeoriaEditable({
  teoria,
  categorias,
}: {
  teoria: TeoriaLeida
  categorias: { id: string; nombre: string }[]
}) {
  const router = useRouter()
  const [titulo, setTitulo] = useState(teoria.titulo ?? "")
  const [tesis, setTesis] = useState(teoria.tesis ?? "")
  const [categoriaId, setCategoriaId] = useState(teoria.categoriaId ?? "")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardada, setGuardada] = useState(false)
  const titulos = Object.fromEntries(teoria.fuentes.map((f) => [f.id, f.titulo]))

  async function guardar() {
    setGuardando(true)
    setError(null)
    setGuardada(false)
    const resultado = await guardarTeoriaAccion({
      teoriaId: teoria.id,
      titulo,
      tesis,
      categoriaId: categoriaId || null,
    })
    setGuardando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    setGuardada(true)
    router.refresh()
  }

  return (
    <form
      className="grid gap-5.5"
      onSubmit={(evento) => {
        evento.preventDefault()
        void guardar()
      }}
    >
      <p className={cn("w-fit rounded-sm px-2.5 py-1 text-meta font-semibold", claseDeEstadoDeTeoria(teoria.estado))}>
        {etiquetaDeEstadoDeTeoria(teoria.estado)}
      </p>
      <p className="text-meta text-apagado">Se armó con {unidas(teoria.fuentes.map((f) => f.titulo))}.</p>

      <Campo id="teoria-titulo" etiqueta="Título">
        <input
          id="teoria-titulo"
          className={CLASES_DE_CAMPO}
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
        />
      </Campo>
      <Campo id="teoria-tesis" etiqueta="Tesis">
        <textarea
          id="teoria-tesis"
          rows={6}
          className={CLASES_DE_CAMPO}
          value={tesis}
          onChange={(evento) => setTesis(evento.target.value)}
        />
      </Campo>
      <Campo id="teoria-categoria" etiqueta="Categoría">
        <select
          id="teoria-categoria"
          className={CLASES_DE_CAMPO}
          value={categoriaId}
          onChange={(evento) => setCategoriaId(evento.target.value)}
        >
          <option value="">Sin categoría</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <section className="grid gap-3">
        <h2 className={SUBTITULO}>Argumentos</h2>
        <ul className="grid gap-3">
          {teoria.argumentos.map((argumento) => (
            <li
              key={`${argumento.materialId}|${argumento.cita}`}
              className="grid gap-2 rounded-lg border border-linea bg-superficie p-4"
            >
              <Link href={`/materiales/${argumento.materialId}`} className="font-semibold text-acento underline">
                {titulos[argumento.materialId] ?? "Sin título"}
              </Link>
              <p>{argumento.aporte}</p>
              <figure className="grid gap-1 border-l-2 border-acento-claro pl-3.5">
                <blockquote>{argumento.cita}</blockquote>
                <figcaption className="text-meta text-apagado">{argumento.ubicacion}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      {teoria.contradicciones.length > 0 ? (
        <section className="grid gap-3">
          <h2 className={SUBTITULO}>Contradicciones</h2>
          <ul className="grid gap-3">
            {teoria.contradicciones.map((contradiccion) => (
              <li
                key={`${contradiccion.materialIds.join("|")}|${contradiccion.descripcion}`}
                className="grid gap-1.5 rounded-lg border border-linea bg-superficie p-4"
              >
                <p>{contradiccion.descripcion}</p>
                <p className="text-meta text-apagado">
                  {unidas(contradiccion.materialIds.map((id) => titulos[id] ?? "Sin título"))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-error-fondo p-3.5 text-[1rem] text-error-tinta">
          {error}
        </p>
      ) : null}
      {guardada ? (
        <output className="rounded-md bg-ok-fondo p-3.5 text-[1rem] text-ok-tinta">Teoría guardada.</output>
      ) : null}
      <Boton type="submit" cargando={guardando}>
        Guardar
      </Boton>
    </form>
  )
}
