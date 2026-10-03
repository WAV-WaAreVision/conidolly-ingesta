"use client"

import { useRouter } from "next/navigation"
import { useId, useState } from "react"
import { Boton } from "@/components/ui/boton"
import { ETIQUETA_DE_VINCULO, TIPOS_DE_VINCULO, type TipoDeVinculo } from "@/lib/ingesta/grafo"
import { crearVinculoAccion } from "./acciones"
import { Panel } from "./panel"

/** The small sheet where a link made by hand gets its type and relevance. */
export function HojaDeVinculoNuevo({
  materialA,
  materialB,
  titulos,
  alCerrar,
}: {
  materialA: string
  materialB: string
  titulos: Record<string, string>
  alCerrar: () => void
}) {
  const router = useRouter()
  const idTipo = useId()
  const idRelevancia = useId()
  const [tipo, setTipo] = useState<TipoDeVinculo>("complementa")
  const [relevancia, setRelevancia] = useState(3)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function crear() {
    setCargando(true)
    setError(null)
    const resultado = await crearVinculoAccion({ materialA, materialB, tipo, relevancia })
    setCargando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    router.refresh()
    alCerrar()
  }

  return (
    <Panel titulo="Vincular a mano" alCerrar={alCerrar}>
      <p className="text-meta text-apagado">
        {titulos[materialA] ?? "Sin título"} con {titulos[materialB] ?? "Sin título"}
      </p>
      <label htmlFor={idTipo} className="grid gap-1.5 text-label font-semibold">
        Tipo de vínculo
        <select
          id={idTipo}
          value={tipo}
          onChange={(evento) => setTipo(evento.target.value as TipoDeVinculo)}
          className="min-h-11 rounded-md border border-linea bg-superficie px-3 font-normal"
        >
          {TIPOS_DE_VINCULO.map((valor) => (
            <option key={valor} value={valor}>
              {ETIQUETA_DE_VINCULO[valor]}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={idRelevancia} className="grid gap-1.5 text-label font-semibold">
        Relevancia
        <select
          id={idRelevancia}
          value={relevancia}
          onChange={(evento) => setRelevancia(Number(evento.target.value))}
          className="min-h-11 rounded-md border border-linea bg-superficie px-3 font-normal"
        >
          {[1, 2, 3, 4, 5].map((valor) => (
            <option key={valor} value={valor}>
              {valor}
            </option>
          ))}
        </select>
      </label>
      <Boton cargando={cargando} onClick={crear}>
        Crear vínculo
      </Boton>
      {error ? (
        <p role="alert" className="rounded-md bg-error-fondo p-3.5 text-[1rem] text-error-tinta">
          {error}
        </p>
      ) : null}
    </Panel>
  )
}
