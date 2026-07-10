import { isValidIdentifier } from "../identifier.js";
import type { Pipeline } from "./pipeline.js";

/**
 * How Harness fetches the branch when creating/importing the remote pipeline.
 * "Branch" tracks the tip of {@link PipelineGitConfigProps.branch}; "Commit"
 * pins a specific `commitId`.
 */
export type PipelineGitFetchType = "Branch" | "Commit";

/**
 * Properties for the Git configuration of a {@link Pipeline}'s **own
 * definition** — i.e. the repo that stores the pipeline YAML, not any
 * application/source repo the pipeline builds or deploys.
 *
 * In Harness this is "Git Experience": a pipeline stored with
 * `storeType: REMOTE` lives as a YAML file in a git repo, and Harness keeps its
 * in-account copy in sync with that file. This metadata is **not** part of the
 * v0 pipeline document ({@link Pipeline.toJson}); it rides alongside the YAML as
 * entity/API-level "git details" when the pipeline is created or imported. So,
 * like a trigger, this is a separate resource that *references* a pipeline
 * rather than something embedded in the pipeline document.
 */
export interface PipelineGitConfigProps {
  /** Pipeline whose definition lives in git. Supplies its identifier. */
  pipeline: Pipeline;
  /** Existing Git connector ref pointing at the pipeline-definition repo. */
  connectorRef: string;
  /** Repository holding the pipeline YAML, e.g. "my-org/pipeline-defs". */
  repoName: string;
  /** Branch the pipeline YAML is read from / written to, e.g. "main". */
  branch: string;
  /**
   * Path to the pipeline YAML within the repo, e.g.
   * ".harness/my_pipeline.yaml".
   */
  filePath: string;
  /**
   * Whether Harness fetches by branch tip or a pinned commit. Defaults to
   * "Branch" — the mode that lets the in-account copy update when the repo
   * updates.
   */
  gitFetchType?: PipelineGitFetchType;
  /** Commit to pin when `gitFetchType` is "Commit". */
  commitId?: string;
  /**
   * Base branch to open the file against (used by some create/import flows).
   * Optional; defaults to {@link branch} on the Harness side when omitted.
   */
  baseBranch?: string;
}

/**
 * Git configuration for a {@link Pipeline}'s own definition (Harness "Git
 * Experience" / remote pipeline). Points the pipeline at the repo that stores
 * its YAML so Harness can keep its copy in sync as that repo updates.
 *
 * This does not modify the pipeline document. It renders the "git details"
 * block that a Harness create/import API call (or the UI) needs; delivering the
 * synthesized YAML to `filePath` in the repo — via a commit or that API call —
 * is left to the consumer, since this library only synthesizes YAML.
 */
export class PipelineGitConfig {
  readonly pipelineIdentifier: string;
  readonly connectorRef: string;
  readonly repoName: string;
  readonly branch: string;
  readonly filePath: string;
  readonly gitFetchType: PipelineGitFetchType;
  readonly commitId?: string;
  readonly baseBranch?: string;

  constructor(props: PipelineGitConfigProps) {
    this.pipelineIdentifier = props.pipeline.identifier;
    this.connectorRef = props.connectorRef;
    this.repoName = props.repoName;
    this.branch = props.branch;
    this.filePath = props.filePath;
    this.gitFetchType = props.gitFetchType ?? "Branch";
    this.commitId = props.commitId;
    this.baseBranch = props.baseBranch;
  }

  /** Returns problems with this config; empty when valid. */
  validate(): string[] {
    const errors: string[] = [];
    if (!isValidIdentifier(this.pipelineIdentifier)) {
      errors.push(`invalid pipelineIdentifier "${this.pipelineIdentifier}"`);
    }
    if (this.connectorRef.trim() === "") {
      errors.push("connectorRef must not be empty");
    }
    if (this.repoName.trim() === "") {
      errors.push("repoName must not be empty");
    }
    if (this.branch.trim() === "") {
      errors.push("branch must not be empty");
    }
    if (this.filePath.trim() === "") {
      errors.push("filePath must not be empty");
    }
    if (this.gitFetchType === "Commit" && this.commitId === undefined) {
      errors.push('gitFetchType "Commit" requires a commitId');
    }
    return errors;
  }

  /**
   * The "git details" metadata block for creating/importing this pipeline as a
   * REMOTE entity. This is entity-level metadata, not part of the pipeline YAML
   * document.
   * @throws if the config is invalid.
   */
  toGitDetails(): Record<string, unknown> {
    const errors = this.validate();
    if (errors.length > 0) {
      throw new Error(
        `PipelineGitConfig for "${this.pipelineIdentifier}" is invalid:\n${errors
          .map((e) => `  - ${e}`)
          .join("\n")}`,
      );
    }
    return {
      storeType: "REMOTE",
      connectorRef: this.connectorRef,
      repoName: this.repoName,
      branch: this.branch,
      filePath: this.filePath,
      ...(this.commitId !== undefined && { commitId: this.commitId }),
      ...(this.baseBranch !== undefined && { baseBranch: this.baseBranch }),
    };
  }
}
