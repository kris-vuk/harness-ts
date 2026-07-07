import { Ajv, type ValidateFunction } from "ajv";
import { expect } from "vitest";
import schema from "../../src/constructs/schema.json";
import type { Pipeline } from "../../src/constructs/index.js";

/**
 * Compiled Harness pipeline validator, built once and reused across all tests.
 *
 * The Harness schema uses vendor extensions that ajv's strict mode rejects
 * (`discriminator`, `desc`/`metadata` annotations, `format: int32`), so the
 * validator is created with strict mode off. These options do not weaken
 * structural validation — required properties, types, enums, and patterns are
 * still enforced.
 */
const ajv = new Ajv({
  strict: false,
  allowUnionTypes: true,
  logger: false,
});

const validatePipeline: ValidateFunction = ajv.compile(schema);

/** Result of validating a JSON document against the Harness pipeline schema. */
export interface SchemaValidationResult {
  valid: boolean;
  /** Human-readable error lines; empty when {@link valid} is true. */
  errors: string[];
}

/**
 * Validates an arbitrary JSON document (typically `pipeline.toJson()`) against
 * the Harness pipeline schema. Returns the outcome instead of throwing, for
 * tests that want to assert on specific failures.
 */
export function validateAgainstSchema(json: unknown): SchemaValidationResult {
  const valid = validatePipeline(json) as boolean;
  const errors = (validatePipeline.errors ?? []).map(
    (e) => `${e.instancePath || "(root)"} ${e.message ?? ""}`.trim(),
  );
  return { valid, errors };
}

/**
 * Asserts that a {@link Pipeline} renders to a document that satisfies the
 * Harness pipeline schema. This is the standard check every construct test
 * should run: build a pipeline containing the construct, then call this.
 *
 * On failure the ajv errors are surfaced in the assertion message so the
 * offending path is visible without re-running.
 */
export function expectValidPipeline(pipeline: Pipeline): void {
  const json = pipeline.toJson();
  const { valid, errors } = validateAgainstSchema(json);
  expect(
    valid,
    `pipeline "${pipeline.identifier}" does not satisfy the Harness schema:\n${errors
      .map((e) => `  - ${e}`)
      .join("\n")}`,
  ).toBe(true);
}
