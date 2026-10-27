// Both projects' first setup (vite.config.ts). Bun loads the developer's
// `.env` into the test run, and with a real AI_PROVIDER and credential in it a
// test that expects no model would ask a real one — spending the developer's
// key or subscription, and passing or failing on what it answered. So every
// AI variable is cleared before each test file; a test that wants a model sets
// the variables it needs, as each one already does.
const AI_VARIABLES = [
  "AI_PROVIDER",
  "AI_API_KEY",
  "AI_BASE_URL",
  "AI_IMPORT_MODEL",
  "AI_RESTYLE_MODEL",
  "AI_PLANNER_MODEL",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "CLAUDE_CODE_EXECUTABLE",
];

for (const name of AI_VARIABLES) delete process.env[name];

// The same for the MCP connector's public address: set, it would pin every OAuth address in a test to the
// developer's own, where the tests expect the address each request reached.
delete process.env.GARNISH_PUBLIC_URL;
