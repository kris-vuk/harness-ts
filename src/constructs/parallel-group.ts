import type { ExecutionItem } from "./stage.js";

export interface ParallelGroupProps {
  /** The items to run concurrently. */
  steps: ExecutionItem[];
}

/**
 * A parallel group inside a stage's execution: its items run concurrently.
 * Maps to the `parallel` variant of `ExecutionWrapperConfig`, which the v0
 * schema models as a bare array (`ParallelStepElementConfig`) — so this
 * renders `{ parallel: [ ...items ] }` and has no identifier of its own.
 */
export class ParallelGroup implements ExecutionItem {
  private readonly items: ExecutionItem[] = [];

  constructor(props: ParallelGroupProps) {
    for (const item of props.steps) {
      this.items.push(item);
    }
  }

  addStep(item: ExecutionItem): this {
    this.items.push(item);
    return this;
  }

  /**
   * A parallel group has no identifier in the schema. We derive a synthetic
   * one from its children so the enclosing stage can key/deduplicate it and
   * prefix error messages; it is never rendered.
   */
  get identifier(): string {
    return `parallel(${this.items.map((item) => item.identifier).join(",")})`;
  }

  validate(): string[] {
    const errors: string[] = [];
    if (this.items.length === 0) {
      errors.push("parallel group must contain at least one step");
    }
    const seen = new Set<string>();
    for (const item of this.items) {
      if (seen.has(item.identifier)) {
        errors.push(`duplicate step identifier "${item.identifier}"`);
      }
      seen.add(item.identifier);
      errors.push(...item.validate().map((e) => `"${item.identifier}": ${e}`));
    }
    return errors;
  }

  toJson(): Record<string, unknown> {
    return {
      parallel: this.items.map((item) => item.toJson()),
    };
  }
}
