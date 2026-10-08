// Hash the exact scripts in final static HTML. Run after Astro has finished.
// Admin is a separate third-party CMS document and is deliberately untouched.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export const scriptHashes = html => [...new Set([...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
  .filter(([, attrs]) => !/\bsrc\s*=/i.test(attrs))
  .map(([, , body]) => `'sha256-${createHash('sha256').update(body.replace(/\r\n?/g, '\n')).digest('base64')}'`))];
export function hardenHtml(html) {
  const meta = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"\s*\/?\s*>/i;
  if (!meta.test(html)) return null;
  const hashes = scriptHashes(html);
  if (!hashes.length) throw new Error('Expected generated inline scripts');
  return html.replace(meta, (_, policy) => {
    if (!/script-src\s/.test(policy)) throw new Error('Missing script policy');
    policy = policy.replace(/script-src\s+[^;]+/, `script-src 'self' ${hashes.join(' ')}`);
    // frame-ancestors is not enforced in meta; enforce it at the edge if added.
    policy = policy.replace(/;\s*frame-ancestors\s+[^;]+/, '');
    return `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  });
}
async function run(dir) {
  let count = 0;
  for (const item of await readdir(dir, {withFileTypes:true})) {
    const path = join(dir,item.name);
    if (item.isDirectory()) { if(item.name !== 'admin') count += await run(path); }
    else if(item.name.endsWith('.html')) {
      const original = await readFile(path,'utf8');
      const hardened = hardenHtml(original);
      if (hardened !== null) { await writeFile(path,hardened); count++; }
    }
  }
  return count;
}
if (process.argv[1]?.endsWith('harden-build.mjs')) {
  const count = await run('dist');
  if (!count) throw new Error('No marketing pages received CSP hashes');
  console.log(`Hash-based script policy applied to ${count} pages.`);
}
