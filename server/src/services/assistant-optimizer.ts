/**
 * Optimizer route.
 *
 * The schedule optimizer is not implemented yet.
 *
 * This route exists to keep schedule-related requests separate from the
 * normal AI assistant route. Once the schedule optimizer backend is
 * implemented, this module will be responsible for integrating the
 * assistant/router with that backend.
 *
 * The optimizer itself is NOT implemented here.
 */

export type OptimizerOutcome = {
  response: string;
};

export async function runOptimizerRoute(): Promise<OptimizerOutcome> {
  return {
    response:
      'The schedule optimizer is not available yet. It will be added once the optimizer backend is implemented.',
  };
}