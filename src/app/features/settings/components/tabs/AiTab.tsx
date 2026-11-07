import { Badge } from "@sixthshift/design-system/badge";
import { Button } from "@sixthshift/design-system/button";
import { Message } from "@sixthshift/design-system/message";
import { Muted } from "@sixthshift/design-system/muted";
import { Select } from "@sixthshift/design-system/select";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { chooseAiModel, testAiConnection } from "../../../../../api/rpc/ai";
import { toastError } from "../../../../../lib/toast";
import {
  AI_USE_LABELS,
  type AiStatus,
  type AiUse,
  type ConnectionCheck,
  type OfferedModel,
  offeredNames,
  type StatusModel,
} from "../../../../../server/ai/client";
import { SettingRow, SettingsColumn, SettingsPanel } from "../SettingsPanel";

/** The choice's value for "no model selected": the feature is off until one is. */
const NOT_SELECTED = "__none__";

/** An offered model as the dropdown names it: with the full id it stands for, when that differs. Pure. */
export function offeredLabel(offer: OfferedModel): string {
  return offer.resolvesTo !== undefined && offer.resolvesTo !== offer.name ? `${offer.name} · ${offer.resolvesTo}` : offer.name;
}

/**
 * The dropdown's options for one use: Not selected, the model selected now
 * when the list does not name it — so the choice still shows what is in use —
 * and every model the provider offers. There is no default (decisions.md row
 * 217): garnish cannot know which of a provider's models can answer. Pure.
 */
export function modelOptions(row: StatusModel, offered: readonly OfferedModel[] | null): { value: string; label: string }[] {
  const list = offered ?? [];
  const names = offeredNames(list);
  return [
    { value: NOT_SELECTED, label: "Not selected" },
    ...(row.model !== null && !names.includes(row.model) ? [{ value: row.model, label: row.model }] : []),
    ...list.map((offer) => ({ value: offer.name, label: offeredLabel(offer) })),
  ];
}

/**
 * One use's model, chosen here from the models the provider offers
 * (decisions.md rows 215, 217). The list comes from the connection check the
 * tab runs on opening — no tokens — so until it answers, or when it fails, the
 * dropdown shows the model selected and cannot be opened. A choice writes
 * straight through; Not selected clears it, and the feature says so when used.
 */
export function ModelChoice({ row, offered, disabled }: { row: StatusModel; offered: readonly OfferedModel[] | null; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const choose = async (value: string) => {
    setBusy(true);
    try {
      await chooseAiModel({ data: { use: row.use, model: value === NOT_SELECTED ? null : value } });
      await router.invalidate();
    } catch (error) {
      toastError("Could not choose that model", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Select
      aria-label={`${AI_USE_LABELS[row.use]} model`}
      options={modelOptions(row, offered)}
      value={row.model ?? NOT_SELECTED}
      searchable={(offered?.length ?? 0) > 8}
      disabled={busy || disabled || offered === null}
      onValueChange={(value) => void choose(value)}
    />
  );
}

type Connected = Extract<ConnectionCheck, { ok: true }>;

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
  if (result.models.length === 0) return `${proved}. Select a model for each feature below.`;
  return result.models.every((row) => row.listed)
    ? `${proved}, and every model selected is offered.`
    : `${proved}. A model marked Not listed may be misspelt, or may be an alias the provider accepts without listing it.`;
}

/**
 * The AI tab, in the order it is set up: the provider, which the server's
 * environment sets and this only shows; the connection, checked as the tab
 * opens — the provider's model list, so no tokens — and again on Test; and
 * each use's model, chosen here from that list — the one place a model is set
 * (decisions.md row 217).
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

  // The dropdowns need the provider's list, so the check runs once as the tab opens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per opening, not on every status change
  useEffect(() => {
    if (status.configured) void run();
  }, []);

  const listed = (use: AiUse) => (result?.ok ? result.models.find((row) => row.use === use)?.listed : undefined);
  const offered = result?.ok ? result.offered : null;

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
      </SettingsPanel>

      {status.problem !== null && (
        <Message intent="warning" size="sm" title="No AI provider">
          {status.problem}
        </Message>
      )}

      <SettingsPanel title="Connection">
        <SettingRow label="Test connection" description="Asks the provider which models it offers, not for an answer, so it uses no tokens.">
          <Button type="button" variant="outline" intent="neutral" size="sm" loading={busy} disabled={!status.configured} onClick={() => void run()}>
            {result === null ? "Test" : "Test again"}
          </Button>
        </SettingRow>
      </SettingsPanel>

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

      {status.models.length > 0 && (
        <SettingsPanel
          title="Models"
          lead="Each feature's model, chosen from the ones the provider offers. A feature with none selected is off until one is. A change applies to the next question."
        >
          {status.models.map((row) => (
            <SettingRow key={row.use} label={AI_USE_LABELS[row.use]}>
              <ModelChoice row={row} offered={offered} disabled={!status.configured} />
              {listed(row.use) === false && (
                <Badge variant="soft" intent="warning">
                  Not listed
                </Badge>
              )}
            </SettingRow>
          ))}
        </SettingsPanel>
      )}
    </SettingsColumn>
  );
}
