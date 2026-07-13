# Construct levels

This library organizes constructs into three levels of abstraction, L1 through
L3. Each level is built out of the one below it and answers a different
question for the person writing a pipeline. **Today the library ships L1
only**; the level definitions exist so that L2 and L3 constructs, when they
arrive, are built on a deliberate foundation rather than grown ad hoc.

## L1 — schema mirrors

A 1:1 typed representation of what Harness actually accepts, modeled on the
[v0 pipeline schema][schema]. One construct per schema type (`ShellScriptStep`,
`TerraformPlanStep`, `CustomStage`, `Pipeline`), fields named exactly as the
schema names them, no opinions, no defaults beyond what the schema itself
defines.

The contract: **if you can write it in raw Harness YAML, the L1 can express it
— and nothing more.** The value an L1 adds is purely mechanical:

- Types instead of stringly YAML — a mistyped field is a compile error, not a
  runtime rejection from Harness.
- Composability — constructs are ordinary objects, so pipelines can be built
  with loops, functions, and shared modules.
- Validation — `validate()` catches structural problems (invalid identifiers,
  missing required blocks) before anything is rendered.

L1 users think in terms of the Harness schema. They know what a
`provisionerIdentifier` or a `gitFetchType` is, because the L1 makes them
spell it out.

## L2 — curated resources

Still one construct per schema type, but with opinions: sensible defaults,
inference of fields that are derivable from others, helper methods, and
validation that encodes *how the type is correctly used* rather than just what
shapes it accepts.

An L2 Terraform plan step might default `command` to `"Apply"`, collapse the
config-files block to `{ repo, folder }` with the fetch type inferred, and
expose a method for attaching var files — while still rendering through the L1
underneath. L2 users think in terms of the resource (a plan step, a stage),
just with the boilerplate absorbed.

## L3 — intent constructs

No longer one schema type — one *goal*, expanding into several resources wired
together correctly. The user states intent; the construct encodes the whole
recipe, including the parts they shouldn't have to know exist.

Example: a Terraform deployment construct whose input is "apply this module to
this target" and whose output is a select-delegate step, host-pinning
selectors, a plan step with backend config and credentials derived from shared
conventions, and an apply step inheriting the plan — several resources, plus
the tribal knowledge of *why* plan and apply must share a delegate, all
invisible to the caller. L3 users think in terms of the outcome ("deploy this
to prod"), not the resources.

## Boundaries at a glance

| | Unit | Opinions | User thinks in terms of |
| --- | --- | --- | --- |
| L1 | one schema type | none | the Harness schema |
| L2 | one schema type | defaults + ergonomics | the resource |
| L3 | many resources | full recipe | the outcome |

## Rules

1. **Dependency direction is strictly downward.** L2s are built out of L1s,
   L3s out of L2s and L1s — never the reverse. Nothing under `level-1/` may
   import from a higher-level directory.
2. **L1 stays unopinionated.** L1 is the layer that guarantees *anything
   Harness can do, the library can do*. Opinions live at L2/L3, where they are
   conveniences; baked into L1 they become ceilings.
3. **Every higher level keeps an escape hatch down.** An L2 or L3 must let the
   caller reach the L1 constructs it manages (or accept extra L1-level
   configuration), so an unmodeled schema corner never forces anyone back to
   hand-written YAML.
4. **Fix mistakes at the lowest level they exist.** A wrong field name or a
   too-narrow type in an L1 propagates into every construct above it; correct
   it at L1 before building on top.

## Where things live

Each level gets its own directory under `src/constructs/`: L1 lives in
[`level-1/`](level-1/), and L2/L3 will land as sibling `level-2/` / `level-3/`
directories. The barrel at `src/constructs/index.ts` re-exports every level.

`level-1/` holds the core primitives (`Pipeline`, `Stage`, `Step`, groups),
the concrete stage and step types, the value objects, and the
trigger/git-config resources. See [level-1/CONSTRUCTS.md](level-1/CONSTRUCTS.md)
for the full inventory and its coverage status against the schema. `Expr`
(typed `<+...>` expression builders) is not a construct but belongs to the L1
layer: it is the typed spelling of a raw schema capability, with no opinions
of its own.

[schema]: https://raw.githubusercontent.com/harness/harness-schema/main/v0/pipeline.json
