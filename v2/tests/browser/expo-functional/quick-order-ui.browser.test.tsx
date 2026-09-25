import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect} from 'vitest';
import {QuickOrderPanel} from '../../../apps/web/src/features/actions/QuickOrderPanel';
import type {QuickOrderPlan} from '../../../packages/contracts/src/index';
import {PatientLanguageSchema} from '../../../packages/contracts/src/index';

(globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
for(const stage of ['plan','confirm'] as const)it(`safely handles ${stage} transport loss without automatic execution retry`,async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let calls=0;
 const plan={plan_id:'plan.test',session_id:'session.test',state_version:1,execution_policy:'CONFIRMED_SEQUENTIAL_STOP_ON_FAILURE',fragments:[{text:'ECG',interpretation:{status:'MATCH',candidate:{action_id:'concept.expo.ecg',parameters:{},unresolved_required_parameters:[]}}}]} as unknown as QuickOrderPlan;
 try{
  await act(async()=>root.render(<QuickOrderPanel sessionId="session.test" locale={PatientLanguageSchema.parse('en-US')} enabled actions={[]} refresh={async()=>{}} onChoose={()=>{}} service={{plan:async()=>{if(stage==='plan')throw new Error('synthetic transport failure');return plan;},confirm:async()=>{calls++;throw new Error('synthetic transport failure');}}}/>));
  const textarea=host.querySelector('textarea')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(textarea,'ECG');textarea.dispatchEvent(new Event('input',{bubbles:true}));});
  const interpret=Array.from(host.querySelectorAll('button')).find(x=>x.textContent==='Interpret orders')!;
  await act(async()=>interpret.click());
  if(stage==='confirm')await act(async()=>Array.from(host.querySelectorAll('button')).find(x=>x.textContent==='Confirm and execute resolved orders only')!.click());
  expect(host.querySelector('[role=status]')!.textContent).toBe(stage==='plan'?'Order interpretation unavailable; use the catalogue.':'Execution could not be confirmed. Review activity before retrying.');
  expect(calls).toBe(stage==='plan'?0:1);expect(interpret.disabled).toBe(false);
 }finally{await act(async()=>root.unmount());host.remove();}
});
