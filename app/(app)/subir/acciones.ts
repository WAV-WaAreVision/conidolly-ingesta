"use server"

import { conSesion } from "@/lib/acciones/servidor"
import { crearAutor } from "@/lib/ingesta/autores"
import { confirmarMaterial, crearMaterial, descartarMaterial } from "@/lib/ingesta/subir"

export async function crearMaterialAccion(entrada: unknown) {
  return conSesion("crearMaterial", (deps) => crearMaterial(deps, entrada))
}

export async function confirmarMaterialAccion(entrada: unknown) {
  return conSesion("confirmarMaterial", (deps) => confirmarMaterial(deps, entrada))
}

export async function descartarMaterialAccion(entrada: unknown) {
  return conSesion("descartarMaterial", (deps) => descartarMaterial(deps, entrada))
}

export async function crearAutorAccion(entrada: unknown) {
  return conSesion("crearAutor", (deps) => crearAutor(deps, entrada))
}
