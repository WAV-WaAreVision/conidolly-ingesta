"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Boton } from "@/components/ui/boton"
import { reintentarTeoriaAccion } from "./acciones"

export function BotonReintentarTeoria({ teoriaId }: { teoriaId: string }) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reintentar() {
    setCargando(true)
    setError(null)
    const resultado = await reintentarTeoriaAccion({ teoriaId })
    setCargando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="grid gap-2">
      <Boton variante="linea" tamano="chico" cargando={cargando} onClick={reintentar} className="w-fit">
        Reintentar
      </Boton>
      {error ? (
        <p role="alert" className="rounded-md bg-error-fondo p-3.5 text-[1rem] text-error-tinta">
          {error}
        </p>
      ) : null}
    </div>
  )
}
