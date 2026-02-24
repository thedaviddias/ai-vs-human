export type ParsedInput =
  | { type: "repo"; owner: string; name: string }
  | { type: "user"; owner: string };

export function parseRepoInput(input: string): ParsedInput | null {
  const trimmed = input.trim().replace(/\/+$/, "");

  // Try "owner/repo" format
  const slashMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (slashMatch) {
    return { type: "repo", owner: slashMatch[1], name: slashMatch[2] };
  }

  // Try full GitHub URL with repo
  const urlRepoMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/
  );
  if (urlRepoMatch) {
    return { type: "repo", owner: urlRepoMatch[1], name: urlRepoMatch[2] };
  }

  // Try full GitHub URL with just username
  const urlUserMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/?$/
  );
  if (urlUserMatch) {
    return { type: "user", owner: urlUserMatch[1] };
  }

  // Try plain username (single word, valid GitHub username chars)
  const usernameMatch = trimmed.match(/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/);
  if (usernameMatch) {
    return { type: "user", owner: trimmed };
  }

  return null;
}
