import {wp1Fixture} from "../fixtures/wp1.ts";
Deno.test('WP3 portable examination commit, replay and case isolation',async()=>{
 for(const patient of ['khalid','dana'] as const){const f=await wp1Fixture(patient,'wp2-approved');
  if((await f.state()).examinations?.receipts.length!==0)throw Error('early disclosure');
  const r=await f.action('examination.expo.auscultation');if(r.response.status!==200)throw Error('commit');
  if((await r.retry()).status!==200)throw Error('replay');
  const s=await f.state(),t=JSON.stringify(s.examinations?.receipts);
  if(s.clinical_time!==30||s.examinations?.receipts.length!==1||!t.includes(patient==='dana'?'bilateral wheeze':'Lungs are clear'))throw Error('receipt');
 }
});
