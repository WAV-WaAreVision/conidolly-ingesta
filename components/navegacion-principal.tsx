import Link from "next/link"
import { clasesDeBoton } from "@/components/ui/clases-de-boton"
import type { Rol } from "@/lib/acciones/ingreso"
import { origenDeConidolly } from "@/lib/sesion/puente"
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
  const conidolly = rol === "coni" ? origenDeConidolly(process.env.CONIDOLLY_URL, process.env.NODE_ENV) : null
  return (
    <div className="grid gap-1">
      {/* One row like Conidolly's tabs: tight padding fits all five sections at 360 px and up. Below that the track
          scrolls inside itself; it does not do so above, because scrolling would clip the raised pill's shadow. */}
      <nav
        aria-label="Secciones"
        className="flex flex-nowrap rounded-panel bg-piedra-honda p-1 shadow-hundido max-[359px]:overflow-x-auto"
      >
        {visibles.map((seccion) => (
          <Link
            key={seccion.clave}
            href={seccion.ruta}
            aria-current={seccion.clave === actual ? "page" : undefined}
            className={cn(
              "flex min-h-objetivo flex-auto items-center justify-center whitespace-nowrap rounded-control px-0.5 text-meta",
              "transition-shadow duration-[var(--dur-corta)] ease-salida",
              seccion.clave === actual
                ? "bg-piedra font-semibold text-tinta shadow-relieve"
                : "font-medium text-apagado",
            )}
          >
            {seccion.texto}
          </Link>
        ))}
      </nav>
      {conidolly ? (
        <a
          href={conidolly}
          className={clasesDeBoton({ variante: "callado", tamano: "chico", className: "justify-self-start" })}
        >
          Volver a Conidolly
        </a>
      ) : null}
    </div>
  )
}
