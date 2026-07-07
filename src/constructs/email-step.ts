import { Step, type StepProps } from "./step.js";

export interface EmailStepProps extends StepProps {
  subject: string;
  /** Comma-separated recipient addresses. */
  to?: string;
  /** Comma-separated CC addresses. */
  cc?: string;
  body?: string;
  /** Send without waiting for delivery confirmation. */
  fireAndForget?: boolean;
}

/**
 * A Harness Email step (`type: Email`): sends an email. Renders the
 * `EmailStepInfo` spec, whose only required field is `subject`.
 */
export class EmailStep extends Step {
  readonly stepType = "Email";

  private readonly subject: string;
  private readonly to?: string;
  private readonly cc?: string;
  private readonly body?: string;
  private readonly fireAndForget?: boolean;

  constructor(props: EmailStepProps) {
    super(props);
    this.subject = props.subject;
    this.to = props.to;
    this.cc = props.cc;
    this.body = props.body;
    this.fireAndForget = props.fireAndForget;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.subject.trim() === "") {
      errors.push("subject must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      subject: this.subject,
      ...(this.to !== undefined && { to: this.to }),
      ...(this.cc !== undefined && { cc: this.cc }),
      ...(this.body !== undefined && { body: this.body }),
      ...(this.fireAndForget !== undefined && { fireAndForget: this.fireAndForget }),
    };
  }
}
