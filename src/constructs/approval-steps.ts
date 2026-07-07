import { Step, type StepProps } from "./step.js";
import type { Shell, ShellScriptVariable } from "./shell-script-step.js";

/**
 * Approval/rejection criteria (`CriteriaSpecWrapper`): either a JEXL
 * expression or a set of key/value conditions. Shared by the Jira,
 * ServiceNow, and Custom approval steps.
 */
export type ApprovalCriteria =
  | { type: "Jexl"; expression: string }
  | {
      type: "KeyValues";
      /** Match any condition (OR) instead of all (AND). Defaults to false. */
      matchAnyCondition?: boolean;
      conditions: ApprovalCondition[];
    };

export interface ApprovalCondition {
  key: string;
  /** e.g. "equals", "not equals", "in", "not in". */
  operator: string;
  value: string;
}

function renderCriteria(criteria: ApprovalCriteria): Record<string, unknown> {
  if (criteria.type === "Jexl") {
    return { type: "Jexl", spec: { expression: criteria.expression } };
  }
  return {
    type: "KeyValues",
    spec: {
      matchAnyCondition: criteria.matchAnyCondition ?? false,
      conditions: criteria.conditions,
    },
  };
}

/** Who may approve a `HarnessApproval` step (`Approvers`). */
export interface HarnessApprovers {
  /** Harness user groups allowed to approve. */
  userGroups: string[];
  /** Minimum number of approvals required. */
  minimumCount: number;
  /** Prevent the user who triggered the pipeline from approving. Defaults to false. */
  disallowPipelineExecutor?: boolean;
}

/** An input the approver fills in (`ApproverInputInfo`). */
export interface ApproverInput {
  name: string;
  defaultValue?: string;
}

export interface HarnessApprovalStepProps extends StepProps {
  approvers: HarnessApprovers;
  approvalMessage?: string;
  /** Show prior executions in the approval UI. Defaults to true. */
  includePipelineExecutionHistory?: boolean;
  approverInputs?: ApproverInput[];
}

/**
 * A Harness manual approval step (`type: HarnessApproval`): pauses for
 * approval by members of the given user groups. Renders the
 * `HarnessApprovalStepInfo` spec.
 */
export class HarnessApprovalStep extends Step {
  readonly stepType = "HarnessApproval";

  private readonly approvers: HarnessApprovers;
  private readonly approvalMessage?: string;
  private readonly includePipelineExecutionHistory: boolean;
  private readonly approverInputs: ApproverInput[];

  constructor(props: HarnessApprovalStepProps) {
    super(props);
    this.approvers = props.approvers;
    this.approvalMessage = props.approvalMessage;
    this.includePipelineExecutionHistory =
      props.includePipelineExecutionHistory ?? true;
    this.approverInputs = props.approverInputs ?? [];
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.approvers.userGroups.length === 0) {
      errors.push("approvers.userGroups must not be empty");
    }
    if (this.approvers.minimumCount < 1) {
      errors.push("approvers.minimumCount must be at least 1");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      ...(this.approvalMessage !== undefined && {
        approvalMessage: this.approvalMessage,
      }),
      includePipelineExecutionHistory: this.includePipelineExecutionHistory,
      approvers: {
        userGroups: this.approvers.userGroups,
        minimumCount: this.approvers.minimumCount,
        disallowPipelineExecutor: this.approvers.disallowPipelineExecutor ?? false,
      },
      ...(this.approverInputs.length > 0 && {
        approverInputs: this.approverInputs.map((i) => ({
          name: i.name,
          ...(i.defaultValue !== undefined && { defaultValue: i.defaultValue }),
        })),
      }),
    };
  }
}

export interface JiraApprovalStepProps extends StepProps {
  connectorRef: string;
  issueKey: string;
  approvalCriteria: ApprovalCriteria;
  rejectionCriteria?: ApprovalCriteria;
  issueType?: string;
  projectKey?: string;
  retryInterval?: string;
  delegateSelectors?: string[];
}

/**
 * A Harness Jira approval step (`type: JiraApproval`): polls a Jira issue
 * until it meets the approval (or rejection) criteria. Renders the
 * `JiraApprovalStepInfo` spec.
 */
export class JiraApprovalStep extends Step {
  readonly stepType = "JiraApproval";

  private readonly connectorRef: string;
  private readonly issueKey: string;
  private readonly approvalCriteria: ApprovalCriteria;
  private readonly rejectionCriteria?: ApprovalCriteria;
  private readonly issueType?: string;
  private readonly projectKey?: string;
  private readonly retryInterval?: string;
  private readonly delegateSelectors?: string[];

  constructor(props: JiraApprovalStepProps) {
    super(props);
    this.connectorRef = props.connectorRef;
    this.issueKey = props.issueKey;
    this.approvalCriteria = props.approvalCriteria;
    this.rejectionCriteria = props.rejectionCriteria;
    this.issueType = props.issueType;
    this.projectKey = props.projectKey;
    this.retryInterval = props.retryInterval;
    this.delegateSelectors = props.delegateSelectors;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.connectorRef.trim() === "") {
      errors.push("connectorRef must not be empty");
    }
    if (this.issueKey.trim() === "") {
      errors.push("issueKey must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      connectorRef: this.connectorRef,
      issueKey: this.issueKey,
      approvalCriteria: renderCriteria(this.approvalCriteria),
      ...(this.rejectionCriteria !== undefined && {
        rejectionCriteria: renderCriteria(this.rejectionCriteria),
      }),
      ...(this.issueType !== undefined && { issueType: this.issueType }),
      ...(this.projectKey !== undefined && { projectKey: this.projectKey }),
      ...(this.retryInterval !== undefined && { retryInterval: this.retryInterval }),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
    };
  }
}

export interface ServiceNowApprovalStepProps extends StepProps {
  connectorRef: string;
  ticketNumber: string;
  ticketType: string;
  approvalCriteria: ApprovalCriteria;
  rejectionCriteria?: ApprovalCriteria;
  retryInterval?: string;
  delegateSelectors?: string[];
}

/**
 * A Harness ServiceNow approval step (`type: ServiceNowApproval`): polls a
 * ServiceNow ticket until it meets the approval (or rejection) criteria.
 * Renders the `ServiceNowApprovalStepInfo` spec.
 */
export class ServiceNowApprovalStep extends Step {
  readonly stepType = "ServiceNowApproval";

  private readonly connectorRef: string;
  private readonly ticketNumber: string;
  private readonly ticketType: string;
  private readonly approvalCriteria: ApprovalCriteria;
  private readonly rejectionCriteria?: ApprovalCriteria;
  private readonly retryInterval?: string;
  private readonly delegateSelectors?: string[];

  constructor(props: ServiceNowApprovalStepProps) {
    super(props);
    this.connectorRef = props.connectorRef;
    this.ticketNumber = props.ticketNumber;
    this.ticketType = props.ticketType;
    this.approvalCriteria = props.approvalCriteria;
    this.rejectionCriteria = props.rejectionCriteria;
    this.retryInterval = props.retryInterval;
    this.delegateSelectors = props.delegateSelectors;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.connectorRef.trim() === "") {
      errors.push("connectorRef must not be empty");
    }
    if (this.ticketNumber.trim() === "") {
      errors.push("ticketNumber must not be empty");
    }
    if (this.ticketType.trim() === "") {
      errors.push("ticketType must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      connectorRef: this.connectorRef,
      ticketNumber: this.ticketNumber,
      ticketType: this.ticketType,
      approvalCriteria: renderCriteria(this.approvalCriteria),
      ...(this.rejectionCriteria !== undefined && {
        rejectionCriteria: renderCriteria(this.rejectionCriteria),
      }),
      ...(this.retryInterval !== undefined && { retryInterval: this.retryInterval }),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
    };
  }
}

export interface CustomApprovalStepProps extends StepProps {
  /** The inline script whose output the criteria are evaluated against. */
  script: string;
  /** Defaults to "Bash". */
  shell?: Shell;
  approvalCriteria: ApprovalCriteria;
  rejectionCriteria?: ApprovalCriteria;
  /** How often to re-run the script, e.g. "1m". Defaults to "1m". */
  retryInterval?: string;
  /** Per-attempt script timeout, e.g. "10m". Defaults to "10m". */
  scriptTimeout?: string;
  environmentVariables?: ShellScriptVariable[];
  outputVariables?: ShellScriptVariable[];
  delegateSelectors?: string[];
}

/**
 * A Harness Custom approval step (`type: CustomApproval`): runs a script on an
 * interval and approves/rejects based on its output. Renders the
 * `CustomApprovalStepInfo` spec (an inline-source ShellScript plus criteria).
 */
export class CustomApprovalStep extends Step {
  readonly stepType = "CustomApproval";

  private readonly script: string;
  private readonly shell: Shell;
  private readonly approvalCriteria: ApprovalCriteria;
  private readonly rejectionCriteria?: ApprovalCriteria;
  private readonly retryInterval: string;
  private readonly scriptTimeout: string;
  private readonly environmentVariables: ShellScriptVariable[];
  private readonly outputVariables: ShellScriptVariable[];
  private readonly delegateSelectors?: string[];

  constructor(props: CustomApprovalStepProps) {
    super(props);
    this.script = props.script;
    this.shell = props.shell ?? "Bash";
    this.approvalCriteria = props.approvalCriteria;
    this.rejectionCriteria = props.rejectionCriteria;
    this.retryInterval = props.retryInterval ?? "1m";
    this.scriptTimeout = props.scriptTimeout ?? "10m";
    this.environmentVariables = props.environmentVariables ?? [];
    this.outputVariables = props.outputVariables ?? [];
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
      approvalCriteria: renderCriteria(this.approvalCriteria),
      ...(this.rejectionCriteria !== undefined && {
        rejectionCriteria: renderCriteria(this.rejectionCriteria),
      }),
      retryInterval: this.retryInterval,
      scriptTimeout: this.scriptTimeout,
      ...(this.environmentVariables.length > 0 && {
        environmentVariables: this.environmentVariables,
      }),
      ...(this.outputVariables.length > 0 && {
        outputVariables: this.outputVariables,
      }),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
    };
  }
}
