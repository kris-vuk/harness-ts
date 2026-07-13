/**
 * A looping / repeat strategy (`HarnessForConfig`, the `repeat` variant of
 * `StrategyConfig`). Iterate over `items`, or `times` a fixed count, or a
 * `start`/`end` range; `unit` and `partitionSize` support percentage-based
 * partitioning. All fields may also be runtime expression strings.
 */
export interface RepeatStrategy {
  /** Values to iterate over, or an expression resolving to a list. */
  items?: string[] | string;
  /** Number of iterations. */
  times?: number | string;
  /** Cap on concurrent iterations. */
  maxConcurrency?: number | string;
  start?: number | string;
  end?: number | string;
  unit?: "Percentage" | "Count";
  partitionSize?: number | string;
}

/**
 * A step/stage looping strategy (`StrategyConfig`) in one of its three common
 * forms: a `matrix` of named axes, fixed `parallelism`, or a `repeat` loop.
 */
export type Strategy =
  | {
      type: "matrix";
      /** Axis name -> list of values; the cross product is fanned out. */
      axes: Record<string, string[]>;
      maxConcurrency?: number;
      /** Axis-value combinations to skip. */
      exclude?: Record<string, string>[];
    }
  | { type: "parallelism"; parallelism: number }
  | { type: "repeat"; repeat: RepeatStrategy };

function renderRepeat(r: RepeatStrategy): Record<string, unknown> {
  return {
    ...(r.items !== undefined && { items: r.items }),
    ...(r.times !== undefined && { times: r.times }),
    ...(r.maxConcurrency !== undefined && { maxConcurrency: r.maxConcurrency }),
    ...(r.start !== undefined && { start: r.start }),
    ...(r.end !== undefined && { end: r.end }),
    ...(r.unit !== undefined && { unit: r.unit }),
    ...(r.partitionSize !== undefined && { partitionSize: r.partitionSize }),
  };
}

/** Renders a {@link Strategy} to its `StrategyConfig` object. */
export function renderStrategy(s: Strategy): Record<string, unknown> {
  switch (s.type) {
    case "matrix":
      return {
        matrix: {
          ...s.axes,
          ...(s.maxConcurrency !== undefined && {
            maxConcurrency: s.maxConcurrency,
          }),
          ...(s.exclude !== undefined && { exclude: s.exclude }),
        },
      };
    case "parallelism":
      return { parallelism: s.parallelism };
    case "repeat":
      return { repeat: renderRepeat(s.repeat) };
  }
}
