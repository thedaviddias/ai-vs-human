export interface Rank {
  title: string;
  description: string;
  color: string; // Tailwind class
  hex: string; // Hex code for OG image
  icon: string;
}

export const RANKS: Rank[] = [
  {
    title: "Organic Architect",
    description: "Pure human thought. 100% natural code.",
    color: "text-green-500",
    hex: "#22c55e",
    icon: "🌿",
  },
  {
    title: "Augmented Developer",
    description: "Human intuition enhanced by machine speed.",
    color: "text-emerald-400",
    hex: "#34d399",
    icon: "✨",
  },
  {
    title: "Cyborg Coder",
    description: "Perfectly balanced. Half biology, half logic.",
    color: "text-cyan-400",
    hex: "#22d3ee",
    icon: "🦾",
  },
  {
    title: "AI Pilot",
    description: "Guiding the machine to build the future.",
    color: "text-purple-400",
    hex: "#a78bfa",
    icon: "🤖",
  },
  {
    title: "Digital Overseer",
    description: "The code flows from the model. You just approve.",
    color: "text-fuchsia-500",
    hex: "#d946ef",
    icon: "🔮",
  },
];

export function getRank(humanPercentage: number): Rank {
  if (humanPercentage >= 95) return RANKS[0]; // Organic Architect
  if (humanPercentage >= 80) return RANKS[1]; // Augmented Developer
  if (humanPercentage >= 50) return RANKS[2]; // Cyborg Coder
  if (humanPercentage >= 20) return RANKS[3]; // AI Pilot
  return RANKS[4]; // Digital Overseer
}
