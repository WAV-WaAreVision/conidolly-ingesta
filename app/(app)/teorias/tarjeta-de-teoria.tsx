import Link from "next/link"
import { etiquetaDeEstadoDeTeoria, type TeoriaLeida } from "@/lib/ingesta/modelo-de-teoria"
import { cn } from "@/lib/utils"
import { claseDeEstadoDeTeoria } from "./estado-de-teoria"
import { ReintentoDeTeoria } from "./reintento-de-teoria"

export function nombreDeTeoria(teoria: Pick<TeoriaLeida, "titulo" | "estado">): string {
  if (teoria.titulo) return teoria.titulo
  return teoria.estado === "fallida" ? "Teoría que no salió" : "Armando la teoría"
}

export function TarjetaDeTeoria({ teoria }: { teoria: TeoriaLeida }) {
  const fuentes = teoria.fuentes.length
  return (
    <li className="grid gap-1.5 rounded-lg border border-linea bg-superficie p-4">
      <Link href={`/teorias/${teoria.id}`} className="grid gap-1.5">
        <span className="font-semibold text-balance">{nombreDeTeoria(teoria)}</span>
        <span className="text-meta text-apagado">{fuentes === 1 ? "1 fuente" : `${fuentes} fuentes`}</span>
      </Link>
      <p className={cn("w-fit rounded-sm px-2.5 py-1 text-meta font-semibold", claseDeEstadoDeTeoria(teoria.estado))}>
        {etiquetaDeEstadoDeTeoria(teoria.estado)}
      </p>
      {teoria.motivoFallo ? <p className="text-meta text-apagado">{teoria.motivoFallo}</p> : null}
      <ReintentoDeTeoria teoria={teoria} />
    </li>
  )
}
