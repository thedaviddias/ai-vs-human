# AI vs Human

**Visualize the authorship DNA of open source software.**

AI vs Human is a modern dashboard that analyzes GitHub repositories to reveal the real breakdown of contributions. We distinguish between human handcrafted code, AI-assisted commits (Copilot, Claude Code, Cursor, etc.), and automated maintenance bots.

[Live Demo: aivshuman.dev](https://aivshuman.dev)

## 🚀 Features

- **Granular AI Attribution**: Detects specific tools like GitHub Copilot, Claude Code, Cursor, Aider, Devin, OpenAI Codex, and Gemini.
- **Activity Timelines**: A full year of activity visualized through a high-density contribution heatmap.
- **Developer Ranks**: Gamified badges from "Organic Architect" to "Digital Overseer" based on your contribution DNA.
- **Lines of Code Analysis**: Goes beyond commit counts to measure actual volume of code added by AI vs Humans.
- **Shareable Identity**: Custom generated scorecard images and embeddable README badges.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Database/Backend**: [Convex](https://convex.dev/) (Real-time sync & background processing)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Visuals**: [Satori](https://github.com/vercel/satori) for OG images, [Lucide](https://lucide.dev/) & [Simple Icons](https://simpleicons.org/) for icons.
- **Validation**: [Biome](https://biomejs.dev/) for linting & [Vitest](https://vitest.dev/) for unit testing.

## 🧠 How it Works

Our analysis engine uses a priority-based cascade to classify every commit:
1. **Author Type**: GitHub API signals for Bot accounts.
2. **Author/Committer Data**: Matching login, name, and email against 50+ known patterns.
3. **Co-Authorship**: Parsing `Co-authored-by` trailers for AI tool signatures.
4. **Message Markers**: Scanning commit messages for "Generated with..." or tool-specific prefixes.
5. **PR Metadata**: Inspecting the source PR of squash-merges to identify the original AI agent creator.

## 🤝 Contributing

We welcome contributions! Whether it's adding new AI tool detection patterns or improving the UI, check out our [Contributing Guide](./CONTRIBUTING.md) to get started.

## 📄 License

Distributed under the MIT License. See [LICENSE](./LICENSE) for more information.

## ✨ Contributors

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- markdownlint-disable -->
<!-- quill-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://thedaviddias.com"><img src="https://avatars.githubusercontent.com/u/1211612?v=4?s=100" width="100px;" alt="David Dias"/><br /><sub><b>David Dias</b></sub></a><br /><a href="#code-thedaviddias" title="Code">💻</a> <a href="#design-thedaviddias" title="Design">🎨</a> <a href="#ideas-thedaviddias" title="Ideas">🤔</a></td>
    </tr>
  </tbody>
</table>

<!-- quill-enable -->
<!-- markdownlint-enable -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

---

Build by [David Dias](https://thedaviddias.com) for the open source community.
