import { NavegacionPrincipal } from "@/components/navegacion-principal"
import { listarRegistro } from "@/lib/ingesta/datos-personales"
import { leerSesion } from "@/lib/sesion/miembro"
import { EditorDeFila } from "./editor-de-fila"

/** Ingesta › Datos (Conidolly spec 2026-11-01, D2): WAV keeps the register; Coni reads it in Conidolly. */
export default async function DatosPersonales() {
  const sesion = await leerSesion()
  if (sesion.estado !== "miembro") return null
  const filas = sesion.rol === "wav" ? await listarRegistro(sesion.db) : []

  return (
    <main className="mx-auto grid w-full max-w-[560px] content-start gap-5.5 px-4.5 pt-[max(2rem,env(safe-area-inset-top))] pb-8">
      <h1 className="font-serif text-display text-balance">Datos personales</h1>
      <NavegacionPrincipal actual="datos" rol={sesion.rol} />
      {sesion.rol === "wav" ? (
        <>
          <p className="text-apagado">
            Lo que Conidolly guarda, para qué, dónde queda y cuándo se borra. Coni lo lee en Conidolly y lo revisa una
            vez al año. Lo que la app borra sola no cambia desde aquí: si los días no calzan con el código, Conidolly lo
            marca.
          </p>
          <ul className="grid gap-3">
            {filas.map((fila) => (
              <li key={fila.id}>
                <EditorDeFila fila={fila} />
              </li>
            ))}
          </ul>
          <section aria-labelledby="fila-nueva" className="grid gap-3">
            <h2 id="fila-nueva" className="font-semibold">
              Agregar una fila
            </h2>
            <EditorDeFila />
          </section>
        </>
      ) : (
        <p className="text-apagado">
          Esta lista la corrige WAV. Tú la revisas en Conidolly, en Ajustes, Datos personales.
        </p>
      )}
    </main>
  )
}
