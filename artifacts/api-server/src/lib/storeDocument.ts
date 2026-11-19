// THE one place a document gets stored.
//
// Nine upload sites existed and exactly one of them knew about Google Drive.
// Adding the branch to the other eight would have produced nine copies of a
// rule that must never disagree - the same mistake that caused Phase 18BC
// (two copies of a selection rule) and Phase 18BI (two copies of a scope).
// So every site now calls storeTenantDocument and the decision lives here.
//
// THE CONTRACT
//   flag OFF  byte-for-byte the previous behaviour: saveTenantPrivateObject
//             with the same namespace, filename, contentType and segments.
//             Nothing about Replit storage changes.
//   flag ON   the verified Drive transaction. It returns only after Drive has
//             confirmed id, size, checksum and institution ownership.
//   FAILURE   throws. There is NO path from a Drive failure to a Replit
//             write. A silent fallback would record a Replit path while the
//             institution believed the file was in its own Drive, and it
//             would do so most often exactly when Drive was having trouble.

import { uploadDocumentToDrive, type UploadDeps } from "./driveUpload";
import { folderSegmentsForNamespace, type DestinationContext } from "./driveDestination";

export interface StoredDocument {
  /** What goes into the database: an app/ path, or drive://<fileId>. */
  objectName: string;
  /** The app route that serves it. Same shape for both providers. */
  url: string;
  /** Present only for a Drive-stored document. */
  driveFileId?: string;
  sha256?: string;
  verified: boolean;
}

export interface StoreRequest {
  tenantId: string;
  /** The application's own vocabulary: attachments, hr, uploads, ... */
  namespace: string;
  filename: string;
  bytes: Buffer;
  contentType?: string;
  /** Replit segments. Passed through UNCHANGED when the flag is off. */
  segments?: string[];
  /** Context the Drive folder mapper needs. Ignored when the flag is off. */
  destination?: DestinationContext;
}

export interface StoreDeps {
  isEnabled: (tenantId: string) => boolean;
  saveToObjectStorage: (input: {
    tenantId: string;
    namespace: string;
    filename: string;
    bytes: Buffer;
    contentType?: string;
    segments?: string[];
  }) => Promise<{ objectName: string }>;
  uploadDeps: UploadDeps;
  /** storageObjectUrl: already branches on the drive:// prefix. */
  urlFor: (objectName: string) => string;
}

export async function storeTenantDocument(
  request: StoreRequest,
  deps: StoreDeps,
): Promise<StoredDocument> {
  if (!deps.isEnabled(request.tenantId)) {
    const saved = await deps.saveToObjectStorage({
      tenantId: request.tenantId,
      namespace: request.namespace,
      filename: request.filename,
      bytes: request.bytes,
      contentType: request.contentType,
      segments: request.segments,
    });
    return { objectName: saved.objectName, url: deps.urlFor(saved.objectName), verified: false };
  }

  const folderSegments = folderSegmentsForNamespace(request.namespace, request.destination ?? {});
  const stored = await uploadDocumentToDrive({
    tenantId: request.tenantId,
    projectId: request.destination?.projectId ?? request.namespace,
    projectLabel: request.destination?.projectLabel ?? request.namespace,
    category: request.destination?.category ?? request.namespace,
    filename: request.filename,
    bytes: request.bytes,
    contentType: request.contentType ?? "application/octet-stream",
    folderSegments,
  }, deps.uploadDeps);

  return {
    objectName: stored.objectPath,
    url: deps.urlFor(stored.objectPath),
    driveFileId: stored.fileId,
    sha256: stored.sha256,
    verified: true,
  };
}
