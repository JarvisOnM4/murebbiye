import { recordPerformanceMetric } from "@/lib/performance/repository";

export async function withPerformanceMetric<T extends Response>(
  routeName: string,
  handler: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();

  try {
    const response = await handler();

    try {
      await recordPerformanceMetric({
        routeName,
        durationMs: Date.now() - startedAt,
        statusCode: response.status
      });
    } catch {
      // swallow metric write errors
    }

    return response;
  } catch (error) {
    try {
      await recordPerformanceMetric({
        routeName,
        durationMs: Date.now() - startedAt,
        statusCode: 500
      });
    } catch {
      // swallow metric write errors
    }

    throw error;
  }
}
