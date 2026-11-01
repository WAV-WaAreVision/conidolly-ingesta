"use client"

import { useRouter } from "next/navigation"
import { type FormEvent, useId, useState } from "react"
import { Campo, CLASES_DE_CAMPO } from "@/components/campo"
import { Boton } from "@/components/ui/boton"
import type { FilaDelRegistro } from "@/lib/ingesta/datos-personales"
import { agregarFilaAccion, confirmarPaisAccion, guardarFilaAccion } from "./acciones"

function leer(datos: FormData, nombre: string): string {
  const valor = datos.get(nombre)
  return typeof valor === "string" ? valor : ""
}

/** The editable fields as the actions validate them: the days are a number, or null when left empty. */
function camposDe(datos: FormData) {
  const dias = leer(datos, "plazo_dias").trim()
  return {
    dato: leer(datos, "dato"),
    para_que: leer(datos, "para_que"),
    proveedor: leer(datos, "proveedor"),
    pais: leer(datos, "pais"),
    plazo: leer(datos, "plazo"),
    plazo_dias: dias === "" ? null : Number(dias),
    orden: Number(leer(datos, "orden")),
  }
}

/** One row of the register for WAV: correct it or confirm its country; without `fila`, add a new one. */
export function EditorDeFila({ fila }: { fila?: FilaDelRegistro }) {
  const router = useRouter()
  const prefijo = useId()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [paisEscrito, setPaisEscrito] = useState(fila?.pais ?? "")
  const id = (campo: string) => `${prefijo}-${campo}`
  // Confirming applies to the stored country: one typed over it and not saved yet would be confirmed unseen.
  const paisSinGuardar = fila !== undefined && paisEscrito.trim() !== fila.pais
  const descripcionDeConfirmar = paisSinGuardar ? `${id("clave-fila")} ${id("pais-sin-guardar")}` : id("clave-fila")

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const formulario = evento.currentTarget
    const datos = new FormData(formulario)
    setCargando(true)
    setError(null)
    setGuardado(false)
    const resultado = fila
      ? await guardarFilaAccion({ id: fila.id, ...camposDe(datos) })
      : await agregarFilaAccion({ clave: leer(datos, "clave"), ...camposDe(datos) })
    setCargando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    if (!fila) formulario.reset()
    setGuardado(true)
    router.refresh()
  }

  async function confirmar(filaId: string) {
    setConfirmando(true)
    setError(null)
    setGuardado(false)
    const resultado = await confirmarPaisAccion({ id: filaId })
    setConfirmando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    router.refresh()
  }

  return (
    <form
      onSubmit={(evento) => void enviar(evento)}
      aria-label={fila ? fila.dato : "Fila nueva"}
      className="grid gap-3 rounded-lg border border-linea bg-superficie p-4"
    >
      {fila ? (
        <p id={id("clave-fila")} className="text-meta text-apagado">
          {fila.regla_de_borrado ? `${fila.clave} · la app lo borra sola (regla ${fila.regla_de_borrado})` : fila.clave}
        </p>
      ) : (
        <Campo
          id={id("clave")}
          etiqueta="Clave"
          ayuda="En minúsculas y con guiones bajos, por ejemplo comentarios_de_riesgo. No cambia después."
        >
          <input
            id={id("clave")}
            name="clave"
            required
            aria-describedby={`${id("clave")}-ayuda`}
            className={CLASES_DE_CAMPO}
          />
        </Campo>
      )}
      <Campo id={id("dato")} etiqueta="Dato">
        <input id={id("dato")} name="dato" defaultValue={fila?.dato} className={CLASES_DE_CAMPO} />
      </Campo>
      <Campo id={id("para_que")} etiqueta="Para qué">
        <textarea
          id={id("para_que")}
          name="para_que"
          rows={2}
          defaultValue={fila?.para_que}
          className={CLASES_DE_CAMPO}
        />
      </Campo>
      <Campo id={id("proveedor")} etiqueta="Proveedor">
        <input id={id("proveedor")} name="proveedor" defaultValue={fila?.proveedor} className={CLASES_DE_CAMPO} />
      </Campo>
      <Campo id={id("pais")} etiqueta="País">
        <input
          id={id("pais")}
          name="pais"
          defaultValue={fila?.pais}
          onChange={(evento) => setPaisEscrito(evento.target.value)}
          className={CLASES_DE_CAMPO}
        />
      </Campo>
      <p className="text-meta text-apagado">{fila?.pais_confirmado ? "País confirmado." : "País por confirmar."}</p>
      <Campo id={id("plazo")} etiqueta="Plazo en palabras">
        <input id={id("plazo")} name="plazo" defaultValue={fila?.plazo} className={CLASES_DE_CAMPO} />
      </Campo>
      <Campo id={id("plazo_dias")} etiqueta="Plazo en días (si la app lo borra sola)">
        <input
          id={id("plazo_dias")}
          name="plazo_dias"
          type="number"
          min={0}
          inputMode="numeric"
          defaultValue={fila?.plazo_dias ?? ""}
          className={CLASES_DE_CAMPO}
        />
      </Campo>
      <Campo id={id("orden")} etiqueta="Orden">
        <input
          id={id("orden")}
          name="orden"
          type="number"
          min={0}
          max={999}
          inputMode="numeric"
          defaultValue={fila?.orden ?? 100}
          className={CLASES_DE_CAMPO}
        />
      </Campo>
      {error ? (
        <p role="alert" className="text-meta text-error-tinta">
          {error}
        </p>
      ) : null}
      {/* Always in the page, so a screen reader hears every change of its text, the second save included. */}
      <output className="text-meta text-apagado">{guardado ? (fila ? "Guardado." : "Fila agregada.") : ""}</output>
      <Boton type="submit" variante="linea" cargando={cargando} aria-describedby={fila ? id("clave-fila") : undefined}>
        {fila ? "Guardar" : "Agregar fila"}
      </Boton>
      {fila && !fila.pais_confirmado ? (
        <>
          <Boton
            variante="callado"
            tamano="chico"
            cargando={confirmando}
            deshabilitado={paisSinGuardar}
            aria-describedby={descripcionDeConfirmar}
            onClick={() => void confirmar(fila.id)}
          >
            Confirmar país
          </Boton>
          {paisSinGuardar ? (
            <p id={id("pais-sin-guardar")} className="text-meta text-apagado">
              Guarda el país antes de confirmarlo.
            </p>
          ) : null}
        </>
      ) : null}
    </form>
  )
}
