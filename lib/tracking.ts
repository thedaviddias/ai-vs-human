/**
 * Type-safe Plausible event tracking.
 *
 * Calls `window.plausible()` which is injected by next-plausible's script tag.
 * Using the raw global instead of the `usePlausible()` hook so tracking works
 * in plain event handlers, callbacks, and non-component code.
 *
 * No-op during SSR and in development (script not loaded → optional chaining).
 */

type TrackingEvents = {
  // Core actions
  search: { query: string };
  analyze_repo: { owner: string; repo: string };
  resync: { owner: string };
  resync_repo: { owner: string; repo: string };
  // Sharing
  copy_card: { label: string; type: "user" | "repo" };
  post_to_x: { label: string; type: "user" | "repo" };
  copy_link: { label: string; type: "user" | "repo" };
  download_png: { label: string; type: "user" | "repo" };
  system_share: { label: string; type: "user" | "repo" };
  // Embed
  copy_embed: { format: "markdown" | "html" };
};

export function trackEvent<T extends keyof TrackingEvents>(
  eventName: T,
  props: TrackingEvents[T]
): void {
  if (typeof window === "undefined") return;
  const win = window as Window & {
    plausible?: (name: string, opts: { props: TrackingEvents[T] }) => void;
  };
  win.plausible?.(eventName, { props });
}
