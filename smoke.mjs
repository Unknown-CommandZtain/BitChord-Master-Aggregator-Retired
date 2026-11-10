import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const pathToWorker=path.join(here,'../src/worker.js');
const source=fs.readFileSync(pathToWorker,'utf8');
assert.match(source,/const PATCH_REVISION = "p11";/);
assert.match(source,/RETIRED_PROVIDER_INDEXES = new Set\(\[0,1,5,6,9\]\)/);
const listing=source.match(/const DISCORD_ADDONS = \[([\s\S]*?)\];/);
assert(listing, 'provider list exists');
assert.equal((listing[1].match(/\bnull\b/g)||[]).length, 13, 'all slots unconfigured');
const urls=[...source.matchAll(/https?:\/\/[^\s"'`<>]+/g)].map(m=>m[0]);
const allowed=['api.cloudflare.com','api.jamendo.com','api.openverse.org','archive.org','commons.wikimedia.org','diagnostics.invalid'];
for (const value of urls) {
  const hostname=value.match(/^https?:\/\/([^/]+)/)?.[1];
  assert(allowed.includes(hostname),`Unapproved URL in source: ${hostname}`);
}
const priorProviderDomains=['soundfean-musics','catalystappsail','deplexo.com','aurix.dpdns.org','geisselgottes.cfd','jucepe0929'];
for(const domain of priorProviderDomains) assert(!source.includes(domain), `Private provider domain in source: ${domain}`);
const {default:worker}=await import(pathToFileURL(pathToWorker));
const manifestResponse=await worker.fetch(new Request('https://example.invalid/manifest.json'),{}, {waitUntil() {}});
assert.equal(manifestResponse.status,200);
const manifest=await manifestResponse.json();
assert.equal(manifest.version,'3.7.17');
assert.deepEqual(manifest.resources,['search','stream']);
console.log('PASS: syntax-independent p11 archive checks, URL allowlist, disabled provider slots and manifest response');
