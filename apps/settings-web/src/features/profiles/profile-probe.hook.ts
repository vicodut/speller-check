import { useCallback, useEffect } from "react";
import { modelsProbe, testProbe } from "../../lib/profile-probe.reducer";
import { listModels, testProfile } from "../../lib/settings-api.client";
import { keyChange, type ProfileForm, type SettingsPageEvent } from "../../lib/settings-page.model";

/** Waits for typing in the base URL to pause before listing its models. */
const LIST_DELAY_MS = 500;

/**
 * The form's model list and Test button. The list loads by itself once the form opens or its
 * base URL changes (after a pause); the key used is the one a save would send.
 */
export const useProfileProbe = (
  token: string | null,
  form: ProfileForm | null,
  dispatch: (event: SettingsPageEvent) => void,
) => {
  const loadModels = useCallback(
    async (form: ProfileForm) => {
      const { baseUrl } = form.draft;
      if (!token) return;
      dispatch({ type: "probe", event: { type: "modelsLoading", baseUrl } });
      const result = await listModels(token, modelsProbe(form.id, baseUrl, keyChange(form.key)));
      dispatch({ type: "probe", event: { type: "modelsLoaded", baseUrl, result } });
    },
    [token, dispatch],
  );

  useEffect(() => {
    if (form?.probe.models.phase !== "idle" || !URL.canParse(form.draft.baseUrl)) return;
    const timer = setTimeout(() => void loadModels(form), LIST_DELAY_MS);
    return () => clearTimeout(timer);
  }, [form, loadModels]);

  const onTest = async () => {
    if (!token || !form) return;
    dispatch({ type: "probe", event: { type: "testing" } });
    const result = await testProfile(token, testProbe(form.id, form.draft, keyChange(form.key)));
    dispatch({ type: "probe", event: { type: "tested", result } });
  };

  return {
    onListModels: () => void (form && loadModels(form)),
    onTest: () => void onTest(),
  };
};
