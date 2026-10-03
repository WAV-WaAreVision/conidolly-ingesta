import Link from "next/link"
import { NavegacionPrincipal } from "@/components/navegacion-principal"
import { resumirAutores } from "@/lib/ingesta/autores"
import { leerSesion } from "@/lib/sesion/miembro"

const TIPO_DE_AUTOR: Record<string, string> = {
  coni: "Coni",
  persona: "Persona",
  cuenta: "Cuenta de redes",
  institucion: "Institución",
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

export default async function Autores() {
  const sesion = await leerSesion()
  if (sesion.estado !== "miembro") return null
  const autores = await resumirAutores(sesion.db)

  return (
    <main className="mx-auto grid w-full max-w-[560px] content-start gap-5.5 px-4.5 pt-[max(2rem,env(safe-area-inset-top))] pb-8">
      <h1 className="font-serif text-display text-balance">Autores</h1>
      <NavegacionPrincipal actual="autores" />
      {autores.length === 0 ? (
        <p className="text-apagado">Todavía no hay autores. Aparecen al subir material.</p>
      ) : (
        <ul className="grid gap-3">
          {autores.map((autor) => (
            <li key={autor.id} className="grid gap-1.5 rounded-lg border border-linea bg-superficie p-4">
              <Link href={`/autores/${autor.id}`} className="grid gap-1.5">
                <span className="font-semibold text-balance">{autor.nombre}</span>
                <span className="text-meta text-apagado">
                  {[TIPO_DE_AUTOR[autor.tipo] ?? autor.tipo, autor.credencial].filter(Boolean).join(" · ")}
                </span>
                <span className="text-meta text-apagado">
                  {`${plural(autor.materiales, "material", "materiales")} · ${plural(autor.afirmaciones, "afirmación", "afirmaciones")}`}
                </span>
              </Link>
              {autor.temas.length > 0 ? (
                <ul aria-label={`Temas de ${autor.nombre}`} className="flex flex-wrap gap-2">
                  {autor.temas.map((tema) => (
                    <li key={tema.id} className="rounded-sm bg-hundido px-2.5 py-1 text-meta">
                      {tema.nombre}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
