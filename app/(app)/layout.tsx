import { redirect } from "next/navigation"
import { SoloParaMiembros } from "@/components/solo-para-miembros"
import { leerSesion } from "@/lib/sesion/miembro"
import { RUTA_DE_INGRESO } from "@/lib/sesion/rutas"

export const dynamic = "force-dynamic"

export default async function LayoutDeLaApp({ children }: { children: React.ReactNode }) {
  const sesion = await leerSesion()
  if (sesion.estado === "sin_sesion") redirect(RUTA_DE_INGRESO)
  if (sesion.estado === "otra_persona") return <SoloParaMiembros />
  return children
}
