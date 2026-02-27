import {
  SiClaude,
  SiCodecov,
  SiCoderabbit,
  SiCursor,
  SiDependabot,
  SiExpo,
  SiGithubactions,
  SiGithubcopilot,
  SiGooglegemini,
  SiGooglejules,
  SiNetlify,
  SiQodo,
  SiRenovate,
  SiReplit,
  SiSemanticrelease,
  SiSentry,
  SiSnyk,
  SiSonar,
  SiStackblitz,
  SiV0,
  SiVercel,
  SiWeblate,
  SiWindsurf,
} from "@icons-pack/react-simple-icons";
import { Bot, Sparkles, Terminal } from "lucide-react";
import {
  GreptileIcon,
  LovableIcon,
  OpenAIIcon,
  SourcegraphIcon,
  TabnineIcon,
} from "@/components/icons/custom-tool-icons";

const AI_SIMPLE_ICON_KEYS = new Set([
  "github-copilot",
  "claude-code",
  "cursor",
  "gemini",
  "coderabbit",
  "seer-by-sentry",
  "sentry-ai-reviewer",
  "qodo-merge",
  "windsurf",
  "replit-agent",
  "v0",
  "bolt",
  "openai-codex",
  "lovable",
  "greptile",
  "tabnine",
  "sourcegraph-cody",
]);

const AI_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  "github-copilot": SiGithubcopilot,
  "claude-code": SiClaude,
  cursor: SiCursor,
  aider: Terminal,
  devin: Bot,
  "openai-codex": OpenAIIcon,
  gemini: SiGooglegemini,
  "amazon-q-developer": Bot,
  sweep: Sparkles,
  coderabbit: SiCoderabbit,
  "seer-by-sentry": SiSentry,
  "sentry-ai-reviewer": SiSentry,
  "qodo-merge": SiQodo,
  greptile: GreptileIcon,
  "korbit-ai": Sparkles,
  codeium: Sparkles,
  windsurf: SiWindsurf,
  "sourcegraph-cody": SourcegraphIcon,
  tabnine: TabnineIcon,
  "continue-dev": Sparkles,
  "replit-agent": SiReplit,
  bolt: SiStackblitz,
  v0: SiV0,
  "blackbox-ai": Sparkles,
  lovable: LovableIcon,
};

const AI_COLORS: Record<string, string> = {
  "github-copilot": "text-[#181717] dark:text-white",
  "claude-code": "text-[#D97757]",
  cursor: "text-[#00A3FF]",
  aider: "text-green-400",
  devin: "text-purple-400",
  "openai-codex": "text-[#181717] dark:text-white",
  gemini: "text-[#4285F4]",
  coderabbit: "text-[#FF6B2B]",
  "seer-by-sentry": "text-[#362D59]",
  "sentry-ai-reviewer": "text-[#362D59]",
  "qodo-merge": "text-[#7C3AED]",
  windsurf: "text-[#00C0FF]",
  "replit-agent": "text-[#F26207]",
  v0: "text-[#181717] dark:text-white",
  bolt: "text-[#1389FD]",
  greptile: "text-[#30B77E]",
  tabnine: "text-[#FF2210]",
  "sourcegraph-cody": "text-[#00CBEC]",
  lovable: "text-[#1E52F1]",
};

const BOT_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  dependabot: SiDependabot,
  renovate: SiRenovate,
  "github-actions": SiGithubactions,
  "semantic-release": SiSemanticrelease,
  "snyk-bot": SiSnyk,
  "sentry-bot": SiSentry,
  codecov: SiCodecov,
  sonarcloud: SiSonar,
  vercel: SiVercel,
  v1: SiVercel,
  "bot-v1": SiVercel,
  netlify: SiNetlify,
  "expo-bot": SiExpo,
  "bot-expo-bot": SiExpo,
  weblate: SiWeblate,
  "bot-weblate": SiWeblate,
  "google-jules": SiGooglejules,
  "bot-google-jules": SiGooglejules,
};

const BOT_COLORS: Record<string, string> = {
  dependabot: "text-[#025E8C]",
  renovate: "text-amber-500",
  "github-actions": "text-[#2088FF]",
  "semantic-release": "text-[#494949] dark:text-neutral-300",
  "snyk-bot": "text-[#4C4A73]",
  "sentry-bot": "text-[#362D59]",
  codecov: "text-[#F01F7A]",
  sonarcloud: "text-[#F3702A]",
  vercel: "text-white",
  v1: "text-white",
  "bot-v1": "text-white",
  netlify: "text-[#00C7B7]",
  "expo-bot": "text-[#000020] dark:text-white",
  "bot-expo-bot": "text-[#000020] dark:text-white",
  weblate: "text-[#2ECCAA]",
  "bot-weblate": "text-[#2ECCAA]",
  "google-jules": "text-[#4285F4]",
  "bot-google-jules": "text-[#4285F4]",
};

export function AiToolLogo({ toolKey, label }: { toolKey: string; label: string }) {
  const Icon = AI_ICONS[toolKey] ?? Sparkles;
  const color = AI_COLORS[toolKey] ?? "text-neutral-300";
  const isSimple = AI_SIMPLE_ICON_KEYS.has(toolKey);

  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-800 bg-black/30 ${color}`}
      role="img"
      aria-label={`${label} logo`}
      title={label}
    >
      {isSimple ? <Icon size={16} /> : <Icon className="h-4 w-4" />}
    </div>
  );
}

export function BotLogo({ botKey, label }: { botKey: string; label: string }) {
  const Icon = BOT_ICONS[botKey] ?? Bot;
  const color = BOT_COLORS[botKey] ?? "text-amber-600";
  const isSimple = botKey in BOT_ICONS;

  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-800 bg-black/30 ${color}`}
      role="img"
      aria-label={`${label} logo`}
      title={label}
    >
      {isSimple ? <Icon size={16} /> : <Icon className="h-4 w-4" />}
    </div>
  );
}
