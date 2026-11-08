// What a thing said asks of voice itself, rather than of the cooking assistant (decisions.md row 223).
import { expect, test } from "vitest";
import { voiceCommand } from "../../../../../src/domain/recipes/components/cooking/CookingAssistant";

test.each(["stop", "Stop listening.", "OK, that's all", "thanks, that's all", "I'm done"])("“%s” stops voice", (said) => {
  expect(voiceCommand(said)).toBe("stop");
});

test.each(["Say that again", "repeat that", "Pardon?", "what did you say"])("“%s” repeats the last answer", (said) => {
  expect(voiceCommand(said)).toBe("again");
});

test.each(["stop the timer", "how do I stop it sticking", "what's next", "say the salt amount again"])("“%s” goes to the assistant", (said) => {
  expect(voiceCommand(said)).toBe(null);
});
