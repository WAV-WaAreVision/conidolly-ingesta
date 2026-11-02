"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { SelectorDeAutor } from "@/components/selector-de-autor"
import { Boton } from "@/components/ui/boton"
import { CLASES_DE_OPCION } from "@/components/ui/clases-de-opcion"
import type { AutorDeLista } from "@/lib/ingesta/buscar-autor"
import { AYUDA_DE_ROL, ETIQUETA_DE_ROL, ROLES, type Rol } from "@/lib/ingesta/modelo"
import { cn } from "@/lib/utils"
import { crearAutorAccion } from "../../subir/acciones"
import { editarMaterialAccion } from "../acciones"

interface Propiedades {
  materialId: string
  autores: AutorDeLista[]
  autorId: string
  rol: Rol
  /** Its claims were taken out with the author and role it had: a change reaches them only by reprocessing. */
  conAfirmaciones: boolean
}

export function EditarAutorYRol({
  materialId,
  autores,
  autorId: inicial,
  rol: rolInicial,
  conAfirmaciones,
}: Propiedades) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [autorId, setAutorId] = useState(inicial)
  const [rol, setRol] = useState<Rol>(rolInicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function guardar() {
    setGuardando(true)
    setError(null)
    const resultado = await editarMaterialAccion({ materialId, autorId, rol })
    setGuardando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    setAbierto(false)
    setAviso(conAfirmaciones ? "Reprocesa el material para que sus afirmaciones usen el cambio." : null)
    router.refresh()
  }

  function cerrar() {
    setAutorId(inicial)
    setRol(rolInicial)
    setError(null)
    setAbierto(false)
  }

  if (!abierto) {
    return (
      <div className="grid gap-2">
        {aviso ? <p className="rounded-bloque bg-piedra-honda p-3.5 text-aviso">{aviso}</p> : null}
        <Boton variante="linea" tamano="chico" className="w-fit" onClick={() => setAbierto(true)}>
          Cambiar autor o papel
        </Boton>
      </div>
    )
  }

  return (
    <section aria-label="Autor y papel" className="grid gap-4 rounded-panel border border-hilo bg-piedra-alta p-4">
      <SelectorDeAutor autores={autores} valor={autorId} alElegir={setAutorId} alCrear={crearAutorAccion} />
      <div role="radiogroup" aria-label="Papel del material" className="grid gap-2">
        {ROLES.map((opcion) => (
          <label key={opcion} className={cn(CLASES_DE_OPCION, "grid gap-0.5 p-3.5")}>
            <input
              type="radio"
              name="rol"
              value={opcion}
              checked={rol === opcion}
              onChange={() => setRol(opcion)}
              className="sr-only"
            />
            <span className="text-cuerpo font-semibold">{ETIQUETA_DE_ROL[opcion]}</span>
            <span className="text-meta text-apagado">{AYUDA_DE_ROL[opcion]}</span>
          </label>
        ))}
      </div>
      {error ? (
        <p role="alert" className="rounded-bloque bg-piedra-honda p-3.5 text-[1rem] text-error">
          {error}
        </p>
      ) : null}
      <Boton cargando={guardando} onClick={() => void guardar()}>
        Guardar
      </Boton>
      <Boton variante="callado" deshabilitado={guardando} onClick={cerrar}>
        Cancelar
      </Boton>
    </section>
  )
}
