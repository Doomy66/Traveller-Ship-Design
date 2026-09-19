/**
 * What version this is, and where to say something about it.
 *
 * The version is written in by the build from package.json, which is the one
 * number that reaches a user.
 */

declare const __APP_VERSION__: string;

export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

/** Where the project lives, which is where everything below points. */
export const REPOSITORY = "https://github.com/Doomy66/Traveller-Ship-Design";

export const RELEASE_NOTES = `${REPOSITORY}/blob/main/CHANGELOG.md`;

/**
 * A new issue, with the version and the ship already filled in. A link rather
 * than a form in the application: a form would need somewhere to send to, a way
 * to keep spam out, and a promise that somebody is reading it.
 */
export function suggestionLink(about: { ship?: string } = {}): string {
  const lines = [
    "",
    "",
    "---",
    `Traveller Ship Design ${APP_VERSION}`,
    about.ship === undefined || about.ship === "" ? "" : `Ship: ${about.ship}`,
  ].filter((line, at) => line !== "" || at < 3);
  return `${REPOSITORY}/issues/new?body=${encodeURIComponent(lines.join("\n"))}`;
}
