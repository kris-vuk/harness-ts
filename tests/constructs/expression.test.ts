import { describe, expect, test } from "vitest";
import { Expr } from "../../src/constructs/index.js";

/**
 * These assertions pin the exact `<+...>` tokens that hand-written pipelines
 * (e.g. an example consumer) depend on. If a builder's output drifts, a pipeline
 * that swapped a literal for `Expr` would silently change its synthesized YAML
 * — so the strings here are deliberately spelled out in full.
 */
describe("Expr", () => {
  test("identifier roots", () => {
    expect(`${Expr.accountId}`).toBe("<+account.identifier>");
    expect(`${Expr.projectId}`).toBe("<+project.identifier>");
    expect(`${Expr.orgId}`).toBe("<+org.identifier>");
    expect(`${Expr.pipelineBranch}`).toBe("<+pipeline.branch>");
  });

  test("variable references", () => {
    expect(`${Expr.pipelineVar("environment")}`).toBe(
      "<+pipeline.variables.environment>",
    );
    expect(`${Expr.stageVar("foo")}`).toBe("<+stage.variables.foo>");
  });

  test("step output", () => {
    expect(`${Expr.stepOutput("select_delegate", "HOST_SELECTOR")}`).toBe(
      "<+execution.steps.select_delegate.output.outputVariables.HOST_SELECTOR>",
    );
  });

  test("secret", () => {
    expect(`${Expr.secret("harness-token-monorepo-org-sa")}`).toBe(
      '<+secrets.getValue("harness-token-monorepo-org-sa")>',
    );
  });

  test("replace() splices inside the token", () => {
    expect(`${Expr.pipelineVar("region").replace("-", "")}`).toBe(
      '<+pipeline.variables.region.replace("-","")>',
    );
  });

  describe("input()", () => {
    test("bare", () => {
      expect(`${Expr.input()}`).toBe("<+input>");
    });

    test("non-empty default renders bare", () => {
      expect(`${Expr.input({ default: "us-east-1" })}`).toBe(
        "<+input>.default(us-east-1)",
      );
    });

    test("empty default renders quoted", () => {
      expect(`${Expr.input({ default: "" })}`).toBe('<+input>.default("")');
    });

    test("default + selectOneFrom", () => {
      expect(
        `${Expr.input({ default: "dev", selectOneFrom: ["dev", "stage", "prod"] })}`,
      ).toBe("<+input>.default(dev).selectOneFrom(dev,stage,prod)");
    });
  });

  test("coerces to its token via String() and JSON", () => {
    const e = Expr.pipelineVar("region");
    expect(String(e)).toBe("<+pipeline.variables.region>");
    expect(JSON.parse(JSON.stringify({ v: e })).v).toBe(
      "<+pipeline.variables.region>",
    );
  });
});
