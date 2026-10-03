"use client"

import type { ReactNode } from "react"
import { Boton } from "@/components/ui/boton"

/** A sheet that comes up from the bottom on a phone and sits at the right of a wide screen. */
export function Panel({ titulo, alCerrar, children }: { titulo: string; alCerrar: () => void; children: ReactNode }) {
  return (
    <section
      role="dialog"
      aria-label={titulo}
      className="fixed inset-x-0 bottom-0 z-20 grid max-h-[70dvh] content-start gap-3.5 overflow-y-auto rounded-t-xl border border-linea bg-superficie p-4.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-flotante md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-96 md:rounded-none md:rounded-l-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-title text-balance">{titulo}</h2>
        <Boton variante="callado" tamano="chico" onClick={alCerrar}>
          Cerrar
        </Boton>
      </div>
      {children}
    </section>
  )
}
