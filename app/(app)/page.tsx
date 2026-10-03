import Link from "next/link"
import { ActualizarMientras } from "@/components/actualizar-mientras"
import { clasesDeBoton } from "@/components/ui/clases-de-boton"
import { hayFiltros, leerFiltros } from "@/lib/ingesta/filtros"
import { autoresDeMateriales, listarMateriales } from "@/lib/ingesta/materiales"
import { leerSesion } from "@/lib/sesion/miembro"
import { estaProcesando } from "./estado-de-material"
import { FiltrosDeLaLista } from "./filtros-de-materiales"
import { TarjetaDeMaterial } from "./tarjeta-de-material"

export default async function Material({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sesion = await leerSesion()
  if (sesion.estado !== "miembro") return null
  const filtros = leerFiltros(await searchParams)
  const [materiales, autores, categorias] = await Promise.all([
    listarMateriales(sesion.db, filtros),
    autoresDeMateriales(sesion.db),
    sesion.db.from("categorias").select("id, nombre").order("nombre"),
  ])
  if (categorias.error) throw new Error(`No pude leer las categorías: ${categorias.error.message}`)

  return (
    <main className="mx-auto grid w-full max-w-[560px] content-start gap-5.5 px-4.5 pt-[max(2rem,env(safe-area-inset-top))] pb-8">
      <ActualizarMientras activo={materiales.some(estaProcesando)} />
      <h1 className="font-serif text-display text-balance">Material de Coni</h1>
      <Link href="/subir" className={clasesDeBoton()}>
        Subir material
      </Link>
      <Link href="/grafo" className={clasesDeBoton({ variante: "linea" })}>
        Ver vínculos
      </Link>
      <Link href="/teorias" className={clasesDeBoton({ variante: "linea" })}>
        Ver teorías
      </Link>
      <FiltrosDeLaLista filtros={filtros} categorias={categorias.data} autores={autores} />
      {materiales.length === 0 ? (
        <p className="text-apagado">
          {hayFiltros(filtros) ? "Ningún material coincide con esos filtros." : "Aún no hay material. Sube el primero."}
        </p>
      ) : (
        <ul className="grid gap-3">
          {materiales.map((material) => (
            <TarjetaDeMaterial key={material.id} material={material} />
          ))}
        </ul>
      )}
    </main>
  )
}
