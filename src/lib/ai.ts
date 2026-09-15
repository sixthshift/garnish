// Reading a model's answer, the part that is the same whatever was asked: a
// model told to answer with JSON sometimes fences it anyway.

/** A ```json fence off an answer that came back as prose despite the schema. Pure. */
export function stripFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/.exec(trimmed);
  return fenced === null ? trimmed : fenced[1]!.trim();
}
