"use client"

import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"
import { Campo, CLASES_DE_CAMPO } from "@/components/campo"
import { Boton } from "@/components/ui/boton"
import { fusionarAutoresAccion } from "../acciones"

interface Propiedades {
  origen: { id: string; nombre: string }
  otros: { id: string; nombre: string }[]
}

export function UnirAutores({ origen, otros }: Propiedades) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [destino, setDestino] = useState("")
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idDelBotonDeAbrir = useId()
  const selectorDeDestino = useRef<HTMLSelectElement>(null)
  const devolverFocoAlCerrar = useRef(false)

  useEffect(() => {
    if (abierto) {
      selectorDeDestino.current?.focus()
      return
    }
    if (devolverFocoAlCerrar.current) {
      devolverFocoAlCerrar.current = false
      document.getElementById(idDelBotonDeAbrir)?.focus()
    }
  }, [abierto, idDelBotonDeAbrir])

  async function unir() {
    if (destino === "") {
      setError("Elige con qué autor unirlo.")
      return
    }
    setCargando(true)
    setError(null)
    const resultado = await fusionarAutoresAccion({ origen: origen.id, destino })
    setCargando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    router.push(`/autores/${destino}`)
  }

  if (!abierto) {
    return (
      <Boton id={idDelBotonDeAbrir} variante="linea" onClick={() => setAbierto(true)}>
        Unir con otro autor
      </Boton>
    )
  }

  return (
    <section aria-label="Unir autores" className="grid gap-3 rounded-lg bg-aviso-fondo p-4">
      <p className="text-aviso-tinta">
        {`Sus materiales y afirmaciones pasan al otro autor y ${origen.nombre} deja de existir como autor. No se puede deshacer.`}
      </p>
      <Campo id="unir-destino" etiqueta="Unir con">
        <select
          id="unir-destino"
          ref={selectorDeDestino}
          value={destino}
          onChange={(evento) => setDestino(evento.target.value)}
          className={CLASES_DE_CAMPO}
        >
          <option value="">Elige un autor</option>
          {otros.map((otro) => (
            <option key={otro.id} value={otro.id}>
              {otro.nombre}
            </option>
          ))}
        </select>
      </Campo>
      {error ? (
        <p role="alert" className="text-error-tinta">
          {error}
        </p>
      ) : null}
      <Boton cargando={cargando} onClick={() => void unir()}>
        Sí, unir
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
