// Settings › MCP's pairing code, pressed: hidden until Show, hidden again by Hide, and Regenerate asks the server for a new one.
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { McpTab } from "../../../src/routes/settings/components/tabs/McpTab";
import { renderInRouter } from "../../helpers/dom";

const regenerate = vi.hoisted(() => vi.fn(async () => ({ pairingCode: "ZZZZ-ZZZZ-ZZZZ" })));
vi.mock("../../../src/server/fns/mcp", () => ({ regeneratePairingCode: regenerate, disconnectClient: vi.fn() }));

const status = { url: "https://garnish.example/api/mcp", problem: null, pairingCode: "K7QF-M2XP-9RTD", connections: [] };

test("the pairing code shows on Show and hides on Hide", async () => {
  const user = userEvent.setup();
  await renderInRouter(<McpTab status={status} />);

  expect(screen.getByText("••••-••••-••••")).toBeTruthy();
  expect(screen.queryByText("K7QF-M2XP-9RTD")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Show" }));
  expect(screen.getByText("K7QF-M2XP-9RTD")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Hide" }));
  expect(screen.queryByText("K7QF-M2XP-9RTD")).toBeNull();
});

test("Regenerate asks the server for a new code", async () => {
  const user = userEvent.setup();
  await renderInRouter(<McpTab status={status} />);
  await user.click(screen.getByRole("button", { name: "Regenerate" }));
  expect(regenerate).toHaveBeenCalledOnce();
});
