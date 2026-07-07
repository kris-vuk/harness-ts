/**
 * Error categories a failure strategy can match (`OnFailureConfig.errors`).
 * `AllErrors` matches every category.
 */
export const FAILURE_ERROR_TYPES = [
  "Unknown",
  "AllErrors",
  "Authentication",
  "Connectivity",
  "Timeout",
  "Authorization",
  "Verification",
  "DelegateProvisioning",
  "PolicyEvaluationFailure",
  "InputTimeoutError",
  "ApprovalRejection",
  "DelegateRestart",
  "UserMarkedFailure",
  "InfrastructureFailure",
  "PluginImageFailure",
  "ResourceLimitsFailure",
  "ConfigurationFailure",
  "RetryableTransientFailure",
] as const;

export type FailureErrorType = (typeof FAILURE_ERROR_TYPES)[number];

/**
 * The action a failure strategy takes (`FailureStrategyActionConfig`). Most
 * actions are terminal and specless; `Retry`/`RetryStepGroup` and
 * `ManualIntervention` carry a spec, and both nest a follow-up action to run
 * once they are exhausted.
 */
export type FailureAction =
  | {
      type:
        | "Ignore"
        | "Abort"
        | "MarkAsSuccess"
        | "MarkAsFailure"
        | "StageRollback"
        | "StepGroupRollback"
        | "PipelineRollback"
        | "ProceedWithDefaultValues";
    }
  | {
      type: "Retry" | "RetryStepGroup";
      retryCount: number;
      /** Wait durations between attempts, e.g. ["10s", "30s"]. */
      retryIntervals: string[];
      /** Action to take after retries are exhausted. */
      onRetryFailure: FailureAction;
    }
  | {
      type: "ManualIntervention";
      /** How long to wait for intervention, e.g. "1h", "30m". */
      timeout: string;
      /** Action to take if the intervention times out. */
      onTimeout: FailureAction;
    };

function renderAction(a: FailureAction): Record<string, unknown> {
  switch (a.type) {
    case "Retry":
    case "RetryStepGroup":
      return {
        type: a.type,
        spec: {
          retryCount: a.retryCount,
          retryIntervals: a.retryIntervals,
          onRetryFailure: { action: renderAction(a.onRetryFailure) },
        },
      };
    case "ManualIntervention":
      return {
        type: a.type,
        spec: {
          timeout: a.timeout,
          onTimeout: { action: renderAction(a.onTimeout) },
        },
      };
    default:
      return { type: a.type };
  }
}

/**
 * A failure-handling rule (`FailureStrategyConfig`): when one of `errors`
 * occurs, run `action`.
 */
export interface FailureStrategy {
  errors: FailureErrorType[];
  action: FailureAction;
}

/** Renders a {@link FailureStrategy} to its `{ onFailure: { ... } }` object. */
export function renderFailureStrategy(
  fs: FailureStrategy,
): Record<string, unknown> {
  return {
    onFailure: {
      errors: fs.errors,
      action: renderAction(fs.action),
    },
  };
}
