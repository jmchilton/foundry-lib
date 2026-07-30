import fs from 'node:fs';
import path from 'node:path';

export const LICENSE_FILE_EXTENSION = '.LICENSE';

export interface LicenseFile {
  licenseId: string;
  filename: string;
  text: string;
}

export function licenseIdFromFilePath(licenseFilePath: string): string {
  return path.basename(licenseFilePath).replace(/\.LICENSE$/, '');
}

export function loadLicenseFiles(licenseDirectory: string): LicenseFile[] {
  return fs
    .readdirSync(licenseDirectory)
    .filter((filename) => filename.endsWith(LICENSE_FILE_EXTENSION))
    .sort()
    .map((filename) => ({
      licenseId: licenseIdFromFilePath(filename),
      filename,
      text: fs.readFileSync(path.join(licenseDirectory, filename), 'utf8'),
    }));
}

export function findLicenseFileById(
  licenseDirectory: string,
  licenseId: string,
): LicenseFile | undefined {
  return loadLicenseFiles(licenseDirectory).find(
    (licenseFile) => licenseFile.licenseId === licenseId,
  );
}
