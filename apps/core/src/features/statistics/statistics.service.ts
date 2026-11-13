import type { StatisticsRow, StatisticsView } from "@gc/protocol";
import type { AppError } from "../../shared/errors";
import type { Result } from "../../shared/result";
import type { StatisticsRecorder } from "./statistics.recorder";
import { cellStats } from "./statistics-aggregate.util";

/** The label for a row whose profile is no longer saved (a profile removed after its calls). */
const REMOVED_PROFILE = "Removed profile";

const EMPTY_CELL = cellStats({ ok: [], failures: {} });

/**
 * The statistics as the page reads them: one row per profile and model, each feature's cell
 * computed from the stored numbers. A live profile shows its current name; a deleted one shows
 * the last name it had, kept while it has rows, and is marked deleted.
 */
export class StatisticsService {
  constructor(
    private readonly recorder: StatisticsRecorder,
    private readonly profileName: (profileId: string) => string | undefined,
  ) {}

  view(): StatisticsView {
    const rows = new Map<string, StatisticsRow>();
    for (const entry of this.recorder.entries()) {
      const key = JSON.stringify([entry.profileId, entry.model]);
      const row: StatisticsRow = rows.get(key) ?? {
        profileId: entry.profileId,
        ...this.nameOf(entry.profileId),
        model: entry.model,
        local: entry.local,
        check: EMPTY_CELL,
        rephrase: EMPTY_CELL,
      };
      const cell = cellStats(entry);
      rows.set(
        key,
        entry.feature === "check" ? { ...row, check: cell } : { ...row, rephrase: cell },
      );
    }
    return { rows: [...rows.values()] };
  }

  /** A live profile's current name; a deleted one's last name, or the fallback label. */
  private nameOf(profileId: string): { profileName: string; deleted: boolean } {
    const live = this.profileName(profileId);
    if (live !== undefined) return { profileName: live, deleted: false };
    const last = this.recorder.removedName(profileId) ?? REMOVED_PROFILE;
    return { profileName: last, deleted: true };
  }

  /** Forgets every number; answers the (now empty) view. */
  async clear(): Promise<Result<StatisticsView, AppError>> {
    const cleared = await this.recorder.clear();
    return cleared.ok ? { ok: true, value: this.view() } : cleared;
  }
}
