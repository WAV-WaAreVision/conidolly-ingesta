import Link from "next/link"
import { notFound } from "next/navigation"
import { clasesDeBoton } from "@/components/ui/clases-de-boton"
import { adaptacionDe } from "@/lib/ingesta/ficha"
import { leerMaterialConFicha } from "@/lib/ingesta/materiales"
import { esquemaDeId } from "@/lib/ingesta/modelo"
import { leerSesion } from "@/lib/sesion/miembro"
import { cn } from "@/lib/utils"
import { ESTADO, ETIQUETA_DE_TIPO, sePuedeReintentar } from "../../estado-de-material"
import { BotonReintentar } from "../boton-reintentar"
import { BorrarMaterial } from "./borrar-material"
import { FichaEditable } from "./ficha-editable"

export default async function FichaDeMaterial({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await leerSesion()
  if (sesion.estado !== "miembro") return null
  const id = esquemaDeId.safeParse({ materialId: (await params).id })
  if (!id.success) notFound()
  const leido = await leerMaterialConFicha(sesion.db, id.data.materialId)
  if (!leido) notFound()
  const { material, ficha } = leido
  const estado = ESTADO[material.estado] ?? { texto: material.estado, clases: "bg-hundido text-apagado" }
  const enlace = `/materiales/${material.id}/texto`

  return (
    <main className="mx-auto grid w-full max-w-[560px] content-start gap-5.5 px-4.5 pt-[max(2rem,env(safe-area-inset-top))] pb-8">
      <Link href="/" className={clasesDeBoton({ variante: "callado", tamano: "chico" })}>
        Volver al material
      </Link>
      <header className="grid gap-2">
        <h1 className="font-serif text-display text-balance">{material.titulo ?? "Sin título"}</h1>
        <p className="text-meta text-apagado">
          {ETIQUETA_DE_TIPO[material.tipo] ?? material.tipo}
          {material.autor ? ` · ${material.autor}` : ""}
          {material.categoria ? ` · ${material.categoria}` : ""}
        </p>
        <p className={cn("w-fit rounded-sm px-2.5 py-1 text-meta font-semibold", estado.clases)}>{estado.texto}</p>
        {material.motivo_fallo ? <p className="text-meta text-apagado">{material.motivo_fallo}</p> : null}
        {sePuedeReintentar(material) ? <BotonReintentar materialId={material.id} /> : null}
      </header>

      {ficha ? (
        <>
          <p className="rounded-md bg-acento-suave p-3.5 text-meta text-tinta">
            {adaptacionDe(material.idioma_original)}
          </p>
          <FichaEditable materialId={material.id} ficha={ficha} />
          <nav aria-label="Texto completo" className="grid gap-2.5">
            <a href={`${enlace}?cual=traducido`} className={clasesDeBoton({ variante: "linea" })}>
              Descargar texto completo
            </a>
            <a href={`${enlace}?cual=original`} className={clasesDeBoton({ variante: "linea" })}>
              Ver texto original
            </a>
          </nav>
        </>
      ) : material.estado === "listo" ? (
        <p className="text-apagado">No pude leer la ficha de este material. Avísale a WAV.</p>
      ) : (
        <p className="text-apagado">La ficha aparece cuando termina de procesarse.</p>
      )}

      <BorrarMaterial materialId={material.id} />
    </main>
  )
}
