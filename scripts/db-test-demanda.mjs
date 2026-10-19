import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {databaseClient} from "./db-client.mjs";
const db=databaseClient();let checks=0,context="schema";
const equal=(a,b)=>{assert.deepEqual(a,b,context);checks++;};
async function as(id){await db.query("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.query("set local role authenticated");}
async function denied(sql,args=[],code="42501"){await db.query("savepoint d");let got;try{await db.query(sql,args);}catch(e){got=e.code;}await db.query("rollback to savepoint d");equal(got,code);}
const reg=(e,r,o="teste")=>db.query("select public.registrar_interesse_demanda($1,$2,$3) as novo",[e,r,o]).then(x=>x.rows[0].novo);
try{
 await db.connect();await db.query("begin");
 const owner=randomUUID(),reader=randomUUID(),outsider=randomUUID(),other=randomUUID();
 for(const id of [owner,reader,outsider,other])await db.query("insert into auth.users(id,email) values($1,$2)",[id,`${id}@test.invalid`]);
 await as(owner);const empresa=(await db.query("select public.criar_empresa('Demanda A','CPF','52998224725') as id")).rows[0].id;
 await as(other);const alheia=(await db.query("select public.criar_empresa('Demanda B','CPF','52998224725') as id")).rows[0].id;
 await db.query("reset role");await db.query("insert into public.usuarios_empresas(empresa_id,usuario_id,papel) values($1,$2,'leitura')",[empresa,reader]);
 // Interesse é idempotente por usuário/empresa/recurso e gera um único evento.
 await as(owner);equal(await reg(empresa,"open_finance"),true);equal(await reg(empresa,"open_finance"),false);equal(await reg(empresa,"boleto_pix"),true);
 equal((await db.query("select count(*)::int n from public.interesses_demanda where empresa_id=$1",[empresa])).rows[0].n,2);
 equal((await db.query("select count(*)::int n from public.eventos_uso where empresa_id=$1 and modulo='demanda'",[empresa])).rows[0].n,2);
 // Leitor pode manifestar interesse e só enxerga o próprio.
 await as(reader);equal(await reg(empresa,"open_finance"),true);equal((await db.query("select count(*)::int n from public.interesses_demanda")).rows[0].n,1);
 // Isolamento, recurso inválido, escrita direta e anônimo.
 await as(outsider);await denied("select public.registrar_interesse_demanda($1,'open_finance','x')",[empresa]);
 await as(owner);await denied("select public.registrar_interesse_demanda($1,'open_finance','x')",[alheia]);
 await denied("select public.registrar_interesse_demanda($1,'inexistente','x')",[empresa],"23514");
 await denied("insert into public.interesses_demanda(empresa_id,usuario_id,recurso,origem) values($1,$2,'assistente_ia','x')",[empresa,owner]);
 await db.query("reset role");await db.query("set local role anon");await denied("select public.registrar_interesse_demanda($1,'open_finance','x')",[empresa]);
 // Cadastros geram evento de uso ao criar e editar, sem alterar a escrita.
 await as(owner);const cli=(await db.query("insert into public.clientes(empresa_id,nome) values($1,'Cliente uso') returning id",[empresa])).rows[0].id;
 await db.query("update public.clientes set nome='Cliente uso 2' where id=$1",[cli]);
 equal((await db.query("select evento from public.eventos_uso where empresa_id=$1 and modulo='cadastros:clientes' order by criado_em,evento",[empresa])).rows.map(r=>r.evento).sort(),["criar","editar"]);
 console.log(`Demanda e uso: ${checks} verificações passaram. Fixtures revertidas.`);
}catch(e){console.error("Falha em demanda/uso:",context,e.code??e.name,e instanceof assert.AssertionError?e.message:"");process.exitCode=1;}finally{await db.query("rollback").catch(()=>{});await db.end();}
