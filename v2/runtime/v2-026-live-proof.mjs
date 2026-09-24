import { PatientVoiceProfileSchema } from '../packages/contracts/src/index.ts';
import { OpenAiResponsesProvider } from '../packages/ai-gateway/src/index.ts';
import { readElevenLabsRuntimeConfig } from '../packages/api-core/src/voice/runtime-config.ts';
import { createElevenLabsTokenProvider } from '../packages/api-core/src/voice/elevenlabs-token-provider.ts';
import { createMemorySpeechTokenBroker } from '../packages/api-core/src/voice/token-broker.ts';

export const DANA_PROOF_QUESTION='شو صار معك قبل ما تبلش الأعراض؟';
export function createDanaQuestionAdmission(){
 let accepted;
 return(body,key)=>{
  if(body?.text!==DANA_PROOF_QUESTION||body?.locale!=='ar-JO'||typeof key!=='string'||!key)return 'REVIEW_PROOF_REQUEST_NOT_ALLOWED';
  if(accepted&&accepted!==key)return 'REVIEW_PROOF_ALREADY_CONSUMED';
  accepted=key;return undefined;
 };
}
/** DEV-only composition of existing providers. No alternate TTD implementation.
 * Female review-voice approval is an owner attestation, not inferred from an ID.
 * It is neither a final Dana voice selection nor a production profile default.
 */
export function prepareDanaLiveProof({getEnv,fetch,now=Date.now}){
 try{
  if(getEnv('V2_ALLOW_LIVE_V2_026_VOICE_PROOF')!=='1')return{success:false,code:'LIVE_PROOF_OPT_IN_REQUIRED'};
  if(getEnv('V2_DANA_REVIEW_VOICE_APPROVED')!=='1')return{success:false,code:'DANA_FEMALE_REVIEW_VOICE_APPROVAL_REQUIRED'};
  const apiKey=getEnv('OPENAI_API_KEY');if(!apiKey?.trim())return{success:false,code:'PATIENT_PROVIDER_KEY_REQUIRED'};
  const speech=readElevenLabsRuntimeConfig(getEnv);if(!speech.success)return speech;
  const ids=(getEnv('ELEVENLABS_SMOKE_VOICE_IDS')??'').split(',').filter(Boolean);
  if(ids.length!==1)return{success:false,code:'ONE_APPROVED_VOICE_REQUIRED'};
  const profile=PatientVoiceProfileSchema.parse({profile_version:'2.0',profile_id:'voice-profile.dana-review',provider:'ELEVENLABS',model_id:'eleven_v3_conversational',voices:{'ar-JO':ids[0],'en-US':ids[0]}});
  let invocations=0,attempts=0,tokens=0;
  const provider=new OpenAiResponsesProvider({api_key:apiKey,transport:{async send(request){
   if(++attempts>1)throw Error('PROOF_LIMIT_REACHED');
   const r=await fetch(request.url,{method:request.method,headers:request.headers,body:request.body,signal:request.signal,redirect:'error'});
   return{status:r.status,body:await r.text()};
  }}});
  const speechProvider=createElevenLabsTokenProvider({...speech.config,fetch});
  const broker=createMemorySpeechTokenBroker({async issue(type){
   if(type!=='ttd_websocket'||++tokens>1)throw Error('PROOF_LIMIT_REACHED');return speechProvider.issue(type);
  }},now,[profile]);
  return{success:true,profile,speech_token_broker:broker,patient_provider:{async execute(request){
   if(request.model!=='gpt-5.6-terra'||++invocations>1)return{success:false,provider:'OPENAI',code:'AI_BUDGET_EXCEEDED',retryable:false,response_status:'FAILED',retry_count:0};
   return provider.execute(request);
  }},counts(){return{patient_http_attempts:attempts,tts_token_attempts:tokens};}};
 }catch{return{success:false,code:'LIVE_PROOF_CONFIGURATION_UNAVAILABLE'};}
}
