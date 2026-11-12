// Options page: token, port, site blocklist and connection status.
import { createRoot } from "react-dom/client";
import { OptionsForm } from "./features/settings/options-form";

const root = document.getElementById("root");
if (root) createRoot(root).render(<OptionsForm />);
