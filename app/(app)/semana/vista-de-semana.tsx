import Link from "next/link"
import { NIVEL_DE_EVIDENCIA, PILAR } from "@/lib/ingesta/etiquetas"
import type { SemanaLeida, TemaDeTeoria } from "@/lib/ingesta/semana"

const ESTADO_DE_CORRIDA: Record<string, string> = { lista: "Lista", corriendo: "Corriendo", fallida: "Falló" }

const dosDecimales = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const diaLargo = new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", day: "numeric", month: "long" })

/** `semana` is a plain date (`2026-10-04`): read as UTC so no timezone moves it a day. */
const fechaDeSemana = (semana: string) => diaLargo.format(new Date(`${semana}T12:00:00Z`))

function EnlacesDeTemas({ temas }: { temas: TemaDeTeoria[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {temas.map((tema) => (
        <li key={tema.id}>
          <Link
            href={`/temas/${tema.id}`}
            className="inline-flex min-h-11 items-center rounded-sm bg-acento-suave px-3 text-meta font-semibold text-acento-profundo focus-visible:outline-3 focus-visible:outline-acento"
          >
            {tema.nombre}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Dato({ texto }: { texto: string }) {
  return <span className="rounded-sm bg-hundido px-2.5 py-1 text-meta font-semibold text-apagado">{texto}</span>
}

export function VistaDeSemana({ semana }: { semana: SemanaLeida }) {
  const { corrida, teorias, descartadas, queSubir } = semana
  if (!corrida) {
    return <p className="text-apagado">Todavía no corre el motor. La primera tanda llega el domingo a las 20:00.</p>
  }
  const sinNada = queSubir && queSubir.unSoloAutor.length === 0 && queSubir.pilaresSinMaterial.length === 0

  return (
    <>
      <section aria-label="Última corrida" className="grid gap-2 rounded-lg border border-linea bg-superficie p-4">
        <h2 className="font-serif text-title">{`Semana del ${fechaDeSemana(corrida.semana)}`}</h2>
        <div className="flex flex-wrap gap-2">
          <Dato texto={ESTADO_DE_CORRIDA[corrida.estado] ?? corrida.estado} />
          <Dato texto={`${corrida.ideas} ${corrida.ideas === 1 ? "idea" : "ideas"}`} />
          <Dato texto={`US$ ${dosDecimales.format(corrida.costoUsd)}`} />
          {corrida.manual ? <Dato texto="A pedido" /> : null}
        </div>
        {corrida.motivoFallo ? <p className="text-error-tinta">{corrida.motivoFallo}</p> : null}
      </section>

      <section aria-label="Teorías de la semana" className="grid gap-3">
        <h2 className="font-serif text-title">Teorías</h2>
        {teorias.length === 0 ? (
          <p className="text-apagado">Esta corrida no escribió teorías.</p>
        ) : (
          <ul className="grid gap-3">
            {teorias.map((teoria) => (
              <li
                key={teoria.id}
                aria-label={teoria.titulo}
                className="grid gap-2.5 rounded-lg border border-linea bg-superficie p-4"
              >
                <h3 className="font-semibold text-balance">{teoria.titulo}</h3>
                <p>{teoria.tesis}</p>
                <div className="flex flex-wrap gap-2">
                  {teoria.puntaje === null ? null : <Dato texto={`Puntaje ${dosDecimales.format(teoria.puntaje)}`} />}
                  {teoria.nivelEvidencia ? (
                    <Dato texto={`Evidencia ${NIVEL_DE_EVIDENCIA[teoria.nivelEvidencia] ?? teoria.nivelEvidencia}`} />
                  ) : null}
                </div>
                <EnlacesDeTemas temas={teoria.temas} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {descartadas.length > 0 ? (
        <section aria-label="Cruces descartados" className="grid gap-3">
          <h2 className="font-serif text-title">Cruces descartados</h2>
          <ul className="grid gap-3">
            {descartadas.map((cruce) => (
              <li key={cruce.id} className="grid gap-2 rounded-lg border border-linea bg-hundido p-4">
                <EnlacesDeTemas temas={cruce.temas} />
                <p className="text-apagado">{cruce.razon}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {queSubir ? (
        <section aria-label="Qué subir después" className="grid gap-3">
          <h2 className="font-serif text-title">Qué subir después</h2>
          {sinNada ? (
            <p className="text-apagado">
              Por ahora no falta nada: cada tema tiene varios autores y cada pilar tiene material.
            </p>
          ) : null}
          {queSubir.unSoloAutor.length > 0 ? (
            <div className="grid gap-2">
              <h3 className="text-label font-semibold">Temas con un solo autor</h3>
              <ul className="grid gap-1.5">
                {queSubir.unSoloAutor.map((nombre) => (
                  <li key={nombre}>{nombre}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {queSubir.pilaresSinMaterial.length > 0 ? (
            <div className="grid gap-2">
              <h3 className="text-label font-semibold">Pilares sin material</h3>
              <ul className="grid gap-1.5">
                {queSubir.pilaresSinMaterial.map((pilar) => (
                  <li key={pilar}>{PILAR[pilar] ?? pilar}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  )
}
