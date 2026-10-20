import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {databaseClient} from "./db-client.mjs";
const db=databaseClient();let checks=0,context="schema";
const equal=(a,b)=>{assert.deepEqual(a,b,context);checks++;};
async function as(id){await db.query("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.query("set local role authenticated");}
const pergunta=(e,limite=40)=>db.query("select public.registrar_pergunta_assistente($1,$2) as ok",[e,limite]).then(r=>r.rows[0].ok);
async function denied(sql,args,code){await db.query("savepoint d");let got;try{await db.query(sql,args);}catch(e){got=e.code;}await db.query("rollback to savepoint d");equal(got,code);}
try{
 await db.connect();await db.query("begin");
 const owner=randomUUID(),reader=randomUUID(),outsider=randomUUID(),other=randomUUID();
 for(const id of [owner,reader,outsider,other])await db.query("insert into auth.users(id,email) values($1,$2)",[id,`${id}@test.invalid`]);
 await as(owner);const e=(await db.query("select public.criar_empresa('Assistente A','CPF','52998224725') as id")).rows[0].id;
 await as(other);const alheia=(await db.query("select public.criar_empresa('Assistente B','CPF','52998224725') as id")).rows[0].id;
 await db.query("reset role");await db.query("insert into public.usuarios_empresas(empresa_id,usuario_id,papel) values($1,$2,'leitura')",[e,reader]);
 context="teto";await as(owner);
 equal([await pergunta(e,3),await pergunta(e,3)],[true,true]);
 await as(reader);equal(await pergunta(e,3),true);equal(await pergunta(e,3),false);equal(await pergunta(e,3),false);
 await as(owner);equal(await pergunta(e,4),true);equal(await pergunta(e,4),false);
 await db.query("reset role");
 equal((await db.query("select perguntas from public.assistente_uso_diario where empresa_id=$1",[e])).rows[0].perguntas,4);
 equal((await db.query("select count(*)::int n from public.eventos_uso where empresa_id=$1 and modulo='assistente'",[e])).rows[0].n,4);
 context="isolamento";await as(outsider);await denied("select public.registrar_pergunta_assistente($1)",[e],"42501");
 await as(owner);await denied("select public.registrar_pergunta_assistente($1)",[alheia],"42501");
 await denied("select public.registrar_pergunta_assistente($1,0)",[e],"22023");
 await denied("select count(*) from public.assistente_uso_diario",[],"42501");
 await db.query("reset role");await db.query("set local role anon");await denied("select public.registrar_pergunta_assistente($1)",[e],"42501");
 await db.query("rollback");
 // Concorrência: 12 chamadas simultâneas com teto 5 consomem exatamente 5.
 context="concorrencia";
 const setup=databaseClient();await setup.connect();const ids={owner:randomUUID()};let empresa;
 try{
  await setup.query("insert into auth.users(id,email) values($1,$2)",[ids.owner,`${ids.owner}@test.invalid`]);
  await setup.query("reset role");
  empresa=randomUUID();
  await setup.query("insert into public.empresas(id,nome,tipo,documento,dono_id) values($1,'Assist conc','CPF','52998224725',$2)",[empresa,ids.owner]);
  await setup.query("insert into public.usuarios_empresas(empresa_id,usuario_id,papel) values($1,$2,'proprietario')",[empresa,ids.owner]);
  const clients=await Promise.all(Array.from({length:12},async()=>{const c=databaseClient();await c.connect();return c;}));
  const results=await Promise.all(clients.map(async c=>{await c.query("begin");await c.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.owner]);await c.query("set local role authenticated");const r=await c.query("select public.registrar_pergunta_assistente($1,5) as ok",[empresa]);await c.query("commit");return r.rows[0].ok;}));
  equal(results.filter(Boolean).length,5);equal(results.filter(x=>!x).length,7);
  await Promise.all(clients.map(c=>c.end()));
 }finally{
  await setup.query("delete from public.empresas where id=$1",[empresa]).catch(()=>{});
  await setup.query("delete from auth.users where id=$1",[ids.owner]).catch(()=>{});
  await setup.end();
 }
 console.log(`Assistente (teto diário): ${checks} verificações passaram. Fixtures revertidas/removidas.`);
}catch(x){console.error("Falha no assistente:",context,x.code??x.name,x instanceof assert.AssertionError?x.message:"");process.exitCode=1;}finally{await db.query("rollback").catch(()=>{});await db.end().catch(()=>{});}
