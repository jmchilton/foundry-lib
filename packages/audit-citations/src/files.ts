import { randomUUID } from 'node:crypto';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function writeJsonAtomic(pathname: string, value: unknown): Promise<void> {
  await writeTextAtomic(pathname, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeTextAtomic(pathname: string, value: string): Promise<void> {
  const directory = path.dirname(pathname);
  await mkdir(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.${path.basename(pathname)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let replaced = false;
  try {
    await writeFile(temporary, value, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, pathname);
    replaced = true;
  } finally {
    if (!replaced) await removeTemporaryFile(temporary);
  }
}

async function removeTemporaryFile(pathname: string): Promise<void> {
  try {
    await unlink(pathname);
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }
}

export function isMissingFile(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
