"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Boton } from "@/components/ui/boton"
import { confirmarCostoAccion } from "./acciones"

const formatoUsd = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function BotonConfirmarCosto({ materialId, costoUsd }: { materialId: string; costoUsd: number }) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmar() {
    setCargando(true)
    setError(null)
    const resultado = await confirmarCostoAccion({ materialId })
    setCargando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="grid gap-2">
      <Boton variante="linea" tamano="chico" cargando={cargando} onClick={confirmar} className="w-fit">
        Procesar por ~US$ {formatoUsd.format(costoUsd)}
      </Boton>
      {error ? (
        <p role="alert" className="rounded-md bg-error-fondo p-3.5 text-[1rem] text-error-tinta">
          {error}
        </p>
      ) : null}
    </div>
  )
}
