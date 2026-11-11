import { Alert, AlertDescription, Button } from "@gc/ui";
import { CircleAlert, CircleCheck, Save, SpellCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { loadSettings, saveSettings } from "../shared/extension-settings";
import { parseBlockedSites } from "../shared/site-blocklist";
import { ConnectionCard } from "./connection-card";
import { BlockedSitesField, CoreFields } from "./options-fields";
import { useConnectionStatus } from "./use-connection-status.hook";

type Notice = { ok: boolean; text: string } | undefined;

const parsePort = (text: string): number | undefined => {
  const port = Number(text.trim());
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : undefined;
};

const Header = () => (
  <header className="flex items-center gap-3">
    <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
      <SpellCheck className="size-5" aria-hidden="true" />
    </span>
    <div>
      <h1 className="text-lg leading-tight font-semibold">Grammar Checker</h1>
      <p className="text-sm text-muted-foreground">Extension options</p>
    </div>
  </header>
);

const SaveNotice = ({ notice }: { notice: Notice }) =>
  notice ? (
    <Alert variant={notice.ok ? "success" : "destructive"} role={notice.ok ? "status" : "alert"}>
      {notice.ok ? <CircleCheck /> : <CircleAlert />}
      <AlertDescription>{notice.text}</AlertDescription>
    </Alert>
  ) : null;

export const OptionsForm = () => {
  const [token, setToken] = useState("");
  const [port, setPort] = useState("");
  const [sites, setSites] = useState("");
  const [notice, setNotice] = useState<Notice>(undefined);
  const connection = useConnectionStatus();

  useEffect(() => {
    void loadSettings().then((settings) => {
      setToken(settings.token);
      setPort(String(settings.port));
      setSites(settings.blockedSites.join("\n"));
    });
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const portNumber = parsePort(port);
    if (portNumber === undefined) {
      return setNotice({ ok: false, text: "Port must be a number from 1 to 65535." });
    }
    const blockedSites = parseBlockedSites(sites);
    await saveSettings({ token: token.trim(), port: portNumber, blockedSites });
    setSites(blockedSites.join("\n"));
    setNotice({ ok: true, text: "Saved." });
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8">
      <Header />
      <ConnectionCard status={connection?.status} check={connection?.check} />
      <CoreFields
        token={{ value: token, onChange: setToken }}
        port={{ value: port, onChange: setPort }}
      />
      <BlockedSitesField sites={{ value: sites, onChange: setSites }} />
      <div className="flex justify-end">
        <Button type="submit">
          <Save />
          Save
        </Button>
      </div>
      <SaveNotice notice={notice} />
    </form>
  );
};
