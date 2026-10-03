import type { Task } from "@trigger.dev/sdk"

/**
 * The task of estudio-coni that turns a material into text and a card. Only its id and payload are declared here:
 * the repos do not import each other, so the contract is this type and `schemaTask` there.
 */
export type ProcesarMaterial = Task<"procesar-material", { materialId: string }, unknown>

/** The manual run of the weekly engine ("Proponer ahora"), a task of estudio-coni apart from the Sunday schedule. */
export type MotorManual = Task<"motor-manual", { manual?: true }, unknown>
