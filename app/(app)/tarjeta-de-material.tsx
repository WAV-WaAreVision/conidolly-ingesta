import Link from "next/link"
import type { MaterialDeLista } from "@/lib/ingesta/materiales"
import { cn } from "@/lib/utils"
import { ESTADO, ETIQUETA_DE_TIPO, esperaConfirmacion, sePuedeReintentar } from "./estado-de-material"
import { BotonConfirmarCosto } from "./materiales/boton-confirmar-costo"
import { BotonReintentar } from "./materiales/boton-reintentar"

export function TarjetaDeMaterial({ material }: { material: MaterialDeLista }) {
  const estado = ESTADO[material.estado] ?? { texto: material.estado, clases: "bg-hundido text-apagado" }
  return (
    <li className="grid gap-1.5 rounded-lg border border-linea bg-superficie p-4">
      <Link href={`/materiales/${material.id}`} className="grid gap-1.5">
        <span className="font-semibold text-balance">{material.titulo ?? "Sin título"}</span>
        <span className="text-meta text-apagado">
          {ETIQUETA_DE_TIPO[material.tipo] ?? material.tipo}
          {material.autor ? ` · ${material.autor}` : ""}
          {material.categoria ? ` · ${material.categoria}` : ""}
        </span>
      </Link>
      <p className={cn("w-fit rounded-sm px-2.5 py-1 text-meta font-semibold", estado.clases)}>{estado.texto}</p>
      {material.motivo_fallo ? <p className="text-meta text-apagado">{material.motivo_fallo}</p> : null}
      {esperaConfirmacion(material) && material.costo_estimado_usd !== null ? (
        <BotonConfirmarCosto materialId={material.id} costoUsd={material.costo_estimado_usd} />
      ) : null}
      {sePuedeReintentar(material) ? <BotonReintentar materialId={material.id} /> : null}
    </li>
  )
}
