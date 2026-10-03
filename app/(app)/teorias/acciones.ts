"use server"

import { conSesion } from "@/lib/acciones/servidor"
import { guardarTeoria, pedirTeoria, reintentarTeoria } from "@/lib/ingesta/teorias"

export async function pedirTeoriaAccion(entrada: unknown) {
  return conSesion("pedirTeoria", (deps) => pedirTeoria(deps, entrada))
}

export async function reintentarTeoriaAccion(entrada: unknown) {
  return conSesion("reintentarTeoria", (deps) => reintentarTeoria(deps, entrada))
}

export async function guardarTeoriaAccion(entrada: unknown) {
  return conSesion("guardarTeoria", (deps) => guardarTeoria(deps, entrada))
}
