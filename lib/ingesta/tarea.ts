import type { Task } from "@trigger.dev/sdk"

/**
 * The task of estudio-coni that turns a material into text and a card. Only its id and payload are declared here:
 * the repos do not import each other, so the contract is this type and `schemaTask` there.
 */
export type ProcesarMaterial = Task<"procesar-material", { materialId: string }, unknown>

/** The task of estudio-coni that weaves the cards of a theory's sources into a draft. Same contract rule as above. */
export type SintetizarTeoria = Task<"sintetizar-teoria", { teoriaId: string }, unknown>
