import { ModelsProbe, type ModelsResult, TestProbe, type TestResult } from "@gc/protocol";
import type { z } from "zod";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";

/** Checks a profile from the form, saved or not (the ProfileProbeProvider in production). */
export type ProbePort = {
  models(probe: ModelsProbe): Promise<ModelsResult>;
  test(probe: TestProbe): Promise<TestResult>;
};

type Reply = Result<ModelsResult | TestResult, AppError>;

const run = async <T>(
  request: Request,
  schema: z.ZodType<T>,
  probe: (input: T) => Promise<ModelsResult | TestResult>,
): Promise<Reply> => {
  if (request.method !== "POST") return err(appError("method_not_allowed"));
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  return parsed.success ? ok(await probe(parsed.data)) : err(appError("body_invalid"));
};

/**
 * `POST /api/probe/models` and `POST /api/probe/test`; null for any other path. A probe that
 * reached its endpoint and failed is still a 200: its result says why (`key_rejected`, …).
 */
export const routeProbe = (
  request: Request,
  pathname: string,
  port: ProbePort,
): Promise<Reply> | null => {
  if (pathname === "/api/probe/models")
    return run(request, ModelsProbe, (probe) => port.models(probe));
  if (pathname === "/api/probe/test") return run(request, TestProbe, (probe) => port.test(probe));
  return null;
};
