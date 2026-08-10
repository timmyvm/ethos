/**
 * Cold Topic content (mechanics.md boss mode): topics the user almost
 * certainly hasn't studied. The point is compression under ignorance —
 * research window, then explain from memory, scored on delivery AND
 * accuracy. The `truth` field is the ground truth the judge checks
 * confident wrong claims against.
 */

export interface ColdTopic {
  id: string;
  title: string;
  /** What a correct 90-second explanation must contain. */
  truth: string[];
  /** Where to read during the research window. */
  reading: string;
}

export const COLD_TOPICS: ColdTopic[] = [
  {
    id: "dunning-kruger",
    title: "The Dunning–Kruger effect",
    truth: [
      "People with low ability at a task overestimate their ability",
      "The original 1999 Kruger & Dunning studies covered humour, grammar, logic",
      "It is about metacognition — the skill needed to judge competence is the same skill being measured",
      "Commonly misstated as 'stupid people think they're geniuses'; the real curve is subtler",
    ],
    reading: "en.wikipedia.org/wiki/Dunning–Kruger_effect",
  },
  {
    id: "bretton-woods",
    title: "Bretton Woods",
    truth: [
      "1944 conference in New Hampshire, 44 allied nations",
      "Set up fixed exchange rates pegged to the US dollar, dollar convertible to gold",
      "Created the IMF and what became the World Bank",
      "Collapsed in 1971 when Nixon suspended dollar-gold convertibility",
    ],
    reading: "en.wikipedia.org/wiki/Bretton_Woods_system",
  },
  {
    id: "crispr",
    title: "CRISPR",
    truth: [
      "A bacterial immune system repurposed as a gene-editing tool",
      "Cas9 is a protein that cuts DNA at a location specified by a guide RNA",
      "The cell's own repair machinery then introduces the edit",
      "Doudna and Charpentier shared the 2020 Nobel Prize in Chemistry",
    ],
    reading: "en.wikipedia.org/wiki/CRISPR",
  },
  {
    id: "jevons",
    title: "The Jevons paradox",
    truth: [
      "Efficiency gains can increase total consumption of a resource",
      "Jevons observed it with coal and steam engines in 1865",
      "Mechanism: efficiency lowers effective price, demand rises to more than compensate",
      "Cited in debates about energy policy and, lately, compute",
    ],
    reading: "en.wikipedia.org/wiki/Jevons_paradox",
  },
  {
    id: "gerrymander",
    title: "Gerrymandering",
    truth: [
      "Drawing electoral boundaries to favour one party",
      "Named after Elbridge Gerry, 1812 Massachusetts, a district shaped like a salamander",
      "Two main techniques: cracking (split opposition across seats) and packing (concentrate them into few)",
      "Measured with metrics like the efficiency gap",
    ],
    reading: "en.wikipedia.org/wiki/Gerrymandering",
  },
  {
    id: "shipping-containers",
    title: "Containerisation",
    truth: [
      "Malcolm McLean's standardised steel box, first voyage 1956",
      "Collapsed loading costs — the dominant cost in shipping was port labour, not distance",
      "Forced redesign of ports, ships, trucks and rail around one standard",
      "Widely credited as a major driver of late-20th-century globalisation",
    ],
    reading: "en.wikipedia.org/wiki/Containerization",
  },
  {
    id: "antibiotic-resistance",
    title: "Antibiotic resistance",
    truth: [
      "Selection pressure: antibiotics kill susceptible bacteria, resistant ones survive and reproduce",
      "Resistance genes spread horizontally between bacteria via plasmids",
      "Driven by over-prescription and agricultural use, not by individuals 'building immunity'",
      "The person doesn't become resistant — the bacterial population does",
    ],
    reading: "en.wikipedia.org/wiki/Antimicrobial_resistance",
  },
];

/** One boss topic per ISO week, rotating. */
export function weeklyTopic(now = new Date()): ColdTopic {
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.floor(
    (now.getTime() - start.getTime()) / (7 * 86_400_000)
  );
  return COLD_TOPICS[week % COLD_TOPICS.length];
}
