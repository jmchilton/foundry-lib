import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runCitationCli } from '../src/cli.js';

describe('citation CLI', () => {
  it('scans configured files into a validated atomic JSON output', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'audit-citations-cli-'));
    await writeFile(
      path.join(root, 'audit-citations.config.json'),
      JSON.stringify({
        schemaVersion: 1,
        sources: [{ include: ['*.md'], artifactKind: 'note' }],
      }),
      'utf8',
    );
    await writeFile(
      path.join(root, 'paper.md'),
      'Example A. "A cited paper." (2024). https://doi.org/10.1000/example\n',
      'utf8',
    );
    await runCitationCli([
      'scan',
      '--root',
      root,
      '--config',
      'audit-citations.config.json',
      '--output',
      'build/scan.json',
    ]);
    const scan = JSON.parse(await readFile(path.join(root, 'build/scan.json'), 'utf8')) as {
      candidates: unknown[];
      diagnostics: { authorYearPatternCount: number };
    };
    expect(scan.candidates).toHaveLength(1);
    expect(scan.diagnostics.authorYearPatternCount).toBe(0);
    expect(await readdir(path.join(root, 'build'))).toEqual(['scan.json']);
  });

  it('rejects unknown options', async () => {
    await expect(
      runCitationCli([
        'scan',
        '--config',
        'config.json',
        '--output',
        'scan.json',
        '--unknown',
        'x',
      ]),
    ).rejects.toThrow(/unknown option/u);
  });
});
