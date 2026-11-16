/**
 * Deadlines for the Studio Connect path. Every stage that waits on the network
 * (or on the extension) is bounded: a hung player request or a googlevideo
 * fetch that never answers must surface as an error toast, never as a spinner
 * that spins until the tab is closed.
 */

export class StageTimeoutError extends Error {
  override readonly name = 'StageTimeoutError';

  constructor(
    readonly stage: string,
    readonly ms: number,
  ) {
    super(`${stage} didn't answer within ${Math.round(ms / 1000)}s`);
  }
}

/** Resolves/rejects with [promise], or rejects with StageTimeoutError after [ms]. */
export function withTimeout<T>(promise: Promise<T>, ms: number, stage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new StageTimeoutError(stage, ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
