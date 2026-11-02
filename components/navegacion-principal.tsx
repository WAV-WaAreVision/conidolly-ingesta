import Link from "next/link"
import type { Rol } from "@/lib/acciones/ingreso"
import { cn } from "@/lib/utils"

const SECCIONES = [
  { clave: "materiales", texto: "Materiales", ruta: "/", soloWav: false },
  { clave: "autores", texto: "Autores", ruta: "/autores", soloWav: false },
  { clave: "temas", texto: "Temas", ruta: "/temas", soloWav: false },
  { clave: "semana", texto: "Semana", ruta: "/semana", soloWav: false },
  // The personal data register is WAV's to correct (Conidolly spec 2026-11-01, D2); Coni reviews it in Conidolly.
  { clave: "datos", texto: "Datos", ruta: "/datos-personales", soloWav: true },
] as const

export type Seccion = (typeof SECCIONES)[number]["clave"]

export function NavegacionPrincipal({ actual, rol }: { actual: Seccion; rol: Rol }) {
  const visibles = SECCIONES.filter((seccion) => !seccion.soloWav || rol === "wav")
  // Coni comes from Conidolly's Biblioteca tab (change 29a) and goes back the same way. WAV never enters Conidolly (A6).
  const conidolly = rol === "coni" ? process.env.CONIDOLLY_URL : undefined
  return (
    <nav aria-label="Secciones" className="flex flex-wrap gap-1 rounded-panel bg-piedra-honda p-1 shadow-hundido">
      {visibles.map((seccion) => (
        <Link
          key={seccion.clave}
          href={seccion.ruta}
          aria-current={seccion.clave === actual ? "page" : undefined}
          className={cn(
            "flex min-h-objetivo min-w-0 flex-auto items-center justify-center rounded-control px-3 text-meta",
            "transition-shadow duration-[var(--dur-corta)] ease-salida",
            seccion.clave === actual ? "bg-piedra font-semibold text-tinta shadow-relieve" : "font-medium text-apagado",
          )}
        >
          {seccion.texto}
        </Link>
      ))}
      {conidolly ? (
        <a
          href={conidolly}
          className="flex min-h-objetivo min-w-0 flex-auto items-center justify-center rounded-control px-3 text-meta font-medium text-tinta underline decoration-1 underline-offset-4"
        >
          Volver a Conidolly
        </a>
      ) : null}
    </nav>
  )
}
