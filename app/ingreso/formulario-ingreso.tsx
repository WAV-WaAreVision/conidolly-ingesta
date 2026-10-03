"use client"

import { useRef, useState } from "react"
import { CasillasCodigo } from "@/components/casillas-codigo"
import { Boton } from "@/components/ui/boton"
import type { Rol } from "@/lib/acciones/ingreso"
import { pedirCodigoAccion, verificarCodigoAccion } from "./acciones"

export function FormularioIngreso() {
  const [rol, setRol] = useState<Rol | null>(null)
  const [correoEnmascarado, setCorreoEnmascarado] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [vuelta, setVuelta] = useState(0)
  const [codigo, setCodigo] = useState("")
  // Own flags instead of useTransition: React 19 entangles every pending async transition, so a code
  // being re-sent (or any other pending action) kept "pending" true and silently dropped a pasted code.
  const [enviando, setEnviando] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const verificandoAhora = useRef(false)
  const pendiente = enviando || verificando

  async function mandarCodigo(quien: Rol, esReenvio: boolean) {
    setError(null)
    setAviso(null)
    setEnviando(true)
    try {
      const resultado = await pedirCodigoAccion(quien)
      if (!resultado.ok) {
        setError(resultado.error)
        return
      }
      setRol(quien)
      setCorreoEnmascarado(resultado.correoEnmascarado)
      setCodigo("")
      setVuelta((actual) => actual + 1)
      if (esReenvio) setAviso("Te mandé otro código.")
    } finally {
      setEnviando(false)
    }
  }

  async function entrar(quien: Rol, valor: string) {
    if (verificandoAhora.current) return
    verificandoAhora.current = true
    setVerificando(true)
    setError(null)
    try {
      const resultado = await verificarCodigoAccion(quien, valor)
      // On success the action redirects, so reaching this line means the code did not work.
      if (!resultado.ok) {
        setError(resultado.error)
        setCodigo("")
        setVuelta((actual) => actual + 1)
      }
    } finally {
      verificandoAhora.current = false
      setVerificando(false)
    }
  }

  if (rol === null) {
    return (
      <div className="grid gap-5.5">
        <div className="grid gap-2.5">
          <h1 className="font-serif text-display text-balance">¿Quién entra?</h1>
          <p className="text-apagado">Te mando un código al correo de quien eres para que entres.</p>
        </div>
        {error ? <MensajeDeError mensaje={error} /> : null}
        <div className="grid gap-3">
          <Boton cargando={pendiente} onClick={() => mandarCodigo("coni", false)}>
            Soy Coni
          </Boton>
          <Boton variante="linea" cargando={pendiente} onClick={() => mandarCodigo("wav", false)}>
            Soy WAV
          </Boton>
        </div>
      </div>
    )
  }

  return (
    <form
      className="grid gap-5.5"
      onSubmit={(evento) => {
        evento.preventDefault()
        if (codigo.length === 6) entrar(rol, codigo)
      }}
    >
      <div className="grid gap-2.5">
        <h1 className="font-serif text-display text-balance">Entra con el código que te mandé</h1>
        <p className="text-apagado">
          Lo envié a {correoEnmascarado}. Vence en 1 hora. Si no llega, mira la carpeta de spam.
        </p>
      </div>
      <CasillasCodigo
        key={vuelta}
        alCambiar={setCodigo}
        alCompletar={(valor) => {
          setCodigo(valor)
          entrar(rol, valor)
        }}
        invalido={error !== null}
        deshabilitado={verificando}
      />
      {error ? <MensajeDeError mensaje={error} /> : null}
      {aviso && !error ? (
        <output className="rounded-md bg-ok-fondo p-3.5 text-[1rem] text-ok-tinta">{aviso}</output>
      ) : null}
      <div className="grid gap-1">
        <Boton type="submit" cargando={pendiente} deshabilitado={codigo.length < 6}>
          Entrar
        </Boton>
        <Boton variante="callado" onClick={() => mandarCodigo(rol, true)} cargando={pendiente}>
          Mandar otro código
        </Boton>
        <Boton variante="callado" onClick={() => setRol(null)} deshabilitado={pendiente}>
          Cambiar de persona
        </Boton>
      </div>
    </form>
  )
}

function MensajeDeError({ mensaje }: { mensaje: string }) {
  return (
    <p role="alert" className="rounded-md bg-error-fondo p-3.5 text-[1rem] text-error-tinta">
      {mensaje}
    </p>
  )
}
