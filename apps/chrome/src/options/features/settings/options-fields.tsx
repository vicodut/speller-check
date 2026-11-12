import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@gc/ui";

type Field = { value: string; onChange(value: string): void };

const Code = ({ children }: { children: string }) => (
  <code className="rounded bg-muted px-1 py-0.5 text-xs whitespace-nowrap">{children}</code>
);

/** Token and port: how the extension reaches the core. */
export const CoreFields = ({ token, port }: { token: Field; port: Field }) => (
  <Card className="gap-4">
    <CardHeader>
      <CardTitle>Core</CardTitle>
      <CardDescription className="grid gap-1">
        <span>
          Copy the token from the <strong>Chrome extension</strong> section of the settings page (
          <Code>bun run settings</Code>), where you can also generate a new one.
        </span>
        <span>
          Or run <Code>bun run --cwd apps/core cli token</Code> and paste it here.
        </span>
      </CardDescription>
    </CardHeader>
    <CardContent className="grid gap-4 sm:grid-cols-[1fr_7rem]">
      <div className="grid gap-2">
        <Label htmlFor="token">Token</Label>
        <Input
          id="token"
          type="password"
          autoComplete="off"
          value={token.value}
          onChange={(e) => token.onChange(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="port">Port</Label>
        <Input
          id="port"
          inputMode="numeric"
          value={port.value}
          onChange={(e) => port.onChange(e.target.value)}
        />
      </div>
    </CardContent>
  </Card>
);

/** Sites where the extension stays off. */
export const BlockedSitesField = ({ sites }: { sites: Field }) => (
  <Card className="gap-4">
    <CardHeader>
      <CardTitle>Blocked sites</CardTitle>
      <CardDescription>One per line. Subdomains are included.</CardDescription>
    </CardHeader>
    <CardContent>
      <Textarea
        aria-label="Blocked sites"
        rows={6}
        placeholder="example.com"
        className="font-mono"
        value={sites.value}
        onChange={(e) => sites.onChange(e.target.value)}
      />
    </CardContent>
  </Card>
);
