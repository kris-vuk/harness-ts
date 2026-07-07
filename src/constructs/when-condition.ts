/** Prior-status gate for a `when` block: run on Success, Failure, or All. */
export type WhenStatus = "Success" | "Failure" | "All";

/**
 * Conditional execution for a step or step group (`StepWhenCondition`). Runs
 * the item based on the enclosing stage's status, optionally further gated by
 * a JEXL `condition` expression.
 */
export interface StepWhen {
  stageStatus: WhenStatus;
  /** JEXL expression that must also evaluate truthy for the item to run. */
  condition?: string;
}

/**
 * Conditional execution for a stage (`StageWhenCondition`). Runs the stage
 * based on the overall pipeline status, optionally gated by a JEXL expression.
 */
export interface StageWhen {
  pipelineStatus: WhenStatus;
  condition?: string;
}

/** Renders a {@link StepWhen}, omitting an unset `condition`. */
export function renderStepWhen(w: StepWhen): Record<string, unknown> {
  return {
    stageStatus: w.stageStatus,
    ...(w.condition !== undefined && { condition: w.condition }),
  };
}

/** Renders a {@link StageWhen}, omitting an unset `condition`. */
export function renderStageWhen(w: StageWhen): Record<string, unknown> {
  return {
    pipelineStatus: w.pipelineStatus,
    ...(w.condition !== undefined && { condition: w.condition }),
  };
}
