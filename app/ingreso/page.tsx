import { TEXTO_PUENTE_VENCIDO } from "@/lib/sesion/puente"
import { FormularioIngreso } from "./formulario-ingreso"

export const dynamic = "force-dynamic"

export default async function Ingreso({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { puente } = await searchParams
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-[560px] content-start px-4.5 pt-[max(4rem,env(safe-area-inset-top))] pb-8">
      <FormularioIngreso avisoDelPuente={puente === "vencido" ? TEXTO_PUENTE_VENCIDO : null} />
    </main>
  )
}
