import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
function verify(dir) {
 for(const e of readdirSync(dir,{withFileTypes:true})) {
  const p=join(dir,e.name);
  if(e.isDirectory()){if(e.name!=='admin')verify(p);continue;}
  if(!p.endsWith('.html'))continue;
  const html=readFileSync(p,'utf8');
  const policy=html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/i)?.[1];
  if(!policy)throw Error(`Missing CSP: ${p}`);
  const scripts=policy.split(';').find(x=>x.trim().startsWith('script-src '));
  if(!scripts || scripts.includes('unsafe-inline') || scripts.includes('unsafe-eval'))throw Error(`Unsafe script policy: ${p}`);
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
   if(/\bsrc\s*=/i.test(match[1]))continue;
   const hash=createHash('sha256').update(match[2].replace(/\r\n?/g,'\n')).digest('base64');
   if(!scripts.includes(`'sha256-${hash}'`))throw Error(`Script missing hash: ${p}`);
  }
 }
}
verify('dist');
console.log('All marketing pages have matching script hashes and no unsafe-inline script permission.');
