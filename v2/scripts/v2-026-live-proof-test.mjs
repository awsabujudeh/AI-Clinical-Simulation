import assert from 'node:assert/strict';
import {test} from 'node:test';
import {prepareDanaLiveProof,createDanaQuestionAdmission,DANA_PROOF_QUESTION} from '../runtime/v2-026-live-proof.mjs';
// Entirely synthetic, injected configuration. Never reads process.env.
const env={V2_ALLOW_LIVE_V2_026_VOICE_PROOF:'1',V2_DANA_REVIEW_VOICE_APPROVED:'1',OPENAI_API_KEY:'synthetic-patient-secret',ELEVENLABS_API_KEY:'synthetic-speech-secret',ELEVENLABS_SMOKE_VOICE_IDS:'syntheticFemale001'};
const prepare=(overrides={},fetch=()=>assert.fail('Unexpected I/O'))=>prepareDanaLiveProof({getEnv:n=>({...env,...overrides})[n],fetch,now:()=>1000});
const request={model:'gpt-5.6-terra',instructions:'Synthetic instructions',user_content:'Synthetic question',output_schema_name:'synthetic',output_json_schema:{type:'object',properties:{},additionalProperties:false},max_output_tokens:64,max_attempts:2,timeout_ms:1000,reasoning_effort:'low'};
test('no opt-in or female review approval means no credential access or I/O',()=>{
 const reads=[];assert.equal(prepareDanaLiveProof({getEnv:n=>{reads.push(n);return undefined;},fetch:()=>assert.fail()}).code,'LIVE_PROOF_OPT_IN_REQUIRED');
 assert.deepEqual(reads,['V2_ALLOW_LIVE_V2_026_VOICE_PROOF']);
 assert.equal(prepare({V2_DANA_REVIEW_VOICE_APPROVED:''}).code,'DANA_FEMALE_REVIEW_VOICE_APPROVAL_REQUIRED');
});
test('Dana admission rejects STEMI question, wrong locale and a second identity; fresh boot resets only DEV admission',()=>{
 const admit=createDanaQuestionAdmission(),body={text:DANA_PROOF_QUESTION,locale:'ar-JO'};
 assert.equal(admit({...body,text:'متى بلش وجع صدرك؟'},'key'),'REVIEW_PROOF_REQUEST_NOT_ALLOWED');
 assert.equal(admit({...body,locale:'en-US'},'key'),'REVIEW_PROOF_REQUEST_NOT_ALLOWED');
 assert.equal(admit(body,'key'),undefined);assert.equal(admit(body,'key'),undefined);
 assert.equal(admit(body,'new-key'),'REVIEW_PROOF_ALREADY_CONSUMED');
 assert.equal(createDanaQuestionAdmission()(body,'new-key'),undefined);
});
test('missing/ambiguous voice configuration fails closed; no global STEMI voice default',()=>{
 assert.equal(prepare({ELEVENLABS_SMOKE_VOICE_IDS:''}).code,'ONE_APPROVED_VOICE_REQUIRED');
 assert.equal(prepare({ELEVENLABS_SMOKE_VOICE_IDS:'a,b'}).code,'ONE_APPROVED_VOICE_REQUIRED');
 assert.equal(prepare({OPENAI_API_KEY:''}).code,'PATIENT_PROVIDER_KEY_REQUIRED');
 const r=prepare();assert.equal(r.success,true);assert.equal(r.profile.profile_id,'voice-profile.dana-review');
 assert.equal(JSON.stringify(r.profile).includes('secret'),false);assert.deepEqual(r.counts(),{patient_http_attempts:0,tts_token_attempts:0});
});
test('existing Terra Responses path remains store false/tools none and one request only',async()=>{
 let calls=0;const r=prepare({},async(url,options)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);
  assert.equal(body.model,'gpt-5.6-terra');assert.equal(body.store,false);assert.deepEqual(body.tools,[]);assert.equal(body.tool_choice,'none');
  return Response.json({id:'response.synthetic',model:request.model,status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{}'}]}]});
 });
 assert.equal((await r.patient_provider.execute(request)).success,true);
 assert.equal((await r.patient_provider.execute(request)).code,'AI_BUDGET_EXCEEDED');assert.equal(calls,1);
});
test('provider failure cannot resubmit a paid proof or change its model',async()=>{
 let calls=0;const r=prepare({},async()=>{calls++;return new Response('',{status:503});});
 assert.equal((await r.patient_provider.execute({...request,model:'gpt-5.6-luna'})).success,false);assert.equal(calls,0);
 assert.equal((await r.patient_provider.execute(request)).success,false);assert.equal(calls,1);
 assert.equal((await r.patient_provider.execute(request)).success,false);assert.equal(calls,1);
});
test('existing TTD broker binds only Dana profile and permits one mint, never STT or STEMI',async()=>{
 let calls=0;const r=prepare({},async(url)=>{calls++;assert.equal(url,'https://api.elevenlabs.io/v1/single-use-token/ttd_websocket');return Response.json({token:'synthetic-single-use'});});
 const req={capability:'TTS',session_id:'session.dana',locale:'ar-JO',voice_profile_id:'voice-profile.dana-review'};
 const issue=(body,key)=>r.speech_token_broker.issue('principal.synthetic',body,'idempotency.'+key);
 assert.equal((await issue({...req,voice_profile_id:'voice-profile.stemi-review'},'stemi')).success,false);
 const issued=await issue(req,'first');assert.equal(issued.success,true);assert.equal(issued.data.token_type,'ttd_websocket');assert.equal(issued.data.model_id,'eleven_v3_conversational');
 assert.equal((await issue(req,'second')).success,false);assert.equal(calls,1);
});
