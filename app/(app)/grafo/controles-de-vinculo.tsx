"use client"

import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { Boton } from "@/components/ui/boton"
import type { VinculoDelGrafo } from "@/lib/ingesta/grafo"
import { aceptarVinculoAccion, cambiarRelevanciaAccion, descartarVinculoAccion } from "./acciones"

const RELEVANCIAS = [1, 2, 3, 4, 5]

/** Aceptar, change the relevance and Descartar for one link; each runs a Server Action and refreshes the page. */
export function ControlesDeVinculo({
  vinculo,
  etiquetaDeRelevancia = "Relevancia",
  alTerminar,
}: {
  vinculo: VinculoDelGrafo
  etiquetaDeRelevancia?: string
  alTerminar?: () => void
}) {
  const router = useRouter()
  const idDelSelect = useId()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const par = { materialA: vinculo.material_a, materialB: vinculo.material_b }

  async function correr(nombre: string, accion: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setOcupado(nombre)
    setError(null)
    const resultado = await accion()
    setOcupado(null)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    router.refresh()
    alTerminar?.()
  }

  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        {vinculo.estado === "sugerido" ? (
          <Boton
            tamano="chico"
            cargando={ocupado === "aceptar"}
            deshabilitado={ocupado !== null}
            onClick={() => correr("aceptar", () => aceptarVinculoAccion(par))}
          >
            Aceptar
          </Boton>
        ) : null}
        <Boton
          variante="linea"
          tamano="chico"
          cargando={ocupado === "descartar"}
          deshabilitado={ocupado !== null}
          onClick={() => correr("descartar", () => descartarVinculoAccion(par))}
        >
          Descartar
        </Boton>
      </div>
      <div className="flex items-center gap-2.5">
        <label htmlFor={idDelSelect} className="text-meta text-apagado">
          {etiquetaDeRelevancia}
        </label>
        <select
          id={idDelSelect}
          value={vinculo.relevancia}
          disabled={ocupado !== null}
          onChange={(evento) =>
            correr("relevancia", () => cambiarRelevanciaAccion({ ...par, relevancia: Number(evento.target.value) }))
          }
          className="min-h-11 rounded-md border border-linea bg-superficie px-3 text-label text-tinta"
        >
          {RELEVANCIAS.map((valor) => (
            <option key={valor} value={valor}>
              {valor}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p role="alert" className="rounded-md bg-error-fondo p-3.5 text-[1rem] text-error-tinta">
          {error}
        </p>
      ) : null}
    </div>
  )
}
