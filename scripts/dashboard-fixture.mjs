import {cashFixture,fixtureRpc} from "./fluxo-fixture.mjs";
export async function dashboardFixture(db,owner) {
 const fixture=await cashFixture(db,owner),fixed=[fixture.pagar.id,fixture.aberto.id];
 for(const [date,value] of [["2026-02-15",1200],["2026-03-15",2300],["2026-04-15",3400],["2026-05-15",4500]]){
  const title=await fixture.title("pagar",`Fixo ${date}`,value,date);fixed.push(title.id);
 }
 await fixture.title("pagar","Variável de fevereiro",7000,"2026-02-15");
 const paid=await fixture.title("pagar","Fixo já pago de fevereiro",600,"2026-02-01","2026-02-01");fixed.push(paid.id);
 const cancelled=await fixture.title("pagar","Fixo cancelado",9900,"2026-02-15");fixed.push(cancelled.id);
 await fixtureRpc(db,"cancelar_pagar",[fixture.empresa,cancelled.id,cancelled.version,false]);
 await fixtureRpc(db,"desfazer_conciliacao",[fixture.empresa,fixture.conciliacao,"Preparar custo fixo sintético"]);
 await db.query("reset role");await db.query("update public.lancamentos_pagar set custo_fixo=true where id=any($1::uuid[])",[fixed]);await db.query("set local role authenticated");
 fixture.conciliacao=(await fixtureRpc(db,"conciliar_movimento",[fixture.empresa,fixture.debito,"pagar",fixture.pagar.id])).id;
 return fixture;
}
