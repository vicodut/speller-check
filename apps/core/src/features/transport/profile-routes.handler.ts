import { ProfileSave, type ProfilesView } from "@gc/protocol";
import { type AppError, appError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";

/** What the profile routes need (the SettingsService in production). */
export type ProfilesPort = {
  profiles(): ProfilesView;
  create(input: ProfileSave): Promise<Result<ProfilesView, AppError>>;
  update(id: string, input: ProfileSave): Promise<Result<ProfilesView, AppError>>;
  remove(id: string): Promise<Result<ProfilesView, AppError>>;
  activate(id: string): Promise<Result<ProfilesView, AppError>>;
};

type Reply = Result<ProfilesView, AppError>;

/** `/api/profiles/<id>` and `/api/profiles/<id>/activate`; ids are opaque, without slashes. */
const PROFILE_PATH = /^\/api\/profiles\/([^/]+)(\/activate)?$/;

const readInput = async (request: Request): Promise<Result<ProfileSave, AppError>> => {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = ProfileSave.safeParse(body);
  return parsed.success ? ok(parsed.data) : err(appError("body_invalid"));
};

const withInput = async (
  request: Request,
  apply: (input: ProfileSave) => Promise<Reply>,
): Promise<Reply> => {
  const input = await readInput(request);
  return input.ok ? apply(input.value) : input;
};

/**
 * The profile routes. Null when the path isn't one of them; `method_not_allowed` when it is but
 * the method isn't. Every change answers with the updated profiles.
 */
export const routeProfiles = (
  request: Request,
  pathname: string,
  port: ProfilesPort,
): Promise<Reply> | null => {
  const { method } = request;
  if (pathname === "/api/profiles") {
    if (method === "GET") return Promise.resolve(ok(port.profiles()));
    if (method === "POST") return withInput(request, (input) => port.create(input));
    return Promise.resolve(err(appError("method_not_allowed")));
  }
  const match = PROFILE_PATH.exec(pathname);
  if (!match?.[1]) return null;
  const id = decodeURIComponent(match[1]);
  if (match[2]) {
    return Promise.resolve(
      method === "POST" ? port.activate(id) : err(appError("method_not_allowed")),
    );
  }
  if (method === "PUT") return withInput(request, (input) => port.update(id, input));
  if (method === "DELETE") return port.remove(id);
  return Promise.resolve(err(appError("method_not_allowed")));
};
