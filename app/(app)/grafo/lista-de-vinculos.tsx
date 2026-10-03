"use client"

import {
  ETIQUETA_DE_ESTADO_DE_VINCULO,
  ETIQUETA_DE_VINCULO,
  type TipoDeVinculo,
  type VinculoDelGrafo,
} from "@/lib/ingesta/grafo"
import { cn } from "@/lib/utils"
import { ControlesDeVinculo } from "./controles-de-vinculo"

export const SIN_VINCULOS = "Los vínculos aparecen cuando hay al menos dos materiales listos."

const CLASES_DE_ESTADO: Record<string, string> = {
  sugerido: "bg-aviso-fondo text-aviso-tinta",
  aceptado: "bg-ok-fondo text-ok-tinta",
}

/** The accessible twin of the graph: the same links as rows, with the same decisions. */
export function ListaDeVinculos({
  vinculos,
  titulos,
}: {
  vinculos: VinculoDelGrafo[]
  titulos: Record<string, string>
}) {
  if (vinculos.length === 0) return <p className="text-apagado">{SIN_VINCULOS}</p>
  return (
    <ul className="grid gap-3">
      {vinculos.map((vinculo) => (
        <li
          key={`${vinculo.material_a}|${vinculo.material_b}`}
          className="grid gap-2.5 rounded-lg border border-linea bg-superficie p-4"
        >
          <p className="grid gap-0.5 font-semibold text-balance">
            <span>{titulos[vinculo.material_a] ?? "Sin título"}</span>
            <span aria-hidden="true" className="text-apagado">
              con
            </span>
            <span>{titulos[vinculo.material_b] ?? "Sin título"}</span>
          </p>
          <p className="flex flex-wrap items-center gap-2 text-meta text-apagado">
            <span>{ETIQUETA_DE_VINCULO[vinculo.tipo as TipoDeVinculo] ?? vinculo.tipo}</span>
            <span
              className={cn(
                "rounded-sm px-2.5 py-1 font-semibold",
                CLASES_DE_ESTADO[vinculo.estado] ?? "bg-hundido text-apagado",
              )}
            >
              {ETIQUETA_DE_ESTADO_DE_VINCULO[vinculo.estado] ?? vinculo.estado}
            </span>
          </p>
          {vinculo.razon ? <p className="text-meta">{vinculo.razon}</p> : null}
          <ControlesDeVinculo vinculo={vinculo} />
        </li>
      ))}
    </ul>
  )
}
