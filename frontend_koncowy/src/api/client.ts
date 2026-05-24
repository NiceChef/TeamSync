/**
 * Simulates network latency for mock API calls.
 * Replace this module with a real HTTP client (e.g. ky, axios) once the backend is ready.
 */
const SIMULATED_DELAY_MS = 300;

export async function fakeDelay<T>(data: T): Promise<T> {
  return new Promise((resolve) =>
    setTimeout(() => resolve(data), SIMULATED_DELAY_MS),
  );
}
