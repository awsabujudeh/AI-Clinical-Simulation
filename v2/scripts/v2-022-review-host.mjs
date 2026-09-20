import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { createV2_022Review } from "../runtime/v2-022-review-composition.ts";
import { apiHeaders } from "../tests/fixtures/api/secure-api.ts";
// Offline local review, no environment/credential reads or provider composition.
const {h,sessionId,advance}=await createV2_022Review();
const origin="http://127.0.0.1:4190";
const vite=await createViteServer({root:fileURLToPath(new URL("../apps/web/",import.meta.url)),envDir:false,envPrefix:"__V2_022_NO_ENV__",server:{middlewareMode:true,hmr:false},appType:"custom"});
const entry=fileURLToPath(new URL("../tests/browser/v2-021-e2e/app.tsx",import.meta.url)).replaceAll("\\","/");
const milestones=[119,120,299,300,479,480];let milestone=0;
const server=createServer(async(req,res)=>{
  try{
    if(req.headers.host!=="127.0.0.1:4190"||(req.headers.origin&&req.headers.origin!==origin)||req.headers["sec-fetch-site"]==="cross-site"){res.writeHead(403).end();return;}
    const url=new URL(req.url,origin);
    if(url.pathname==="/__review/session"){res.setHeader("Content-Type","application/json");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify({session_id:sessionId,patient_language:"ar-JO",review_namespace:"media-review"}));return;}
    if(url.pathname==="/__review/next-milestone"&&req.method==="POST"){
      const target=milestones[milestone++];if(target===undefined){res.writeHead(409).end();return;}
      const r=await advance(target);res.writeHead(r.success?200:409,{"Content-Type":"application/json"});res.end(JSON.stringify({success:r.success,target,reached:r.success?r.authoritative_session.patient_state.clinical_time:undefined}));return;
    }
    if(url.pathname.startsWith("/v1/")){
      const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>65536){res.writeHead(413).end();return;}chunks.push(c);}
      const r=await h.app.request(url.pathname+url.search,{method:req.method,headers:apiHeaders({token:"faculty",idempotency:req.headers["idempotency-key"]}),...(chunks.length?{body:Buffer.concat(chunks)}:{})});
      res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return;
    }
    vite.middlewares(req,res,async()=>{
      if(req.method!=="GET"||!/^\/(?:sessions\/[^/]+)?$/.test(url.pathname)){res.writeHead(404).end();return;}
      res.setHeader("Content-Type","text/html");res.end(await vite.transformIndexHtml(url.pathname,`<!doctype html><html><body><div id="root"></div><script type="module" src="/@fs/${entry}"></script></body></html>`));
    });
  }catch{res.writeHead(500).end("REVIEW_UNAVAILABLE");}
});
server.listen(4190,"127.0.0.1");
const close=()=>{server.closeAllConnections();server.close();void vite.close();};process.once("SIGINT",close);process.once("SIGTERM",close);
