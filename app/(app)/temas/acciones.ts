"use server"

import { conSesion } from "@/lib/acciones/servidor"
import { excluirAfirmacion } from "@/lib/ingesta/temas"

export async function excluirAfirmacionAccion(entrada: unknown) {
  return conSesion("excluirAfirmacion", (deps) => excluirAfirmacion(deps, entrada))
}
