"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Boton } from "@/components/ui/boton"
import { borrarMaterialAccion } from "../acciones"

export function BorrarMaterial({ materialId }: { materialId: string }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function borrar() {
    setBorrando(true)
    setError(null)
    const resultado = await borrarMaterialAccion({ materialId })
    if (!resultado.ok) {
      setBorrando(false)
      setError(resultado.error)
      return
    }
    router.push("/")
  }

  if (!confirmando) {
    return (
      <Boton variante="linea" onClick={() => setConfirmando(true)}>
        Borrar material
      </Boton>
    )
  }

  return (
    <section aria-label="Confirmar el borrado" className="grid gap-3 rounded-lg bg-error-fondo p-4">
      <p className="text-error-tinta">
        ¿Borrar este material? Se borran también la ficha y los archivos. No se puede deshacer.
      </p>
      {error ? (
        <p role="alert" className="text-error-tinta">
          {error}
        </p>
      ) : null}
      <Boton cargando={borrando} onClick={borrar}>
        Sí, borrar
      </Boton>
      <Boton variante="callado" deshabilitado={borrando} onClick={() => setConfirmando(false)}>
        Cancelar
      </Boton>
    </section>
  )
}
