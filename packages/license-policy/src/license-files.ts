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

/**
 * One note's (or one book's) `license_file`, as the thing that declared it.
 *
 * `licenseFile` is the value exactly as authored, including its directory — the audit checks that
 * directory, so normalizing it to an id before calling here would discard what it came to look at.
 * Absent, null, and empty all mean the same thing and are skipped: a note that redistributes no
 * text vendors no copy and is not a finding.
 */
export interface LicenseFileDeclaration {
  /** Where the declaration lives, quoted back in the finding. A note path, a `book.yml`, an id. */
  source: string;
  /** The `license_file` value as authored, e.g. `LICENSES/CC-BY-4.0.LICENSE`. */
  licenseFile?: string | null;
}

/**
 * What an audit can find wrong.
 *
 * - `missing-copy` — a declaration names a copy the directory does not hold. The obligation the
 *   field exists to record is unmet, and nothing else notices: the field is a string, so a typo
 *   satisfies every schema.
 * - `unexpected-path` — the copy exists, but the declared path does not point into the licence
 *   directory. `LICENSE/x.LICENSE` and a bare `x.LICENSE` both resolve by basename and both send a
 *   reader somewhere there is no file.
 * - `unused-copy` — a vendored copy nothing declares. Checked because the reverse direction is
 *   where a licence directory rots: text stays behind after the note that carried it was rewritten
 *   to own words, and the directory slowly stops describing what is redistributed.
 * - `empty-copy` — a copy present but blank. An empty file satisfies existence and grants nothing.
 */
export type LicenseFileFindingCode =
  'missing-copy' | 'unexpected-path' | 'unused-copy' | 'empty-copy';

export interface LicenseFileFinding {
  code: LicenseFileFindingCode;
  /** See {@link LicenseFileId} — the copy at issue, by file stem. */
  licenseFileId: LicenseFileId;
  /** The declaration that produced it, absent on findings about a file nothing declared. */
  source?: string;
  message: string;
}

export interface LicenseFileAuditOptions {
  /** The directory holding the vendored copies. Missing is audited, not thrown — see below. */
  licenseDirectory: string;
  declarations: readonly LicenseFileDeclaration[];
  /**
   * The directory name a declared path must sit in, matched against its last path segment so that
   * `LICENSES/x.LICENSE` and `content/LICENSES/x.LICENSE` both pass.
   *
   * Defaults to the licence directory's own name, which is what both instances want and spares
   * them from opting in to a check they would rather not have had to remember. Pass `null` to skip
   * it — appropriate when declarations carry a bare id rather than a path.
   */
  directoryName?: string | null;
}

/**
 * Both directions of the vendored-licence contract, as findings.
 *
 * The forward direction is the obligation: a note claiming verbatim carry names a licence copy, and
 * that copy has to be there. A schema can require the field and cannot open the file, so until
 * something walks the directory the strongest statement available is that a string was present.
 *
 * The reverse direction is the one that keeps the directory honest, and it is the same argument the
 * tag registries already make: a vocabulary checked in one direction accumulates. Returns findings
 * rather than throwing, so an instance decides whether an unused copy fails its build or merely
 * reports.
 */
export function auditLicenseFiles(options: LicenseFileAuditOptions): LicenseFileFinding[] {
  const { licenseDirectory, declarations } = options;
  const directoryName =
    options.directoryName === undefined ? path.basename(licenseDirectory) : options.directoryName;

  // A missing directory is the state an instance is in the moment before it vendors its first
  // copy, and reporting every declaration as unmet says more than ENOENT does. Anything else —
  // a permission error, a file where the directory should be — still throws.
  let licenseFiles: LicenseFile[];
  try {
    licenseFiles = loadLicenseFiles(licenseDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
    licenseFiles = [];
  }

  const present = new Set(licenseFiles.map((licenseFile) => licenseFile.id));
  const declared = new Set<LicenseFileId>();
  const findings: LicenseFileFinding[] = [];

  for (const declaration of declarations) {
    const declaredPath = declaration.licenseFile;
    if (typeof declaredPath !== 'string' || declaredPath.length === 0) continue;

    const licenseFileId = licenseFileIdFromPath(declaredPath);
    declared.add(licenseFileId);

    if (!present.has(licenseFileId)) {
      findings.push({
        code: 'missing-copy',
        licenseFileId,
        source: declaration.source,
        message: `${declaration.source} declares license_file ${declaredPath}, which ${licenseDirectory} does not hold`,
      });
      continue;
    }

    if (directoryName !== null && path.basename(path.dirname(declaredPath)) !== directoryName) {
      findings.push({
        code: 'unexpected-path',
        licenseFileId,
        source: declaration.source,
        message: `${declaration.source} declares license_file ${declaredPath}, which does not point into ${directoryName}/`,
      });
    }
  }

  for (const licenseFile of licenseFiles) {
    if (!declared.has(licenseFile.id))
      findings.push({
        code: 'unused-copy',
        licenseFileId: licenseFile.id,
        message: `${licenseFile.filename} is vendored but no declaration carries under it`,
      });

    if (licenseFile.text.trim().length === 0)
      findings.push({
        code: 'empty-copy',
        licenseFileId: licenseFile.id,
        message: `${licenseFile.filename} is empty, so it grants nothing`,
      });
  }

  return findings.sort(
    (a, b) =>
      a.code.localeCompare(b.code) ||
      a.licenseFileId.localeCompare(b.licenseFileId) ||
      (a.source ?? '').localeCompare(b.source ?? ''),
  );
}
