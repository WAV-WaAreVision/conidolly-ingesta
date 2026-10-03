import Link from "next/link"
import type { MaterialDeLista } from "@/lib/ingesta/materiales"
import { ETIQUETA_DE_ROL, type Rol } from "@/lib/ingesta/modelo"
import { cn } from "@/lib/utils"
import { ETIQUETA_DE_TIPO, esperaConfirmacion, estadoVisible, sePuedeReintentar } from "./estado-de-material"
import { BotonConfirmarCosto } from "./materiales/boton-confirmar-costo"
import { BotonReintentar } from "./materiales/boton-reintentar"

export function TarjetaDeMaterial({ material }: { material: MaterialDeLista }) {
  const estado = estadoVisible(material)
  return (
    <li className="grid gap-1.5 rounded-lg border border-linea bg-superficie p-4">
      <Link href={`/materiales/${material.id}`} className="grid gap-1.5">
        <span className="font-semibold text-balance">{material.titulo ?? "Sin título"}</span>
        <span className="text-meta text-apagado">
          {ETIQUETA_DE_TIPO[material.tipo] ?? material.tipo}
          {` · ${material.autor} · ${ETIQUETA_DE_ROL[material.rol as Rol] ?? material.rol}`}
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
