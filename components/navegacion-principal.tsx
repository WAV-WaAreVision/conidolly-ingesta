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
  return (
    <nav aria-label="Secciones" className="flex flex-wrap gap-1.5">
      {visibles.map((seccion) => (
        <Link
          key={seccion.clave}
          href={seccion.ruta}
          aria-current={seccion.clave === actual ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-auto items-center justify-center rounded-md border border-linea px-1 text-nav font-semibold",
            "focus-visible:outline-3 focus-visible:outline-acento",
            seccion.clave === actual
              ? "border-acento bg-acento-suave text-acento-profundo"
              : "bg-superficie text-tinta",
          )}
        >
          {seccion.texto}
        </Link>
      ))}
    </nav>
  )
}
