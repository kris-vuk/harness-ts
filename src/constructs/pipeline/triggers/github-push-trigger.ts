import { stringify } from "yaml";
import { isValidIdentifier, toIdentifier } from "../identifier.js";
import type { Pipeline } from "./pipeline.js";

/**
 * Operators a branch/payload condition can use (`TriggerEventDataCondition`).
 */
export type BranchOperator =
  | "Equals"
  | "NotEquals"
  | "StartsWith"
  | "EndsWith"
  | "Regex"
  | "In";

/** A raw payload condition (`payloadConditions` entry). */
export interface PayloadCondition {
  key: string;
  operator: string;
  value: string;
}

/**
 * Properties of a Harness GitHub push webhook trigger. Unlike a {@link Pipeline}
 * (which owns its `stages`), a trigger is a separate top-level resource that
 * *references* a pipeline by `pipelineIdentifier` and renders to its own
 * `{ trigger: { ... } }` YAML document. Triggers are not part of the v0 pipeline
 * schema this library otherwise models.
 *
 * Scope: GitHub source, `Push` event. The Git connector is assumed to already
 * exist and is referenced by `connectorRef`.
 */
export interface GithubPushTriggerProps {
  /** Display name. */
  name: string;
  /** Defaults to an identifier derived from `name` ("On Push" -> "On_Push"). */
  identifier?: string;
  /** Pipeline this trigger starts. Supplies pipeline/org/project identifiers. */
  pipeline: Pipeline;
  /** Override the identifier derived from `pipeline`. */
  pipelineIdentifier?: string;
  /** Override the org derived from `pipeline`. */
  orgIdentifier?: string;
  /** Override the project derived from `pipeline`. */
  projectIdentifier?: string;
  /** Existing Git connector ref (assumed to exist). */
  connectorRef: string;
  /** Repository the connector should watch, e.g. "my-org/my-service". */
  repoName: string;
  /**
   * Watched branch. Shorthand for a `targetBranch <branchOperator> <branch>`
   * payload condition, prepended to any explicit {@link payloadConditions}.
   */
  branch?: string;
  /** Operator for the `branch` shorthand. Defaults to "Equals". */
  branchOperator?: BranchOperator;
  /** Additional payload conditions, appended after the `branch` condition. */
  payloadConditions?: PayloadCondition[];
  /** Whether the trigger is active. Defaults to true when rendered. */
  enabled?: boolean;
  /**
   * Runtime inputs passed into the pipeline run (`inputYaml`). Defaults to a
   * CI codebase block that builds the pushed branch (`<+trigger.branch>`). Pass
   * an object to replace it, or `false` to omit `inputYaml` entirely.
   */
  inputYaml?: Record<string, unknown> | false;
}

/**
 * A Harness GitHub push webhook trigger. Synthesizes to the
 * `{ trigger: { ... } }` YAML document consumed by Harness: when a push to the
 * watched repo matches the branch condition, the referenced pipeline runs.
 */
export class GithubPushTrigger {
  readonly name: string;
  readonly identifier: string;
  readonly pipelineIdentifier: string;
  readonly orgIdentifier: string;
  readonly projectIdentifier: string;
  readonly connectorRef: string;
  readonly repoName: string;
  readonly branch?: string;
  readonly branchOperator: BranchOperator;
  readonly payloadConditions: PayloadCondition[];
  readonly enabled?: boolean;
  private readonly inputYaml: Record<string, unknown> | false | undefined;

  constructor(props: GithubPushTriggerProps) {
    this.name = props.name;
    this.identifier = props.identifier ?? toIdentifier(props.name);
    this.pipelineIdentifier =
      props.pipelineIdentifier ?? props.pipeline.identifier;
    this.orgIdentifier = props.orgIdentifier ?? props.pipeline.orgIdentifier;
    this.projectIdentifier =
      props.projectIdentifier ?? props.pipeline.projectIdentifier;
    this.connectorRef = props.connectorRef;
    this.repoName = props.repoName;
    this.branch = props.branch;
    this.branchOperator = props.branchOperator ?? "Equals";
    this.payloadConditions = props.payloadConditions ?? [];
    this.enabled = props.enabled;
    this.inputYaml = props.inputYaml;
  }

  /** All payload conditions, with the `branch` shorthand (if any) first. */
  private allPayloadConditions(): PayloadCondition[] {
    const branchCondition: PayloadCondition[] =
      this.branch !== undefined
        ? [
            {
              key: "targetBranch",
              operator: this.branchOperator,
              value: this.branch,
            },
          ]
        : [];
    return [...branchCondition, ...this.payloadConditions];
  }

  /** Returns problems with this trigger; empty when valid. */
  validate(): string[] {
    const errors: string[] = [];
    if (!isValidIdentifier(this.identifier)) {
      errors.push(`invalid identifier "${this.identifier}"`);
    }
    if (!isValidIdentifier(this.pipelineIdentifier)) {
      errors.push(`invalid pipelineIdentifier "${this.pipelineIdentifier}"`);
    }
    if (this.connectorRef.trim() === "") {
      errors.push("connectorRef must not be empty");
    }
    if (this.repoName.trim() === "") {
      errors.push("repoName must not be empty");
    }
    if (this.allPayloadConditions().length === 0) {
      errors.push(
        "trigger must set `branch` or at least one payload condition, " +
          "otherwise it fires on every push",
      );
    }
    return errors;
  }

  /** The default `inputYaml`: build the pushed branch via the CI codebase. */
  private defaultInputYaml(): Record<string, unknown> {
    return {
      pipeline: {
        identifier: this.pipelineIdentifier,
        properties: {
          ci: {
            codebase: {
              build: {
                type: "branch",
                spec: { branch: "<+trigger.branch>" },
              },
            },
          },
        },
      },
    };
  }

  toJson(): Record<string, unknown> {
    const inputYaml =
      this.inputYaml === false
        ? undefined
        : stringify(this.inputYaml ?? this.defaultInputYaml());
    return {
      trigger: {
        name: this.name,
        identifier: this.identifier,
        enabled: this.enabled ?? true,
        orgIdentifier: this.orgIdentifier,
        projectIdentifier: this.projectIdentifier,
        pipelineIdentifier: this.pipelineIdentifier,
        source: {
          type: "Webhook",
          spec: {
            type: "Github",
            spec: {
              type: "Push",
              spec: {
                connectorRef: this.connectorRef,
                repoName: this.repoName,
                actions: [],
                payloadConditions: this.allPayloadConditions(),
                headerConditions: [],
              },
            },
          },
        },
        ...(inputYaml !== undefined && { inputYaml }),
      },
    };
  }

  /**
   * Validates the trigger and renders it as Harness trigger YAML.
   * @throws if the trigger is invalid.
   */
  synth(): string {
    const errors = this.validate();
    if (errors.length > 0) {
      throw new Error(
        `GithubPushTrigger "${this.identifier}" is invalid:\n${errors
          .map((e) => `  - ${e}`)
          .join("\n")}`,
      );
    }
    return stringify(this.toJson());
  }
}
