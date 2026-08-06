import fs from 'node:fs';
import path from 'node:path';

export const LICENSE_FILE_EXTENSION = '.LICENSE';

/**
 * The id of a vendored copy in `LICENSES/`: the filename without its extension.
 *
 * **Not a {@link LicenseId}.** The values are `msmb` and `nf-schema` — they name the SOURCE whose
 * licence text was vendored, never the licence. Two sources under CC-BY-4.0 vendor two files and
 * get two of these; a note under MIT that vendors nothing has none at all.
 *
 * This type exists because both ids were once called `licenseId`, including on the same line, and
 * the pair reads as interchangeable right up until something compares them. Nothing enforces the
 * distinction at runtime — both are strings out of a filesystem — so the names carry it.
 */
export type LicenseFileId = string;

/** A vendored licence copy: its id, the file it came from, and the text itself. */
export interface LicenseFile {
  /** See {@link LicenseFileId} — the filename's stem, not an SPDX id. */
  id: LicenseFileId;
  filename: string;
  text: string;
}

/**
 * The {@link LicenseFileId} a `license_file` path points at.
 *
 * Takes a path because that is what a note declares (`LICENSES/msmb.LICENSE`), and a bare stem
 * passes through unchanged so a caller holding an id already need not know which it has.
 */
export function licenseFileIdFromPath(licenseFilePath: string): LicenseFileId {
  return path.basename(licenseFilePath).replace(/\.LICENSE$/, '');
}

/**
 * Whether a note's `license_file` is a use of this vendored copy.
 *
 * Named because this is the comparison the old spelling made unreadable. Both instances wrote it
 * as `licenseIdFromFilePath(note.license_file) === license.licenseId` — a file stem against a file
 * stem, in an expression that scanned as a licence check. A note under CC-BY-4.0 whose source
 * vendored its own copy does not match another source's copy of the same licence, which is correct
 * and is not what that line looked like.
 *
 * Absent `license_file` is `false`: the note redistributes no text, so it uses no copy. That is
 * the state of 49 of one instance's 111 licensed notes.
 */
export function redistributesUnder(
  licenseFilePath: string | undefined | null,
  licenseFileId: LicenseFileId,
): boolean {
  if (typeof licenseFilePath !== 'string' || licenseFilePath.length === 0) return false;
  return licenseFileIdFromPath(licenseFilePath) === licenseFileId;
}

export function loadLicenseFiles(licenseDirectory: string): LicenseFile[] {
  return fs
    .readdirSync(licenseDirectory)
    .filter((filename) => filename.endsWith(LICENSE_FILE_EXTENSION))
    .sort()
    .map((filename) => ({
      id: licenseFileIdFromPath(filename),
      filename,
      text: fs.readFileSync(path.join(licenseDirectory, filename), 'utf8'),
    }));
}

export function findLicenseFileById(
  licenseDirectory: string,
  licenseFileId: LicenseFileId,
): LicenseFile | undefined {
  return loadLicenseFiles(licenseDirectory).find((licenseFile) => licenseFile.id === licenseFileId);
}
