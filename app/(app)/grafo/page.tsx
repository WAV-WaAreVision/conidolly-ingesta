import Link from "next/link"
import { clasesDeBoton } from "@/components/ui/clases-de-boton"
import { listarMateriales } from "@/lib/ingesta/materiales"
import { teoriasDelGrafo } from "@/lib/ingesta/teorias"
import { listarVinculos } from "@/lib/ingesta/vinculos"
import { leerSesion } from "@/lib/sesion/miembro"
import { VistaDelGrafo } from "./vista-del-grafo"

export default async function Grafo() {
  const sesion = await leerSesion()
  if (sesion.estado !== "miembro") return null
  const [materiales, vinculos, teorias] = await Promise.all([
    listarMateriales(sesion.db, { estado: "listo" }),
    listarVinculos(sesion.db),
    teoriasDelGrafo(sesion.db),
  ])

  return (
    <main className="mx-auto grid w-full max-w-[560px] content-start gap-5.5 px-4.5 pt-[max(2rem,env(safe-area-inset-top))] pb-8">
      <Link href="/" className={clasesDeBoton({ variante: "callado", tamano: "chico" })}>
        Volver a materiales
      </Link>
      <h1 className="font-serif text-display text-balance">Vínculos entre materiales</h1>
      <VistaDelGrafo materiales={materiales} vinculos={vinculos} teorias={teorias} />
    </main>
  )
}
