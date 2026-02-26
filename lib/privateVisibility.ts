/**
 * Determines whether private data should be visible to the current viewer.
 *
 * Decision tree:
 *
 *   No private data?                → false (nothing to show)
 *   Owner viewing own profile?      → true  (always sees their data)
 *   showPrivateDataPublicly = true?  → true  (user opted in — default)
 *   showPrivateDataPublicly = undef? → true  (treat undefined as default on)
 *   showPrivateDataPublicly = false? → false (user opted out)
 *
 * The key design choice: `undefined` (field not set) is treated as `true`
 * because the default behaviour is to show private data publicly. Users
 * must explicitly toggle it off. This avoids needing a migration for
 * existing profiles that were created before the toggle existed.
 */

interface PrivateVisibilityInput {
  isOwnProfile: boolean;
  hasPrivateData: boolean;
  /** undefined = default to true (show publicly) */
  showPrivateDataPublicly?: boolean;
}

export function shouldShowPrivateData({
  isOwnProfile,
  hasPrivateData,
  showPrivateDataPublicly,
}: PrivateVisibilityInput): boolean {
  // Nothing to show if no private data exists
  if (!hasPrivateData) return false;

  // Owner always sees their own data regardless of the toggle
  if (isOwnProfile) return true;

  // For visitors: respect the toggle (undefined/true = show, false = hide)
  return showPrivateDataPublicly !== false;
}
