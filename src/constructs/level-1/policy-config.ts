/**
 * Policy enforcement attached to a step, stage, or pipeline (`PolicyConfig`).
 * Evaluates the named OPA policy sets against the node; `policySets` may be a
 * list of policy-set references or a single runtime-input expression.
 */
export interface PolicyConfig {
  /** Policy-set references to enforce, or a `<+input>` expression. */
  policySets: string[] | string;
}

/** Renders a {@link PolicyConfig} to its `enforce` object. */
export function renderPolicyConfig(p: PolicyConfig): Record<string, unknown> {
  return {
    policySets: p.policySets,
  };
}
