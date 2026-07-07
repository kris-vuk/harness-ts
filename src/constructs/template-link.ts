/**
 * A reference to a Harness template (`TemplateLinkConfig`). Used wherever a
 * pipeline, stage, step, or step group is sourced from a template rather than
 * defined inline.
 */
export interface TemplateLink {
  /** Reference to the template (account/org/project scoped). */
  templateRef: string;
  /**
   * Template version to resolve. Schema pattern:
   * `^[0-9a-zA-Z][^\s/&]{0,63}$`. Omit to use the stable version.
   */
  versionLabel?: string;
  /** Runtime inputs supplied to the template (`templateInputs`). */
  templateInputs?: Record<string, unknown>;
  /** Variable overrides supplied to the template (`templateVariables`). */
  templateVariables?: Record<string, unknown>;
}

/** Renders a {@link TemplateLink} to its `TemplateLinkConfig` object. */
export function renderTemplateLink(t: TemplateLink): Record<string, unknown> {
  return {
    templateRef: t.templateRef,
    ...(t.versionLabel !== undefined && { versionLabel: t.versionLabel }),
    ...(t.templateInputs !== undefined && { templateInputs: t.templateInputs }),
    ...(t.templateVariables !== undefined && {
      templateVariables: t.templateVariables,
    }),
  };
}
