"use server"

import { revalidatePath } from "next/cache"
import { conSesion } from "@/lib/acciones/servidor"
import { dispararMotor } from "@/lib/ingesta/disparo"
import { proponerAhora } from "@/lib/ingesta/semana"

/** Takes no input, so there is nothing to validate: who asks is what the server checks. */
export async function proponerAhoraAccion() {
  const resultado = await conSesion("proponerAhora", (deps) =>
    proponerAhora({ db: deps.db, ahora: deps.ahora, dispararMotor: (semana) => dispararMotor(semana) }),
  )
  if (resultado.ok) revalidatePath("/semana")
  return resultado
}
