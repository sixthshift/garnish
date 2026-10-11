// The providers: one file per way of reaching a model, each an `AiClient`
// (../client.ts). `AI_PROVIDER` routes: `api` reads `AI_API_KEY` and
// `AI_BASE_URL`, `claude-code` reads `CLAUDE_CODE_OAUTH_TOKEN`, and neither
// reads the other's, so both may be set and the variable alone decides. It has
// no default — a `.env` says which AI it uses in one line — so unset, or set to
// anything else, the AI is off and Settings says why. This index is the one
// place that chooses; everything else imports the default export and asks it:
// `import ai from "…/ai/provider"; ai.ask(…)`. Tests and the labs bring their
// own (`apiProvider(fakeFetch)`, or a fake that answers from a fixture).

import { AI_PROVIDERS, type AiClient, AiError, type AiProviderName } from "../client";
import { apiProvider } from "./api";
import { claudeCodeProvider } from "./claudeCode";

/** `AI_PROVIDER`, read: a provider's name, or why there is none. Pure. */
export function providerChoice(value = process.env.AI_PROVIDER): { name: AiProviderName } | { problem: string } {
  const raw = (value ?? "").trim();
  if ((AI_PROVIDERS as readonly string[]).includes(raw)) return { name: raw as AiProviderName };
  if (raw === "") {
    return { problem: "No AI provider is set. Set AI_PROVIDER to api (with AI_API_KEY) or claude-code (with CLAUDE_CODE_OAUTH_TOKEN) to use this." };
  }
  return { problem: `AI_PROVIDER is "${raw}", which is not a provider here. Set it to api or claude-code.` };
}

/** The provider a name stands for. */
export function providerNamed(name: AiProviderName): AiClient {
  return name === "claude-code" ? claudeCodeProvider() : apiProvider();
}

/** The client when no provider is chosen: never configured, and every question and check says why. */
export function noProvider(problem: string): AiClient {
  return {
    configured: () => false,
    model: () => "",
    status: () => ({ provider: null, problem, credential: "", configured: false, baseUrl: "", isDefaultProvider: false, models: [] }),
    check: async () => ({ ok: false, baseUrl: "", message: problem }),
    ask: async () => {
      throw new AiError("unavailable", problem);
    },
  };
}

/**
 * The server's client. `AI_PROVIDER` is read on every call, as every other AI
 * variable is, so changing provider does not need the app restarted.
 */
export function serverClient(): AiClient {
  const current = () => {
    const choice = providerChoice();
    return "name" in choice ? providerNamed(choice.name) : noProvider(choice.problem);
  };
  return {
    configured: () => current().configured(),
    model: (use) => current().model(use),
    status: () => current().status(),
    check: () => current().check(),
    ask: (request) => current().ask(request),
  };
}

export default serverClient();
