import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { ActualizarMientras } from "@/components/actualizar-mientras"
import { clasesDeBoton } from "@/components/ui/clases-de-boton"
import { estaSintetizando } from "@/lib/ingesta/modelo-de-teoria"
import { leerTeoria } from "@/lib/ingesta/teorias"
import { leerSesion } from "@/lib/sesion/miembro"
import { BotonReintentarTeoria } from "../boton-reintentar-teoria"
import { nombreDeTeoria } from "../tarjeta-de-teoria"
import { TeoriaEditable } from "./teoria-editable"

export default async function TeoriaPagina({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await leerSesion()
  if (sesion.estado !== "miembro") return null
  const id = z
    .string()
    .uuid()
    .safeParse((await params).id)
  if (!id.success) notFound()
  const teoria = await leerTeoria(sesion.db, id.data)
  if (!teoria) notFound()
  const categorias = await sesion.db.from("categorias").select("id, nombre").order("nombre")
  if (categorias.error) throw new Error(`No pude leer las categorías: ${categorias.error.message}`)

  return (
    <main className="mx-auto grid w-full max-w-[560px] content-start gap-5.5 px-4.5 pt-[max(2rem,env(safe-area-inset-top))] pb-8">
      <ActualizarMientras activo={estaSintetizando(teoria)} cadaMs={5_000} />
      <Link href="/teorias" className={clasesDeBoton({ variante: "callado", tamano: "chico" })}>
        Volver a teorías
      </Link>
      <h1 className="font-serif text-display text-balance">{nombreDeTeoria(teoria)}</h1>

      {estaSintetizando(teoria) ? (
        <output className="rounded-md bg-aviso-fondo p-3.5 text-[1rem] text-aviso-tinta">
          Estoy armando la teoría con tus {teoria.fuentes.length} materiales. Puede tardar un minuto; esta página se
          actualiza sola.
        </output>
      ) : teoria.estado === "fallida" ? (
        <div className="grid gap-3">
          <p role="alert" className="rounded-md bg-error-fondo p-3.5 text-[1rem] text-error-tinta">
            {teoria.motivoFallo ?? "La teoría no salió."}
          </p>
          <BotonReintentarTeoria teoriaId={teoria.id} />
        </div>
      ) : (
        <TeoriaEditable teoria={teoria} categorias={categorias.data} />
      )}
    </main>
  )
}
