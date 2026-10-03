const ZONA = "America/Santiago"
const MS_POR_DIA = 86_400_000

/** The calendar day of `fecha` in Santiago, as `2026-10-04`. */
function diaEnSantiago(fecha: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha)
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? ""
  return `${valor("year")}-${valor("month")}-${valor("day")}`
}

/**
 * The Sunday that closes the Monday to Sunday week of `fecha` in Santiago, as `2026-10-11`. It keys
 * `motor_corridas.semana`; a copy of `semanaDe` in estudio-coni, so both sides name the same week.
 */
export function semanaDe(fecha: Date): string {
  const mediodia = Date.parse(`${diaEnSantiago(fecha)}T12:00:00Z`)
  const diasHastaElDomingo = (7 - new Date(mediodia).getUTCDay()) % 7
  return new Date(mediodia + diasHastaElDomingo * MS_POR_DIA).toISOString().slice(0, 10)
}
