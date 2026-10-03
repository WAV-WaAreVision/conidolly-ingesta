import { leerSesion } from "@/lib/sesion/miembro"
import { FormularioSubida } from "./formulario-subida"

export default async function Subir() {
  const sesion = await leerSesion()
  if (sesion.estado !== "miembro") return null
  const { data, error } = await sesion.db.from("categorias").select("id, nombre").order("nombre")
  if (error) throw new Error(`No pude leer las categorías: ${error.message}`, { cause: error })
  return <FormularioSubida categorias={data} />
}
