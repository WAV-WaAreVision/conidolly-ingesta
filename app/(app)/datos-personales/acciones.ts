"use server"

import { revalidatePath } from "next/cache"
import type { Resultado } from "@/lib/acciones/resultado"
import { conSesion } from "@/lib/acciones/servidor"
import { agregarFila, confirmarPais, guardarFila } from "@/lib/ingesta/datos-personales"

function refrescar<T extends object>(resultado: Resultado<T>): Resultado<T> {
  if (resultado.ok) revalidatePath("/datos-personales")
  return resultado
}

export async function guardarFilaAccion(entrada: unknown) {
  return refrescar(await conSesion("guardarFila", (deps) => guardarFila(deps, entrada)))
}

export async function agregarFilaAccion(entrada: unknown) {
  return refrescar(await conSesion("agregarFila", (deps) => agregarFila(deps, entrada)))
}

export async function confirmarPaisAccion(entrada: unknown) {
  return refrescar(await conSesion("confirmarPais", (deps) => confirmarPais(deps, entrada)))
}
