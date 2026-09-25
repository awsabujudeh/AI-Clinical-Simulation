import {prepareApprovedExpoCase} from '../content/cases/shared-catalogue/approved-expo-cases.ts';
import {PORTABLE_SHA256_ADAPTER} from '../tests/fixtures/portable-sha256.ts';
import {createApiTestHarness,apiHeaders,startBody} from '../tests/fixtures/api/secure-api.ts';
import {z} from 'zod';
export const ExpoBeginSchema=z.strictObject({entry_id:z.enum(['patient-01','patient-02']),mode:z.enum(['PRACTICE_DEMO','ASSESSMENT'])});
// Trusted local synthetic composition only. No credentials or provider gateway.
export async function createExpoEntry(namespace:string,now:()=>string){
 const entries=await Promise.all((['khalid','dana'] as const).map(async(patient,index)=>{
  const artifact=await prepareApprovedExpoCase(patient,PORTABLE_SHA256_ADAPTER);
  const h=await createApiTestHarness({review_artifact:artifact,hash_adapter:PORTABLE_SHA256_ADAPTER,trusted_time_utc:now});
  return {id:`patient-0${index+1}`,patient,artifact,h};
 }));
 const sessions=new Map<string,typeof entries[number]>();let serial=0;
 const starts=new Map<string,{body:string;result:Promise<{status:number;body:unknown}>}>();
 return {
  cards:entries.map(e=>({entry_id:e.id,name:e.patient==='khalid'?'Khalid':'Dana',demographics:e.patient==='khalid'?'58-year-old male':'Adult female',setting:'Emergency Department',complaint:e.patient==='khalid'?'Acute chest pain, dizziness and hypotension':'Sudden rash, itching, dizziness and breathing difficulty',role:'Learner responsible for initial assessment and management'})),
  async begin(body:unknown,key:string){
   const p=ExpoBeginSchema.safeParse(body);if(!p.success)return {status:400,body:{}};
   const fingerprint=JSON.stringify(p.data),prior=starts.get(key);if(prior)return prior.body===fingerprint?prior.result:{status:409,body:{}};
   if(starts.size>=64)return {status:429,body:{}};
   const entry=entries.find(e=>e.id===p.data.entry_id)!;
   const result=(async()=>{const r=await entry.h.app.request('/v1/review-sessions',{method:'POST',headers:apiHeaders({token:'faculty',idempotency:`idempotency.expo.${namespace}.${++serial}`}),body:JSON.stringify(startBody(entry.artifact.source_case.manifest.case_id,{mode:p.data.mode,patient_language:'ar-JO'}))});const data=await r.json();if(r.status===201)sessions.set(data.data.session.session_id,entry);return {status:r.status,body:data};})();
   starts.set(key,{body:fingerprint,result});return result;
  },
  async request(path:string,method:string,body:string|undefined,key:string){
   const id=/^\/v1\/sessions\/([^/]+)\//.exec(path)?.[1],entry=id?sessions.get(id):undefined;
   if(!entry)return new Response('{}',{status:404});
   return entry.h.app.request(path,{method,headers:apiHeaders({token:'faculty',idempotency:key}),...(body?{body}:{})});
  }
 };
}
