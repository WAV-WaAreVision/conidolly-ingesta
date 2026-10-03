import { clienteDeServicio } from "./ayudas"
import { PREFIJO_DE_PRUEBA } from "./entorno"

// The run owns the local database while it lasts: it leaves it as it found it, without the materials it uploaded.
export default async function limpiar(): Promise<void> {
  const teorias = await clienteDeServicio().from("teorias").delete().like("titulo", `${PREFIJO_DE_PRUEBA}%`)
  if (teorias.error) throw new Error(`No pude limpiar las teorías de la prueba: ${teorias.error.message}`)
  const { error } = await clienteDeServicio().from("materiales").delete().like("titulo", `${PREFIJO_DE_PRUEBA}%`)
  if (error) throw new Error(`No pude limpiar los materiales de la prueba: ${error.message}`)
  const categorias = await clienteDeServicio().from("categorias").delete().like("nombre", `${PREFIJO_DE_PRUEBA}%`)
  if (categorias.error) throw new Error(`No pude limpiar las categorías de la prueba: ${categorias.error.message}`)
}
