"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Campo, CLASES_DE_CAMPO } from "@/components/campo"
import { SelectorDeAutor } from "@/components/selector-de-autor"
import { Boton } from "@/components/ui/boton"
import type { AutorDeLista } from "@/lib/ingesta/buscar-autor"
import {
  AYUDA_DE_ROL,
  ETIQUETA_DE_ROL,
  leerEntrada,
  MAXIMO_DE_IMAGENES,
  ROLES,
  type Rol,
  TAMANO_MAXIMO_BYTES,
  TIPOS_DE_MATERIAL,
  type TipoDeMaterial,
} from "@/lib/ingesta/modelo"
import { subirArchivos } from "@/lib/ingesta/subida-cliente"
import { cn } from "@/lib/utils"
import { confirmarMaterialAccion, crearAutorAccion, crearMaterialAccion, descartarMaterialAccion } from "./acciones"

const NOMBRE_DE_TIPO: Record<TipoDeMaterial, string> = {
  documento: "Documento",
  link: "Link",
  audio: "Audio",
  video: "Video",
  imagen: "Imagen",
  post: "Post",
}

/** What the file picker offers for each type that takes a file; the server checks the extension again. */
const ACEPTA: Record<"documento" | "audio" | "video" | "imagen", string> = {
  documento: ".pdf,.docx,.txt",
  audio: ".mp3,.m4a,.wav",
  video: ".mp4,.mov",
  imagen: ".jpg,.jpeg,.png,.webp,.heic",
}

const PESA_DEMASIADO = "Ese archivo pesa más de 2 GB."

export function FormularioSubida({ autores }: { autores: AutorDeLista[] }) {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoDeMaterial>("documento")
  const [archivos, setArchivos] = useState<File[]>([])
  const [titulo, setTitulo] = useState("")
  const [autorId, setAutorId] = useState("")
  const [rol, setRol] = useState<Rol | "">("")
  const [referencia, setReferencia] = useState("")
  const [url, setUrl] = useState("")
  const [textoPegado, setTextoPegado] = useState("")
  const [declaracion, setDeclaracion] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progreso, setProgreso] = useState<string | null>(null)

  const ocupado = progreso !== null
  const esImagen = tipo === "imagen"
  const tomaArchivo =
    tipo === "documento" || tipo === "audio" || tipo === "video" || tipo === "imagen" || tipo === "post"
  const conReferencia = tipo === "video" || tipo === "imagen"

  const miniaturas = useMemo(
    () => (esImagen ? archivos.map((archivo) => URL.createObjectURL(archivo)) : []),
    [archivos, esImagen],
  )
  useEffect(
    () => () => {
      for (const miniatura of miniaturas) URL.revokeObjectURL(miniatura)
    },
    [miniaturas],
  )

  function cambiarTipo(nuevo: TipoDeMaterial) {
    setTipo(nuevo)
    setArchivos([])
    setError(null)
  }

  function elegirArchivos(elegidos: File[]) {
    setError(null)
    const cabenEnElCupo = elegidos.filter((archivo) => archivo.size <= TAMANO_MAXIMO_BYTES)
    if (cabenEnElCupo.length < elegidos.length) setError(PESA_DEMASIADO)
    if (!esImagen) {
      setArchivos(cabenEnElCupo.slice(0, 1))
      return
    }
    const juntas = [...archivos, ...cabenEnElCupo]
    if (juntas.length > MAXIMO_DE_IMAGENES) setError(`Puedes subir hasta ${MAXIMO_DE_IMAGENES} imágenes.`)
    setArchivos(juntas.slice(0, MAXIMO_DE_IMAGENES))
  }

  function mover(indice: number, hacia: -1 | 1) {
    const destino = indice + hacia
    if (destino < 0 || destino >= archivos.length) return
    const siguientes = [...archivos]
    const [movida] = siguientes.splice(indice, 1)
    if (movida) siguientes.splice(destino, 0, movida)
    setArchivos(siguientes)
  }

  function quitar(indice: number) {
    setArchivos(archivos.filter((_, posicion) => posicion !== indice))
  }

  async function subir() {
    setError(null)
    const entrada = {
      tipo,
      titulo,
      autorId,
      rol,
      declaracion,
      url: tipo === "link" ? url : "",
      textoPegado: tipo === "post" ? textoPegado : "",
      referencia: conReferencia ? referencia : "",
      archivos: archivos.map((archivo) => ({ nombre: archivo.name, tamano: archivo.size })),
    }
    const lectura = leerEntrada(entrada)
    if (!lectura.ok) {
      setError(lectura.error)
      return
    }

    setProgreso("Preparando…")
    const creado = await crearMaterialAccion(entrada)
    if (!creado.ok) {
      setError(creado.error)
      setProgreso(null)
      return
    }
    try {
      await subirArchivos({
        subidas: creado.subidas,
        archivos,
        alAvanzar: (hechos, total) =>
          setProgreso(total === 0 ? "Guardando…" : `Subiendo ${Math.min(hechos + 1, total)} de ${total}`),
      })
    } catch (falla) {
      // The row was created before the upload: a failed upload must not leave a material that will never have its file.
      await descartarMaterialAccion({ materialId: creado.materialId })
      setError(falla instanceof Error ? falla.message : "No pude subir el archivo. Inténtalo de nuevo.")
      setProgreso(null)
      return
    }
    setProgreso("Guardando…")
    const confirmado = await confirmarMaterialAccion({ materialId: creado.materialId })
    if (!confirmado.ok) {
      setError(confirmado.error)
      setProgreso(null)
      return
    }
    router.push("/")
  }

  return (
    <main className="mx-auto grid w-full max-w-[560px] content-start gap-5.5 px-4.5 pt-[max(2rem,env(safe-area-inset-top))] pb-10">
      <h1 className="font-serif text-display text-balance">Subir material</h1>
      <form
        noValidate
        className="grid gap-5.5"
        onSubmit={(evento) => {
          evento.preventDefault()
          if (!ocupado) void subir()
        }}
      >
        <div role="radiogroup" aria-label="Tipo de material" className="grid grid-cols-3 gap-2">
          {TIPOS_DE_MATERIAL.map((opcion) => (
            <label
              key={opcion}
              className={cn(
                "flex min-h-13 cursor-pointer items-center justify-center rounded-md border border-linea bg-superficie px-2 text-center text-label font-semibold",
                "has-checked:border-acento has-checked:bg-acento-suave has-checked:text-acento-profundo has-focus-visible:outline-3 has-focus-visible:outline-acento",
              )}
            >
              <input
                type="radio"
                name="tipo"
                value={opcion}
                checked={tipo === opcion}
                onChange={() => cambiarTipo(opcion)}
                className="sr-only"
              />
              {NOMBRE_DE_TIPO[opcion]}
            </label>
          ))}
        </div>

        {tipo === "link" ? (
          <Campo id="url" etiqueta="Dirección del link">
            <input
              id="url"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://"
              value={url}
              onChange={(evento) => setUrl(evento.target.value)}
              className={CLASES_DE_CAMPO}
            />
          </Campo>
        ) : null}

        {tipo === "post" ? (
          <Campo id="texto" etiqueta="Texto del post">
            <textarea
              id="texto"
              rows={6}
              value={textoPegado}
              onChange={(evento) => setTextoPegado(evento.target.value)}
              className={cn(CLASES_DE_CAMPO, "min-h-40 resize-y")}
            />
          </Campo>
        ) : null}

        {tomaArchivo ? (
          <Campo
            id="archivo"
            etiqueta={esImagen ? "Imágenes" : tipo === "post" ? "Video (opcional)" : "Archivo"}
            ayuda={esImagen ? `Hasta ${MAXIMO_DE_IMAGENES}. Puedes cambiar el orden.` : "Hasta 2 GB."}
          >
            <input
              key={tipo}
              id="archivo"
              type="file"
              multiple={esImagen}
              accept={tipo === "post" ? ACEPTA.video : ACEPTA[tipo as keyof typeof ACEPTA]}
              aria-describedby="archivo-ayuda"
              onChange={(evento) => {
                elegirArchivos(Array.from(evento.target.files ?? []))
                evento.target.value = ""
              }}
              className="min-h-13 w-full rounded-md border border-dashed border-linea bg-superficie p-3 text-label"
            />
          </Campo>
        ) : null}

        {esImagen ? (
          <ol className="grid grid-cols-2 gap-3">
            {archivos.map((archivo, indice) => (
              <li
                // The key is the position: the list is reordered by hand and the same file may repeat.
                key={`${indice}-${archivo.name}`}
                data-nombre={archivo.name}
                className="grid gap-1.5 rounded-md border border-linea bg-superficie p-2"
              >
                {/* biome-ignore lint/performance/noImgElement: a blob preview of a picked file, nothing to optimize */}
                <img
                  src={miniaturas[indice]}
                  alt={`Imagen ${indice + 1}`}
                  className="aspect-square w-full rounded-sm object-cover"
                />
                <div className="flex gap-1">
                  <Boton
                    variante="linea"
                    tamano="chico"
                    aria-label={`Mover la imagen ${indice + 1} antes`}
                    deshabilitado={indice === 0 || ocupado}
                    onClick={() => mover(indice, -1)}
                    className="flex-1"
                  >
                    ←
                  </Boton>
                  <Boton
                    variante="linea"
                    tamano="chico"
                    aria-label={`Mover la imagen ${indice + 1} después`}
                    deshabilitado={indice === archivos.length - 1 || ocupado}
                    onClick={() => mover(indice, 1)}
                    className="flex-1"
                  >
                    →
                  </Boton>
                  <Boton
                    variante="callado"
                    tamano="chico"
                    aria-label={`Quitar la imagen ${indice + 1}`}
                    deshabilitado={ocupado}
                    onClick={() => quitar(indice)}
                  >
                    Quitar
                  </Boton>
                </div>
              </li>
            ))}
          </ol>
        ) : archivos[0] ? (
          <p className="rounded-md bg-hundido p-3 text-label">{archivos[0].name}</p>
        ) : null}

        <Campo
          id="titulo"
          etiqueta={
            <>
              Título <span className="font-normal text-apagado">(opcional)</span>
            </>
          }
        >
          <input
            id="titulo"
            type="text"
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
            className={CLASES_DE_CAMPO}
          />
        </Campo>

        <SelectorDeAutor
          autores={autores}
          valor={autorId}
          alElegir={(id) => {
            setAutorId(id)
            setError(null)
          }}
          alCrear={crearAutorAccion}
        />

        <div role="radiogroup" aria-label="Papel del material" className="grid gap-2">
          {ROLES.map((opcion) => (
            <label
              key={opcion}
              className={cn(
                "grid cursor-pointer gap-0.5 rounded-md border border-linea bg-superficie p-3.5",
                "has-checked:border-acento has-checked:bg-acento-suave has-focus-visible:outline-3 has-focus-visible:outline-acento",
              )}
            >
              <input
                type="radio"
                name="rol"
                value={opcion}
                checked={rol === opcion}
                onChange={() => {
                  setRol(opcion)
                  // What Coni says is by Coni: the seeded author is the obvious pick while none is chosen.
                  if (opcion === "voz_propia" && autorId === "") {
                    setAutorId(autores.find((autor) => autor.tipo === "coni")?.id ?? "")
                  }
                  setError(null)
                }}
                className="sr-only"
              />
              <span className="text-label font-semibold">{ETIQUETA_DE_ROL[opcion]}</span>
              <span className="text-meta text-apagado">{AYUDA_DE_ROL[opcion]}</span>
            </label>
          ))}
        </div>

        {conReferencia ? (
          <Campo id="referencia" etiqueta="Link de referencia (no se abre)">
            <input
              id="referencia"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://"
              value={referencia}
              onChange={(evento) => setReferencia(evento.target.value)}
              className={CLASES_DE_CAMPO}
            />
          </Campo>
        ) : null}

        <label className="flex items-start gap-3 text-body">
          <input
            type="checkbox"
            checked={declaracion}
            onChange={(evento) => setDeclaracion(evento.target.checked)}
            className="mt-1 size-5 shrink-0 accent-acento"
          />
          <span>Este material no contiene datos de pacientes</span>
        </label>

        {error ? (
          <p role="alert" className="rounded-md bg-error-fondo p-3.5 text-[1rem] text-error-tinta">
            {error}
          </p>
        ) : null}
        {progreso ? <output className="rounded-md bg-hundido p-3.5 text-[1rem] text-tinta">{progreso}</output> : null}

        <Boton type="submit" cargando={ocupado}>
          Subir material
        </Boton>
      </form>
    </main>
  )
}
