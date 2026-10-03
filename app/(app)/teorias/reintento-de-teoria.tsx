import { AVISO_SIN_SUSTENTO, puedeReintentarse, type TeoriaLeida } from "@/lib/ingesta/modelo-de-teoria"
import { BotonReintentarTeoria } from "./boton-reintentar-teoria"

/** What a failed theory offers next: a retry, or, when the cards cannot back it, the advice to use other materials. */
export function ReintentoDeTeoria({ teoria }: { teoria: Pick<TeoriaLeida, "id" | "estado" | "motivoCodigo"> }) {
  if (puedeReintentarse(teoria)) return <BotonReintentarTeoria teoriaId={teoria.id} />
  if (teoria.estado !== "fallida") return null
  return <p className="text-meta text-apagado">{AVISO_SIN_SUSTENTO}</p>
}
