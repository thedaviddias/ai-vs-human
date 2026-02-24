# Contributing to AI vs Human

First off, thank you for considering contributing to AI vs Human! It's people like you that make open source such a great community.

## Local Development

This project is built with:
- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Database/Backend**: [Convex](https://convex.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide](https://lucide.dev/) and [Simple Icons](https://simpleicons.org/)

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/thedaviddias/ai-vs-human.git
   cd ai-vs-human
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure Environment**
   Create a `.env.local` file with your Convex deployment URL and a GitHub personal access token (no special scopes needed for public repos).
   ```bash
   CONVEX_DEPLOYMENT=...
   NEXT_PUBLIC_CONVEX_URL=...
   GITHUB_TOKEN=your_token
   ANALYZE_API_KEY=any_secret_string
   ```

4. **Run the development server**
   ```bash
   pnpm dev
   ```
   This will start both the Next.js dev server and the Convex backend listener.

## Adding New AI Tools

If you know of an AI tool we're not detecting yet:
1. Open `convex/classification/knownBots.ts`.
2. Add the relevant regex patterns to `KNOWN_BOT_PATTERNS`, `CO_AUTHOR_AI_PATTERNS`, or `COMMIT_MESSAGE_AI_MARKERS`.
3. If the tool should have its own breakdown card, add it to the `classificationValidator` in `convex/schema.ts` and update `AIToolBreakdown.tsx`.

## Submitting Changes

1. **Branching**: Create a feature branch (`git checkout -b feature/amazing-feature`).
2. **Linting**: We use [Biome](https://biomejs.dev/) for linting and formatting. Run `pnpm lint` before committing.
3. **Commit Messages**: Follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat: add aider detection`).
4. **Pull Request**: Open a PR against the `main` branch with a clear description of your changes.

## Testing

Run the test suite using Vitest:
```bash
pnpm test
```

We aim for high coverage on the classification logic to prevent false positives.

---

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
