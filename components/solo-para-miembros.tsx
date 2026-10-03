import { cerrarSesionAccion } from "@/app/(app)/acciones"
import { Boton } from "@/components/ui/boton"
import { SOLO_PARA_MIEMBROS } from "@/lib/sesion/miembro"

// Whoever else signs in sees only this: the material is Coni's and WAV's.
export function SoloParaMiembros() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-[560px] content-start gap-5.5 px-4.5 pt-16">
      <h1 className="font-serif text-display text-balance">{SOLO_PARA_MIEMBROS}</h1>
      <form action={cerrarSesionAccion}>
        <Boton type="submit" variante="linea">
          Salir
        </Boton>
      </form>
    </main>
  )
}
