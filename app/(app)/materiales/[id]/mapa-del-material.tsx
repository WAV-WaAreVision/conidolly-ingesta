import { EVIDENCIA, TIPO_DE_AFIRMACION } from "@/lib/ingesta/etiquetas"
import type { MapaDelMaterial as Mapa } from "@/lib/ingesta/materiales"

function Recuento({ titulo, filas }: { titulo: string; filas: { clave: string; texto: string; cantidad: number }[] }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-label font-semibold">{titulo}</h3>
      <ul aria-label={titulo} className="grid gap-1.5">
        {filas.map((fila) => (
          <li
            key={fila.clave}
            className="flex items-baseline justify-between gap-3 rounded-md bg-hundido px-3.5 py-2.5"
          >
            <span>{fila.texto}</span>
            <span className="text-meta font-semibold text-apagado">{fila.cantidad}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

const masFrecuentesPrimero = (cuentas: Record<string, number>, etiquetas: Record<string, string>) =>
  Object.entries(cuentas)
    .sort(([claveA, a], [claveB, b]) => b - a || claveA.localeCompare(claveB))
    .map(([clave, cantidad]) => ({ clave, texto: etiquetas[clave] ?? clave, cantidad }))

/** What a material says: how many claims it gave, which topics they went to, what kind they are and how they are backed. */
export function MapaDelMaterial({ mapa, estado }: { mapa: Mapa; estado: string }) {
  return (
    <section aria-labelledby="mapa-titulo" className="grid gap-4.5">
      <h2 id="mapa-titulo" className="font-serif text-title">
        Mapa del material
      </h2>
      {mapa.total === 0 ? (
        <p className="text-apagado">
          {estado === "listo"
            ? "Este material no produjo afirmaciones."
            : "El mapa aparece cuando termina de procesarse."}
        </p>
      ) : (
        <>
          <p className="text-label font-semibold">{mapa.total === 1 ? "1 afirmación" : `${mapa.total} afirmaciones`}</p>
          <Recuento
            titulo="Temas"
            filas={[
              ...mapa.temas.map((tema) => ({ clave: tema.id, texto: tema.nombre, cantidad: tema.afirmaciones })),
              ...(mapa.sinTema > 0 ? [{ clave: "sin-tema", texto: "Sin tema todavía", cantidad: mapa.sinTema }] : []),
            ]}
          />
          <Recuento titulo="Tipos de afirmación" filas={masFrecuentesPrimero(mapa.tipos, TIPO_DE_AFIRMACION)} />
          <Recuento titulo="Evidencia" filas={masFrecuentesPrimero(mapa.evidencia, EVIDENCIA)} />
        </>
      )}
    </section>
  )
}
