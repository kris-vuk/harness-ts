import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * A resource the {@link App} can render to a file: anything with a stable
 * `identifier` and a `synth()` that returns a YAML document. Both {@link
 * Pipeline} and {@link GithubPushTrigger} satisfy this.
 */
export interface Synthesizable {
  readonly identifier: string;
  synth(): string;
}

/**
 * A resource that carries other synthesizable resources emitted alongside it —
 * e.g. a {@link Pipeline} exposes its attached triggers. {@link App.add}
 * discovers these so one `add()` writes every related file.
 */
interface HasAttachedResources {
  attachedResources(): Synthesizable[];
}

function hasAttachedResources(
  resource: Synthesizable,
): resource is Synthesizable & HasAttachedResources {
  return (
    typeof (resource as Partial<HasAttachedResources>).attachedResources ===
    "function"
  );
}

/** A resource added to an {@link App}, with its resolved output file name. */
interface AppEntry {
  resource: Synthesizable;
  fileName: string;
}

export interface AppProps {
  /**
   * Directory the synthesized YAML files are written to, relative to the
   * current working directory (or absolute). Defaults to ".harness".
   */
  outdir?: string;
}

export interface AddOptions {
  /**
   * Output file name (with or without a `.yaml` extension). Defaults to the
   * resource's identifier, so a pipeline `My_Pipeline` writes to
   * `My_Pipeline.yaml`.
   */
  fileName?: string;
}

/**
 * Collects synthesizable resources and writes each to its own YAML file under
 * {@link AppProps.outdir} (default `.harness`). This is the build entry point a
 * consumer wires to an npm script:
 *
 * ```ts
 * // harness.ts
 * import { App } from "harness-ts";
 * import { pipeline } from "./my-pipeline.js"; // with pipeline.addTrigger(...)
 *
 * new App().add(pipeline).synth(); // writes the pipeline + its triggers
 * ```
 *
 * ```jsonc
 * // package.json
 * "scripts": { "synth": "tsx harness.ts" }
 * ```
 *
 * `npm run synth` then writes `.harness/<identifier>.yaml` for each resource.
 * Each resource's own `synth()` validates before rendering, so an invalid
 * pipeline throws instead of writing a broken file.
 */
export class App {
  readonly outdir: string;
  private readonly entries: AppEntry[] = [];

  constructor(props: AppProps = {}) {
    this.outdir = props.outdir ?? ".harness";
  }

  /**
   * Registers a resource to be written on {@link synth}, along with any
   * resources it carries (e.g. a pipeline's attached triggers). Chainable.
   */
  add(resource: Synthesizable, options: AddOptions = {}): this {
    this.register(resource, options.fileName);
    if (hasAttachedResources(resource)) {
      for (const attached of resource.attachedResources()) {
        this.register(attached);
      }
    }
    return this;
  }

  /** Registers a single resource, ignoring one already added by identity. */
  private register(resource: Synthesizable, fileName?: string): void {
    if (this.entries.some((e) => e.resource === resource)) {
      return;
    }
    const base = fileName ?? resource.identifier;
    this.entries.push({
      resource,
      fileName: base.endsWith(".yaml") ? base : `${base}.yaml`,
    });
  }

  /**
   * Renders every added resource and writes it to `<outdir>/<fileName>`,
   * creating `outdir` if needed. Returns the absolute paths written.
   *
   * @throws if two resources resolve to the same file, or if any resource's
   *   own `synth()` throws (e.g. an invalid pipeline). Validation happens for
   *   every resource before anything is written, so a failure leaves no
   *   partial output.
   */
  synth(): string[] {
    const dir = resolve(this.outdir);

    const seen = new Set<string>();
    for (const { fileName } of this.entries) {
      if (seen.has(fileName)) {
        throw new Error(
          `App: two resources write to "${fileName}"; ` +
            "pass a distinct fileName to add().",
        );
      }
      seen.add(fileName);
    }

    // Render everything first so a validation error writes nothing.
    const rendered = this.entries.map(({ resource, fileName }) => ({
      path: join(dir, fileName),
      yaml: resource.synth(),
    }));

    mkdirSync(dir, { recursive: true });
    for (const { path, yaml } of rendered) {
      writeFileSync(path, yaml);
    }
    return rendered.map((r) => r.path);
  }
}
