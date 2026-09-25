import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import type {SessionMode} from '@ai-clinical-simulation/contracts';
import type {LearnerCaseEntry,StudentUiServices} from '../../app/types';
import {Button,Panel} from '../../components/ui';
import {useLocalization} from '../../app/localization';
export function EncounterEntry({service}:{service:NonNullable<StudentUiServices['encounter_entry']>}){
 const [entries,setEntries]=useState<readonly LearnerCaseEntry[]>([]),[selected,setSelected]=useState<LearnerCaseEntry>(),[mode,setMode]=useState<SessionMode>('PRACTICE_DEMO'),[brief,setBrief]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const nav=useNavigate(),{locale}=useLocalization(),ar=locale==='ar-JO';
 useEffect(()=>{void service.list().then(setEntries).catch(()=>setError('Case selection unavailable'));},[service]);
 async function begin(){if(!selected||busy)return;setBusy(true);try{const r=await service.begin(selected.entry_id,mode);if(r.success)nav(`/sessions/${r.projection.session_id}`);else setError(ar?'تعذر بدء المقابلة':'Unable to begin encounter');}catch{setError(ar?'تعذر بدء المقابلة':'Unable to begin encounter');}finally{setBusy(false);}}
 return <Panel><h1>{brief?(ar?'ملخص المقابلة':'Encounter briefing'):(ar?'اختيار المريض':'Select a patient')}</h1>{!brief?<>
 {entries.map(e=><Button key={e.entry_id} onClick={()=>setSelected(e)}>{e.name} — {e.demographics} — {e.complaint}</Button>)}
 <label>{ar?'نمط الجلسة':'Session mode'}<select aria-label="Session mode" value={mode} onChange={e=>setMode(e.target.value as SessionMode)}><option value="PRACTICE_DEMO">{ar?'تدريب':'Practice'}</option><option value="ASSESSMENT">{ar?'تقييم':'Assessment'}</option></select></label>
 <Button disabled={!selected} onClick={()=>setBrief(true)}>{ar?'مراجعة الملخص':'Review briefing'}</Button></>:<>
 <h2>{selected?.name}</h2><p>{selected?.demographics}</p><p>{selected?.setting}</p><p>{selected?.complaint}</p><p>{selected?.role}</p><p>{mode==='ASSESSMENT'?'Assessment':'Practice'}</p><p>{ar?'يبدأ الوقت السريري عند بدء المقابلة.':'Clinical Time starts when you begin the encounter.'}</p>
 <Button disabled={busy} onClick={()=>void begin()}>{ar?'بدء المقابلة':'Begin Encounter'}</Button><Button disabled={busy} onClick={()=>setBrief(false)}>{ar?'رجوع':'Back'}</Button></>}<p role="status">{error}</p></Panel>;
}
