"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Boton } from "@/components/ui/boton"
import { proponerAhoraAccion } from "./acciones"

export function BotonProponerAhora() {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pedido, setPedido] = useState(false)

  async function proponer() {
    setCargando(true)
    setError(null)
    setPedido(false)
    const resultado = await proponerAhoraAccion()
    setCargando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    setPedido(true)
    router.refresh()
  }

  return (
    <div className="grid gap-2.5">
      <Boton cargando={cargando} onClick={() => void proponer()}>
        Proponer ahora
      </Boton>
      {pedido ? (
        <output className="block rounded-md bg-ok-fondo p-3.5 text-ok-tinta">
          El motor se puso a trabajar. Las ideas llegan a Conidolly en unos minutos.
        </output>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-md bg-error-fondo p-3.5 text-error-tinta">
          {error}
        </p>
      ) : null}
    </div>
  )
}
