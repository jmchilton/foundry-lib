// Turning a Mold's `references:` list into concrete file ops, and performing them.
//
// A ref arrives as authored YAML and leaves as bytes in a bundle plus one provenance entry
// describing how they got there. Which kinds are castable, what each defaults to and how each
// resolves are read from the reference contract's `cast:` blocks rather than decided here.

import { existsSync } from 'node:fs';
import path from 'node:path';

import type { KindTerm } from '@galaxy-foundry/reference-contract';
import { fileSlug, resolveWikiLink, WIKI_LINK_RE } from '@galaxy-foundry/wiki-links';

import { copyVerbatim, listFilesUnder } from '../bundle.js';
import type { CastContract } from '../cast-contract.js';
import { readMarkdown, type Frontmatter } from '../frontmatter.js';
import type { ProvenanceRefEntry } from '../provenance.js';
import { reconcile, reconcileText, sha256File } from '../reconcile.js';
import type { CastHooks } from './hooks.js';
import type { CastKindLayout } from './cast-mold.js';
import type { TargetConfig, TargetKindConfig } from './target-config.js';

/**
 * What resolving a ref needs to know, all of it already loaded.
 *
 * A `CastRequest` satisfies this by construction, so the caster passes itself and these stay
 * callable on their own — which is what lets a test exercise one declaration without staging a
 * bundle around it.
 */
export interface RefResolution {
  repoRoot: string;
  slugMap: ReadonlyMap<string, string>;
  metaByPath: ReadonlyMap<string, Frontmatter>;
  /** How the caller addresses the target — the only thing here that has to name it. */
  targetName: string;
  target: TargetConfig;
  castContract: CastContract;
  refKinds: Record<string, KindTerm>;
  hooks: CastHooks;
  kindLayouts: Readonly<Record<string, CastKindLayout>>;
}

export interface ResolvedRef {
  /**
   * The kind this ref declared, as its contract spells it.
   *
   * A `string` rather than a union, because the set of kinds is exactly what varies by Foundry:
   * one authors `cli-tool` and `schema` refs, a sibling authors neither. A union here would be a
   * compile-time copy of a table read at runtime, and the copy would be this package's — which
   * is the one place that cannot be right about it. Whether a kind is real, and whether it is
   * castable, the contract decides.
   */
  kind: string;
  mode: 'verbatim' | 'sidecar';
  ref: string;
  src: string;
  dst: string;
  used_at: 'cast-time' | 'runtime' | 'both';
  load: 'upfront' | 'on-demand';
  evidence?: string | undefined;
  purpose?: string | undefined;
  trigger?: string | undefined;
  verification?: string | undefined;
  /** Set when src is an npm package export rather than a repo file. */
  package_source?: { spec: string; exportName: string } | undefined;
  /** Bundle-relative dst of the parent note when this ref is a copied companion file. */
  companion_of?: string | undefined;
  /** License of the upstream work this ref draws on, from the source note's frontmatter. */
  license?: string | undefined;
  /** How an authored note relates to the licensed work it cites. Absent for raw payloads. */
  derived?: string | undefined;
  /** Repo-relative LICENSES/ path associated with this ref's licensed lineage. */
  license_file?: string | undefined;
}

function deriveDst(kind: string, src: string, mode: string, kindCfg: TargetKindConfig): string {
  // 1:1 strict slug mapping: a bundled file is named for the note it came from, never for the
  // file it happens to be stored in. Those were the same string while every note was
  // `<slug>.md`, which is why the verbatim branch could get away with the basename — and why
  // it silently produced `references/notes/index.md` the moment a kind became a directory.
  //
  // Non-markdown sources keep their literal basename: a slug plus `dst_extension` would turn
  // `gxformat2.schema.json` into `gxformat2.schema.json.json`.
  if (path.extname(src) !== '.md') {
    return path.posix.join(kindCfg.dst_dir, path.basename(src));
  }
  const slug = fileSlug(src);
  const ext = mode === 'verbatim' ? '.md' : kindCfg.dst_extension;
  return path.posix.join(kindCfg.dst_dir, `${slug}${ext}`);
}

export function resolveMoldRef(
  raw: unknown,
  index: number,
  ctx: RefResolution,
): { resolved?: ResolvedRef; error?: string } {
  const { slugMap, metaByPath, targetName, target, castContract, refKinds } = ctx;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { error: `references[${index}]: not an object` };
  }
  const ref = raw as Record<string, unknown>;
  const kind = typeof ref.kind === 'string' ? ref.kind : '';
  const refStr = typeof ref.ref === 'string' ? ref.ref : '';

  const castDecl = castContract[kind];
  if (!castDecl) {
    // Two different failures, and the distinction is the declaration's: a kind the contract
    // never names is a typo, while a kind it names WITHOUT a `cast:` block is deliberate —
    // authored vocabulary the caster has no support for yet.
    return {
      error: refKinds[kind]
        ? `references[${index}]: kind=${kind} is not castable — reference_contract.yml declares it with no \`cast:\` block (the first Mold to need one defines the contract)`
        : `references[${index}]: unknown kind=${kind}`,
    };
  }
  const kindCfg = target.kinds[kind];
  if (!kindCfg) {
    return { error: `references[${index}]: target=${targetName} does not declare kind=${kind}` };
  }

  const mode = (
    typeof ref.mode === 'string' ? ref.mode : castDecl.default_mode
  ) as ResolvedRef['mode'];
  // The target's list is a CONSTRAINT on the kind's, never a second declaration of it: a
  // target may refuse a mode the kind allows, and can never permit one the kind does not.
  if (!kindCfg.modes.includes(mode)) {
    return {
      error: `references[${index}]: kind=${kind} does not support mode=${mode} (allowed: ${kindCfg.modes.join(', ')})`,
    };
  }

  // Resolve src.
  let src: string;
  let dstOverride: string | undefined;
  let packageSource: { spec: string; exportName: string } | undefined;

  // Every kind addresses its note the same way and expects the note's `type` to be one the kind
  // declares; the strategies differ only in what they take FROM that note.
  //
  // The address check answers to the kind's declared `ref_shape` rather than assuming every
  // castable kind is wiki-link-shaped. They all are today, which is exactly why asserting it
  // in code would sit there being true until the first `path`-shaped kind, and then be wrong.
  //
  // It is deliberately strict. `resolveWikiLink` accepts the bare inner text
  // (`planemo-asserts-idioms`) as readily as `[[planemo-asserts-idioms]]`, so without this
  // precheck a kind could declare `ref_shape: wiki-link` and still take things that are not
  // wiki-links — a declaration that means nothing. All 253 committed refs are bracketed; a bare
  // or space-padded one is refused.
  if (refKinds[kind]?.ref_shape === 'wiki-link' && !WIKI_LINK_RE.test(refStr)) {
    return {
      error: `references[${index}]: ${kind} ref must be a [[wiki-link]] to a ${kind} note (got ${refStr})`,
    };
  }
  const tp = resolveWikiLink(refStr, slugMap);
  if (!tp) return { error: `references[${index}]: ${kind} ref ${refStr} did not resolve` };
  // Frontmatter of the note this ref resolves to; source of its license fields.
  const noteMeta: Frontmatter | undefined = metaByPath.get(tp);
  // Which note types satisfy this kind is the KIND's to declare. It defaults to the kind's own
  // name, so a corpus that names a kind after the notes it cites says nothing; one that cites
  // three publication shapes under a single kind says so once, in its `cast:` block.
  const accepted = castDecl.note_types ?? [kind];
  if (typeof noteMeta?.type !== 'string' || !accepted.includes(noteMeta.type)) {
    return {
      error: `references[${index}]: ${kind} ref ${refStr} resolves to type=${noteMeta?.type ?? '(none)'}, expected ${accepted.join(' | ')}`,
    };
  }

  // The bundled filename is the note's slug, never the storage filename — `fileSlug` is what
  // keeps a directory-shaped kind from landing as `index.md`. `slug_field` overrides it where
  // the note's own slug is the wrong name for a reader of the bundle.
  //
  // A declared `slug_field` the note does not carry is an ERROR, not a fallback to the slug:
  // the declaration's whole content is "the note's own slug is the wrong name here", so
  // quietly using it anyway would rename every file of the kind on a typo'd field name and
  // look like a successful cast.
  let slug = fileSlug(tp);
  if (castDecl.slug_field) {
    const declaredSlug = noteMeta[castDecl.slug_field];
    if (typeof declaredSlug !== 'string' || !declaredSlug) {
      return {
        error: `references[${index}]: ${kind} ref ${refStr} resolves to a note with no \`${castDecl.slug_field}\`, which its kind declares as slug_field`,
      };
    }
    slug = declaredSlug;
  }
  const namedDst = path.posix.join(kindCfg.dst_dir, `${slug}${kindCfg.dst_extension}`);

  switch (castDecl.resolve) {
    case 'package-export': {
      // The note declares `package` + `package_export`; cast imports the runtime export,
      // JSON.stringifies it, and writes that to the bundle. There is no file to copy.
      const pkg = typeof noteMeta.package === 'string' ? noteMeta.package : null;
      const exp = typeof noteMeta.package_export === 'string' ? noteMeta.package_export : null;
      if (!pkg || !exp) {
        return {
          error: `references[${index}]: ${kind} ref ${refStr} resolves to a note missing 'package' and/or 'package_export' frontmatter`,
        };
      }
      src = `package://${pkg}#${exp}`;
      dstOverride = namedDst;
      packageSource = { spec: pkg, exportName: exp };
      break;
    }
    case 'payload-companion': {
      // What casting packages is the payload beside the note, never the wrapper. Which file that
      // is, the note's own Kind already declares: the strategy means "one companion IS the
      // bundled material", and `disposition: bundled` is how a layout spells exactly that.
      //
      // Read from the layout rather than asked of the instance, because the layout is already
      // here — it is what expands companions on every other kind — and an instance answering
      // separately would be answering from the same declaration, with the freedom to disagree.
      const layout = ctx.kindLayouts[noteMeta.type];
      if (!layout) {
        return {
          error: `references[${index}]: ${kind} ref ${refStr} resolves to type=${noteMeta.type}, but the caster received no Kind layout for it`,
        };
      }
      const bundled = layout.companions.filter((companion) => companion.disposition === 'bundled');
      // Not a fallback to the note: the declaration's whole content is "the note is the wrapper,
      // not the payload", so casting the wrapper would package the wrong file and look like it
      // worked. Reported against the ref that asked, because a broken declaration otherwise
      // names no reference.
      if (bundled.length !== 1) {
        return {
          error: `references[${index}]: ${kind} resolves via payload-companion, and type=${noteMeta.type} declares ${bundled.length} bundled companions — the strategy packages exactly one`,
        };
      }
      const payload = bundled[0]!.file;
      if (payload.endsWith('/')) {
        return {
          error: `references[${index}]: ${kind} resolves via payload-companion, and type=${noteMeta.type} declares its bundled companion as the directory ${payload} — a payload is one file`,
        };
      }
      src = path.posix.join(path.posix.dirname(tp), payload);
      dstOverride = namedDst;
      break;
    }
    case 'note': {
      src = tp;
      // Only a kind that renames its output needs the explicit dst; the rest go through
      // `deriveDst`, which is also the path a non-markdown source has to take.
      if (castDecl.slug_field) dstOverride = namedDst;
      break;
    }
  }

  const dst = dstOverride ?? deriveDst(kind, src, mode, kindCfg);

  const used_at = (
    typeof ref.used_at === 'string' ? ref.used_at : 'runtime'
  ) as ResolvedRef['used_at'];
  const load = (typeof ref.load === 'string' ? ref.load : 'on-demand') as ResolvedRef['load'];

  return {
    resolved: {
      kind: kind as ResolvedRef['kind'],
      mode,
      ref: refStr,
      src,
      dst,
      used_at,
      load,
      evidence: typeof ref.evidence === 'string' ? ref.evidence : undefined,
      purpose: typeof ref.purpose === 'string' ? ref.purpose : undefined,
      trigger: typeof ref.trigger === 'string' ? ref.trigger : undefined,
      verification: typeof ref.verification === 'string' ? ref.verification : undefined,
      package_source: packageSource,
      license: typeof noteMeta?.license === 'string' ? noteMeta.license : undefined,
      // `derived` describes authored prose. A package export or payload companion is upstream
      // bytes rather than the note that describes them, so absence deliberately keeps those
      // refs on the policy's pass-through path.
      derived:
        castDecl.resolve === 'note' && typeof noteMeta?.derived === 'string'
          ? noteMeta.derived
          : undefined,
      license_file: typeof noteMeta?.license_file === 'string' ? noteMeta.license_file : undefined,
    },
  };
}

// Expand a note Kind's `bundled` companions into sibling refs. Fixed membership and disposition
// are Kind-owned; only a Kind that explicitly allows additional companions may take extra names
// from a note's frontmatter. Companions ship verbatim whatever the parent ref's mode — a note
// points at its structured sibling either way. They inherit the parent ref's loading metadata and
// carry `companion_of` for provenance.
export interface CompanionExpansion {
  refs: ResolvedRef[];
  errors: string[];
}

export function expandCompanions(resolved: ResolvedRef[], ctx: RefResolution): CompanionExpansion {
  const { repoRoot, metaByPath, target, castContract, kindLayouts } = ctx;
  const out: ResolvedRef[] = [];
  const errors: string[] = [];
  for (const r of resolved) {
    out.push(r);
    // These strategies already chose bytes other than the note. A payload-companion is itself
    // the Kind-selected companion; a package export has no note directory in the bundle at all.
    if (castContract[r.kind]?.resolve !== 'note') continue;
    const noteMeta = metaByPath.get(r.src);
    const noteType = typeof noteMeta?.type === 'string' ? noteMeta.type : undefined;
    const layout = noteType === undefined ? undefined : kindLayouts[noteType];
    if (!layout) {
      errors.push(
        `${r.ref} resolves to type=${noteType ?? '(none)'}, but the caster received no Kind layout for it`,
      );
      continue;
    }
    if (layout.shape !== 'directory') {
      if (layout.companions.length > 0) {
        errors.push(
          `${r.ref} resolves to file-shaped type=${noteType}, which cannot declare companions`,
        );
      }
      continue;
    }
    const kindCfg = target.kinds[r.kind];
    if (!kindCfg) continue;
    const srcDir = path.posix.dirname(r.src);

    const declared = layout.companions
      .filter((companion) => companion.disposition === 'bundled')
      .map((companion) => ({ file: companion.file, requirement: companion.requirement }));
    const fixedNames = new Set(layout.companions.map((companion) => companion.file));
    const rawAdditional = noteMeta?.companions;
    const additional =
      layout.additionalCompanions === 'allow' && Array.isArray(rawAdditional)
        ? rawAdditional
            .filter((file): file is string => typeof file === 'string')
            // A note cannot turn a fixed foundry-only or cast-input declaration into bundled
            // material by naming it again as an additional companion. The Kind's disposition
            // remains authoritative wherever it has an answer.
            .filter((file) => !fixedNames.has(file))
            .map((file) => ({ file, requirement: 'required' as const }))
        : [];

    for (const companion of [...declared, ...additional]) {
      const c = companion.file;
      const src = path.posix.join(srcDir, c);
      const present = existsSync(path.join(repoRoot, src));
      if (companion.requirement !== 'required' && !present) continue;

      // A directory is a companion declaration, while provenance remains one entry per file.
      // Expand its files here so hashing, collision detection and orphan sweeping keep operating
      // on the same identity: one destination path, one record.
      const isDirectory = c.endsWith('/');
      const sources = isDirectory
        ? present
          ? listFilesUnder(path.join(repoRoot, src), repoRoot)
          : []
        : [src];
      // A missing FILE still travels, and `castOneRef` reports its absence against the
      // destination it would have taken. A directory has no such ref to report against: the
      // path is not a file, so carrying it would claim a bundle destination nothing can occupy
      // — a claim the duplicate check and the orphan sweep both read as real.
      if (isDirectory && sources.length === 0) {
        if (companion.requirement === 'required') {
          errors.push(
            present
              ? `${r.ref} declares ${c} required, and ${src} holds no file to carry`
              : `${r.ref} declares ${c} required, and there is no ${src}`,
          );
        }
        continue;
      }
      for (const companionSrc of sources) {
        const rel = path.posix.relative(srcDir, companionSrc);
        out.push({
          kind: r.kind,
          mode: 'verbatim',
          ref: r.ref,
          src: companionSrc,
          dst: path.posix.join(kindCfg.dst_dir, rel),
          used_at: r.used_at,
          load: r.load,
          evidence: r.evidence,
          purpose: r.purpose,
          trigger: r.trigger,
          companion_of: r.dst,
          license: r.license,
          license_file: r.license_file,
        });
      }
    }
  }
  return { refs: out, errors };
}

/**
 * Destinations more than one ref claims, one message each.
 *
 * A bundle path is a ref's identity everywhere downstream: the orphan sweep asks what claims a
 * path, provenance is keyed by it, and SKILL.md names it. Two refs on one path therefore look
 * like one everywhere the answer matters — the second write silently replaces the first, the
 * sweep sees a claimed path and keeps it, and the record carries two entries with different
 * `src_hash` for a file that can only have one. Nothing else in a cast is positioned to notice.
 *
 * The reachable case is companions: their destination is the kind's directory plus the
 * companion's own filename, so two notes of one kind that each ship a `table.csv` collide.
 */
export function duplicateDestinations(refs: readonly ResolvedRef[]): string[] {
  const byDst = new Map<string, ResolvedRef[]>();
  for (const ref of refs) {
    const claimants = byDst.get(ref.dst);
    if (claimants) claimants.push(ref);
    else byDst.set(ref.dst, [ref]);
  }
  return [...byDst.entries()]
    .filter(([, claimants]) => claimants.length > 1)
    .map(([dst, claimants]) => {
      const sources = claimants.map((c) => c.src || c.ref).join(', ');
      return `${dst} is claimed by ${claimants.length} refs (${sources}) — a bundle path names one file, so the later write would replace the earlier and both would be recorded`;
    });
}

/**
 * Place one ref's bytes and report what it took.
 *
 * There is no check mode in here. Assembly always writes, because it writes into a staged copy
 * of the bundle that a `--check` run simply never publishes — check-ness is one decision, made
 * once, after every ref has had its say. That is also why `dst_hash` is the expected hash rather
 * than `recordedHash`'s answer: the staged file was brought into line by definition, so the two
 * cases that function distinguishes cannot both arise here.
 */
export async function castOneRef(
  resolved: ResolvedRef,
  repoRoot: string,
  bundleRoot: string,
  hooks: Pick<CastHooks, 'renderers' | 'packageLoader'>,
): Promise<{ entry: ProvenanceRefEntry; drift?: string | undefined; error?: string | undefined }> {
  const renderers = hooks.renderers;
  const dstAbs = path.join(bundleRoot, resolved.dst);

  // Package-vendored payload: import the named export, JSON.stringify, write verbatim.
  // No file `src` exists; src_hash and dst_hash are both the hash of the synthesized JSON.
  //
  // Which KINDS arrive here is the contract's to say — `package-export` is declared per kind,
  // and what a kind is called is exactly what varies between Foundries. Only the mode is
  // checked, because that is a fact about these bytes rather than about one instance's
  // vocabulary: the value IS the file, so there is no source for a renderer to transform.
  if (resolved.package_source) {
    if (resolved.mode !== 'verbatim') {
      return {
        entry: { ...skeleton(resolved), src_hash: null, dst_hash: null, source: 'deterministic' },
        error: `${resolved.ref} resolves via package-export, which synthesizes its own bytes and so must be mode=verbatim (got ${resolved.mode})`,
      };
    }
    // Imported by the INSTANCE, not here. A bare `import(spec)` resolves relative to the file
    // running it, so this module would look for an instance's dependencies beside its own
    // installed copy and find nothing. Nothing registered is an error rather than a fallback:
    // the bytes exist only inside a package this one cannot reach.
    if (!hooks.packageLoader) {
      return {
        entry: { ...skeleton(resolved), src_hash: null, dst_hash: null, source: 'deterministic' },
        error: `${resolved.ref} resolves via package-export, but nothing registers a packageLoader hook — the contract declares this strategy and this Foundry does not implement it`,
      };
    }
    let json: string;
    try {
      const mod = await hooks.packageLoader(resolved.package_source.spec);
      const exported = mod[resolved.package_source.exportName];
      if (exported === undefined) {
        return {
          entry: { ...skeleton(resolved), src_hash: null, dst_hash: null, source: 'deterministic' },
          error: `package ${resolved.package_source.spec} has no export '${resolved.package_source.exportName}'`,
        };
      }
      const stringified = JSON.stringify(exported, null, 2);
      if (stringified === undefined) {
        return {
          entry: { ...skeleton(resolved), src_hash: null, dst_hash: null, source: 'deterministic' },
          error: `package ${resolved.package_source.spec} export '${resolved.package_source.exportName}' is not JSON-serializable (typeof=${typeof exported}). The export must be a plain JSON Schema object; an Effect schema function needs upstream to publish a JSON-converted sibling.`,
        };
      }
      json = stringified + '\n';
    } catch (e) {
      return {
        entry: { ...skeleton(resolved), src_hash: null, dst_hash: null, source: 'deterministic' },
        error: `failed to import ${resolved.package_source.spec}: ${(e as Error).message}`,
      };
    }
    const drift = reconcileText({
      path: dstAbs,
      expected: json,
      label: 'package schema',
      check: false,
    });
    return {
      entry: {
        ...skeleton(resolved),
        src_hash: drift.expectedHash,
        dst_hash: drift.expectedHash,
        source: 'deterministic',
      },
      drift: drift.reason,
    };
  }

  const srcAbs = path.join(repoRoot, resolved.src);
  if (!existsSync(srcAbs)) {
    return {
      entry: { ...skeleton(resolved), src_hash: null, dst_hash: null, source: 'deterministic' },
      error: `ref source missing: ${resolved.src}`,
    };
  }
  const srcHash = sha256File(srcAbs);

  if (resolved.mode === 'verbatim') {
    // The one ref that is a COPY rather than a render: compared against the source's own hash,
    // and written with `copyFileSync`, so the expected bytes are never a string in hand.
    const drift = reconcile({
      path: dstAbs,
      expectedHash: srcHash,
      label: 'dst',
      check: false,
      write: () => copyVerbatim(srcAbs, dstAbs),
    });
    return {
      entry: {
        ...skeleton(resolved),
        src_hash: srcHash,
        dst_hash: drift.expectedHash,
        source: 'deterministic',
      },
      drift: drift.reason,
    };
  }

  // Dispatched on the mode alone. Which kinds may take a given mode is already declared — the
  // target's `kinds.<kind>.modes` gates it above — so naming the kind again here would be a
  // second gate that could only ever disagree with the first.
  //
  // Which RENDERER a mode selects is a separate question, and the instance answers it. The mode
  // is shared vocabulary; the bytes it produces are not.
  const renderer = renderers[resolved.mode];
  if (renderer) {
    const parsed = readMarkdown(srcAbs);
    const text = await renderer({ srcAbs, srcRel: resolved.src, meta: parsed.meta });
    const drift = reconcileText({
      path: dstAbs,
      expected: text,
      label: resolved.mode,
      check: false,
    });
    return {
      entry: {
        ...skeleton(resolved),
        src_hash: srcHash,
        dst_hash: drift.expectedHash,
        source: 'deterministic',
      },
      drift: drift.reason,
    };
  }

  // Unreachable from this instance, and kept anyway. Our `modes` vocabulary is narrowed to
  // exactly the modes we implement, so an unimplemented one is refused when the contract loads.
  // That is a fact about this instance's vocabulary, not a guarantee of the caster: widen the
  // vocabulary without registering a renderer and this is the failure. Says which of the two
  // disagreed, because "kind does not support mode" is a Mold to fix and this is a hook to write.
  return {
    entry: { ...skeleton(resolved), src_hash: srcHash, dst_hash: null, source: 'deterministic' },
    error: `no renderer for mode=${resolved.mode} (kind=${resolved.kind}) — the target admits this mode but nothing implements it`,
  };
}

function skeleton(r: ResolvedRef): Omit<ProvenanceRefEntry, 'src_hash' | 'dst_hash' | 'source'> {
  return {
    kind: r.kind,
    mode: r.mode,
    ref: r.ref,
    src: r.src,
    dst: r.dst,
    used_at: r.used_at,
    load: r.load,
    evidence: r.evidence,
    purpose: r.purpose,
    trigger: r.trigger,
    verification: r.verification,
    companion_of: r.companion_of,
    license: r.license,
    derived: r.derived,
    license_file: r.license_file,
  };
}
