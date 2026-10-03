import type { ReactNode } from "react"
import { EVIDENCIA, TIPO_DE_AFIRMACION } from "@/lib/ingesta/etiquetas"
import { textoDeUbicacion, type Ubicacion } from "@/lib/ingesta/ficha"

export interface AfirmacionVisible {
  id: string
  texto: string
  cita: string
  ubicacion: Ubicacion | null
  tipo: string
  evidencia: string
  publico?: string | null
  dolor?: string | null
  emocion?: string | null
  gancho?: string | null
}

const CARACTERISTICAS = [
  ["publico", "Para"],
  ["dolor", "Dolor"],
  ["emocion", "Emoción"],
  ["gancho", "Gancho"],
] as const

/** A claim with its verbatim quote collapsed; `acciones` is where the screen puts its own buttons. */
export function ListaDeAfirmaciones({
  afirmaciones,
  acciones,
}: {
  afirmaciones: AfirmacionVisible[]
  acciones?: (afirmacion: AfirmacionVisible) => ReactNode
}) {
  return (
    <ul className="grid gap-2.5">
      {afirmaciones.map((afirmacion) => {
        const lugar = afirmacion.ubicacion ? textoDeUbicacion(afirmacion.ubicacion) : null
        return (
          <li key={afirmacion.id} className="grid gap-2 rounded-md bg-hundido p-3.5">
            <p>{afirmacion.texto}</p>
            <p className="text-meta text-apagado">
              {`${TIPO_DE_AFIRMACION[afirmacion.tipo] ?? afirmacion.tipo} · ${EVIDENCIA[afirmacion.evidencia] ?? afirmacion.evidencia}`}
            </p>
            {CARACTERISTICAS.map(([clave, etiqueta]) =>
              afirmacion[clave] ? (
                <p key={clave} className="text-meta text-apagado">
                  <span className="font-semibold">{etiqueta}:</span> {afirmacion[clave]}
                </p>
              ) : null,
            )}
            <details className="text-meta">
              <summary className="cursor-pointer font-semibold">Ver cita</summary>
              <blockquote className="mt-1.5 text-apagado">{afirmacion.cita}</blockquote>
              {lugar ? <p className="mt-1 text-apagado">{lugar}</p> : null}
            </details>
            {acciones?.(afirmacion)}
          </li>
        )
      })}
    </ul>
  )
}
