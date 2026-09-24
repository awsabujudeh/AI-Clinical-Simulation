import { PatientConversationTranscriptSchema, PatientVoiceProfileSchema } from '../../../packages/contracts/src/index.ts';
import { observePatientAudio } from '../../../apps/web/src/features/voice/patient-audio-playback.ts';
import type { StudentUiServices } from '../../../apps/web/src/app/types.ts';

/** Test-entry composition only. No token, provider, speech synthesis or clinical write. */
export function localSpeakingFixture(sessionId:string):Pick<StudentUiServices,'patient_conversation'|'voice'>{
 const transcript=PatientConversationTranscriptSchema.parse({conversation_schema_version:'1.0',session_id:sessionId,turns:[{
  conversation_schema_version:'1.0',turn_id:'conversation-turn.dana.local-visual-proof',session_id:sessionId,turn_sequence:1,
  clinical_time:0,grounded_state_version:0,locale:'ar-JO',source:'TEXT',utterance_id:'utterance.dana.local-visual-proof',
  learner_utterance:'LOCAL VISUAL PLAYBACK FIXTURE — not a provider conversation',
  patient_utterance:'اختبار محلي لحركة الفم فقط.',answer_mode:'FALLBACK',fallback_used:true,grounding_fact_ids:[],grounding_state_refs:[],
  question_event_id:'00000000-0000-4000-8000-000000000011',response_event_id:'00000000-0000-4000-8000-000000000012'
 }]});
 return {
  patient_conversation:{async load(){return{kind:'AVAILABLE',transcript};},async submit(){return{kind:'UNAVAILABLE'};}},
  voice:{profile:PatientVoiceProfileSchema.parse({profile_id:'voice-profile.dana-local-fixture',profile_version:'2.0',provider:'ELEVENLABS',model_id:'eleven_v3_conversational',voices:{'ar-JO':'LOCAL_FIXTURE_NOT_A_VOICE','en-US':'LOCAL_FIXTURE_NOT_A_VOICE'}}),adapter:{
   async recognize(){throw Error('LOCAL_VISUAL_FIXTURE_NO_STT');},
   async synthesize(){
    // Real HTMLAudioElement START/END drives the unmodified PatientSpeech and
    // SimulationWorkspace callbacks. This quiet tone is NOT ElevenLabs speech.
    const rate=24000,samples=rate*12,buffer=new ArrayBuffer(44+samples*2),v=new DataView(buffer);
    const text=(at:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
    text(0,'RIFF');v.setUint32(4,36+samples*2,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,samples*2,true);
    for(let i=0;i<samples;i++)v.setInt16(44+i*2,Math.sin(i*2*Math.PI*220/rate)*80,true);
    const url=URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));
    return observePatientAudio(new Audio(url),()=>URL.revokeObjectURL(url));
   }
  }}
 };
}
