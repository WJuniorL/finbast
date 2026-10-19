import {z} from "zod";
import {moneySchema} from "./financeiro.ts";
export const scenarioSchema=z.object({nome:z.string().trim().min(2).max(120),ano:z.coerce.number().int().min(2000).max(2100),request_id:z.string().uuid()});
export const planLineSchema=z.object({id:z.union([z.string().uuid(),z.literal("")]).optional(),descricao:z.string().trim().min(2).max(160),tipo:z.enum(["receita","despesa"]),categoria_id:z.string().uuid(),centro_custo_id:z.union([z.string().uuid(),z.literal("")]),mes:z.string().regex(/^(?:20\d{2}|2100)-(?:0[1-9]|1[0-2])$/).transform(v=>`${v}-01`),valor_unitario_centavos:moneySchema,quantidade:z.coerce.number().int().min(1).max(1000000)}).refine(d=>d.valor_unitario_centavos>0&&BigInt(d.valor_unitario_centavos)*BigInt(d.quantidade)<=1000000000000n,"Total deve ser positivo e dentro do limite permitido.");
export type PlanMonth={mes:string;receitas:string;despesas:string;fixos:string;caixa:string;fechado:boolean};
export type PlanCell={mes:string;base:string;plano:string;realizado:string;fixos:string};
export type PlanGroup={tipo:"receita"|"despesa";categoria_id:string;centro_custo_id:string|null;categoria:string;centro:string;meses:PlanCell[]};
export type Scenario={id:string;nome:string;ano:number;versao:number;arquivado:boolean};
export type PlanSummary={cenario:Scenario;total:number;pagina:number;grade:PlanGroup[];meses:PlanMonth[]};
export type PlanLine={id:string;descricao:string;tipo:string;categoria_id:string;centro_custo_id:string|null;mes:string;valor_unitario_centavos:number|string;quantidade:number;valor_centavos:number|string;convite_id:string|null};
export type Option={id:string;nome:string;tipo?:string};
export type ContributionLine={categoria_id:string;mes:string;descricao:string;valor_centavos:string};
export type LeaderData={setor:string;ano:number;versao:number;revisao:number;expira_em:string;linhas:ContributionLine[];categorias:Option[]};
export function simulatedMonths(months:PlanMonth[],enabled:boolean){let accumulated=0n;return months.map(m=>{if(enabled)accumulated+=BigInt(m.receitas)-BigInt(m.despesas);return {...m,simulado:String(BigInt(m.caixa)+accumulated)};});}
export function planDeviation(cell:PlanCell){return BigInt(cell.realizado)-BigInt(cell.base)-BigInt(cell.plano);}
