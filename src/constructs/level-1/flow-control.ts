/**
 * Pipeline flow control (`flowControl`). Declares the barriers that
 * {@link BarrierStep}s across the pipeline synchronize on; every barrier a
 * step references must be declared here.
 */

/** A named synchronization barrier (`barrierConfig`). */
export interface Barrier {
  /** Identifier a `Barrier` step references via its `barrierRef`. */
  identifier: string;
  /** Display name. */
  name: string;
}

/** Pipeline-level flow control (`flowControl`): the set of declared barriers. */
export interface FlowControl {
  barriers: Barrier[];
}

/** Renders a {@link FlowControl} to its `flowControl` object. */
export function renderFlowControl(fc: FlowControl): Record<string, unknown> {
  return {
    barriers: fc.barriers.map((b) => ({
      identifier: b.identifier,
      name: b.name,
    })),
  };
}
