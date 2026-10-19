import {z} from "zod";
import {dateSchema,moneySchema,optionalId} from "./financeiro.ts";

export function parseBps(input:string):number {
 const value=input.trim();if(!/^\d{1,3}(?:,\d{1,2})?$/.test(value))throw new Error("Use percentual com até duas casas, como 40,25.");
 const [whole,fraction=""]=value.split(","),bps=Number(whole)*100+Number(fraction.padEnd(2,"0"));
 if(bps>10000)throw new Error("Percentual deve ficar entre 0 e 100%.");return bps;
}
export const percentSchema=z.string().transform((value,ctx)=>{try{return parseBps(value);}catch(error){ctx.addIssue({code:"custom",message:error instanceof Error?error.message:"Percentual inválido."});return z.NEVER;}});
export const productSchema=z.object({id:optionalId,nome:z.string().trim().min(2).max(120),custo_unitario_centavos:moneySchema,custo_projeto_centavos:moneySchema,preco_centavos:moneySchema,volume:z.coerce.number().int().min(1).max(1000000),margem_bps:percentSchema.refine(v=>v<10000,"A margem alvo deve ser menor que 100%.")}).refine(v=>BigInt(v.custo_unitario_centavos)*BigInt(v.volume)+BigInt(v.custo_projeto_centavos)<=1000000000000n&&BigInt(v.preco_centavos)*BigInt(v.volume)<=1000000000000n,"Totais projetados acima do limite permitido.");
export const allocationSchema=z.object({id:optionalId,nome:z.string().trim().min(2).max(120),categoria_id:optionalId,fornecedor_id:optionalId,itens:z.array(z.object({produto_id:z.string().uuid(),peso_bps:z.number().int().min(1).max(10000)})).min(1).max(200)}).refine(v=>Boolean(v.categoria_id)!==Boolean(v.fornecedor_id),"Escolha uma categoria OU um fornecedor.").refine(v=>v.itens.reduce((n,i)=>n+i.peso_bps,0)===10000&&new Set(v.itens.map(i=>i.produto_id)).size===v.itens.length,"O rateio deve totalizar 100%, sem produtos repetidos.");
export const manualCostSchema=z.object({id:optionalId,produto_id:z.string().uuid(),descricao:z.string().trim().min(2).max(160),dia:dateSchema,valor_centavos:moneySchema.refine(v=>v>0,"Informe um valor positivo.")});
export const productPeriodSchema=z.object({inicio:dateSchema,fim:dateSchema,base:z.enum(["registrado","realizado"])}).refine(v=>{const days=(Date.parse(v.fim)-Date.parse(v.inicio))/86400000;return days>=0&&days<=365;},"Use período inclusivo de até 366 dias.");
export type Product={id:string;nome:string;ativo:boolean;custo_unitario_centavos:string|number;custo_projeto_centavos:string|number;preco_centavos:string|number;volume:number;margem_bps:number};
export type Allocation={id:string;nome:string;ativo:boolean;categoria_id:string|null;fornecedor_id:string|null;itens:{produto_id:string;peso_bps:number}[]};
export type ProductRow={id:string;nome:string;ativo:boolean;receita:string;direto:string;compartilhado:string;margem:string;geral:string;resultado:string};
export type ProductSummary={total:number;receita:string;gerais:string;receita_sem_produto:string;gerais_alocados:string;gerais_nao_alocados:string;produtos:ProductRow[]};
export type CostSource={id:string;descricao:string;dia:string;valor:string;tipo:string;produto_id:string|null;regra_id:string|null;origem:string};
export type Option={id:string;nome:string};
const ceil=(a:bigint,b:bigint)=>(a+b-1n)/b;
export function simulateProduct(p:Pick<Product,"custo_unitario_centavos"|"custo_projeto_centavos"|"preco_centavos"|"volume"|"margem_bps">){
 const unit=BigInt(p.custo_unitario_centavos),fixed=BigInt(p.custo_projeto_centavos),price=BigInt(p.preco_centavos),qty=BigInt(p.volume),margin=BigInt(p.margem_bps);
 if(unit<0n||fixed<0n||price<0n||qty<1n||margin<0n||margin>=10000n)throw new Error("Premissas inválidas.");
 const receitas=price*qty,custos=unit*qty+fixed,spread=price-unit;
 return {receitas,custos,contribuicao:receitas-custos,precoAlvo:ceil(custos*10000n,qty*(10000n-margin)),equilibrio:fixed===0n?(spread>=0n?0n:null):spread>0n?ceil(fixed,spread):null};
}
