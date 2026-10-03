import Link from "next/link"
import { ActualizarMientras } from "@/components/actualizar-mientras"
import { clasesDeBoton } from "@/components/ui/clases-de-boton"
import { estaSintetizando } from "@/lib/ingesta/modelo-de-teoria"
import { listarTeorias } from "@/lib/ingesta/teorias"
import { leerSesion } from "@/lib/sesion/miembro"
import { TarjetaDeTeoria } from "./tarjeta-de-teoria"

export default async function Teorias() {
  const sesion = await leerSesion()
  if (sesion.estado !== "miembro") return null
  const teorias = await listarTeorias(sesion.db)

  return (
    <main className="mx-auto grid w-full max-w-[560px] content-start gap-5.5 px-4.5 pt-[max(2rem,env(safe-area-inset-top))] pb-8">
      <ActualizarMientras activo={teorias.some(estaSintetizando)} cadaMs={5_000} />
      <Link href="/" className={clasesDeBoton({ variante: "callado", tamano: "chico" })}>
        Volver a materiales
      </Link>
      <h1 className="font-serif text-display text-balance">Teorías</h1>
      <Link href="/grafo" className={clasesDeBoton({ variante: "linea" })}>
        Armar una teoría desde el grafo
      </Link>
      {teorias.length === 0 ? (
        <p className="text-apagado">Aún no hay teorías. Elige varios materiales en el grafo y toca Sintetizar.</p>
      ) : (
        <ul className="grid gap-3">
          {teorias.map((teoria) => (
            <TarjetaDeTeoria key={teoria.id} teoria={teoria} />
          ))}
        </ul>
      )}
    </main>
  )
}
