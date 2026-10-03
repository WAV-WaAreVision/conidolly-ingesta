"use server"

import { redirect } from "next/navigation"
import { createActionClient } from "@/lib/supabase/action"

export async function cerrarSesionAccion(): Promise<void> {
  const db = await createActionClient()
  await db.auth.signOut()
  redirect("/ingreso")
}
