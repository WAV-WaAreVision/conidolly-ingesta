"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Boton } from "@/components/ui/boton"
import { clasesDeBoton } from "@/components/ui/clases-de-boton"
import {
  aElementosDelGrafo,
  ETIQUETA_DE_ESTADO_DE_VINCULO,
  ETIQUETA_DE_VINCULO,
  type FiltrosDelGrafo,
  filtrarVinculos,
  type MaterialDelGrafo,
  materialesVisibles,
  type TeoriaDelGrafo,
  TIPOS_DE_VINCULO,
  type TipoDeVinculo,
  type VinculoDelGrafo,
} from "@/lib/ingesta/grafo"
import { alternarSeleccion, MAXIMO_PARA_SINTETIZAR } from "@/lib/ingesta/seleccion"
import { BarraDeSintesis } from "./barra-de-sintesis"
import { ControlesDeVinculo } from "./controles-de-vinculo"
import { GrafoCytoscape } from "./grafo-cytoscape"
import { HojaDeVinculoNuevo } from "./hoja-de-vinculo-nuevo"
import { ListaDeVinculos, SIN_VINCULOS } from "./lista-de-vinculos"
import { ListaParaElegir } from "./lista-para-elegir"
import { Panel } from "./panel"

interface Propiedades {
  materiales: MaterialDelGrafo[]
  vinculos: VinculoDelGrafo[]
  teorias: TeoriaDelGrafo[]
}

type Seleccion =
  | { tipo: "material"; id: string }
  | { tipo: "vinculo"; a: string; b: string }
  | { tipo: "nuevo"; a: string; b: string }
  | { tipo: "teoria"; id: string }
  | null

const campo = "min-h-11 rounded-md border border-linea bg-superficie px-3 text-label text-tinta"

export function VistaDelGrafo({ materiales, vinculos, teorias }: Propiedades) {
  const [modo, setModo] = useState<"grafo" | "lista">("grafo")
  const [filtros, setFiltros] = useState<FiltrosDelGrafo>({})
  const [seleccion, setSeleccion] = useState<Seleccion>(null)
  const [origen, setOrigen] = useState<string | null>(null)
  const [eligiendo, setEligiendo] = useState(false)
  const [elegidos, setElegidos] = useState<string[]>([])
  const [aviso, setAviso] = useState<string | null>(null)

  const titulos = useMemo(
    () => Object.fromEntries(materiales.map((m) => [m.id, m.titulo ?? "Sin título"])),
    [materiales],
  )
  const categorias = useMemo(
    () => [...new Set(materiales.map((m) => m.categoria).filter(Boolean))].sort(),
    [materiales],
  )
  const autores = useMemo(
    () => [...new Set(materiales.flatMap((m) => (m.autor ? [m.autor] : [])))].sort((a, b) => a.localeCompare(b, "es")),
    [materiales],
  )
  const elementos = useMemo(
    () => aElementosDelGrafo(materiales, vinculos, teorias, filtros),
    [materiales, vinculos, teorias, filtros],
  )
  const visibles = useMemo(() => filtrarVinculos(materiales, vinculos, filtros), [materiales, vinculos, filtros])
  const materialesAElegir = useMemo(() => materialesVisibles(materiales, filtros), [materiales, filtros])
  // A filter can hide a material that was chosen: what is hidden is not part of the theory.
  const elegidosVisibles = useMemo(() => {
    const ids = new Set(materialesAElegir.map((m) => m.id))
    return elegidos.filter((id) => ids.has(id))
  }, [elegidos, materialesAElegir])

  const vinculoSeleccionado =
    seleccion?.tipo === "vinculo"
      ? vinculos.find((v) => v.material_a === seleccion.a && v.material_b === seleccion.b)
      : undefined
  const materialSeleccionado =
    seleccion?.tipo === "material" ? materiales.find((m) => m.id === seleccion.id) : undefined
  const teoriaSeleccionada = seleccion?.tipo === "teoria" ? teorias.find((t) => t.id === seleccion.id) : undefined

  function alternar(id: string) {
    const siguiente = alternarSeleccion(elegidosVisibles, id)
    setElegidos(siguiente.seleccion)
    setAviso(siguiente.lleno ? `Son ${MAXIMO_PARA_SINTETIZAR} materiales como máximo.` : null)
  }

  function empezarAElegir() {
    setSeleccion(null)
    setOrigen(null)
    setEligiendo(true)
  }

  function dejarDeElegir() {
    setEligiendo(false)
    setElegidos([])
    setAviso(null)
  }

  function alTocarNodo(id: string) {
    if (eligiendo) {
      if (materiales.some((m) => m.id === id)) alternar(id)
      return
    }
    if (origen && origen !== id) {
      setSeleccion({ tipo: "nuevo", a: origen, b: id })
      setOrigen(null)
      return
    }
    setOrigen(null)
    if (materiales.some((m) => m.id === id)) setSeleccion({ tipo: "material", id })
    else if (teorias.some((t) => t.id === id)) setSeleccion({ tipo: "teoria", id })
  }

  function alTocarArista(id: string) {
    if (eligiendo) return
    const [a, b] = id.split("|")
    if (a && b && vinculos.some((v) => v.material_a === a && v.material_b === b)) {
      setSeleccion({ tipo: "vinculo", a, b })
    }
    setOrigen(null)
  }

  function alCerrar() {
    setSeleccion(null)
  }

  const hayGrafo = materiales.length >= 2
  const ajustar = (cambio: Partial<FiltrosDelGrafo>) => setFiltros((actual) => ({ ...actual, ...cambio }))

  return (
    <div className="grid gap-4">
      {hayGrafo ? (
        <>
          <details className="rounded-md border border-linea bg-superficie p-3.5">
            <summary className="min-h-6 cursor-pointer text-label font-semibold">Filtros</summary>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <label className="grid gap-1 text-meta text-apagado">
                Categoría
                <select
                  className={campo}
                  value={filtros.categoria ?? ""}
                  onChange={(e) => ajustar({ categoria: e.target.value || undefined })}
                >
                  <option value="">Todas</option>
                  {categorias.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-meta text-apagado">
                Autor
                <select
                  className={campo}
                  value={filtros.autor ?? ""}
                  onChange={(e) => ajustar({ autor: e.target.value || undefined })}
                >
                  <option value="">Todos</option>
                  {autores.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-meta text-apagado">
                Tipo de vínculo
                <select
                  className={campo}
                  value={filtros.tipo ?? ""}
                  onChange={(e) => ajustar({ tipo: e.target.value || undefined })}
                >
                  <option value="">Todos</option>
                  {TIPOS_DE_VINCULO.map((t) => (
                    <option key={t} value={t}>
                      {ETIQUETA_DE_VINCULO[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-meta text-apagado">
                Relevancia mínima
                <select
                  className={campo}
                  value={filtros.relevanciaMinima ?? 0}
                  onChange={(e) => ajustar({ relevanciaMinima: Number(e.target.value) || undefined })}
                >
                  <option value={0}>Cualquiera</option>
                  {[2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} o más
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </details>
          <div className="flex flex-wrap gap-2.5">
            <Boton variante="linea" tamano="chico" onClick={() => setModo(modo === "grafo" ? "lista" : "grafo")}>
              {modo === "grafo" ? "Ver como lista" : "Ver como grafo"}
            </Boton>
            {eligiendo ? null : (
              <Boton variante="linea" tamano="chico" onClick={empezarAElegir}>
                Seleccionar
              </Boton>
            )}
          </div>
          {eligiendo ? <BarraDeSintesis seleccionados={elegidosVisibles} alCancelar={dejarDeElegir} /> : null}
          {aviso ? (
            <output className="rounded-md bg-aviso-fondo p-3.5 text-meta text-aviso-tinta">{aviso}</output>
          ) : null}
        </>
      ) : null}

      {!hayGrafo ? (
        <p className="text-apagado">{SIN_VINCULOS}</p>
      ) : modo === "lista" ? (
        eligiendo ? (
          <ListaParaElegir materiales={materialesAElegir} seleccionados={elegidosVisibles} alAlternar={alternar} />
        ) : (
          <ListaDeVinculos vinculos={visibles} titulos={titulos} />
        )
      ) : (
        <>
          <p className="text-meta text-apagado">
            {eligiendo
              ? "Toca los materiales que quieres juntar en una teoría."
              : "Toca un material o un vínculo. Para unir dos materiales a mano, mantén uno apretado y toca el otro."}
          </p>
          {origen ? (
            <output className="flex items-center justify-between gap-3 rounded-md bg-acento-suave p-3.5 text-meta">
              <span>Toca otro material para unirlo con {titulos[origen] ?? "este"}.</span>
              <Boton variante="callado" tamano="chico" onClick={() => setOrigen(null)}>
                Cancelar
              </Boton>
            </output>
          ) : null}
          <GrafoCytoscape
            elementos={elementos}
            origen={origen}
            elegidos={elegidosVisibles}
            alTocarNodo={alTocarNodo}
            alTocarArista={alTocarArista}
            alMantenerNodo={(id) => {
              if (!eligiendo && materiales.some((m) => m.id === id)) {
                setSeleccion(null)
                setOrigen(id)
              }
            }}
            alTocarFondo={() => {
              setOrigen(null)
              setSeleccion(null)
            }}
          />
        </>
      )}

      {materialSeleccionado ? (
        <Panel titulo={materialSeleccionado.titulo ?? "Sin título"} alCerrar={alCerrar}>
          <p className="text-meta text-apagado">
            {[materialSeleccionado.autor, materialSeleccionado.categoria].filter(Boolean).join(" · ")}
          </p>
          <Link href={`/materiales/${materialSeleccionado.id}`} className={clasesDeBoton({ variante: "linea" })}>
            Ver ficha
          </Link>
        </Panel>
      ) : null}

      {teoriaSeleccionada ? (
        <Panel titulo={teoriaSeleccionada.nombre} alCerrar={alCerrar}>
          <p className="text-meta text-apagado">Teoría armada con {teoriaSeleccionada.materiales.length} materiales.</p>
          <Link href={`/teorias/${teoriaSeleccionada.id}`} className={clasesDeBoton({ variante: "linea" })}>
            Ver teoría
          </Link>
        </Panel>
      ) : null}

      {vinculoSeleccionado ? (
        <Panel titulo="Vínculo" alCerrar={alCerrar}>
          <p className="font-semibold text-balance">
            {titulos[vinculoSeleccionado.material_a]} con {titulos[vinculoSeleccionado.material_b]}
          </p>
          <p className="text-meta text-apagado">
            {ETIQUETA_DE_VINCULO[vinculoSeleccionado.tipo as TipoDeVinculo] ?? vinculoSeleccionado.tipo} ·{" "}
            {ETIQUETA_DE_ESTADO_DE_VINCULO[vinculoSeleccionado.estado] ?? vinculoSeleccionado.estado}
          </p>
          {vinculoSeleccionado.razon ? <p>{vinculoSeleccionado.razon}</p> : null}
          {vinculoSeleccionado.cita_a ? (
            <blockquote className="border-l-4 border-acento-claro pl-3 text-meta">
              <span className="text-apagado">{titulos[vinculoSeleccionado.material_a]}</span>
              <br />“{vinculoSeleccionado.cita_a}”
            </blockquote>
          ) : null}
          {vinculoSeleccionado.cita_b ? (
            <blockquote className="border-l-4 border-acento-claro pl-3 text-meta">
              <span className="text-apagado">{titulos[vinculoSeleccionado.material_b]}</span>
              <br />“{vinculoSeleccionado.cita_b}”
            </blockquote>
          ) : null}
          <ControlesDeVinculo
            vinculo={vinculoSeleccionado}
            etiquetaDeRelevancia="Cambiar relevancia"
            alTerminar={alCerrar}
          />
        </Panel>
      ) : null}

      {seleccion?.tipo === "nuevo" ? (
        <HojaDeVinculoNuevo materialA={seleccion.a} materialB={seleccion.b} titulos={titulos} alCerrar={alCerrar} />
      ) : null}
    </div>
  )
}
