import Link from "next/link"
import { cn } from "@/lib/utils"

const SECCIONES = [
  { clave: "materiales", texto: "Materiales", ruta: "/" },
  { clave: "autores", texto: "Autores", ruta: "/autores" },
  { clave: "temas", texto: "Temas", ruta: "/temas" },
  { clave: "semana", texto: "Semana", ruta: "/semana" },
] as const

export type Seccion = (typeof SECCIONES)[number]["clave"]

export function NavegacionPrincipal({ actual }: { actual: Seccion }) {
  return (
    <nav aria-label="Secciones" className="flex gap-1.5">
      {SECCIONES.map((seccion) => (
        <Link
          key={seccion.clave}
          href={seccion.ruta}
          aria-current={seccion.clave === actual ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-md border border-linea px-1 text-nav font-semibold",
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
