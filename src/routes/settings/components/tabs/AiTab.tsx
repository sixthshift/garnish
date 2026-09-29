import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { useState } from "react";
import type { AiStatus, CheckedModel, ConnectionCheck } from "../../../../server/ai/check";
import { testAiConnection } from "../../../../server/fns/ai";
import { SettingRow, SettingsColumn, SettingsPanel } from "../SettingsPanel";

const USE_LABELS: Record<CheckedModel["use"], { label: string; variable: string }> = {
  import: { label: "Recipe import", variable: "AI_MODEL" },
  restyle: { label: "Restyle", variable: "AI_RESTYLE_MODEL" },
  planner: { label: "Planner", variable: "AI_PLANNER_MODEL" },
};

/**
 * The AI tab: the model configuration as it stands on the server, and a check
 * that it works. One provider serves the import, the restyle and the planner,
 * so this sits here rather than under any one of them. The configuration is
 * environment variables, so the rows show values and name the variable; they
 * are not edited here.
 */
export function AiTab({ status }: { status: AiStatus }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ConnectionCheck | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      setResult(await testAiConnection());
    } catch (error) {
      setResult({ ok: false, baseUrl: status.baseUrl, message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const listed = (use: CheckedModel["use"]) => (result?.ok ? result.models.find((row) => row.use === use)?.listed : undefined);

  return (
    <SettingsColumn>
      <SettingsPanel
        title="Provider"
        lead="Set on the server with environment variables. Without a key, pasting a recipe to import is hidden and restyle and the planner are unavailable; everything else works."
        foot={
          status.isDefaultProvider
            ? "Gemini's free tier may train on what is sent to it — for an import, only the text you pasted. Set AI_BASE_URL to a paid provider or a model on the LAN to avoid that."
            : undefined
        }
      >
        <SettingRow label="API key" description={<code>AI_API_KEY</code>}>
          {status.configured ? (
            // A fixed-length mask: the key never leaves the server, and neither does its length.
            <code className="text-[0.625rem] tracking-widest text-fg-subtle" data-testid="ai-key-status">
              <span aria-hidden="true">●●●●●●●●●●●●</span>
              <span className="sr-only">Set</span>
            </code>
          ) : (
            <Muted as="span" className="text-sm" data-testid="ai-key-status">
              Not set
            </Muted>
          )}
        </SettingRow>
        <SettingRow label="Endpoint" description={<code>AI_BASE_URL</code>}>
          <code className="truncate text-sm">{status.baseUrl}</code>
        </SettingRow>
        {status.models.map((row) => (
          <SettingRow key={row.use} label={USE_LABELS[row.use].label} description={<code>{USE_LABELS[row.use].variable}</code>}>
            <code className="truncate text-sm">{row.model}</code>
            {listed(row.use) === true && (
              <Badge variant="soft" intent="success">
                Listed
              </Badge>
            )}
            {listed(row.use) === false && (
              <Badge variant="soft" intent="warning">
                Not listed
              </Badge>
            )}
          </SettingRow>
        ))}
      </SettingsPanel>

      <SettingsPanel title="Connection">
        <SettingRow label="Test connection" description="Asks the provider for its model list, not an answer, so it uses no tokens.">
          <Button type="button" variant="outline" intent="neutral" size="sm" loading={busy} disabled={!status.configured} onClick={run}>
            Test
          </Button>
        </SettingRow>
      </SettingsPanel>

      {result && !result.ok && (
        <Message intent="danger" size="sm" title="Could not connect">
          {result.message}
        </Message>
      )}
      {result?.ok && (
        <Message
          intent={result.models.every((row) => row.listed) ? "success" : "warning"}
          size="sm"
          title={result.models.every((row) => row.listed) ? "Connected" : "Connected, but a model is not listed"}
        >
          {result.models.every((row) => row.listed)
            ? "The key works and the provider lists every model named above."
            : "The key works. A model marked Not listed may be misspelt, or may be an alias the provider accepts without listing it."}
        </Message>
      )}
    </SettingsColumn>
  );
}
