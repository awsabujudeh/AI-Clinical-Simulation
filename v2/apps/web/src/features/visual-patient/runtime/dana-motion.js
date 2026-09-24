/** Presentation-only envelopes. Time is renderer time, never Clinical Time. */
export function danaMotion(t, state) {
 const improved=state.body==='calm_body';
 const time=Math.max(0,Number.isFinite(t)?t:0);
 const ease=x=>{const v=Math.max(0,Math.min(1,x));return v*v*(3-2*v);};
 // Reach, HOLD for four visible strokes, release. Contact does not disappear
 // at every stroke; only the wrist and fingers articulate during the plateau.
 const episode=(start,hold,phase)=>{
  const d=phase-start,reach=1.1,release=1.2;
  if(d<0||d>reach+hold+release)return {weight:0,contact:0,stroke:0};
  const weight=d<reach?ease(d/reach):d<reach+hold?1:1-ease((d-reach-hold)/release);
  const contact=d>=reach&&d<=reach+hold?1:0;
  return {weight,contact,stroke:contact*Math.sin((d-reach)/hold*Math.PI*8)};
 };
 // Unequal pauses, short asymmetric close/open envelope; no random global state.
 const phase=time%23.4;
 let blink=0;
 for(const start of [2.9,7.7,11.3,17.5,21.6]) {
  const d=phase-start;
  if(d>=0&&d<.24)blink=d<.075?d/.075:1-(d-.075)/.165;
 }
 const scratchPhase=time%40.9;
 const active=state.hand&&state.body==='itch_body'&&state.mode==='conversation';
 const episodes=[episode(2.4,3.6,scratchPhase),episode(15.1,3.2,scratchPhase),episode(29.0,3.9,scratchPhase)];
 const gesture=episodes.find(e=>e.weight>0)??{weight:0,contact:0,stroke:0};
 const forearm=active?Math.max(episodes[0].weight,episodes[2].weight):0;
 const neck=active?episodes[1].weight:0;
 const scratch=Math.max(forearm,neck);
 return {
  blink:state.blink&&state.living!==false?Math.max(0,blink):0,
  mouth:state.speaking?(.12+.47*(.5+.5*Math.sin(time*16.7))*(.68+.32*Math.sin(time*7.1)**2)):0,
  scratch,forearm,neck,
  contact:active?gesture.contact:0,
  wristStroke:active?gesture.stroke:0,
  fingerStroke:active?gesture.contact*(.5+.5*gesture.stroke):0,
  // Same RR-driven spine layer; readable but <1 degree. Improved breathing
  // is both slower and shallower. Pruritus targets/envelopes are unchanged.
  breathing:state.breathing?Math.sin(time*(improved?20:28)*Math.PI/30)*(improved?.010:.016):0,
  // Visible ribcage excursion shares the same RR/phase, not a head-only rock.
  // The pinned mesh limits full excursion to 9 mm; improvement reduces it 62%.
  thoracic:state.breathing?(.5+.5*Math.sin(time*(improved?20:28)*Math.PI/30))*(improved?.38:1):0,
  anxious:state.face==='anxious'?1:0,
  calm:state.face==='relieved'?1:0,
  rash:improved?.06:1,
  swelling:improved?.05:1
 };
}
