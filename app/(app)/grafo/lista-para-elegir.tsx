"use client"

import type { MaterialDelGrafo } from "@/lib/ingesta/grafo"

/** The accessible twin of choosing nodes on the graph: every material as a row with a checkbox. */
export function ListaParaElegir({
  materiales,
  seleccionados,
  alAlternar,
}: {
  materiales: MaterialDelGrafo[]
  seleccionados: string[]
  alAlternar: (id: string) => void
}) {
  return (
    <ul className="grid gap-3">
      {materiales.map((material) => (
        <li key={material.id} className="rounded-lg border border-linea bg-superficie">
          <label className="flex min-h-13 cursor-pointer items-center gap-3 p-4">
            <input
              type="checkbox"
              className="size-5 accent-acento"
              checked={seleccionados.includes(material.id)}
              onChange={() => alAlternar(material.id)}
            />
            <span className="grid gap-0.5">
              <span className="font-semibold text-balance">{material.titulo ?? "Sin título"}</span>{" "}
              <span className="text-meta text-apagado">
                {[material.autor, material.categoria].filter(Boolean).join(" · ")}
              </span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  )
}
