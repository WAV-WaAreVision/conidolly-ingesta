import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ListaDeAfirmaciones } from "@/components/lista-de-afirmaciones"
import { destinoDeTema, leerTema } from "@/lib/ingesta/temas"
import { leerSesion } from "@/lib/sesion/miembro"
import { BotonOcultar } from "../boton-ocultar"

export default async function Tema({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await leerSesion()
  if (sesion.estado !== "miembro") return null
  const { id } = await params
  const destino = await destinoDeTema(sesion.db, id)
  if (destino === null) notFound()
  if (destino !== id) redirect(`/temas/${destino}`)
  const leido = await leerTema(sesion.db, id)
  if (!leido) notFound()
  const { tema, autores } = leido

  return (
    <main className="mx-auto grid w-full max-w-[560px] content-start gap-5.5 px-4.5 pt-[max(2rem,env(safe-area-inset-top))] pb-8">
      <Link href="/temas" className="w-fit text-meta font-semibold text-acento-profundo">
        ← Temas
      </Link>
      <header className="grid gap-1.5">
        <h1 className="font-serif text-display text-balance">{tema.nombre}</h1>
        {tema.descripcion ? <p>{tema.descripcion}</p> : null}
        {tema.alias.length > 0 ? (
          <p className="text-meta text-apagado">{`También se le dice: ${tema.alias.join(", ")}`}</p>
        ) : null}
      </header>
      {autores.length === 0 ? <p className="text-apagado">Este tema no tiene afirmaciones visibles.</p> : null}
      {autores.map((grupo) => (
        <section key={grupo.autor.id} className="grid gap-2.5">
          <h2 className="text-title font-serif">
            <Link href={`/autores/${grupo.autor.id}`}>{grupo.autor.nombre}</Link>
          </h2>
          {grupo.autor.credencial ? <p className="text-meta text-apagado">{grupo.autor.credencial}</p> : null}
          <ListaDeAfirmaciones
            afirmaciones={grupo.afirmaciones}
            acciones={(afirmacion) => <BotonOcultar afirmacionId={afirmacion.id} oculta={false} />}
          />
        </section>
      ))}
    </main>
  )
}
