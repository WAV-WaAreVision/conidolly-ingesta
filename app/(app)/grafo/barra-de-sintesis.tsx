"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { pedirTeoriaAccion } from "@/app/(app)/teorias/acciones"
import { Boton } from "@/components/ui/boton"
import { MINIMO_PARA_SINTETIZAR, puedeSintetizar } from "@/lib/ingesta/seleccion"

/** The count of the materials chosen and the button that weaves them into a theory. */
export function BarraDeSintesis({ seleccionados, alCancelar }: { seleccionados: string[]; alCancelar: () => void }) {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listo = puedeSintetizar(seleccionados.length)

  async function sintetizar() {
    if (!listo) return
    setCargando(true)
    setError(null)
    const resultado = await pedirTeoriaAccion({ materialIds: seleccionados })
    if (!resultado.ok) {
      setCargando(false)
      setError(resultado.error)
      return
    }
    router.push(`/teorias/${resultado.teoriaId}`)
  }

  return (
    <div className="grid gap-2.5 rounded-md bg-acento-suave p-3.5">
      <p className="text-meta">
        {listo
          ? `${seleccionados.length} materiales elegidos.`
          : `Elige al menos ${MINIMO_PARA_SINTETIZAR} materiales (llevas ${seleccionados.length}).`}
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Boton tamano="chico" deshabilitado={!listo} cargando={cargando} onClick={sintetizar}>
          Sintetizar
        </Boton>
        <Boton variante="callado" tamano="chico" onClick={alCancelar}>
          Cancelar
        </Boton>
      </div>
      {error ? (
        <p role="alert" className="rounded-md bg-error-fondo p-3.5 text-[1rem] text-error-tinta">
          {error}
        </p>
      ) : null}
    </div>
  )
}
