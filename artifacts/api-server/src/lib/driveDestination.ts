// Where each kind of document lives in the institution's Drive.
//
// ONE mapper, because nine upload sites with nine ideas about folders is how
// an archive becomes unbrowsable. Every site passes its namespace and what
// context it has; this decides the path.
//
// The resulting tree is the one an employee actually navigates:
//
//   01 Projects / <project> (<id8>) / <category>
//   02 HR
//   03 Email Archive / <message>
//   04 Agencies / <agency>
//   09 Uploads / <project> (<id8>) / <section>
//
// A numeric prefix keeps the top level in a deliberate order rather than
// alphabetical-by-accident, and keeps Arabic and Latin names from
// interleaving unpredictably.

const MAX_SEGMENT = 120;

export function sanitiseSegment(value: string, fallback: string): string {
  const cleaned = String(value ?? "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{M}\p{N}._ ()-]/gu, "_")
    .trim()
    .slice(0, MAX_SEGMENT);
  // "." and ".." would be path traversal in any other system; Drive has no
  // paths, but a folder literally named ".." is still a trap for a human.
  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : fallback;
}

/** A project folder carries its id, so renaming the project is cosmetic. */
export function projectFolderName(projectId: string, projectLabel?: string): string {
  const label = sanitiseSegment(projectLabel ?? "", "");
  const shortId = String(projectId ?? "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 8) || "unknown";
  return label ? `${label} (${shortId})` : `Project ${shortId}`;
}

export interface DestinationContext {
  projectId?: string;
  projectLabel?: string;
  /** Attachment entity type, upload section, agency folder, message id. */
  category?: string;
}

/**
 * The folder chain for one namespace.
 *
 * Namespaces are the application's own vocabulary and are NOT invented here -
 * they are exactly the strings the upload sites already pass to Replit Object
 * Storage, so the two storages stay describable in the same terms.
 */
export function folderSegmentsForNamespace(
  namespace: string,
  context: DestinationContext = {},
): string[] {
  const category = context.category ? sanitiseSegment(context.category, "") : "";
  switch (namespace) {
    case "attachments":
      return [
        "01 Projects",
        projectFolderName(context.projectId ?? "", context.projectLabel),
        category || "99 Other",
      ];
    case "hr":
      // HR documents are deliberately NOT under a project: they belong to a
      // person, and filing them by project would expose them to anyone who
      // can see that project's folder.
      return ["02 HR", category || "General"];
    case "email-archive":
      return ["03 Email Archive", category || "Unsorted"];
    case "agencies":
      return ["04 Agencies", category || "General"];
    case "project-photos":
      return [
        "01 Projects",
        projectFolderName(context.projectId ?? "", context.projectLabel),
        "05 Photos",
      ];
    case "uploads":
      return [
        "09 Uploads",
        projectFolderName(context.projectId ?? "", context.projectLabel),
        category || "General",
      ];
    default:
      // An unknown namespace must still land somewhere predictable rather
      // than at the root of the institution's Drive.
      return ["09 Uploads", sanitiseSegment(namespace, "misc")];
  }
}

/** Every namespace this build knows how to file. */
export const KNOWN_NAMESPACES = Object.freeze([
  "attachments", "hr", "email-archive", "agencies", "project-photos", "uploads",
]);
