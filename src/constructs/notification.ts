/**
 * Pipeline notification support (`NotificationRules`). A rule fires its
 * {@link NotificationChannel} when one of its {@link PipelineEvent}s occurs.
 */

/** Events a notification rule can subscribe to (`PipelineEvent.type`). */
export const PIPELINE_EVENT_TYPES = [
  "AllEvents",
  "PipelineStart",
  "PipelineSuccess",
  "PipelineFailed",
  "PipelineEnd",
  "PipelinePaused",
  "StageSuccess",
  "StageFailed",
  "StageStart",
  "StepFailed",
  "TriggerFailed",
  "WaitingForUserAction",
  "PipelineResumed",
] as const;

export type PipelineEventType = (typeof PIPELINE_EVENT_TYPES)[number];

/**
 * A subscription to one class of pipeline events (`PipelineEvent`). The
 * stage-scoped events (`Stage*`) may be narrowed to specific stages via
 * `forStages`; `StepFailed` may be narrowed via `forSteps`.
 */
export interface PipelineEvent {
  type: PipelineEventType;
  /** Restrict a stage event to these stage identifiers. */
  forStages?: string[];
  /** Restrict a step event to these step identifiers. */
  forSteps?: string[];
}

/**
 * The channel a rule delivers to (`NotificationChannelWrapper`). A
 * discriminated union over the six channel types Harness supports; each
 * carries only the fields relevant to that transport.
 */
export type NotificationChannel =
  | { type: "Email"; recipients?: string[]; userGroups?: string[] }
  | { type: "Slack"; webhookUrl?: string; userGroups?: string[] }
  | { type: "MsTeams"; msTeamKeys?: string[]; userGroups?: string[] }
  | { type: "PagerDuty"; integrationKey?: string; userGroups?: string[] }
  | {
      type: "Webhook";
      webhookUrl?: string;
      headers?: Record<string, string>;
    }
  | {
      type: "Datadog";
      url: string;
      apiKey: string;
      headers?: Record<string, string>;
    };

/**
 * A single notification rule (`NotificationRules`): when any of `events`
 * occurs, deliver via `notificationMethod`. `enabled` defaults to true.
 */
export interface NotificationRule {
  name: string;
  /** Whether the rule is active. Defaults to true when rendered. */
  enabled?: boolean;
  /** Events that trigger the rule (`pipelineEvents`). */
  events: PipelineEvent[];
  /** The channel to deliver on (`notificationMethod`). */
  notificationMethod: NotificationChannel;
}

function renderChannelSpec(c: NotificationChannel): Record<string, unknown> {
  switch (c.type) {
    case "Email":
      return {
        ...(c.recipients !== undefined && { recipients: c.recipients }),
        ...(c.userGroups !== undefined && { userGroups: c.userGroups }),
      };
    case "Slack":
      return {
        ...(c.webhookUrl !== undefined && { webhookUrl: c.webhookUrl }),
        ...(c.userGroups !== undefined && { userGroups: c.userGroups }),
      };
    case "MsTeams":
      return {
        ...(c.msTeamKeys !== undefined && { msTeamKeys: c.msTeamKeys }),
        ...(c.userGroups !== undefined && { userGroups: c.userGroups }),
      };
    case "PagerDuty":
      return {
        ...(c.integrationKey !== undefined && {
          integrationKey: c.integrationKey,
        }),
        ...(c.userGroups !== undefined && { userGroups: c.userGroups }),
      };
    case "Webhook":
      return {
        ...(c.webhookUrl !== undefined && { webhookUrl: c.webhookUrl }),
        ...(c.headers !== undefined && { headers: c.headers }),
      };
    case "Datadog":
      return {
        url: c.url,
        apiKey: c.apiKey,
        ...(c.headers !== undefined && { headers: c.headers }),
      };
  }
}

function renderEvent(e: PipelineEvent): Record<string, unknown> {
  return {
    type: e.type,
    ...(e.forStages !== undefined && { forStages: e.forStages }),
    ...(e.forSteps !== undefined && { forSteps: e.forSteps }),
  };
}

/** Renders a {@link NotificationRule} to its `NotificationRules` object. */
export function renderNotificationRule(
  r: NotificationRule,
): Record<string, unknown> {
  return {
    name: r.name,
    enabled: r.enabled ?? true,
    pipelineEvents: r.events.map(renderEvent),
    notificationMethod: {
      type: r.notificationMethod.type,
      spec: renderChannelSpec(r.notificationMethod),
    },
  };
}
