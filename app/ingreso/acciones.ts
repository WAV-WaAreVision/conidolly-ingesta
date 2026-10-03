"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { correoDe, enmascararCorreo, pedirCodigo, type ResultadoIngreso, verificarCodigo } from "@/lib/acciones/ingreso"
import { ERROR_GENERICO } from "@/lib/acciones/resultado"
import { createActionClient } from "@/lib/supabase/action"

const Rol = z.enum(["coni", "wav"])

async function dependencias(rol: unknown) {
  const quien = Rol.parse(rol)
  const db = await createActionClient()
  return { auth: db.auth, correo: correoDe(quien, process.env) }
}

export async function pedirCodigoAccion(
  rol: unknown,
): Promise<{ ok: true; correoEnmascarado: string } | { ok: false; error: string }> {
  try {
    const deps = await dependencias(rol)
    const resultado = await pedirCodigo(deps)
    return resultado.ok ? { ok: true, correoEnmascarado: enmascararCorreo(deps.correo) } : resultado
  } catch (error) {
    // A missing CORREO_* variable is for WAV: it goes to the log and the person gets a plain message.
    console.error("No pude preparar el ingreso", error)
    return { ok: false, error: ERROR_GENERICO }
  }
}

export async function verificarCodigoAccion(rol: unknown, codigo: string): Promise<ResultadoIngreso> {
  let resultado: ResultadoIngreso
  try {
    resultado = await verificarCodigo(await dependencias(rol), codigo)
  } catch (error) {
    console.error("No pude verificar el ingreso", error)
    return { ok: false, error: ERROR_GENERICO }
  }
  if (resultado.ok) redirect("/")
  return resultado
}
