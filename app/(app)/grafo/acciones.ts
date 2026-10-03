"use server"

import { conSesion } from "@/lib/acciones/servidor"
import { aceptarVinculo, cambiarRelevancia, crearVinculo, descartarVinculo } from "@/lib/ingesta/vinculos"

export async function aceptarVinculoAccion(entrada: unknown) {
  return conSesion("aceptarVinculo", (deps) => aceptarVinculo(deps, entrada))
}

export async function descartarVinculoAccion(entrada: unknown) {
  return conSesion("descartarVinculo", (deps) => descartarVinculo(deps, entrada))
}

export async function cambiarRelevanciaAccion(entrada: unknown) {
  return conSesion("cambiarRelevancia", (deps) => cambiarRelevancia(deps, entrada))
}

export async function crearVinculoAccion(entrada: unknown) {
  return conSesion("crearVinculo", (deps) => crearVinculo(deps, entrada))
}
