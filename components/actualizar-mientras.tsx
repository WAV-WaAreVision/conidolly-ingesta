"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

const CADA_MS = 10_000

/** Asks the server for the page again every 10 seconds while `activo`; once the page says it is not, it stops. */
export function ActualizarMientras({ activo }: { activo: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (!activo) return
    const temporizador = setInterval(() => router.refresh(), CADA_MS)
    return () => clearInterval(temporizador)
  }, [activo, router])
  return null
}
