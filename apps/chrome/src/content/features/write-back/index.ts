export { applyFix } from "./apply-fix.service";
export { expectedTextAfterFix, issuesAfterFix, matchesText } from "./fix-text.util";
export {
  holdsPassage,
  type PassageBase,
  type ReplacedRun,
  replacePassageFix,
  replaceRunFix,
  runContains,
  runsDisjoint,
  type TextFix,
} from "./passage-fix.util";
