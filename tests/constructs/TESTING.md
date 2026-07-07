# Test requirements

Rules for writing construct tests in this directory. Every new construct MUST
have a test that validates its rendered output against the Harness schema.

## Required for every construct

1. Add a `*.test.ts` file (or a case in an existing one) under `tests/constructs/`.
2. Build a `Pipeline` that contains the construct under test.
3. Assert it validates with `expectValidPipeline(pipeline)`.

A construct is not considered done until it has a passing schema-validation test.

## Helper API (`tests/constructs/harness-schema.ts`)

- `expectValidPipeline(pipeline: Pipeline): void` — renders `pipeline.toJson()`,
  validates against `schema.json`, fails the test with ajv error paths on
  mismatch. Use this by default.
- `validateAgainstSchema(json: unknown): { valid: boolean; errors: string[] }` —
  returns the result instead of asserting. Use when a test needs to assert on
  specific error messages (e.g. negative tests).

The ajv validator is compiled once at module load and reused; do not construct
your own.

## Canonical pattern

```ts
import { describe, test } from "vitest";
import { CIStage, Pipeline, ShellScriptStep } from "../../src/constructs/index.js";
import { expectValidPipeline } from "./harness-schema.js";

describe("MyStep", () => {
  test("validates against the Harness schema", () => {
    const pipeline = new Pipeline({
      name: "Test Pipeline",
      projectIdentifier: "testproj",
      orgIdentifier: "default",
      stages: [
        new CIStage({
          name: "Build",
          platform: { os: "Linux", arch: "Amd64" },
          runtime: { type: "Cloud" },
          cloneCodebase: false,
          steps: [
            new ShellScriptStep({ name: "Run", script: "echo hi", timeout: "10m" }),
          ],
        }),
      ],
    });
    expectValidPipeline(pipeline);
  });
});
```

## Conventions

- **Imports:** import constructs from `../../src/constructs/index.js` (note the
  `.js` extension — the project uses Node16 module resolution). Import helpers
  from `./harness-schema.js`.
- **File naming:** `<construct>.test.ts`.
- **Structure:** one top-level `describe` per construct.
- **Minimal fixtures:** build the smallest valid pipeline that exercises the
  construct. A step needs a stage (`CIStage` is the simplest) to sit in; a stage
  needs a `Pipeline`.
- **Negative tests (optional):** assert a construct's own `validate()` returns an
  expected error string, or use `validateAgainstSchema()` to check a hand-built
  bad document is rejected.

## Commands

- `npm test` — run all tests (`vitest run`).
- `npm run typecheck` — `tsc`; tests must typecheck too.

Both must be green before a construct is complete.

## Gotcha

`schema.json` is vendored and had 3 ajv-incompatible nodes removed (empty
`enum`, `null` `minLength`, `null` `properties`). If the schema is
re-downloaded, re-apply those removals or the helper throws at import. See
`src/constructs/CONSTRUCTS.md` for details.
