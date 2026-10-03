import Link from "next/link"
import { notFound } from "next/navigation"
import { ListaDeAfirmaciones } from "@/components/lista-de-afirmaciones"
import { leerAutor, listarAutores } from "@/lib/ingesta/autores"
import { leerSesion } from "@/lib/sesion/miembro"
import { BotonOcultar } from "../../temas/boton-ocultar"
import { UnirAutores } from "./unir-autores"

export default async function Autor({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await leerSesion()
  if (sesion.estado !== "miembro") return null
  const { id } = await params
  const [leido, autores] = await Promise.all([leerAutor(sesion.db, id), listarAutores(sesion.db)])
  if (!leido) notFound()
  const { autor, grupos, ocultas } = leido

  return (
    <main className="mx-auto grid w-full max-w-[560px] content-start gap-5.5 px-4.5 pt-[max(2rem,env(safe-area-inset-top))] pb-8">
      <Link href="/autores" className="w-fit text-meta font-semibold text-acento-profundo">
        ← Autores
      </Link>
      <header className="grid gap-1">
        <h1 className="font-serif text-display text-balance">{autor.nombre}</h1>
        {autor.credencial ? <p className="text-apagado">{autor.credencial}</p> : null}
      </header>

      {grupos.length === 0 && ocultas.length === 0 ? (
        <p className="text-apagado">Este autor todavía no tiene afirmaciones.</p>
      ) : null}
      {grupos.map((grupo) => (
        <section key={grupo.tema?.id ?? "sin-tema"} className="grid gap-2.5">
          <h2 className="text-title font-serif">
            {grupo.tema ? <Link href={`/temas/${grupo.tema.id}`}>{grupo.tema.nombre}</Link> : "Sin tema todavía"}
          </h2>
          <ListaDeAfirmaciones afirmaciones={grupo.afirmaciones} />
        </section>
      ))}
      {ocultas.length > 0 ? (
        <section className="grid gap-2.5">
          <h2 className="text-title font-serif">Ocultas</h2>
          <ListaDeAfirmaciones
            afirmaciones={ocultas}
            acciones={(afirmacion) => <BotonOcultar afirmacionId={afirmacion.id} oculta />}
          />
        </section>
      ) : null}

      {autor.tipo === "coni" ? null : (
        <UnirAutores
          origen={{ id: autor.id, nombre: autor.nombre }}
          otros={autores
            .filter((otro) => otro.id !== autor.id)
            .map(({ id: otroId, nombre }) => ({ id: otroId, nombre }))}
        />
      )}
    </main>
  )
}
