import Link from "next/link"
import { EVIDENCIA } from "@/lib/ingesta/etiquetas"
import type { TemaResumido } from "@/lib/ingesta/temas"

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

export function mezclaDeEvidencia(evidencia: Record<string, number>): string {
  return Object.entries(evidencia)
    .sort(([claveA, a], [claveB, b]) => b - a || claveA.localeCompare(claveB))
    .map(([clave, cantidad]) => `${EVIDENCIA[clave] ?? clave} ${cantidad}`)
    .join(" · ")
}

function Insignia({ texto }: { texto: string }) {
  return (
    <span className="w-fit rounded-sm bg-acento-suave px-2.5 py-1 text-meta font-semibold text-acento-profundo">
      {texto}
    </span>
  )
}

export function TarjetaDeTema({ tema }: { tema: TemaResumido }) {
  const evidencia = mezclaDeEvidencia(tema.evidencia)
  return (
    <li className="grid gap-1.5 rounded-lg border border-linea bg-superficie p-4">
      <Link href={`/temas/${tema.id}`} className="grid gap-1.5">
        <span className="font-semibold text-balance">{tema.nombre}</span>
        <span className="text-meta text-apagado">
          {`${plural(tema.afirmaciones, "afirmación", "afirmaciones")} · ${plural(tema.autores, "autor", "autores")}`}
        </span>
      </Link>
      {tema.cubiertoPorConi || tema.autores === 1 ? (
        <div className="flex flex-wrap gap-2">
          {tema.cubiertoPorConi ? <Insignia texto="Coni ya lo trató" /> : null}
          {tema.autores === 1 ? <Insignia texto="Un solo autor" /> : null}
        </div>
      ) : null}
      {evidencia ? <p className="text-meta text-apagado">{evidencia}</p> : null}
    </li>
  )
}
