import {test,expect} from '@playwright/test';
test('actual local audio START/END composes Dana mouth with anxiety/breathing without reloading (not live provider proof)',async({page},info)=>{
 let loads=0;page.on('request',r=>{if(r.url().endsWith('.glb'))loads++;});
 const file=decodeURIComponent(new URL('./runtime-harness.html',import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
 await page.goto(`/@fs/${file}`);
 await expect.poll(()=>page.evaluate(()=>window.__DANA_CONTRACT__.ready)).toBe(true);
 const stats=()=>page.evaluate(()=>window.__DANA_CONTRACT__.runtime.stats());
 const before=await stats();await page.getByRole('button',{name:'Play synthetic lifecycle fixture'}).click();
 await expect.poll(async()=>(await stats()).state.speaking).toBe(true);
 await expect.poll(async()=>(await stats()).exam?.articulation??0).toBeGreaterThan(.15);
 expect((await stats()).state.face).toBe('anxious');expect((await stats()).exam?.face?.anxious).toBeGreaterThan(.95);
 await expect.poll(async()=>(await stats()).breathing).not.toBe(before.breathing);
 await page.screenshot({path:info.outputPath('dana-synthetic-playback-speaking.png')});
 await expect.poll(()=>page.evaluate(()=>window.__DANA_CONTRACT__.events)).toContain('END');
 await expect.poll(async()=>(await stats()).exam?.articulation).toBe(0);
 const after=await stats();expect(after.state.speaking).toBe(false);expect(after.state.body).toBe('itch_body');expect(after.state.face).toBe('anxious');
 expect(after.modelUUID).toBe(before.modelUUID);expect(after.entryCount).toBe(before.entryCount);expect(after.elapsed).toBeGreaterThan(before.elapsed);expect(loads).toBe(1);
});
