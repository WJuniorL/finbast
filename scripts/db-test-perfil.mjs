import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {databaseClient} from "./db-client.mjs";
const db=databaseClient();let checks=0,context="schema";
const equal=(a,b)=>{assert.deepEqual(a,b,context);checks++;};
async function as(id){await db.query("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.query("set local role authenticated");}
const acessos=e=>db.query("select usuario_id,email,papel from public.listar_acessos($1)",[e]).then(r=>r.rows);
try{
 await db.connect();await db.query("begin");
 const owner=randomUUID(),op=randomUUID(),outro=randomUUID(),estranho=randomUUID();
 for(const id of [owner,op,outro,estranho])await db.query("insert into auth.users(id,email) values($1,$2)",[id,`${id}@test.invalid`]);
 await as(owner);const e=(await db.query("select public.criar_empresa('Perfil A','CPF','52998224725') as id")).rows[0].id;
 await db.query("insert into public.usuarios_empresas(empresa_id,usuario_id,papel) values($1,$2,'operador'),($1,$3,'leitura')",[e,op,outro]);
 context="listar";const lista=await acessos(e);equal(lista.length,3);equal(lista[0].papel,"proprietario");equal(lista[0].email,`${owner}@test.invalid`);
 for(const id of [op,estranho]){await as(id);equal(await acessos(e),[]);}
 await as(owner);
 context="renomear";equal((await db.query("update public.empresas set nome='Perfil A2' where id=$1 returning nome",[e])).rows[0].nome,"Perfil A2");
 await as(op);equal((await db.query("update public.empresas set nome='Hack' where id=$1 returning id",[e])).rowCount,0);
 context="sair";await as(estranho);equal((await db.query("select public.sair_da_empresa($1) as ok",[e])).rows[0].ok,false);
 await as(owner);equal((await db.query("select public.sair_da_empresa($1) as ok",[e])).rows[0].ok,false);equal((await acessos(e)).length,3);
 await as(op);equal((await db.query("select public.sair_da_empresa($1) as ok",[e])).rows[0].ok,true);
 await as(owner);equal((await acessos(e)).map(a=>a.usuario_id).includes(op),false);
 context="remover";equal((await db.query("delete from public.usuarios_empresas where empresa_id=$1 and usuario_id=$2",[e,outro])).rowCount,1);
 equal((await db.query("delete from public.usuarios_empresas where empresa_id=$1 and usuario_id=$2",[e,owner])).rowCount,0);
 await as(estranho);equal((await db.query("delete from public.usuarios_empresas where empresa_id=$1",[e])).rowCount,0);
 await db.query("reset role");await db.query("set local role anon");await db.query("savepoint a");let code;try{await db.query("select public.sair_da_empresa($1)",[e]);}catch(x){code=x.code;}equal(code,"42501");
 console.log(`Perfil/usuários: ${checks} verificações passaram. Fixtures revertidas.`);
}catch(x){console.error("Falha em perfil/usuários:",context,x.code??x.name,x instanceof assert.AssertionError?x.message:"");process.exitCode=1;}finally{await db.query("rollback").catch(()=>{});await db.end();}
