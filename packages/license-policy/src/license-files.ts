// The verbatim license texts a `license_file: true` row obliges an instance to carry.
//
// The table says a copy must accompany the carry; this reads the copies. Both Foundry
// instances had byte-identical readers for it, one of them carrying a comment admitting it
// was cribbed from the other.
//
// The directory is a parameter, not `../LICENSES` resolved against cwd, because the callers
// are Astro pages whose cwd is the site subdirectory — an implicit relative path is the one
// thing that does not survive being shared.

import fs from 'node:fs';
import path from 'node:path';

/** The conventional extension for a verbatim license copy. */
export const LICENSE_FILE_EXT = '.LICENSE';

export interface LicenseFile {
  /** Route key, e.g. `nf-schema` for `nf-schema.LICENSE`. */
  id: string;
  /** Filename as referenced in note frontmatter, e.g. `nf-schema.LICENSE`. */
  filename: string;
  /** Raw license text. */
  text: string;
}

/** `LICENSES/nf-schema.LICENSE` (or `nf-schema.LICENSE`) -> `nf-schema`. */
export function licenseIdFromFile(licenseFile: string): string {
  return path.basename(licenseFile).replace(/\.LICENSE$/, '');
}

/** Every `*.LICENSE` in `dir`, id-sorted. Throws if the directory is missing. */
export function loadLicenseFiles(dir: string): LicenseFile[] {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(LICENSE_FILE_EXT))
    .sort()
    .map((filename) => ({
      id: licenseIdFromFile(filename),
      filename,
      text: fs.readFileSync(path.join(dir, filename), 'utf8'),
    }));
}

/** One license text by id, or `undefined` when nothing carries that id. */
export function findLicenseFile(dir: string, id: string): LicenseFile | undefined {
  return loadLicenseFiles(dir).find((license) => license.id === id);
}
