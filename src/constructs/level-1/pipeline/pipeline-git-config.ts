import { isValidIdentifier } from "../../../identifier.js";
import type { PipelineGitConfigProps, PipelineGitFetchType } from "./types.js";

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
