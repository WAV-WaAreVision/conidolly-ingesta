import Link from "next/link"
import type { ReactNode } from "react"
import { clasesDeBoton } from "@/components/ui/clases-de-boton"

/** The way back to a list: Conidolly's quiet action, so its target is the 2.75rem row of its text. */
export function EnlaceDeVuelta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={clasesDeBoton({ variante: "callado", tamano: "chico" })}>
      ← {children}
    </Link>
  )
}
