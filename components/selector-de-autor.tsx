"use client"

import { useState } from "react"
import { Campo, CLASES_DE_CAMPO } from "@/components/campo"
import { Boton } from "@/components/ui/boton"
import type { Resultado } from "@/lib/acciones/resultado"
import { type AutorDeLista, autoresParecidos, buscarAutores } from "@/lib/ingesta/buscar-autor"

interface AutorNuevo {
  nombre: string
  credencial: string
  tipo: string
}

interface Propiedades {
  autores: AutorDeLista[]
  /** The id of the picked author, "" while there is none. */
  valor: string
  alElegir: (id: string) => void
  alCrear: (datos: AutorNuevo) => Promise<Resultado<{ autor: AutorDeLista }>>
}

const MAXIMO_DE_RESULTADOS = 6
const TIPOS_DE_AUTOR_NUEVO = [
  ["persona", "Persona"],
  ["cuenta", "Cuenta de redes"],
  ["institucion", "Institución"],
] as const

/** A Enter inside these fields must not send the form that contains them. */
const sinEnviar = (evento: { key: string; preventDefault: () => void }) => {
  if (evento.key === "Enter") evento.preventDefault()
}

const descripcion = (autor: AutorDeLista) => (autor.credencial ? `${autor.nombre}, ${autor.credencial}` : autor.nombre)

/** Search an author by name or alias, or add one; the form that holds it only ever sees the picked id. */
export function SelectorDeAutor({ autores: iniciales, valor, alElegir, alCrear }: Propiedades) {
  const [autores, setAutores] = useState(iniciales)
  const [texto, setTexto] = useState("")
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState("")
  const [credencial, setCredencial] = useState("")
  const [tipo, setTipo] = useState("persona")
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [cambiando, setCambiando] = useState(false)

  const elegido = autores.find((autor) => autor.id === valor)

  function elegir(id: string) {
    setCambiando(false)
    setCreando(false)
    setError(null)
    alElegir(id)
  }

  function empezarNuevo() {
    setNombre(texto.trim())
    setCredencial("")
    setTipo("persona")
    setError(null)
    setCreando(true)
  }

  async function crear() {
    setError(null)
    setGuardando(true)
    const resultado = await alCrear({ nombre, credencial, tipo })
    setGuardando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    const { autor } = resultado
    setAutores((actuales) => (actuales.some((actual) => actual.id === autor.id) ? actuales : [...actuales, autor]))
    setTexto("")
    elegir(autor.id)
  }

  if (elegido && !cambiando) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-acento bg-acento-suave p-3.5">
        <p className="grid text-label">
          <span className="font-semibold text-acento-profundo">{elegido.nombre}</span>
          {elegido.credencial ? <span className="text-meta text-apagado">{elegido.credencial}</span> : null}
        </p>
        <Boton variante="callado" tamano="chico" onClick={() => setCambiando(true)} aria-label="Cambiar autor">
          Cambiar
        </Boton>
      </div>
    )
  }

  if (creando) {
    const parecidos = autoresParecidos(autores, nombre)
    return (
      <div className="grid gap-3 rounded-md bg-hundido p-3.5">
        <Campo id="autor-nombre" etiqueta="Nombre del autor" ayuda="Ej: Esther Perel, @cuenta o Instituto Gottman">
          <input
            id="autor-nombre"
            type="text"
            autoComplete="off"
            value={nombre}
            aria-describedby="autor-nombre-ayuda"
            onKeyDown={sinEnviar}
            onChange={(evento) => setNombre(evento.target.value)}
            className={CLASES_DE_CAMPO}
          />
        </Campo>
        {parecidos.map((parecido) => (
          <div key={parecido.id} className="grid gap-2 rounded-md bg-aviso-fondo p-3">
            <p className="text-aviso-tinta">¿Es el mismo autor que {parecido.nombre}?</p>
            <Boton variante="linea" tamano="chico" onClick={() => elegir(parecido.id)}>
              Sí, es {parecido.nombre}
            </Boton>
          </div>
        ))}
        <Campo
          id="autor-credencial"
          etiqueta={
            <>
              Credencial <span className="font-normal text-apagado">(opcional)</span>
            </>
          }
          ayuda="Ej: Psicoterapeuta de parejas"
        >
          <input
            id="autor-credencial"
            type="text"
            autoComplete="off"
            value={credencial}
            aria-describedby="autor-credencial-ayuda"
            onKeyDown={sinEnviar}
            onChange={(evento) => setCredencial(evento.target.value)}
            className={CLASES_DE_CAMPO}
          />
        </Campo>
        <Campo id="autor-tipo" etiqueta="Tipo de autor">
          <select
            id="autor-tipo"
            value={tipo}
            onChange={(evento) => setTipo(evento.target.value)}
            className={CLASES_DE_CAMPO}
          >
            {TIPOS_DE_AUTOR_NUEVO.map(([valorDeTipo, etiqueta]) => (
              <option key={valorDeTipo} value={valorDeTipo}>
                {etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        {error ? (
          <p role="alert" className="rounded-md bg-error-fondo p-3.5 text-[1rem] text-error-tinta">
            {error}
          </p>
        ) : null}
        <Boton variante="linea" cargando={guardando} onClick={() => void crear()}>
          Crear autor
        </Boton>
        <Boton variante="callado" deshabilitado={guardando} onClick={() => setCreando(false)}>
          Volver a buscar
        </Boton>
      </div>
    )
  }

  const encontrados = buscarAutores(autores, texto)
  return (
    <div className="grid gap-3">
      <Campo id="autor-busqueda" etiqueta="Autor" ayuda="Busca por nombre o alias.">
        <input
          id="autor-busqueda"
          type="search"
          autoComplete="off"
          value={texto}
          aria-describedby="autor-busqueda-ayuda"
          onKeyDown={sinEnviar}
          onChange={(evento) => setTexto(evento.target.value)}
          className={CLASES_DE_CAMPO}
        />
      </Campo>
      {encontrados.length === 0 ? (
        <p className="text-apagado">Nadie se llama así todavía.</p>
      ) : (
        <ul className="grid gap-2">
          {encontrados.slice(0, MAXIMO_DE_RESULTADOS).map((autor) => (
            <li key={autor.id}>
              <button
                type="button"
                onClick={() => elegir(autor.id)}
                aria-label={descripcion(autor)}
                className="grid min-h-13 w-full content-center gap-0.5 rounded-md border border-linea bg-superficie px-3.5 py-2.5 text-left focus-visible:outline-3 focus-visible:outline-acento"
              >
                <span className="font-semibold">{autor.nombre}</span>
                {autor.credencial ? <span className="text-meta text-apagado">{autor.credencial}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {encontrados.length > MAXIMO_DE_RESULTADOS ? (
        <p className="text-meta text-apagado">Escribe más del nombre para ver el resto.</p>
      ) : null}
      <Boton variante="linea" onClick={empezarNuevo}>
        Autor nuevo
      </Boton>
    </div>
  )
}
