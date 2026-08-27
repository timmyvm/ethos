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
      "It is about metacognition: judging competence takes the same skill being measured",
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
      "Collapsed loading costs: the dominant cost in shipping was port labour, not distance",
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
      "The person does not become resistant; the bacterial population does",
    ],
    reading: "en.wikipedia.org/wiki/Antimicrobial_resistance",
  },
  {
    id: "moral-hazard",
    title: "Moral hazard",
    truth: [
      "Taking more risk because someone else bears the cost",
      "The term comes from the insurance trade: cover changes behaviour",
      "Banks judged too big to fail may lend more loosely, expecting rescue",
      "Distinct from adverse selection, which happens before a contract is signed",
    ],
    reading: "en.wikipedia.org/wiki/Moral_hazard",
  },
  {
    id: "gini-coefficient",
    title: "The Gini coefficient",
    truth: [
      "One number for inequality: 0 is perfect equality, 1 is one person holding everything",
      "Devised by the Italian statistician Corrado Gini in 1912",
      "Derived from the Lorenz curve, which plots cumulative income against population",
      "Two countries with the same Gini can hide very different distributions",
      "South Africa sits near the top of world rankings, Nordic countries near the bottom",
    ],
    reading: "en.wikipedia.org/wiki/Gini_coefficient",
  },
  {
    id: "comparative-advantage",
    title: "Comparative advantage",
    truth: [
      "Trade can benefit both sides even when one side is better at producing everything",
      "What matters is opportunity cost, not absolute productivity",
      "David Ricardo formalised it in 1817 using English cloth and Portuguese wine",
      "Even a country worse at everything still holds a comparative advantage in something",
    ],
    reading: "en.wikipedia.org/wiki/Comparative_advantage",
  },
  {
    id: "tulip-mania",
    title: "Tulip mania",
    truth: [
      "A Dutch tulip bubble that peaked in the winter of 1636 to 1637",
      "The prized flame-streaked petals were caused by a plant virus",
      "Often called the first recorded speculative bubble",
      "Historians such as Anne Goldgar argue the crash's real economic damage was small",
    ],
    reading: "en.wikipedia.org/wiki/Tulip_mania",
  },
  {
    id: "market-for-lemons",
    title: "The market for lemons",
    truth: [
      "George Akerlof's 1970 paper on used cars and information asymmetry",
      "Sellers know a car's quality, buyers do not, so offers sink toward the average",
      "Good cars exit and the lemons stay: adverse selection can unravel a market",
      "Akerlof shared the 2001 Nobel in economics for the work",
      "The fixes are signals and guarantees: warranties, inspections, branding",
    ],
    reading: "en.wikipedia.org/wiki/The_Market_for_Lemons",
  },
  {
    id: "lagrange-points",
    title: "Lagrange points",
    truth: [
      "Five positions where a small object keeps station with two orbiting bodies",
      "Named for Joseph-Louis Lagrange, who analysed the problem in 1772",
      "The James Webb Space Telescope loops around L2, about 1.5 million km from Earth",
      "L4 and L5 are stable; Jupiter's hold thousands of Trojan asteroids",
    ],
    reading: "en.wikipedia.org/wiki/Lagrange_point",
  },
  {
    id: "cosmic-microwave-background",
    title: "The cosmic microwave background",
    truth: [
      "Radiation left over from the universe at about 380,000 years old",
      "Penzias and Wilson found it by accident in 1964 and first blamed pigeon droppings",
      "Its temperature today is about 2.7 kelvin, almost uniform across the whole sky",
      "The accidental discovery won the 1978 Nobel Prize in Physics",
      "Tiny ripples in it are the seeds that grew into galaxies",
    ],
    reading: "en.wikipedia.org/wiki/Cosmic_microwave_background",
  },
  {
    id: "kessler-syndrome",
    title: "Kessler syndrome",
    truth: [
      "A cascade where collisions in orbit create debris that causes further collisions",
      "Proposed by NASA scientist Donald Kessler in 1978",
      "Debris in low Earth orbit moves at roughly 7 to 8 km per second",
      "The 2009 Iridium and Cosmos crash was the first accidental hit between intact satellites",
    ],
    reading: "en.wikipedia.org/wiki/Kessler_syndrome",
  },
  {
    id: "superconductivity",
    title: "Superconductivity",
    truth: [
      "Below a critical temperature, some materials carry current with zero resistance",
      "Discovered in mercury by Heike Kamerlingh Onnes in 1911",
      "Superconductors also expel magnetic fields, the Meissner effect, hence levitation",
      "MRI scanners run on superconducting magnets cooled by liquid helium",
      "So-called high-temperature versions still run far below zero, cooled with liquid nitrogen",
    ],
    reading: "en.wikipedia.org/wiki/Superconductivity",
  },
  {
    id: "prions",
    title: "Prions",
    truth: [
      "Infectious agents made only of misfolded protein, carrying no DNA or RNA",
      "One misfolded prion converts normal proteins to its shape in a chain reaction",
      "Cause Creutzfeldt–Jakob disease in humans and mad cow disease in cattle",
      "Stanley Prusiner won the 1997 Nobel for the prion hypothesis",
      "They survive sterilisation that reliably kills bacteria and viruses",
    ],
    reading: "en.wikipedia.org/wiki/Prion",
  },
  {
    id: "hela-cells",
    title: "HeLa cells",
    truth: [
      "The first immortal human cell line, growing in labs since 1951",
      "Taken from Henrietta Lacks, a cervical cancer patient, without her knowledge",
      "Helped test the polio vaccine and appear in tens of thousands of papers",
      "Her family learned of the cells decades later; the case reshaped consent rules",
    ],
    reading: "en.wikipedia.org/wiki/HeLa",
  },
  {
    id: "semmelweis-handwashing",
    title: "Semmelweis and handwashing",
    truth: [
      "Ignaz Semmelweis, Vienna, 1847: hand washing in chlorinated lime cut maternal deaths",
      "Doctors were moving from autopsies straight to deliveries, carrying infection",
      "Deaths from childbed fever on his ward fell roughly tenfold",
      "Colleagues rejected the idea; he died in an asylum in 1865, before germ theory won",
    ],
    reading: "en.wikipedia.org/wiki/Ignaz_Semmelweis",
  },
  {
    id: "placebo-effect",
    title: "The placebo effect",
    truth: [
      "Improvement after an inert treatment, driven by expectation and ritual",
      "Part of any measured placebo response is regression to the mean, not an effect at all",
      "The nocebo effect is the mirror: expecting harm produces real symptoms",
      "Strongest on self-rated outcomes like pain and nausea; it does not shrink tumours",
    ],
    reading: "en.wikipedia.org/wiki/Placebo",
  },
  {
    id: "loss-aversion",
    title: "Loss aversion",
    truth: [
      "Losses feel roughly twice as heavy as equal gains",
      "A pillar of Kahneman and Tversky's 1979 prospect theory",
      "Drives framing effects: the same choice flips when worded as a loss or a gain",
      "Kahneman won the 2002 Nobel in economics; Tversky had died in 1996",
    ],
    reading: "en.wikipedia.org/wiki/Loss_aversion",
  },
  {
    id: "bystander-effect",
    title: "The bystander effect",
    truth: [
      "The more witnesses to an emergency, the less likely any one of them helps",
      "Shown in lab experiments by Darley and Latané in 1968",
      "Mechanisms: responsibility diffuses, and everyone reads everyone else's calm as safety",
      "The 1964 Kitty Genovese story that sparked it was overstated: some neighbours did act",
    ],
    reading: "en.wikipedia.org/wiki/Bystander_effect",
  },
  {
    id: "spacing-effect",
    title: "The spacing effect",
    truth: [
      "Practice spread over days beats the same amount massed into one session",
      "Hermann Ebbinghaus documented it in 1885 while memorising nonsense syllables",
      "His forgetting curve drops steeply at first, then flattens",
      "Recall at growing intervals slows the forgetting; flashcard apps schedule exactly this",
    ],
    reading: "en.wikipedia.org/wiki/Spacing_effect",
  },
  {
    id: "marshmallow-test",
    title: "The marshmallow test",
    truth: [
      "Walter Mischel's Stanford studies of the early 1970s on delayed gratification",
      "A child chose one treat now or two after waiting about 15 minutes alone",
      "Early follow-ups linked longer waits to better teenage outcomes",
      "A 2018 revisit found the link mostly fades once family background is controlled for",
    ],
    reading: "en.wikipedia.org/wiki/Stanford_marshmallow_experiment",
  },
  {
    id: "antikythera-mechanism",
    title: "The Antikythera mechanism",
    truth: [
      "A geared astronomical calculator raised from a Greek shipwreck in 1901",
      "Built around the 2nd century BC; it predicted eclipses and tracked lunar cycles",
      "About 30 bronze gears survive, read today with X-ray tomography",
      "Nothing as intricate survives again until medieval clockwork, a thousand years on",
    ],
    reading: "en.wikipedia.org/wiki/Antikythera_mechanism",
  },
  {
    id: "year-without-a-summer",
    title: "The year without a summer",
    truth: [
      "1816: summer frosts and failed harvests across Europe and eastern North America",
      "The cause was the 1815 eruption of Mount Tambora in Indonesia, the largest on record",
      "Stratospheric aerosols dimmed sunlight and cooled the globe for over a year",
      "The gloomy Geneva summer produced Frankenstein, begun in a ghost story contest",
    ],
    reading: "en.wikipedia.org/wiki/Year_Without_a_Summer",
  },
  {
    id: "library-of-alexandria",
    title: "The Library of Alexandria",
    truth: [
      "The ancient Mediterranean's great research library, in Ptolemaic Egypt",
      "No single burning destroyed it; it declined over several centuries",
      "Caesar's fire in 48 BC damaged holdings, yet scholarship carried on after",
      "Most classical texts were lost to neglect and failed copying, not to flames",
    ],
    reading: "en.wikipedia.org/wiki/Library_of_Alexandria",
  },
  {
    id: "rosetta-stone",
    title: "The Rosetta Stone",
    truth: [
      "Found in 1799 by French soldiers rebuilding a fort near the town of Rosetta",
      "One priestly decree of 196 BC in three scripts: hieroglyphic, Demotic and Greek",
      "Jean-François Champollion announced the decipherment of hieroglyphs in 1822",
      "It has sat in the British Museum since 1802",
    ],
    reading: "en.wikipedia.org/wiki/Rosetta_Stone",
  },
  {
    id: "non-proliferation-treaty",
    title: "The Non-Proliferation Treaty",
    truth: [
      "Opened for signature in 1968; the bargain at the heart of the nuclear order",
      "Recognises five weapon states: the US, Russia, the UK, France and China",
      "Everyone else forswears the bomb in exchange for civilian nuclear help",
      "The five promised in Article VI to negotiate towards disarmament",
      "India, Pakistan and Israel never joined; North Korea withdrew in 2003",
    ],
    reading: "en.wikipedia.org/wiki/Treaty_on_the_Non-Proliferation_of_Nuclear_Weapons",
  },
  {
    id: "antarctic-treaty",
    title: "The Antarctic Treaty",
    truth: [
      "Signed by twelve nations in 1959, in force since 1961",
      "Bans military bases, weapons tests and nuclear waste on the continent",
      "Freezes every territorial claim without settling any of them",
      "A 1991 protocol added a ban on mining",
      "Any party may inspect any other party's station",
    ],
    reading: "en.wikipedia.org/wiki/Antarctic_Treaty_System",
  },
  {
    id: "exclusive-economic-zone",
    title: "Exclusive economic zones",
    truth: [
      "A coastal state controls sea resources out to 200 nautical miles",
      "Created by the UN Convention on the Law of the Sea, agreed in 1982",
      "Not territory: foreign ships pass freely, but fish and seabed riches are exclusive",
      "Tiny islands cast huge zones, which is why remote rocks get contested",
      "Scattered territories give France and the United States the largest zones",
    ],
    reading: "en.wikipedia.org/wiki/Exclusive_economic_zone",
  },
  {
    id: "marshall-plan",
    title: "The Marshall Plan",
    truth: [
      "US aid that helped rebuild Western Europe from 1948 to 1951",
      "About 13 billion dollars at the time, named for Secretary of State George Marshall",
      "The Soviet Union refused it and made its satellite states refuse too",
      "Its coordinating body, the OEEC, seeded later European economic integration",
    ],
    reading: "en.wikipedia.org/wiki/Marshall_Plan",
  },
  {
    id: "submarine-cables",
    title: "Submarine cables",
    truth: [
      "Nearly all intercontinental internet traffic runs through undersea fibre, not satellites",
      "The first transatlantic telegraph cable worked in 1858 and failed within weeks",
      "In deep water the cable is only about as thick as a garden hose",
      "Fishing gear and anchors cause most faults; ships grapple the cable up to mend it",
    ],
    reading: "en.wikipedia.org/wiki/Submarine_communications_cable",
  },
  {
    id: "domain-name-system",
    title: "The Domain Name System",
    truth: [
      "Translates names like wikipedia.org into the numeric addresses machines route by",
      "A delegated hierarchy: root servers point to top-level domains, then down the chain",
      "There are 13 root server addresses but hundreds of physical servers behind them",
      "Paul Mockapetris designed it in 1983, replacing one hand-edited hosts file",
    ],
    reading: "en.wikipedia.org/wiki/Domain_Name_System",
  },
  {
    id: "public-key-cryptography",
    title: "Public-key cryptography",
    truth: [
      "Two linked keys: anyone may encrypt with the public one, only the private one decrypts",
      "Solves key distribution: strangers can talk secretly with no prior shared secret",
      "Diffie and Hellman published the idea in 1976; RSA followed in 1977",
      "GCHQ's Clifford Cocks had it secretly by 1973, declassified only in 1997",
      "Every HTTPS padlock is this mathematics at work",
    ],
    reading: "en.wikipedia.org/wiki/Public-key_cryptography",
  },
  {
    id: "turing-test",
    title: "The Turing test",
    truth: [
      "Alan Turing's 1950 imitation game: can a judge in text chat tell machine from human",
      "Proposed in the paper Computing Machinery and Intelligence, in the journal Mind",
      "He offered it to replace 'can machines think', a question he called too vague to debate",
      "Passing measures imitation in conversation, not understanding or thought",
    ],
    reading: "en.wikipedia.org/wiki/Turing_test",
  },
  {
    id: "packet-switching",
    title: "Packet switching",
    truth: [
      "Data is chopped into packets that route independently and reassemble at the far end",
      "Conceived separately in the 1960s by Paul Baran and Donald Davies, who coined 'packet'",
      "Replaced circuit switching, where a call held one dedicated line open end to end",
      "ARPANET's first message in 1969 delivered two letters, LO, before the link crashed",
    ],
    reading: "en.wikipedia.org/wiki/Packet_switching",
  },
  {
    id: "habeas-corpus",
    title: "Habeas corpus",
    truth: [
      "A court order to produce a detained person and justify the detention",
      "The Latin means 'you shall have the body'",
      "England's Habeas Corpus Act of 1679 made the writ hard for the Crown to evade",
      "It can be suspended: Lincoln did so during the American Civil War",
    ],
    reading: "en.wikipedia.org/wiki/Habeas_corpus",
  },
  {
    id: "doctrine-of-precedent",
    title: "The doctrine of precedent",
    truth: [
      "Common law courts are bound by earlier decisions of higher courts",
      "The Latin tag is stare decisis, to stand by what has been decided",
      "Only the ratio decidendi binds, the reasoning essential to the result; the rest is obiter",
      "Civil law countries like France and Germany work from codes; cases persuade, not bind",
    ],
    reading: "en.wikipedia.org/wiki/Precedent",
  },
  {
    id: "double-jeopardy",
    title: "Double jeopardy",
    truth: [
      "An acquitted person cannot normally be tried again for the same offence",
      "Ancient roots: Roman law and the common law plea of autrefois acquit",
      "England added an exception in 2003 for grave crimes with compelling new evidence",
      "That reform followed the Stephen Lawrence case; a 2012 conviction used it",
    ],
    reading: "en.wikipedia.org/wiki/Double_jeopardy",
  },
  {
    id: "nuremberg-trials",
    title: "The Nuremberg trials",
    truth: [
      "The Allied tribunal that tried leading Nazis at Nuremberg, 1945 to 1946",
      "Twelve of the main defendants were sentenced to death",
      "Established that following orders is no complete defence",
      "Put crimes against humanity into international law",
      "Its principles led towards the Genocide Convention and the ICC",
    ],
    reading: "en.wikipedia.org/wiki/Nuremberg_trials",
  },
  {
    id: "haber-bosch",
    title: "The Haber–Bosch process",
    truth: [
      "Fixes nitrogen from air into ammonia for fertiliser, under fierce heat and pressure",
      "Fritz Haber demonstrated it in 1909; Carl Bosch industrialised it at BASF",
      "Fertiliser made this way feeds roughly half the people alive today",
      "It consumes roughly 1 to 2 percent of the world's energy supply",
      "Haber later ran Germany's chlorine gas programme in the First World War",
    ],
    reading: "en.wikipedia.org/wiki/Haber_process",
  },
  {
    id: "gps",
    title: "The Global Positioning System",
    truth: [
      "A receiver times signals from at least four satellites to fix position and clock",
      "The satellites carry atomic clocks; a nanosecond of error is about 30 cm on the ground",
      "Uncorrected relativity would drift the clocks by about 38 microseconds a day",
      "Civilian accuracy jumped in 2000 when the US switched off Selective Availability",
      "The constellation keeps at least 24 satellites aloft, run by the US Space Force",
    ],
    reading: "en.wikipedia.org/wiki/Global_Positioning_System",
  },
  {
    id: "tacoma-narrows",
    title: "The Tacoma Narrows collapse",
    truth: [
      "A new suspension bridge in Washington State tore itself apart in November 1940",
      "Wind near 40 mph set the deck twisting through aeroelastic flutter",
      "Textbooks long blamed simple resonance; the real mechanism is self-excited flutter",
      "Nicknamed Galloping Gertie; the only casualty was a dog left in a stranded car",
      "The failure made wind tunnel testing standard for long-span bridge decks",
    ],
    reading: "en.wikipedia.org/wiki/Tacoma_Narrows_Bridge_(1940)",
  },
  {
    id: "roman-concrete",
    title: "Roman concrete",
    truth: [
      "Roman harbour concrete has endured two millennia of seawater",
      "The binder mixed lime with volcanic ash called pozzolana, named after Pozzuoli",
      "The Pantheon's 43-metre dome is still the largest unreinforced concrete dome",
      "Research in 2023 showed embedded lime clasts let the material heal its own cracks",
    ],
    reading: "en.wikipedia.org/wiki/Roman_concrete",
  },
  {
    id: "great-vowel-shift",
    title: "The Great Vowel Shift",
    truth: [
      "English long vowels moved step by step between roughly 1400 and 1700",
      "Spelling froze first, thanks to printing, which is why English spelling misleads",
      "'Bite' once sounded like 'beet', and 'meet' close to modern 'mate'",
      "Causes are still debated; dialect mixing in post-plague London is one theory",
    ],
    reading: "en.wikipedia.org/wiki/Great_Vowel_Shift",
  },
  {
    id: "linguistic-relativity",
    title: "Linguistic relativity",
    truth: [
      "The idea that the language you speak shapes how you think",
      "The strong claim, that language determines thought, is rejected by most linguists",
      "Weak effects are real: colour terms and direction words measurably nudge perception",
      "The 'dozens of Eskimo words for snow' factoid is exaggerated folklore",
      "Sapir and Whorf never co-wrote the hypothesis named after them",
    ],
    reading: "en.wikipedia.org/wiki/Linguistic_relativity",
  },
  {
    id: "equal-temperament",
    title: "Equal temperament",
    truth: [
      "Tuning that splits the octave into twelve equal semitones",
      "Each semitone step is the twelfth root of two, about 1.0595",
      "A compromise: every key becomes playable, and none is perfectly in tune",
      "Older tunings kept some keys pure and left others with howling 'wolf' intervals",
    ],
    reading: "en.wikipedia.org/wiki/Equal_temperament",
  },
  {
    id: "plate-tectonics",
    title: "Plate tectonics",
    truth: [
      "Earth's rigid outer shell is broken into plates that drift on the mantle",
      "Alfred Wegener proposed continental drift in 1912 and was mocked for lacking a mechanism",
      "Seafloor spreading, mapped in the 1960s, supplied the mechanism and settled it",
      "Plates move a few centimetres a year, about the pace fingernails grow",
    ],
    reading: "en.wikipedia.org/wiki/Plate_tectonics",
  },
  {
    id: "great-oxidation-event",
    title: "The Great Oxidation Event",
    truth: [
      "Around 2.4 billion years ago, oxygen began accumulating in Earth's atmosphere",
      "The source was photosynthesising cyanobacteria",
      "For the anaerobic life already here, the new oxygen was a poison",
      "Banded iron formations record it: dissolved iron rusted out of the oceans",
      "It may have triggered the Huronian glaciation by destroying greenhouse methane",
    ],
    reading: "en.wikipedia.org/wiki/Great_Oxidation_Event",
  },
  {
    id: "el-nino",
    title: "El Niño",
    truth: [
      "A periodic warming of the central and eastern tropical Pacific",
      "Trade winds slacken, warm water shifts east, and weather patterns move worldwide",
      "Named by Peruvian fishermen for the Christ child; it peaks near Christmas",
      "La Niña is the cool opposite phase; the whole cycle is called ENSO",
      "Events arrive every two to seven years, on no fixed schedule",
    ],
    reading: "en.wikipedia.org/wiki/El_Niño–Southern_Oscillation",
  },
  {
    id: "milankovitch-cycles",
    title: "Milankovitch cycles",
    truth: [
      "Slow changes in Earth's orbit and tilt that set the rhythm of the ice ages",
      "Three cycles: orbit shape near 100,000 years, tilt near 41,000, wobble near 23,000",
      "Computed by Milutin Milankovic while interned during the First World War",
      "Deep-sea sediment cores confirmed the timings in a landmark 1976 study",
      "They redistribute sunlight by season and latitude; feedbacks amplify the signal",
    ],
    reading: "en.wikipedia.org/wiki/Milankovitch_cycles",
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
