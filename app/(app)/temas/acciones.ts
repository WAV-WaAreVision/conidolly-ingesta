"use server"

import { revalidatePath } from "next/cache"
import { conSesion } from "@/lib/acciones/servidor"
import { excluirAfirmacion } from "@/lib/ingesta/temas"

export async function excluirAfirmacionAccion(entrada: unknown) {
  const resultado = await conSesion("excluirAfirmacion", (deps) => excluirAfirmacion(deps, entrada))
  // Hiding the last claim of a topic deletes the topic, so its list, its page and the author pages are all stale.
  if (resultado.ok) {
    revalidatePath("/temas", "layout")
    revalidatePath("/autores", "layout")
  }
  return resultado
}
