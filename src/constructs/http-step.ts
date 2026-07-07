import { Step, type StepProps } from "./step.js";

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | "PATCH";

/** A request header (`HttpHeaderConfig`). */
export interface HttpHeader {
  key: string;
  value: string;
}

/** A value captured from the response, referenceable downstream (`NGVariable`). */
export interface HttpOutputVariable {
  name: string;
  /** JEXL expression evaluated against the response, e.g. "<+json.object(...)>". */
  value: string;
  type?: "String" | "Number" | "Secret";
}

export interface HttpStepProps extends StepProps {
  url: string;
  method: HttpMethod;
  requestBody?: string;
  headers?: HttpHeader[];
  /** JEXL assertion that must pass for the step to succeed. */
  assertion?: string;
  outputVariables?: HttpOutputVariable[];
  delegateSelectors?: string[];
}

/**
 * A Harness HTTP step (`type: Http`): makes an HTTP request and optionally
 * asserts on the response. Renders the `HttpStepInfo` spec (required `url`
 * and `method`).
 */
export class HttpStep extends Step {
  readonly stepType = "Http";

  private readonly url: string;
  private readonly method: HttpMethod;
  private readonly requestBody?: string;
  private readonly headers: HttpHeader[];
  private readonly assertion?: string;
  private readonly outputVariables: HttpOutputVariable[];
  private readonly delegateSelectors?: string[];

  constructor(props: HttpStepProps) {
    super(props);
    this.url = props.url;
    this.method = props.method;
    this.requestBody = props.requestBody;
    this.headers = props.headers ?? [];
    this.assertion = props.assertion;
    this.outputVariables = props.outputVariables ?? [];
    this.delegateSelectors = props.delegateSelectors;
  }

  override validate(): string[] {
    const errors = super.validate();
    if (this.url.trim() === "") {
      errors.push("url must not be empty");
    }
    return errors;
  }

  protected renderSpec(): Record<string, unknown> {
    return {
      url: this.url,
      method: this.method,
      ...(this.requestBody !== undefined && { requestBody: this.requestBody }),
      ...(this.headers.length > 0 && { headers: this.headers }),
      ...(this.assertion !== undefined && { assertion: this.assertion }),
      ...(this.outputVariables.length > 0 && {
        outputVariables: this.outputVariables.map((v) => ({
          name: v.name,
          type: v.type ?? "String",
          value: v.value,
        })),
      }),
      ...(this.delegateSelectors !== undefined && {
        delegateSelectors: this.delegateSelectors,
      }),
    };
  }
}
