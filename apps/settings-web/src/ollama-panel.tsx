import type { RuntimeView } from "@gc/protocol";

type Props = {
  ollama: RuntimeView["ollama"];
  /** The model the active profile asks Ollama for. */
  model: string | null;
  busy: boolean;
  onStart: () => void;
};

/** Ollama lists `qwen3` as `qwen3:latest`. */
const sameModel = (a: string, b: string) =>
  (a.includes(":") ? a : `${a}:latest`) === (b.includes(":") ? b : `${b}:latest`);

const Status = ({ ollama, busy, onStart }: Omit<Props, "model">) => {
  switch (ollama.state) {
    case "running":
      return (
        <p>
          <span className="dot ok" /> Running{ollama.version && ` · v${ollama.version}`}
          <span className="hint">
            {ollama.startedByApp
              ? " · started by Grammar Checker, stopped when you switch to a cloud profile"
              : " · your own Ollama, left running"}
          </span>
        </p>
      );
    case "starting":
      return (
        <p>
          <span className="dot busy" /> Starting Ollama…
        </p>
      );
    case "not_installed":
      return (
        <p>
          <span className="dot off" /> Ollama isn't installed. Get it from{" "}
          <a href="https://ollama.com/download" target="_blank" rel="noreferrer">
            ollama.com
          </a>
          , or pick a cloud profile.
        </p>
      );
    default:
      return (
        <p>
          <span className="dot off" />{" "}
          {ollama.state === "failed" ? "Ollama didn't start within 30 s." : "Ollama isn't running."}{" "}
          <button type="button" disabled={busy} onClick={onStart}>
            Start Ollama
          </button>
        </p>
      );
  }
};

/** The local runtime behind the active profile: its state and the models it has. */
export const OllamaPanel = ({ ollama, model, busy, onStart }: Props) => {
  const missing =
    ollama.state === "running" && model && !ollama.models.some((m) => sameModel(m, model));
  return (
    <section aria-label="Ollama" className="ollama">
      <h2>Ollama</h2>
      <Status ollama={ollama} busy={busy} onStart={onStart} />
      {ollama.state === "running" && (
        <ul className="models">
          {ollama.models.map((m) => (
            <li key={m} className={model && sameModel(m, model) ? "current" : undefined}>
              {m}
            </li>
          ))}
          {ollama.models.length === 0 && <li className="none">No models pulled yet</li>}
        </ul>
      )}
      {missing && (
        <p className="notice">
          {model} isn't pulled. Run <code>ollama pull {model}</code> in a terminal.
        </p>
      )}
    </section>
  );
};
