"use client"

import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"
import { Boton } from "@/components/ui/boton"
import { borrarAutorAccion } from "../acciones"

interface Propiedades {
  autor: { id: string; nombre: string }
}

export function BorrarAutor({ autor }: Propiedades) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idDelBotonDeAbrir = useId()
  const idDelBotonDeConfirmar = useId()
  const devolverFocoAlCerrar = useRef(false)

  useEffect(() => {
    if (abierto) {
      document.getElementById(idDelBotonDeConfirmar)?.focus()
      return
    }
    if (devolverFocoAlCerrar.current) {
      devolverFocoAlCerrar.current = false
      document.getElementById(idDelBotonDeAbrir)?.focus()
    }
  }, [abierto, idDelBotonDeAbrir, idDelBotonDeConfirmar])

  async function borrar() {
    setCargando(true)
    setError(null)
    const resultado = await borrarAutorAccion({ id: autor.id })
    setCargando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    router.push("/autores")
    router.refresh()
  }

  if (!abierto) {
    return (
      <Boton id={idDelBotonDeAbrir} variante="linea" tamano="chico" className="w-fit" onClick={() => setAbierto(true)}>
        Borrar autor
      </Boton>
    )
  }

  return (
    <section aria-label={`Borrar a ${autor.nombre}`} className="grid gap-3 rounded-lg bg-aviso-fondo p-4">
      <p className="text-aviso-tinta">{`${autor.nombre} deja de existir como autor. No se puede deshacer.`}</p>
      {error ? (
        <p role="alert" className="text-error-tinta">
          {error}
        </p>
      ) : null}
      <Boton id={idDelBotonDeConfirmar} cargando={cargando} onClick={() => void borrar()}>
        Sí, borrar
      </Boton>
      <Boton
        variante="callado"
        deshabilitado={cargando}
        onClick={() => {
          devolverFocoAlCerrar.current = true
          setAbierto(false)
        }}
      >
        Cancelar
      </Boton>
    </section>
  )
}
