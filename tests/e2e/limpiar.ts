import { clienteDeServicio } from "./ayudas"
import { PREFIJO_DE_PRUEBA } from "./entorno"

// The run owns the local database while it lasts: it leaves it as it found it, without the materials it uploaded.
export default async function limpiar(): Promise<void> {
  const { error } = await clienteDeServicio().from("materiales").delete().like("titulo", `${PREFIJO_DE_PRUEBA}%`)
  if (error) throw new Error(`No pude limpiar los materiales de la prueba: ${error.message}`)
  const temas = await clienteDeServicio().from("temas").delete().like("nombre", `${PREFIJO_DE_PRUEBA}%`)
  if (temas.error) throw new Error(`No pude limpiar los temas de la prueba: ${temas.error.message}`)
  const autores = await clienteDeServicio().from("autores").delete().like("nombre", `${PREFIJO_DE_PRUEBA}%`)
  if (autores.error) throw new Error(`No pude limpiar los autores de la prueba: ${autores.error.message}`)
}
