"use server"

import { conSesion } from "@/lib/acciones/servidor"
import { fusionarAutores } from "@/lib/ingesta/autores"

export async function fusionarAutoresAccion(entrada: unknown) {
  return conSesion("fusionarAutores", (deps) => fusionarAutores(deps, entrada))
}
