import Link from "next/link"
import { clasesDeBoton } from "@/components/ui/clases-de-boton"
import { leerSesion } from "@/lib/sesion/miembro"
import { cn } from "@/lib/utils"

const ETIQUETA_DE_TIPO: Record<string, string> = {
  documento: "Documento",
  link: "Link",
  audio: "Audio",
  video: "Video",
  imagen: "Imagen",
  post: "Post",
}

const ESTADO: Record<string, { texto: string; clases: string }> = {
  procesando: { texto: "Procesando", clases: "bg-aviso-fondo text-aviso-tinta" },
  listo: { texto: "Listo", clases: "bg-ok-fondo text-ok-tinta" },
  fallido: { texto: "No se pudo procesar", clases: "bg-error-fondo text-error-tinta" },
}

export default async function Material() {
  const sesion = await leerSesion()
  if (sesion.estado !== "miembro") return null
  const { data, error } = await sesion.db
    .from("materiales")
    .select("id, titulo, autor, tipo, estado, motivo_fallo, creado_en")
    .order("creado_en", { ascending: false })
    .limit(50)
  if (error) throw new Error(`No pude leer el material: ${error.message}`, { cause: error })

  return (
    <main className="mx-auto grid w-full max-w-[560px] content-start gap-5.5 px-4.5 pt-[max(2rem,env(safe-area-inset-top))] pb-8">
      <h1 className="font-serif text-display text-balance">Material de Coni</h1>
      <Link href="/subir" className={clasesDeBoton()}>
        Subir material
      </Link>
      {data.length === 0 ? (
        <p className="text-apagado">Aún no hay material. Sube el primero.</p>
      ) : (
        <ul className="grid gap-3">
          {data.map((material) => {
            const estado = ESTADO[material.estado] ?? { texto: material.estado, clases: "bg-hundido text-apagado" }
            return (
              <li key={material.id} className="grid gap-1.5 rounded-lg border border-linea bg-superficie p-4">
                <p className="font-semibold text-balance">{material.titulo ?? "Sin título"}</p>
                <p className="text-meta text-apagado">
                  {ETIQUETA_DE_TIPO[material.tipo] ?? material.tipo}
                  {material.autor ? ` · ${material.autor}` : ""}
                </p>
                <p className={cn("w-fit rounded-sm px-2.5 py-1 text-meta font-semibold", estado.clases)}>
                  {estado.texto}
                </p>
                {material.estado === "fallido" && material.motivo_fallo ? (
                  <p className="text-meta text-apagado">{material.motivo_fallo}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
