import Link from "next/link"
import { ActualizarMientras } from "@/components/actualizar-mientras"
import { NavegacionPrincipal } from "@/components/navegacion-principal"
import { clasesDeBoton } from "@/components/ui/clases-de-boton"
import { listarAutores } from "@/lib/ingesta/autores"
import { hayFiltros, leerFiltros } from "@/lib/ingesta/filtros"
import { listarMateriales } from "@/lib/ingesta/materiales"
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
  const [materiales, autores] = await Promise.all([listarMateriales(sesion.db, filtros), listarAutores(sesion.db)])

  return (
    <main className="mx-auto grid w-full max-w-[560px] content-start gap-5.5 px-4.5 pt-[max(2rem,env(safe-area-inset-top))] pb-8">
      <ActualizarMientras activo={materiales.some(estaProcesando)} />
      <h1 className="font-serif text-display text-balance">Material de Coni</h1>
      <NavegacionPrincipal actual="materiales" rol={sesion.rol} />
      <Link href="/subir" className={clasesDeBoton()}>
        Subir material
      </Link>
      <FiltrosDeLaLista filtros={filtros} autores={autores} />
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
