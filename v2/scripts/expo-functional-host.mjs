import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createServer as createViteServer} from 'vite';
import {createExpoEntry} from '../runtime/expo-entry.ts';
import {assertLocalReviewEnvironment} from './local-review-security.mjs';
assertLocalReviewEnvironment(process.env.NODE_ENV);
const namespace=randomUUID(),port=4218,origin=`http://127.0.0.1:${port}`;
const entry=await createExpoEntry(namespace,()=>new Date(Math.floor(Date.now()/1000)*1000).toISOString());
const vite=await createViteServer({root:fileURLToPath(new URL('../apps/web/',import.meta.url)),envDir:false,envPrefix:'__NO_EXPO_CLIENT_ENV__',server:{middlewareMode:true,hmr:{port:24218}},appType:'custom'});
const appEntry=fileURLToPath(new URL('../tests/browser/v2-021-e2e/app.tsx',import.meta.url)).replaceAll('\\','/');
const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 try{
  if(req.headers.host!==`127.0.0.1:${port}`||(req.headers.origin&&req.headers.origin!==origin)||req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403).end();return;}
  const path=new URL(req.url,origin).pathname;
  const json=(status,body)=>res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(body));
  if(path==='/__review/session'&&req.method==='GET')return json(200,{functional_expo:true,review_namespace:namespace,expo_finalization:true,tutor_enabled:true});
  if(path==='/__expo/cases'&&req.method==='GET')return json(200,{entries:entry.cards});
  if(path.startsWith('/v1/')||path==='/__expo/begin'){
   let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>16384){res.writeHead(413).end();return;}chunks.push(c);}const body=chunks.length?Buffer.concat(chunks).toString():undefined;
   const key=req.headers['idempotency-key'];if(req.method==='POST'&&(typeof key!=='string'||key.length>128))return json(400,{});
   if(path==='/__expo/begin'){if(req.method!=='POST')return json(405,{});const r=await entry.begin(JSON.parse(body??'null'),key);return json(r.status,r.body);}
   const r=await entry.request(path,req.method,body,key);res.writeHead(r.status,Object.fromEntries(r.headers)).end(Buffer.from(await r.arrayBuffer()));return;
  }
  vite.middlewares(req,res,async()=>{if(req.method!=='GET'||!/^\/(?:app|sessions\/[^/]+(?:\/debrief)?)?$/.test(path)){res.writeHead(404).end();return;}res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml(path,`<!doctype html><html><head><meta charset="UTF-8"><title>BALSIM local Expo review</title></head><body><div id="root"></div><script type="module" src="/@fs/${appEntry}"></script></body></html>`));});
 }catch{res.writeHead(500).end('Local review unavailable');}
});
server.listen(port,'127.0.0.1',()=>console.log(`LOCAL SYNTHETIC EXPO — providers unavailable — ${origin}/app`));
const close=async()=>{server.closeAllConnections();server.close();await vite.close();};process.once('SIGINT',close);process.once('SIGTERM',close);
