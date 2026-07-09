/**
 * Typed builders for Harness runtime expressions — the `<+...>` tokens that
 * appear throughout a pipeline (variable references, step outputs, secrets,
 * runtime inputs). Hand-written, these are stringly-typed and easy to get
 * subtly wrong (a mistyped step identifier or output name fails only at
 * runtime); `Expr` makes them typo-resistant and self-documenting while
 * rendering to the exact same string Harness expects.
 *
 * Every builder returns an {@link Expression}, whose `toString()` is the raw
 * token — so an `Expr` value drops straight into a template literal or any
 * field typed as `string`:
 *
 * ```ts
 * `environment:${Expr.pipelineVar("environment")}`   // "environment:<+pipeline.variables.environment>"
 * Expr.secret("my-token")                             // '<+secrets.getValue("my-token")>'
 * Expr.stepOutput("select_delegate", "HOST_SELECTOR") // "<+execution.steps.select_delegate.output.outputVariables.HOST_SELECTOR>"
 * ```
 *
 * These are Harness *expressions*, distinct from the {@link NGVariable} value
 * objects they often reference.
 */

/**
 * A rendered Harness expression. `toString()` (and therefore any string
 * coercion — template literals, `String(...)`, concatenation) yields the raw
 * `<+...>` token. Chainable string-op helpers (e.g. {@link replace}) return a
 * new `Expression` wrapping the transformed token.
 */
export class Expression {
  constructor(private readonly token: string) {}

  /** The raw `<+...>` token. */
  toString(): string {
    return this.token;
  }

  /** JSON-serializes as the raw token, so `Expr` values render correctly in specs. */
  toJSON(): string {
    return this.token;
  }

  /**
   * Appends a `.replace("from","to")` string operation to the expression, e.g.
   * `Expr.pipelineVar("region").replace("-", "")` ->
   * `<+pipeline.variables.region.replace("-","")>`. Harness evaluates the op
   * inside the token, so it is spliced before the closing `>`.
   */
  replace(from: string, to: string): Expression {
    const inner = this.token.slice(2, -1); // strip "<+" and ">"
    return new Expression(`<+${inner}.replace("${from}","${to}")>`);
  }
}

/** Options for a `<+input>` runtime input expression. */
export interface InputExprOptions {
  /**
   * Default value when the input is left blank. Rendered as `.default(<value>)`.
   * An empty string renders quoted (`.default("")`); any other value renders
   * bare (`.default(dev)`), matching Harness's own serialization.
   */
  default?: string;
  /** Constrains the input to a fixed set, rendered as `.selectOneFrom(a,b,c)`. */
  selectOneFrom?: string[];
  /** Constrains a multi-select input, rendered as `.selectManyFrom(a,b,c)`. */
  selectManyFrom?: string[];
  /** Constrains the input to values matching a regex, rendered as `.regex(...)`. */
  regex?: string;
  /** Restricts the input to an explicit allow-list, rendered as `.allowedValues(a,b,c)`. */
  allowedValues?: string[];
}

/**
 * Builders for the common Harness expression roots. Each returns an
 * {@link Expression}; compose with template literals for surrounding text.
 */
export const Expr = {
  /** Wrap an already-formed token, e.g. `Expr.raw("<+trigger.branch>")`. Escape hatch for tokens without a dedicated builder. */
  raw(token: string): Expression {
    return new Expression(token);
  },

  /** `<+account.identifier>` — the Harness account id. */
  get accountId(): Expression {
    return new Expression("<+account.identifier>");
  },

  /** `<+project.identifier>` — the current project's id. */
  get projectId(): Expression {
    return new Expression("<+project.identifier>");
  },

  /** `<+org.identifier>` — the current org's id. */
  get orgId(): Expression {
    return new Expression("<+org.identifier>");
  },

  /** `<+pipeline.branch>` — the branch the run was triggered from. */
  get pipelineBranch(): Expression {
    return new Expression("<+pipeline.branch>");
  },

  /** `<+pipeline.variables.<name>>` — a pipeline-level variable reference. */
  pipelineVar(name: string): Expression {
    return new Expression(`<+pipeline.variables.${name}>`);
  },

  /** `<+stage.variables.<name>>` — a stage-level variable reference. */
  stageVar(name: string): Expression {
    return new Expression(`<+stage.variables.${name}>`);
  },

  /**
   * `<+execution.steps.<stepId>.output.outputVariables.<name>>` — an output
   * variable published by an earlier step in the same stage.
   */
  stepOutput(stepId: string, name: string): Expression {
    return new Expression(
      `<+execution.steps.${stepId}.output.outputVariables.${name}>`,
    );
  },

  /** `<+secrets.getValue("<ref>")>` — resolves a secret from the Harness secret manager. */
  secret(ref: string): Expression {
    return new Expression(`<+secrets.getValue("${ref}")>`);
  },

  /**
   * A `<+input>` runtime input, optionally constrained. With no options this is
   * a bare `<+input>`; options append `.default(...)`, `.selectOneFrom(...)`,
   * etc. in Harness's canonical order.
   */
  input(options: InputExprOptions = {}): Expression {
    let token = "<+input>";
    if (options.allowedValues !== undefined) {
      token += `.allowedValues(${options.allowedValues.join(",")})`;
    }
    if (options.regex !== undefined) {
      token += `.regex(${options.regex})`;
    }
    if (options.default !== undefined) {
      // Harness renders an empty default quoted, non-empty defaults bare.
      const rendered = options.default === "" ? '""' : options.default;
      token += `.default(${rendered})`;
    }
    if (options.selectOneFrom !== undefined) {
      token += `.selectOneFrom(${options.selectOneFrom.join(",")})`;
    }
    if (options.selectManyFrom !== undefined) {
      token += `.selectManyFrom(${options.selectManyFrom.join(",")})`;
    }
    return new Expression(token);
  },
} as const;
