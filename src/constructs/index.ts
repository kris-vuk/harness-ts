/**
 * Construct barrel. Constructs are organized by abstraction level (see
 * LEVELS.md); each level re-exports from its own directory. Only L1 exists
 * today — L2/L3 will be added as sibling directories (`level-2/`, `level-3/`)
 * as they land.
 */
export * from "./level-1/index.js";
