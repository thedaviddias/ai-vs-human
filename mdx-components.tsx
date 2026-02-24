import type { MDXComponents } from "mdx/types";
import { Children, type ReactNode } from "react";
import { highlight } from "sugar-high";

type Props = { children?: ReactNode };
type AnchorProps = Props & { href?: string };
type CodeProps = Props & { className?: string };

/** Strip whitespace-only text nodes inserted between table tags. */
function noWS(children: ReactNode): ReactNode {
  return Children.map(children, (c) => (typeof c === "string" && c.trim() === "" ? null : c));
}

/** Extract the raw text string from children (handles nested elements). */
function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Headings
    h1: ({ children }: Props) => (
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{children}</h1>
    ),
    h2: ({ children }: Props) => (
      <h2 className="mt-12 text-xl font-bold tracking-tight sm:text-2xl first:mt-0">{children}</h2>
    ),
    h3: ({ children }: Props) => (
      <h3 className="mt-8 text-lg font-bold tracking-tight sm:text-xl">{children}</h3>
    ),

    // Body text
    p: ({ children }: Props) => (
      <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        {children}
      </p>
    ),

    // Lists
    ul: ({ children }: Props) => (
      <ul className="mt-3 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">{children}</ul>
    ),
    ol: ({ children }: Props) => (
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
        {children}
      </ol>
    ),
    li: ({ children }: Props) => <li className="leading-relaxed">{children}</li>,

    // Code blocks (fenced ``` blocks) — mdxRs emits <pre><code class="language-*">
    // We intercept the <pre> wrapper and let the inner <code> handle highlighting.
    pre: ({ children }: Props) => (
      <pre className="mt-4 overflow-x-auto rounded-lg border border-neutral-800 bg-[#0d1117] p-4 text-sm leading-relaxed font-mono">
        {children}
      </pre>
    ),

    // Code — inline or block. Fenced code blocks get className="language-*"
    // from mdxRs; inline code does not.
    code: ({ children, className }: CodeProps) => {
      const isBlock = className?.startsWith("language-");

      if (isBlock) {
        const code = extractText(children).replace(/\n$/, "");
        const html = highlight(code);
        return (
          <code
            className="sugar-high"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: syntax-highlighted HTML from sugar-high is safe
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }

      // Inline code
      return (
        <code className="rounded bg-neutral-800 px-1.5 py-0.5 text-[13px] text-neutral-200">
          {children}
        </code>
      );
    },

    // Block quotes → styled as callout boxes
    blockquote: ({ children }: Props) => (
      <div className="mt-4 rounded-md border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400">
        {children}
      </div>
    ),

    // Emphasis
    strong: ({ children }: Props) => (
      <strong className="font-medium text-neutral-900 dark:text-neutral-100">{children}</strong>
    ),

    // Links
    a: ({ href, children }: AnchorProps) => (
      <a
        href={href}
        target={href?.startsWith("http") ? "_blank" : undefined}
        rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
        className="underline hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        {children}
      </a>
    ),

    // Horizontal rule → section divider
    hr: () => <hr className="my-8 border-neutral-200 dark:border-neutral-800" />,

    // Tables
    table: ({ children }: Props) => (
      <table className="mt-4 w-full text-left text-sm">{noWS(children)}</table>
    ),
    thead: ({ children }: Props) => <thead>{noWS(children)}</thead>,
    tbody: ({ children }: Props) => <tbody>{noWS(children)}</tbody>,
    tr: ({ children }: Props) => <tr>{noWS(children)}</tr>,
    th: ({ children }: Props) => (
      <th className="pb-2 pr-4 font-semibold text-neutral-900 dark:text-neutral-100">{children}</th>
    ),
    td: ({ children }: Props) => (
      <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-400">{children}</td>
    ),

    ...components,
  };
}
