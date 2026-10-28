// Packs the appify command (studio/) and the skill (skills/appify/) and
// attaches them to the GitHub release for studio/package.json's version,
// creating the release if it doesn't exist yet. The setup prompt installs from
// releases/latest/download/appify.tgz and skill.tgz.
// Usage: npm run release (needs gh, logged in, and the commit pushed).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, renameSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = mkdtempSync(path.join(os.tmpdir(), 'appify-release-'));
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', ...opts });

const { version } = JSON.parse(readFileSync(path.join(root, 'studio/package.json'), 'utf8'));
const [{ filename }] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', out], { cwd: path.join(root, 'studio') }));
renameSync(path.join(out, filename), path.join(out, 'appify.tgz'));
run('tar', ['-czf', path.join(out, 'skill.tgz'), '-C', path.join(root, 'skills'), 'appify']);

const tag = `v${version}`;
const files = [path.join(out, 'appify.tgz'), path.join(out, 'skill.tgz')];
let exists = true;
try {
  run('gh', ['release', 'view', tag], { stdio: 'ignore' });
} catch {
  exists = false;
}
if (exists) run('gh', ['release', 'upload', tag, ...files, '--clobber'], { stdio: 'inherit' });
else {
  run('gh', ['release', 'create', tag, ...files, '--title', `appify ${tag}`, '--notes', 'The appify command (appify.tgz) and the skill (skill.tgz). Install steps are in the README.'], {
    stdio: 'inherit',
  });
}
console.log(`${exists ? 'Updated' : 'Created'} release ${tag} with appify.tgz and skill.tgz`);
