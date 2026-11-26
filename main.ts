// Sky Courier: Ember Isles — the hand-in program (Node 22, standard library
// only). It gathers the entry — the game under game/, the screenshots under
// screenshots/ — into the output directory and writes /output/dossier.json,
// the summary the judge reads, with the vendored make.fun library.
//
// Run it outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Run it twice: both runs must write the same bytes.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// Copy a tree the boring way: walk it in sorted order so the copy is
// deterministic, skip nothing, and refuse symlinks (the gate wants plain
// files and directories only).
function copyTree(source, target) {
  mkdirSync(target, { recursive: true });
  const names = readdirSync(source).sort();
  for (const name of names) {
    const from = join(source, name);
    const to = join(target, name);
    const info = statSync(from);
    if (info.isSymbolicLink()) throw new Error(`symlink not allowed in the entry: ${from}`);
    if (info.isDirectory()) copyTree(from, to);
    else cpSync(from, to);
  }
}

mkdirSync(out, { recursive: true });
copyTree(join(here, 'game'), join(out, 'game'));
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  copyTree(join(here, 'screenshots'), join(out, 'screenshots'));
}

// The scorer's own caps (from the kit's gate): only text_max_bytes shapes
// the dossier text; the others refuse an entry the scorer would refuse —
// more than 4 screenshots or one over 256 KiB, more than 993 files in game/
// or 48 MiB of game files in all, or a path under game/ over 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
