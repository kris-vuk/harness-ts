import { readFileSync } from "node:fs";
import { Step, type StepProps } from "./step.js";

/** Shells supported by the ShellScript step per the v0 schema. */
export type Shell = "Bash" | "PowerShell";

/**
 * An environment or output variable of a ShellScript step (`NGVariable`).
 * `Secret` values are resolved from the Harness secret manager.
 */
export interface ShellScriptVariable {
  name: string;
  type: "String" | "Secret" | "Number";
  value: string;
}

export interface ShellScriptStepProps extends StepProps {
  /** The inline script to execute. */
  script: string;
  /** Defaults to "Bash". */
  shell?: Shell;
  environmentVariables?: ShellScriptVariable[];
  outputVariables?: ShellScriptVariable[];
  /** Run the script on the delegate itself rather than a target host. */
  onDelegate?: boolean;
  /** Tags/names of existing delegates to run the script. */
  delegateSelectors?: string[];
}

/**
 * A Harness ShellScript step (`type: ShellScript`): runs an inline Bash or
 * PowerShell script. Renders the `ShellScriptStepInfo` spec with an inline
 * source. (Harness file-store sources can be added later.)
 */
export class ShellScriptStep extends Step {
  readonly stepType = "ShellScript";

  /**
   * Reads a script from a file so long inline shell can live in a real `.sh`
   * file (shellcheck-able, syntax-highlighted, testable) instead of a TS string
   * literal. Pass a path resolved against the calling module so it works
   * regardless of the process working directory:
   *
   * ```ts
   * script: ShellScriptStep.fromFile(new URL("./scripts/read-tags.sh", import.meta.url))
   * ```
   *
   * A plain string path is also accepted and resolved relative to `process.cwd()`.
   */
  static fromFile(path: string | URL): string {
    return readFileSync(path, "utf8");
  }

  private readonly script: string;
  private readonly shell: Shell;
  private readonly environmentVariables: ShellScriptVariable[];
  private readonly outputVariables: ShellScriptVariable[];
  private readonly onDelegate?: boolean;
  private readonly delegateSelectors?: string[];

  constructor(props: ShellScriptStepProps) {
    super(props);
    this.script = props.script;
    this.shell = props.shell ?? "Bash";
    this.environmentVariables = props.environmentVariables ?? [];
    this.outputVariables = props.outputVariables ?? [];
    this.onDelegate = props.onDelegate;
    this.delegateSelectors = props.delegateSelectors;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.script.trim() === "") {
      errors.push("script must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      shell: this.shell,
      source: {
        type: "Inline",
        spec: {
          script: this.script,
        },
      },
      ...(this.environmentVariables.length > 0 && {
        environmentVariables: this.environmentVariables,
      }),
      ...(this.outputVariables.length > 0 && {
        outputVariables: this.outputVariables,
      }),
      ...(this.onDelegate !== undefined && { onDelegate: this.onDelegate }),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
    };
  }
}
