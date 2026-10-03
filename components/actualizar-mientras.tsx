"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

const CADA_MS = 10_000

/** Asks the server for the page again (every 10 seconds unless `cadaMs` says otherwise) while `activo`; once the page says it is not, it stops. */
export function ActualizarMientras({ activo, cadaMs = CADA_MS }: { activo: boolean; cadaMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    if (!activo) return
    const temporizador = setInterval(() => router.refresh(), cadaMs)
    return () => clearInterval(temporizador)
  }, [activo, cadaMs, router])
  return null
}
