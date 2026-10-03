"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Boton } from "@/components/ui/boton"
import { reprocesarMaterialAccion } from "../acciones"

export function BotonReprocesar({ materialId }: { materialId: string }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reprocesar() {
    setCargando(true)
    setError(null)
    const resultado = await reprocesarMaterialAccion({ materialId })
    setCargando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    setConfirmando(false)
    router.refresh()
  }

  if (!confirmando) {
    return (
      <Boton variante="linea" onClick={() => setConfirmando(true)}>
        Reprocesar
      </Boton>
    )
  }

  return (
    <section aria-label="Confirmar el reprocesado" className="grid gap-3 rounded-lg bg-aviso-fondo p-4">
      <p className="text-aviso-tinta">
        Reprocesar cuesta más o menos lo mismo que la primera vez. Se borran las afirmaciones de este material y se
        vuelven a sacar.
      </p>
      {error ? (
        <p role="alert" className="text-error-tinta">
          {error}
        </p>
      ) : null}
      <Boton cargando={cargando} onClick={() => void reprocesar()}>
        Sí, reprocesar
      </Boton>
      <Boton variante="callado" deshabilitado={cargando} onClick={() => setConfirmando(false)}>
        Cancelar
      </Boton>
    </section>
  )
}
