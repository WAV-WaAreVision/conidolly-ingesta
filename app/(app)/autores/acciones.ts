"use server"

import { revalidatePath } from "next/cache"
import { conSesion } from "@/lib/acciones/servidor"
import { borrarAutor, fusionarAutores } from "@/lib/ingesta/autores"

export async function fusionarAutoresAccion(entrada: unknown) {
  return conSesion("fusionarAutores", (deps) => fusionarAutores(deps, entrada))
}

export async function borrarAutorAccion(entrada: unknown) {
  const resultado = await conSesion("borrarAutor", (deps) => borrarAutor(deps, entrada))
  // The list is dynamic, but the router cache would still show the deleted author when she lands back on it.
  if (resultado.ok) revalidatePath("/autores", "layout")
  return resultado
}
