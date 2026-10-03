"use server"

import { conSesion } from "@/lib/acciones/servidor"
import {
  borrarMaterial,
  confirmarCosto,
  editarFicha,
  editarMaterial,
  reintentarMaterial,
  reprocesarMaterial,
} from "@/lib/ingesta/materiales"

export async function reintentarMaterialAccion(entrada: unknown) {
  return conSesion("reintentarMaterial", (deps) => reintentarMaterial(deps, entrada))
}

export async function confirmarCostoAccion(entrada: unknown) {
  return conSesion("confirmarCosto", (deps) => confirmarCosto(deps, entrada))
}

export async function editarFichaAccion(entrada: unknown) {
  return conSesion("editarFicha", (deps) => editarFicha(deps, entrada))
}

export async function borrarMaterialAccion(entrada: unknown) {
  return conSesion("borrarMaterial", (deps) => borrarMaterial(deps, entrada))
}

export async function editarMaterialAccion(entrada: unknown) {
  return conSesion("editarMaterial", (deps) => editarMaterial(deps, entrada))
}

export async function reprocesarMaterialAccion(entrada: unknown) {
  return conSesion("reprocesarMaterial", (deps) => reprocesarMaterial(deps, entrada))
}
