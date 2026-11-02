# conidolly-ingesta

App web (móvil primero) donde **Coni del Rosario** y **WAV** suben material de referencia: documento, link, audio,
video, imagen (hasta 20) y post. Los archivos van directo a R2 con URLs firmadas; luego se dispara la tarea
`procesar-material` de Trigger.dev, que lo convierte en texto y ficha para Conidolly.

## Dónde vive qué

- El esquema (tablas `materiales`, `categorias`, `fichas`, RLS, RPC `crear_categoria`, `es_coni`, `es_mantenedor`)
  y las tareas de Trigger.dev viven en **estudio-coni** (`~/Projects/estudio-coni`). Aquí no hay migraciones ni tareas.
- Mismo proyecto Supabase, mismo bucket R2 y mismo proyecto Trigger.dev que Conidolly. Los repos no se importan
  entre sí: `lib/almacen/` y `lib/ingesta/tarea.ts` son copias mínimas.
- Tipos de la base: `pnpm db:types` (contra el Supabase local de estudio-coni).
- `/ingreso/puente` (POST) es la otra punta de la pestaña Biblioteca de Conidolly (cambio 29a): solo acepta un
  `Origin` igual a `CONIDOLLY_URL`, verifica el token de un solo uso y abre la sesión de Coni. `CONIDOLLY_URL`
  (`https://conidolly.vercel.app` en Vercel) también da el enlace «Volver a Conidolly»; si falta, el puente no acepta
  nada y lo dice en el log.
- Los tokens de `app/globals.css` son copia de `estudio-coni/app/globals.css`: mantenerlos en sincronía hasta la
  etapa 2.

## Comandos

```
pnpm run dev            # http://localhost:3100
pnpm lint | type | test:run | build
pnpm test:db            # integración contra el Supabase local (54421/54422)
pnpm test:e2e           # Playwright; PLAYWRIGHT_CHROMIUM_PATH apunta a un Chromium ya instalado
```

## Reglas

- TDD estricto: primero el test que falla. Biome en modo seguro (`biome check --write`, nunca `--unsafe`); revisar
  que `"use client"` siga en la línea 1.
- TypeScript estricto: sin `any`, `@ts-expect-error`, `!` ni `catch` silencioso.
- Solo tokens semánticos de `app/globals.css`; sin colores hex en componentes.
- Textos en español de Chile, tuteo, sin guiones largos.
- Las server actions validan con Zod y comprueban en el servidor que quien llama es Coni o WAV.
- Local: `DISPARO_DE_PRUEBA=1` no llama a Trigger.dev y `R2_ENDPOINT` apunta a un S3 falso. Ambos se niegan en Vercel.
- El repo está en GitHub (privado, `WAV-WaAreVision/conidolly-ingesta`) y se publica en Vercel a mano
  (`vercel deploy --prod --yes`, https://conidolly-ingesta.vercel.app). Cada salida a producción sigue la
  autorización vigente escrita en el `CLAUDE.md` de estudio-coni.
