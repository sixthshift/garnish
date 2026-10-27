import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import type { Connection } from "../../../../db/models/mcp/repo";
import { writeClipboard } from "../../../../lib/clipboard";
import { formatDateStamp } from "../../../../lib/dates";
import { disconnectClient, type McpStatus, regeneratePairingCode } from "../../../../server/fns/mcp";
import { SettingRow, SettingsColumn, SettingsPanel } from "../SettingsPanel";

/** One connection's line under its name: when it connected, when it was last used, what it may do. Pure. */
export function connectionDescription(connection: Pick<Connection, "createdAt" | "lastUsedAt" | "scope">): string {
  const used = connection.lastUsedAt ? `last used ${formatDateStamp(connection.lastUsedAt)}` : "not used yet";
  return `Connected ${formatDateStamp(connection.createdAt)}, ${used}. May ${connection.scope.split(" ").join(", ")}.`;
}

/** A pairing code with every character hidden and its dashes kept, so it still reads as a code. Pure. */
export function maskedCode(code: string): string {
  return code.replace(/[^-]/g, "•");
}

/**
 * What the address is good for. An https address is one the whole internet
 * reaches; anything else is the LAN address this page was opened at, which a
 * client on the network can use and a web assistant cannot. Pure.
 */
export function addressNote(url: string): string {
  return url.startsWith("https:")
    ? "Give this to the assistant as a remote MCP server."
    : "The address you opened garnish at: right for clients on this network, such as Claude Code. Claude on the web or phone needs your tunnel's https address, with /api/mcp on the end.";
}

/**
 * Settings › MCP (decisions.md row 181): the address to give an MCP client,
 * the pairing code the consent page asks for (hidden until shown, with Copy
 * and Regenerate), and every client the household has let in, each with
 * Disconnect. Always on: the address is the one this page was opened at,
 * unless GARNISH_PUBLIC_URL names the public one.
 */
export function McpTab({ status }: { status: McpStatus }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);

  // Connecting happens in another app, and every Allow replaces the code: coming back reads the tab again,
  // so the code on screen and the one Copy gives are the live one, and the new connection is listed.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void router.invalidate();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [router]);

  const copy = async () => {
    if (await writeClipboard(status.url)) setCopied(true);
  };

  const disconnect = async () => {
    if (!leaving) return;
    setBusy(true);
    try {
      await disconnectClient({ data: { id: leaving.id } });
      setLeaving(null);
      await router.invalidate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsColumn>
      <SettingsPanel
        title="Connector"
        lead="Any AI assistant that speaks MCP — Claude, ChatGPT, or another — can read and change recipes, the shopping list and the meal plan through garnish's MCP server, once someone with the pairing code lets it in. Assistants on the web reach garnish from the internet, through a tunnel that forwards only the connector's paths; the app stays on the LAN."
      >
        <SettingRow label="Address" description={addressNote(status.url)}>
          <code className="truncate text-sm">{status.url}</code>
          <Button type="button" variant="outline" intent="neutral" size="sm" onClick={() => void copy()}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </SettingRow>
        <SettingRow
          label="Pairing code"
          description="The connect page asks for it. It changes each time a connection is allowed, so a code that has been typed is never good twice. Regenerate makes a new one; nothing already connected is disconnected."
        >
          {/* Keyed by the code: a new one starts hidden, with nothing copied. */}
          <PairingCode key={status.pairingCode} code={status.pairingCode} />
        </SettingRow>
      </SettingsPanel>

      {status.problem !== null && (
        <Message intent="warning" size="sm" title="GARNISH_PUBLIC_URL is not used">
          {status.problem}
        </Message>
      )}

      <SettingsPanel title="How to connect">
        <SettingRow
          label="Any MCP client"
          description="Add a remote (Streamable HTTP) MCP server with this address. When it connects, a garnish page opens: choose what it may do, enter the pairing code and press Allow."
        />
        <SettingRow
          label="Claude"
          description="Settings › Connectors › Add custom connector, then paste the address. It needs the https address of your tunnel."
        />
        <SettingRow label="Claude Code" description={<code>claude mcp add --transport http garnish {status.url}</code>} />
      </SettingsPanel>

      <SettingsPanel title="Connected" lead="Disconnecting takes a client's keys away at once; it has to ask again, with a pairing code, to come back.">
        {status.connections.length === 0 && <SettingRow label="Nothing connected" />}
        {status.connections.map((connection) => (
          <SettingRow key={connection.id} label={connection.clientName} description={connectionDescription(connection)}>
            <Button type="button" variant="outline" intent="neutral" size="sm" onClick={() => setLeaving(connection)}>
              Disconnect
            </Button>
          </SettingRow>
        ))}
      </SettingsPanel>

      {leaving && (
        <ConfirmDialog
          title={`Disconnect ${leaving.clientName}?`}
          aria-label={`Disconnect ${leaving.clientName}`}
          confirmLabel="Disconnect"
          busy={busy}
          busyLabel="Disconnecting…"
          onCancel={() => !busy && setLeaving(null)}
          onConfirm={() => void disconnect()}
        >
          It can no longer read or change anything in garnish until someone with the pairing code lets it in again.
        </ConfirmDialog>
      )}
    </SettingsColumn>
  );
}

/** The pairing code, hidden until shown, with Show, Copy and Regenerate; wraps under itself on a phone. */
function PairingCode({ code }: { code: string }) {
  const router = useRouter();
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const copy = async () => {
    if (await writeClipboard(code)) setCopied(true);
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      await regeneratePairingCode();
      await router.invalidate();
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {shown ? (
        <code className="text-sm tracking-wider">{code}</code>
      ) : (
        <code className="text-sm tracking-wider">
          <span aria-hidden="true">{maskedCode(code)}</span>
          <span className="sr-only">Hidden</span>
        </code>
      )}
      <Button type="button" variant="outline" intent="neutral" size="sm" aria-pressed={shown} onClick={() => setShown((was) => !was)}>
        {shown ? "Hide" : "Show"}
      </Button>
      <Button type="button" variant="outline" intent="neutral" size="sm" onClick={() => void copy()}>
        {copied ? "Copied" : "Copy"}
      </Button>
      <Button type="button" variant="outline" intent="neutral" size="sm" disabled={regenerating} onClick={() => void regenerate()}>
        {regenerating ? "Regenerating…" : "Regenerate"}
      </Button>
    </div>
  );
}
