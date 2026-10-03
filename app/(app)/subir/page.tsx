import { listarAutores } from "@/lib/ingesta/autores"
import { leerSesion } from "@/lib/sesion/miembro"
import { FormularioSubida } from "./formulario-subida"

export default async function Subir() {
  const sesion = await leerSesion()
  if (sesion.estado !== "miembro") return null
  return <FormularioSubida autores={await listarAutores(sesion.db)} />
}
