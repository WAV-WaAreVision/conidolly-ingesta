"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Boton } from "@/components/ui/boton"
import { excluirAfirmacionAccion } from "./acciones"

export function BotonOcultar({ afirmacionId, oculta }: { afirmacionId: string; oculta: boolean }) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cambiar() {
    setCargando(true)
    setError(null)
    const resultado = await excluirAfirmacionAccion({ id: afirmacionId, excluida: !oculta })
    setCargando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="grid gap-1.5">
      <Boton variante="callado" tamano="chico" className="w-fit" cargando={cargando} onClick={() => void cambiar()}>
        {oculta ? "Mostrar" : "Ocultar"}
      </Boton>
      {error ? (
        <p role="alert" className="text-meta text-error-tinta">
          {error}
        </p>
      ) : null}
    </div>
  )
}
