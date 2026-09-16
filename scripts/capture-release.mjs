/** Capture the current production UI using fictional inputs and real processing. */
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
const {version}=JSON.parse(await readFile('package.json','utf8'));
const out=path.resolve('release-screenshots',version);await mkdir(out,{recursive:true});
const base=process.env.CAPTURE_URL??'http://127.0.0.1:4174/screenshot-stitch/';
const browser=await chromium.launch(),shots=[];
for(const [profile,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
 const page=await browser.newPage({viewport,reducedMotion:'reduce'});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const shot=async name=>{const file=`${profile}-${name}.png`;await page.screenshot({path:path.join(out,file),fullPage:true});shots.push({profile,name,file});};
 await page.goto(base);await page.evaluate(()=>document.fonts.ready);await shot('landing');
 await page.getByRole('button',{name:'Try the demo',exact:true}).click();await page.locator('.review-page').waitFor({timeout:120000});await shot('review');
 await page.getByRole('button',{name:'Back to screenshots',exact:true}).click();await shot('prepare');await page.getByRole('button',{name:'Resume review',exact:true}).click();await page.locator('.review-page').waitFor();
 await page.getByRole('button',{name:'Draw redaction',exact:true}).click();await page.keyboard.press('Enter');await page.locator('.redaction-mask.is-selected').waitFor();await page.getByRole('button',{name:'Precise position & size'}).click();await shot('mask-controls');
 await page.getByRole('button',{name:'Review & export',exact:true}).click();await page.locator('.export-paper').waitFor();await shot('export');
 await page.getByRole('checkbox').check();const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Save clean image',exact:true}).click();await (await downloading).saveAs(path.join(out,`${profile}-example.png`));await shot('saved');
 expect(errors).toEqual([]);await page.close();console.log(profile+' capture complete');
}
await browser.close();
await writeFile(path.join(out,'manifest.json'),JSON.stringify({version,source:'Real production app with synthetic demo inputs; not a detection-accuracy claim',shots},null,2));
await writeFile(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Screenshot Stitch ${version}</title><style>body{margin:0;padding:32px;background:#f3f5f7;color:#182b38;font:15px system-ui}h1{font-size:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}figure{margin:0;background:white;border:1px solid #dce3e8;border-radius:12px;overflow:hidden}figcaption{padding:16px}img{width:100%;height:330px;object-fit:cover;object-position:top}</style><h1>Screenshot Stitch · ${version}</h1><p>Actual desktop and mobile UI. Click a capture to see the full image.</p><main>${shots.map(s=>`<figure><figcaption>${s.profile} / ${s.name}</figcaption><a href="${s.file}"><img loading="lazy" src="${s.file}" alt="${s.profile} ${s.name}"></a></figure>`).join('')}</main></html>`);
console.log(shots.length+' screenshots captured');
