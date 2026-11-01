import { NavegacionPrincipal } from "@/components/navegacion-principal"
import { leerSemana } from "@/lib/ingesta/semana"
import { leerSesion } from "@/lib/sesion/miembro"
import { BotonProponerAhora } from "./boton-proponer-ahora"
import { VistaDeSemana } from "./vista-de-semana"

export default async function Semana() {
  const sesion = await leerSesion()
  if (sesion.estado !== "miembro") return null
  const semana = await leerSemana(sesion.db)

  return (
    <main className="mx-auto grid w-full max-w-[560px] content-start gap-5.5 px-4.5 pt-[max(2rem,env(safe-area-inset-top))] pb-8">
      <h1 className="font-serif text-display text-balance">Semana</h1>
      <NavegacionPrincipal actual="semana" rol={sesion.rol} />
      <BotonProponerAhora />
      <VistaDeSemana semana={semana} />
    </main>
  )
}
