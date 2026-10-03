import Link from "next/link"
import { notFound } from "next/navigation"
import { clasesDeBoton } from "@/components/ui/clases-de-boton"
import { listarAutores } from "@/lib/ingesta/autores"
import { adaptacionDe } from "@/lib/ingesta/ficha"
import { leerMapaDelMaterial, leerMaterialConFicha } from "@/lib/ingesta/materiales"
import { ETIQUETA_DE_ROL, esquemaDeId, type Rol } from "@/lib/ingesta/modelo"
import { leerSesion } from "@/lib/sesion/miembro"
import { cn } from "@/lib/utils"
import { ETIQUETA_DE_TIPO, esperaConfirmacion, estadoVisible, sePuedeReintentar } from "../../estado-de-material"
import { BotonConfirmarCosto } from "../boton-confirmar-costo"
import { BotonReintentar } from "../boton-reintentar"
import { BorrarMaterial } from "./borrar-material"
import { BotonReprocesar } from "./boton-reprocesar"
import { EditarAutorYRol } from "./editar-autor-y-rol"
import { FichaEditable } from "./ficha-editable"
import { MapaDelMaterial } from "./mapa-del-material"

export default async function FichaDeMaterial({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await leerSesion()
  if (sesion.estado !== "miembro") return null
  const id = esquemaDeId.safeParse({ materialId: (await params).id })
  if (!id.success) notFound()
  const leido = await leerMaterialConFicha(sesion.db, id.data.materialId)
  if (!leido) notFound()
  const { material, ficha } = leido
  const rol = material.rol as Rol
  const conFicha = rol === "estrategia"
  const [autores, mapa] = await Promise.all([
    listarAutores(sesion.db),
    conFicha ? null : leerMapaDelMaterial(sesion.db, material.id),
  ])
  const estado = estadoVisible(material)
  const enlace = `/materiales/${material.id}/texto`

  return (
    <main className="mx-auto grid w-full max-w-[560px] content-start gap-5.5 px-4.5 pt-[max(2rem,env(safe-area-inset-top))] pb-8">
      <Link href="/" className={clasesDeBoton({ variante: "callado", tamano: "chico" })}>
        Volver al material
      </Link>
      <header className="grid gap-2">
        <h1 className="font-serif text-display text-balance">{material.titulo ?? "Sin título"}</h1>
        <p className="text-meta text-apagado">
          {ETIQUETA_DE_TIPO[material.tipo] ?? material.tipo}
          {` · ${material.autor} · ${ETIQUETA_DE_ROL[rol] ?? material.rol}`}
        </p>
        <p className={cn("w-fit rounded-sm px-2.5 py-1 text-meta font-semibold", estado.clases)}>{estado.texto}</p>
        {material.motivo_fallo ? <p className="text-meta text-apagado">{material.motivo_fallo}</p> : null}
        {esperaConfirmacion(material) && material.costo_estimado_usd !== null ? (
          <BotonConfirmarCosto materialId={material.id} costoUsd={material.costo_estimado_usd} />
        ) : null}
        {sePuedeReintentar(material) ? <BotonReintentar materialId={material.id} /> : null}
      </header>

      <EditarAutorYRol
        materialId={material.id}
        autores={autores}
        autorId={material.autor_id}
        rol={rol}
        conAfirmaciones={(mapa?.total ?? 0) > 0}
      />

      {mapa ? (
        <MapaDelMaterial mapa={mapa} estado={material.estado} />
      ) : ficha ? (
        <>
          <p className="rounded-md bg-acento-suave p-3.5 text-meta text-tinta">
            {adaptacionDe(material.idioma_original)}
          </p>
          <FichaEditable materialId={material.id} ficha={ficha} />
        </>
      ) : material.estado === "listo" ? (
        <p className="text-apagado">No pude leer la ficha de este material. Avísale a WAV.</p>
      ) : (
        <p className="text-apagado">La ficha aparece cuando termina de procesarse.</p>
      )}

      {material.estado === "listo" ? (
        <nav aria-label="Texto completo" className="grid gap-2.5">
          <a href={enlace} className={clasesDeBoton({ variante: "linea" })}>
            Descargar texto original
          </a>
        </nav>
      ) : null}

      {material.estado === "listo" ? <BotonReprocesar materialId={material.id} /> : null}
      <BorrarMaterial materialId={material.id} />
    </main>
  )
}
