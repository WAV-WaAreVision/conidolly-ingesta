import Link from "next/link"
import { z } from "zod"
import { Campo, CLASES_DE_CAMPO } from "@/components/campo"
import { NavegacionPrincipal } from "@/components/navegacion-principal"
import { Boton } from "@/components/ui/boton"
import { clasesDeBoton } from "@/components/ui/clases-de-boton"
import { listarPilares, listarTemas } from "@/lib/ingesta/temas"
import { leerSesion } from "@/lib/sesion/miembro"
import { TarjetaDeTema } from "./tarjeta-de-tema"

export default async function Temas({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sesion = await leerSesion()
  if (sesion.estado !== "miembro") return null
  const { pilar: crudo } = await searchParams
  const leido = z
    .string()
    .uuid()
    .safeParse(Array.isArray(crudo) ? crudo[0] : crudo)
  const pilar = leido.success ? leido.data : undefined
  const [temas, pilares] = await Promise.all([listarTemas(sesion.db, { pilar }), listarPilares(sesion.db)])

  return (
    <main className="mx-auto grid w-full max-w-[560px] content-start gap-5.5 px-4.5 pt-[max(2rem,env(safe-area-inset-top))] pb-8">
      <h1 className="font-serif text-display text-balance">Temas</h1>
      <NavegacionPrincipal actual="temas" />
      <form
        key={pilar ?? ""}
        method="get"
        action="/temas"
        aria-label="Filtros"
        className="grid gap-3 rounded-lg border border-linea bg-superficie p-4"
      >
        <Campo id="filtro-pilar" etiqueta="Pilar">
          <select id="filtro-pilar" name="pilar" defaultValue={pilar ?? ""} className={CLASES_DE_CAMPO}>
            <option value="">Todos</option>
            {pilares.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>
                {opcion.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Boton type="submit" variante="linea">
          Filtrar
        </Boton>
        {pilar ? (
          <Link href="/temas" className={clasesDeBoton({ variante: "callado", tamano: "chico" })}>
            Quitar filtros
          </Link>
        ) : null}
      </form>
      {temas.length === 0 ? (
        <p className="text-apagado">
          {pilar
            ? "Ningún tema coincide con ese pilar."
            : "Los temas aparecen solos cuando hay al menos 3 afirmaciones parecidas. Sube más material de distintos autores."}
        </p>
      ) : (
        <ul className="grid gap-3">
          {temas.map((tema) => (
            <TarjetaDeTema key={tema.id} tema={tema} />
          ))}
        </ul>
      )}
    </main>
  )
}
