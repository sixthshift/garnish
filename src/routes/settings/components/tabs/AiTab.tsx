import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { useState } from "react";
import type { AiStatus, CheckedModel, ConnectionCheck, OfferedModel } from "../../../../server/ai/client";
import { testAiConnection } from "../../../../server/fns/ai";
import { SettingRow, SettingsColumn, SettingsPanel } from "../SettingsPanel";

const USE_LABELS: Record<CheckedModel["use"], { label: string; variable: string }> = {
  import: { label: "Recipe import", variable: "AI_IMPORT_MODEL" },
  restyle: { label: "Restyle", variable: "AI_RESTYLE_MODEL" },
  planner: { label: "Planner", variable: "AI_PLANNER_MODEL" },
};

type Connected = Extract<ConnectionCheck, { ok: true }>;

/**
 * Every model the provider offers, one row each: the name a model variable
 * takes, the full id it stands for when the provider says, and which features
 * ask it now. What answers "what can go in AI_IMPORT_MODEL?" with the exact
 * spellings.
 */
export function OfferedModels({ offered, models }: { offered: readonly OfferedModel[]; models: readonly CheckedModel[] }) {
  const usedBy = (model: OfferedModel) =>
    models.filter((row) => row.model === model.name || (model.resolvesTo !== undefined && row.model === model.resolvesTo));
  return (
    <SettingsPanel
      title="Models it offers"
      lead="Any of these names can go in AI_IMPORT_MODEL, AI_RESTYLE_MODEL or AI_PLANNER_MODEL; where a name stands for a full id, either works."
    >
      {offered.length === 0 && <SettingRow label="No models listed" description="The provider answered with an empty list." />}
      {offered.map((model) => (
        <SettingRow
          key={model.name}
          label={<code>{model.name}</code>}
          description={model.resolvesTo !== undefined && model.resolvesTo !== model.name ? <code>{model.resolvesTo}</code> : undefined}
        >
          {usedBy(model).map((row) => (
            <Badge key={row.use} variant="soft" intent="success">
              {USE_LABELS[row.use].label}
            </Badge>
          ))}
        </SettingRow>
      ))}
    </SettingsPanel>
  );
}

/** The success message's title: whether every model is listed. Pure. */
export function connectedTitle(result: Connected): string {
  return result.models.every((row) => row.listed) ? "Connected" : "Connected, but a model is not listed";
}

/**
 * What a successful check proved, in words. A check that could not prove the
 * credential says the first question will, rather than claiming it works. Pure.
 */
export function connectedMessage(result: Connected, credential: "key" | "token"): string {
  const proved = result.credentialProved
    ? `The ${credential} works`
    : `The provider starts and picked up the ${credential}; the ${credential} itself is proved by the first import`;
  return result.models.every((row) => row.listed)
    ? `${proved}, and every model named above is offered.`
    : `${proved}. A model marked Not listed may be misspelt, or may be an alias the provider accepts without listing it.`;
}

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
        lead="Set on the server with environment variables: AI_PROVIDER says how the model is reached — api, with an API key, or claude-code, on a Claude subscription — and that provider reads its own. Without one, pasting a recipe to import is hidden and restyle and the planner are unavailable; everything else works."
        foot={
          status.isDefaultProvider
            ? "Gemini's free tier may train on what is sent to it — for an import, only the text you pasted. Set AI_BASE_URL to a paid provider or a model on the LAN to avoid that."
            : undefined
        }
      >
        <SettingRow label="Provider" description={<code>AI_PROVIDER</code>}>
          {status.provider === null ? (
            <Muted as="span" className="text-sm" data-testid="ai-provider-status">
              Not set
            </Muted>
          ) : (
            <code className="truncate text-sm" data-testid="ai-provider-status">
              {status.provider}
            </code>
          )}
        </SettingRow>
        {status.provider !== null && (
          <SettingRow label={status.provider === "claude-code" ? "Token" : "API key"} description={<code>{status.credential}</code>}>
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
        )}
        {status.provider === "api" && (
          <SettingRow label="Endpoint" description={<code>AI_BASE_URL</code>}>
            <code className="truncate text-sm">{status.baseUrl}</code>
          </SettingRow>
        )}
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
        <SettingRow label="Test connection" description="Asks the provider which models it offers, not for an answer, so it uses no tokens.">
          <Button type="button" variant="outline" intent="neutral" size="sm" loading={busy} disabled={!status.configured} onClick={run}>
            Test
          </Button>
        </SettingRow>
      </SettingsPanel>

      {status.problem !== null && (
        <Message intent="warning" size="sm" title="No AI provider">
          {status.problem}
        </Message>
      )}
      {result && !result.ok && (
        <Message intent="danger" size="sm" title="Could not connect">
          {result.message}
        </Message>
      )}
      {result?.ok && (
        <Message intent={result.models.every((row) => row.listed) ? "success" : "warning"} size="sm" title={connectedTitle(result)}>
          {connectedMessage(result, status.provider === "claude-code" ? "token" : "key")}
        </Message>
      )}
      {result?.ok && <OfferedModels offered={result.offered} models={result.models} />}
    </SettingsColumn>
  );
}
