import {createPatientRuntime,type PatientRuntime} from '../../../apps/web/src/features/visual-patient/runtime/runtime.js';
import {VisualPatientPresentationSchema} from '../../../packages/contracts/src/index.ts';
import {observePatientAudio} from '../../../apps/web/src/features/voice/patient-audio-playback.ts';
const presentation=VisualPatientPresentationSchema.parse({presentation_schema_version:'1.0',asset_id:'dana.review-v01',position:'semi_fowler',face:'anxious',body:'itch_body',breathing:true,blink:true,hand:true,living:true});
declare global{interface Window{__DANA_CONTRACT__:{runtime:PatientRuntime;ready:boolean;events:string[]}}}
const h:Window['__DANA_CONTRACT__']=window.__DANA_CONTRACT__={runtime:undefined as unknown as PatientRuntime,ready:false,events:[] as string[]};
h.runtime=createPatientRuntime(document.querySelector('canvas')!,document.getElementById('view')!,{onReady(){h.runtime.setPresentation(presentation);h.ready=true;},onError(){throw Error('DANA_RUNTIME_FAILED');},onExamRequest(){}},presentation.asset_id);
// A short local WAV tests real HTMLAudioElement events. It is not patient speech,
// a provider response, or evidence of successful ElevenLabs integration.
const samples=24000*4,buffer=new ArrayBuffer(44+samples*2),v=new DataView(buffer);
function text(at:number,s:string){for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));}
text(0,'RIFF');v.setUint32(4,36+samples*2,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,24000,true);v.setUint32(28,48000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,samples*2,true);
for(let i=0;i<samples;i++)v.setInt16(44+i*2,Math.sin(i*2*Math.PI*220/24000)*120,true);
const url=URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));const player=new Audio(url);
const audio=observePatientAudio(player,()=>URL.revokeObjectURL(url));audio.onPlayback!(e=>{h.events.push(e);h.runtime.setSpeaking(e==='START');});
document.getElementById('play')!.onclick=()=>void audio.play();
window.addEventListener('pagehide',()=>{audio.close();h.runtime.dispose();},{once:true});
