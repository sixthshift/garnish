import type { SeededStatement } from "./statements";

/**
 * The starting guide, in reading order, all fourteen on. It began as the guide
 * Jason chose in a blind pair comparison over real recipe methods (decisions.md
 * row 124), and was then reworked against his own hand restyle of the sixteen
 * recipes in the library (row 225): a stage ends at a wait, a prep step comes
 * first, the time comes last after a comma, another method goes whole into the
 * supporting line, the oven setting is the author's alone, and the kitchen words
 * are Australian. Six shape the method (stage size, voice, ingredients, cue then
 * time, labels as an outline, the prep step), one cuts the author but keeps what
 * they said, one moves everything off the main path into the supporting line,
 * four are about how the page reads (metric and oven settings, numbers,
 * emphasis, kitchen words), one drops pointers to notes the method does not
 * carry, and one puts preparation on the ingredient's line.
 *
 * What is deliberately not here is any sentence telling the model to keep
 * something. Conservation is `FIXED_RESTYLE_LINE`'s job, above the guide,
 * because a guide made half of guards asks for nothing and the model returns
 * the recipe unchanged — which is what the lab found when the keeping was
 * written into the statements themselves. A statement asks for a shape; the
 * fixed line says what may not be lost while it is given.
 *
 * Try a change here with `bun run restyle` on two models before it lands.
 */
export const DEFAULT_STYLE_RULES: readonly SeededStatement[] = [
  {
    text: 'One stage per step, and a stage ends at a wait: a step runs until the cook has to wait for a time or a cue ("until golden", "3 minutes"), and what has nothing to wait for — heating the oil, heating the oven, seasoning the meat, tasting — joins the step it leads into. Short waits may share a step where one label covers them; a rest, a chill, a soak or a marinade is a step of its own. Split an author\'s step that holds several stages, join fragments of one stage into one step, and keep the author\'s order.',
    enabled: true,
    was: [
      'One stage per step, in the author\'s order: a stage is what one short label can honestly name ("Sear the beef", "Soften the vegetables"). Keep the author\'s paragraph whole unless no one label covers it, and join fragments of one stage ("Add the onion." "Stir." "Cook 5 minutes.") into one step.',
      'One stage per step, in the author\'s order: a step is everything done at one pan or bowl until the next wait or the next pan. The author\'s paragraph is usually one stage, so keep it whole; fragments of one stage ("Add the onion." "Stir." "Cook 5 minutes.") become one step.',
      "One stage per step: everything done at one pan or bowl until the next wait or the next pan. The author's paragraph is usually already one stage; do not split it into sentences.",
      "One action per step: split a paragraph that does several things.",
      'One action per step: one thing done to the food, with the wait or cue that follows it. "Add the garlic and onion and fry for 2 minutes" is one step; "Add the garlic and onion." and "Fry for 2 minutes." are half a step each. Never a step of a single verb.',
      'Merge steps that are one action: "Add the onion." "Stir." "Cook 5 minutes." become one step.',
      "Keep the order of work: steps stay in the order the author gave them.",
      "Short steps: no step longer than two sentences.",
    ],
  },
  {
    text: 'Imperative, verb first, with full articles: "Add the garlic to the pan", not "You then add the garlic" or "Add garlic to pan". Keep the author\'s technique words (sauté, deglaze, fold, blanch): they are the method, not the voice.',
    enabled: true,
    was: [
      'Imperative, verb first: "Add the garlic", not "You then add the garlic" or "Now it is time to add the garlic".',
      'Imperative, verb first: "Add the garlic", not "You then add the garlic" or "Now it is time to add the garlic". Keep the author\'s cooking verbs (sauté, deglaze, fold, blanch, sear): they are the method, not the voice.',
      'Plain imperative: start with the verb ("Add the garlic", not "You then add the garlic") and use the everyday word ("fry" not "sauté") unless the technique word matters ("fold", "deglaze").',
      'Imperative voice, starting with the verb: "Add the garlic", not "You then add the garlic".',
      'Plain words: "fry" not "sauté", "stir" not "agitate", unless the technique word matters ("fold", "deglaze").',
    ],
  },
  {
    text: 'Drop the author and the reader but keep what they said: encouragement and blog references go, and a personal aside that carries a tip becomes the tip, said impersonally — "(I use 2 wooden spoons)" becomes "Two wooden spoons make the tossing easier." Where a remark carries an instruction, keep the instruction — "Yell for your family to sit down at the dinner table because you need to serve it immediately!" becomes "Serve immediately."',
    enabled: true,
    was: [
      'Drop what is about the author or the reader: encouragement, blog references, "I use 2 wooden spoons". Where such a remark carries an instruction, keep the instruction and drop the rest — "Yell for your family to sit down at the dinner table because you need to serve it immediately!" becomes "Serve immediately."',
      'No chatter: drop asides, encouragement, blog references, the author\'s step titles and "to your taste". Keep storage and make-ahead advice.',
      "No chatter: drop asides, encouragement and references to the blog.",
      'No chatter: drop asides, encouragement, references to the blog and "to your taste". Keep storage and make-ahead advice.',
    ],
  },
  {
    text: 'Ingredients by their food name, as marked (food: …) after each ingredient line: "beef", never "the meat" and never the whole line. Write the name in the sentence\'s own case — "melt the unsalted butter", not "melt Unsalted Butter" — capitalised only where it is a proper name (Parmesan, Dijon). Name them individually rather than collectively: "the remaining ingredients" reads as a bowl someone already mixed, so use a collective name only where the recipe made that thing. Quantities stay in the list; a step carries one only where the author wrote it or where part of an ingredient is used ("1 tbsp of the oil", then "the remaining 2 tbsp").',
    enabled: true,
    was: [
      'Ingredients by their food name, as marked (food: …) after each ingredient line: "beef", never "the meat" and never the whole line. Name them individually rather than collectively: "the remaining ingredients" reads as a bowl someone already mixed, so use a collective name only where the recipe made that thing. Quantities stay in the list; a step carries one only where the author wrote it or where part of an ingredient is used ("1 tbsp of the oil", then "the remaining 2 tbsp").',
      'Ingredients by their food name, as marked (food: …) after each ingredient line: "beef", never "the meat" and never the whole line. Quantities stay in the list; a step carries one only where the author wrote it or where part of an ingredient is used ("1 tbsp of the oil", then "the remaining 2 tbsp").',
      'Call ingredients by their list name: "beef" or "chuck beef", never "the meat".',
      'Call an ingredient by its food name, marked (food: …) after each ingredient line: "beef", never "the meat" and never the whole line with its quantity.',
      'Name the quantity where the ingredient is used: "Add 2 tbsp of the oil".',
      'Quantities stay in the ingredient list: a step names the food and carries a quantity only where the author wrote one, or where only part of an ingredient is used ("1 tbsp of the oil", then "the remaining 2 tbsp"). Never copy an ingredient line into a step.',
    ],
  },
  {
    text: 'A step\'s time comes last, after a comma, with its cue before it: "sear until very browned, 3–5 minutes", "let them sear, 15 seconds", "cook until golden, 3 minutes a side" — not "sear for 3–5 minutes or until browned". Flag parallel work with "Meanwhile".',
    enabled: true,
    was: [
      'When the author gives a time and a cue, the cue comes first and the time after it: "sear until very browned, 3–5 minutes", not "sear for 3–5 minutes or until browned". Flag parallel work with "Meanwhile".',
      'Flag parallel work with "Meanwhile".',
      'Timing: when the author gives a time and a cue, the cue comes last ("fry for 5 minutes until soft"); flag parallel work with "Meanwhile".',
      "End with what to look for: when the author gives a time and a cue, the cue comes last.",
    ],
  },
  {
    text: 'Give every step a label: a short verb phrase naming what the stage achieves, so the labels read on their own as an outline of the recipe — "Sear the beef", "Soften the vegetables", "Simmer slowly", "Taste and adjust". The step\'s text then starts with the detail and does not repeat the label.',
    enabled: true,
    was: [
      'Start a step with a short label and an em dash where its first verb is setup ("Heat", "Turn down", "Bring to the boil") and so does not say what the step is for: "Sear beef — Heat 1 tbsp of the olive oil…". Use the step\'s own words. A step whose opening words already say what it does gets no label.',
    ],
  },
  {
    text: 'What is not an instruction on the main path — why a time is a range, what to expect ("the sauce will look thin at this stage"), what to do if it goes wrong, a make-ahead or storage note — goes in that step\'s supporting line, as many sentences as it takes, rather than in its text. So does another way of doing the step — on the BBQ or in the oven instead of the pan, pan-steamed instead of deep-fried, in a slow cooker — written out whole in the supporting line of the step it replaces rather than as steps of its own. A wait of hours says when to start: "Start the day before."',
    enabled: true,
    was: [
      'What is not an instruction on the main path — why a time is a range, what to expect ("the sauce will look thin at this stage"), what to do if it goes wrong, a make-ahead or storage note, an alternative appliance ("Or cook for 8 hours on low in a slow cooker") — goes in that step\'s supporting line, as many sentences as it takes, rather than in its text.',
      "The one sentence of a step that is not an instruction — why a time is a range, what to do if it goes wrong, what will happen that might worry you — goes in that step's supporting line rather than in its text.",
      'A run of steps belonging to a different phase or a different method becomes its own part, named for it: "To serve", "Slow cooker", "Make ahead".',
      'Move plating and garnish steps to a part named "To serve".',
      "Drop the author's alternative methods: keep only the first where a slow cooker and an oven method are both given.",
    ],
  },
  {
    text: 'Prefer metric: where a step gives both, keep only metric. Name the oven setting the author gave, fan or conventional, and do not work out the other one: "Heat the oven to 180°C fan".',
    enabled: true,
    was: [
      'Prefer metric: where a step gives both, keep only metric. Name the oven setting on every oven temperature, fan first: "160°C fan (180°C conventional)".',
      "Prefer metric: where a step gives both, keep only metric.",
    ],
  },
  {
    text: 'Write numbers one way throughout: an en dash for a range ("3–5 minutes", "2–2½ hours"), fraction glyphs (½, ¼), minutes and hours written out rather than "mins" and "hrs", and a quantity in a step in the ingredient list\'s own units ("1 tbsp of the oil", not "1 tablespoon of the oil").',
    enabled: true,
    was: [
      'Write numbers one way throughout: an en dash for a range ("3–5 minutes", "2–2½ hours"), fraction glyphs (½, ¼), and minutes and hours written out rather than "mins" and "hrs".',
    ],
  },
  {
    text: 'Normalise emphasis: no capitals for shouting ("SCOOP OUT" is "scoop out"), no "ALSO," or "NOTE:" openers, no exclamation marks. The words stay; only the shouting goes.',
    enabled: true,
  },
  {
    text: 'Drop a bare pointer to a numbered note ("(Note 7)"), since the notes are not part of the method; keep any words the pointer carries.',
    enabled: true,
  },
  {
    text: 'An ingredient\'s line carries its preparation and its optionality: "finely dice the onion" in the method makes the onion\'s line "finely diced", and an ingredient a step hedges with "if using" is marked "optional" on its own line. Write a note as the words that follow the food — its kind or size first, then how much, then how it is prepared, then any alternative or condition ("large, about 170 g each, cut into 1.5 cm cubes, or butternut pumpkin") — with no leading comma, no brackets and no pointer to a numbered note.',
    enabled: true,
    was: [
      'Preparation belongs to the ingredient, not the step: "finely dice the onion" in a step becomes "finely diced" on the onion\'s line, and the step then names the food alone. So does optionality: an ingredient a step hedges with "(if using)" is marked "optional" on its own line instead. Write a note as the words that follow the food — "diced", "at room temperature", "optional" — with no leading comma, no brackets and no pointer to a numbered note.',
      'Preparation belongs to the ingredient, not the step: "finely dice the onion" in a step becomes "finely diced" on the onion\'s line, and the step then names the food alone. Write a note as the words that follow the food — "diced", "at room temperature", "separated" — with no leading comma, no brackets and no pointer to a numbered note.',
    ],
  },
  {
    text: 'Begin with a step labelled "Prepare the ingredients" that does every cut, peel, grate, soak and mix the cooking needs before it starts, garnishes for serving included, as a list of dot points, one action each ("- Mince the garlic."), in the order that saves time. When something has to start first — a soak, rice to cook, meat to marinate while the rest is cut — open the step with one sentence that says so ("Start the rice first so it\'s ready with the curry."). The cooking steps after it name the food alone ("Add the onion"), since it is already cut; leave the step out when there is nothing to prepare.',
    enabled: true,
  },
  {
    text: 'Use Australian kitchen words: a frying pan (not a skillet), a baking tray (not a baking sheet), baking paper (not parchment), the grill (not the broiler), a stick blender (not an immersion blender), muslin (not cheesecloth), a packet (not a package), and "heat the oven" rather than "preheat the oven".',
    enabled: true,
  },
];
