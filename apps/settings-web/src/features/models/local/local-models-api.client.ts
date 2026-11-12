import { LocalModelsView } from "@gc/protocol";
import { call } from "../../../lib/settings-api.client";

const PATH = "/api/local-models";

/** The curated local models with their state. */
export const fetchLocalModels = (token: string, base = "") =>
  call(LocalModelsView, { token, path: PATH, base });

/** Starts (or resumes) a download; answers at once with its first progress. */
export const downloadLocalModel = (token: string, id: string, base = "") =>
  call(LocalModelsView, { token, path: `${PATH}/${id}/download`, method: "POST", base });

/** Stops the download; the partial file stays, so a later download resumes. */
export const cancelLocalModel = (token: string, id: string, base = "") =>
  call(LocalModelsView, { token, path: `${PATH}/${id}/download`, method: "DELETE", base });

/** Deletes a model from disk; refused with `model_in_use` while a profile uses it. */
export const deleteLocalModel = (token: string, id: string, base = "") =>
  call(LocalModelsView, { token, path: `${PATH}/${id}`, method: "DELETE", base });
