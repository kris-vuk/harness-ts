import type { ExprString } from "./expression.js";

/**
 * A typed pipeline/stage/step-group variable (`NGVariable`). Harness models
 * three concrete variants (`StringNGVariable`, `SecretNGVariable`,
 * `NumberNGVariable`); this discriminated union captures all three. `Secret`
 * values are references into the Harness secret manager; `Number` values may
 * be a literal or a runtime expression string.
 *
 * `String`/`Secret` values accept a plain string or a typed {@link Expression}
 * ({@link ExprString}), so `value: Expr.secret("x")` needs no `${...}` wrapping.
 */
export type NGVariable =
  | { name: string; type: "String"; value: ExprString; default?: ExprString; description?: string; required?: boolean }
  | { name: string; type: "Secret"; value: ExprString; default?: ExprString; description?: string; required?: boolean }
  | {
      name: string;
      type: "Number";
      value: number | string;
      default?: number | string;
      description?: string;
      required?: boolean;
    };

/** Renders an {@link NGVariable} to its schema object, omitting unset fields. */
export function renderVariable(v: NGVariable): Record<string, unknown> {
  return {
    name: v.name,
    type: v.type,
    value: v.value,
    ...(v.default !== undefined && { default: v.default }),
    ...(v.description !== undefined && { description: v.description }),
    ...(v.required !== undefined && { required: v.required }),
  };
}
