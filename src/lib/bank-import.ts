import {createHash} from "node:crypto";
import {inflateRawSync} from "node:zlib";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import {z} from "zod";
import {importRowSchema,signedCentavos,type ImportRow} from "./bancos.ts";

export const FILE_LIMIT=5*1024*1024,ROW_LIMIT=1000;
export const bankIdentity=(value:string)=>value.replace(/[^a-z0-9]/gi,"").toUpperCase();
function dateValue(input:unknown):string {
  if(input instanceof Date)return input.toISOString().slice(0,10);
  const value=String(input??"").trim();
  const br=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const iso=br?`${br[3]}-${br[2]}-${br[1]}`:value;
  if(!z.iso.date().safeParse(iso).success)throw new Error("Data inválida; use dd/mm/aaaa ou aaaa-mm-dd.");
  return iso;
}
function decimalCentavos(value:string):number {
  if(!/^-?\d+(?:\.\d{1,2})?$/.test(value))throw new Error("Valor decimal inválido.");
  return signedCentavos(value.replace(".",","));
}
function normalizeRows(rows:{data:unknown;descricao:unknown;valor:unknown;identificador:unknown;decimal?:boolean}[]):{rows:ImportRow[];warning:string|null} {
  if(!rows.length||rows.length>ROW_LIMIT)throw new Error(`Use de 1 a ${ROW_LIMIT} movimentos por arquivo.`);
  const occurrences=new Map<string,number>(),keys=new Set<string>();let withoutId=false;
  const normalized=rows.map((row,index)=>{
    try{
      const date=dateValue(row.data),description=String(row.descricao??"").trim().replace(/\s+/g," "),identifier=String(row.identificador??"").trim();
      const amount=typeof row.valor==="number"?decimalCentavos(String(row.valor)):row.decimal?decimalCentavos(String(row.valor).trim()):signedCentavos(String(row.valor??""));
      const base=createHash("sha256").update(JSON.stringify([date,description,amount])).digest("hex");
      const ordinal=(occurrences.get(base)??0)+1;occurrences.set(base,ordinal);
      const key=identifier?`id:${identifier}`:`linha:${base}:${ordinal}`;if(!identifier)withoutId=true;
      if(keys.has(key))throw new Error("Identificador repetido no arquivo.");keys.add(key);
      return importRowSchema.parse({chave:key,data_movimento:date,descricao:description,valor_centavos:amount});
    }catch(error){throw new Error(`Linha ${index+2}: ${error instanceof z.ZodError?"confira data, descrição e valor não zero":error instanceof Error?error.message:"dados inválidos"}`);}
  });
  return {rows:normalized,warning:withoutId?"Há linhas sem identificador. A deduplicação usa data, descrição, valor e ocorrência; confira extratos sobrepostos com movimentos idênticos. Prefira identificadores únicos do banco.":null};
}
function decode(buffer:Buffer):string {try{return new TextDecoder("utf-8",{fatal:true}).decode(buffer).replace(/^\uFEFF/,"");}catch{return new TextDecoder("windows-1252").decode(buffer);}}
function csvRows(text:string) {
  if(text.includes("\0"))throw new Error("Arquivo CSV inválido.");
  const parsed=Papa.parse<Record<string,string>>(text,{header:true,skipEmptyLines:"greedy",dynamicTyping:false,delimitersToGuess:[";",",","\t"],transformHeader:header=>header.trim().toLowerCase()});
  const meta=parsed.meta as Papa.ParseMeta&{renamedHeaders?:Record<string,string>};
  if(parsed.errors.length||meta.renamedHeaders&&Object.keys(meta.renamedHeaders).length)throw new Error("CSV inválido: confira cabeçalho, aspas e número de colunas.");
  if(!["data","descricao","valor"].every(field=>parsed.meta.fields?.includes(field)))throw new Error("Use o modelo: data, descricao, valor, identificador.");
  return normalizeRows(parsed.data.map(row=>({data:row.data,descricao:row.descricao,valor:row.valor,identificador:row.identificador})));
}
export function validateXlsxArchive(buffer:Buffer) {
  let end=-1;
  for(let pos=buffer.length-22;pos>=Math.max(0,buffer.length-65557);pos--)if(buffer.readUInt32LE(pos)===0x06054b50){end=pos;break;}
  if(end<0)throw new Error("XLSX inválido.");
  const count=buffer.readUInt16LE(end+10),offset=buffer.readUInt32LE(end+16);
  if(count===65535||count>200||buffer.readUInt16LE(end+4)!==0||buffer.readUInt16LE(end+6)!==0)throw new Error("XLSX complexo demais; use o modelo simples.");
  let pos=offset,total=0;
  for(let index=0;index<count;index++){
    if(pos+46>end||buffer.readUInt32LE(pos)!==0x02014b50)throw new Error("Estrutura XLSX inválida.");
    const size=buffer.readUInt32LE(pos+24),nameLength=buffer.readUInt16LE(pos+28),extra=buffer.readUInt16LE(pos+30),comment=buffer.readUInt16LE(pos+32);
    total+=size;if(total>50*1024*1024||size>20*1024*1024)throw new Error("XLSX excede o limite descompactado.");
    const name=buffer.subarray(pos+46,pos+46+nameLength).toString("utf8");
    if(/vbaProject|externalLinks|activex|\.\./i.test(name))throw new Error("Use uma planilha sem macros ou vínculos externos.");
    const local=buffer.readUInt32LE(pos+42),compressedSize=buffer.readUInt32LE(pos+20),method=buffer.readUInt16LE(pos+10);
    if(buffer.readUInt16LE(pos+8)&1||local+30>offset||buffer.readUInt32LE(local)!==0x04034b50)throw new Error("XLSX criptografado ou inválido.");
    const begin=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);
    if(begin+compressedSize>offset||![0,8].includes(method))throw new Error("Compressão XLSX inválida.");
    const packed=buffer.subarray(begin,begin+compressedSize),unpacked=method===0?packed:inflateRawSync(packed,{maxOutputLength:20*1024*1024});
    if(unpacked.length!==size)throw new Error("Tamanho XLSX inconsistente.");
    if(name.endsWith(".xml")){
      const xml=unpacked.toString("utf8");
      if(/<!DOCTYPE|<!ENTITY/i.test(xml)||(xml.match(/<c[\s>]/g)?.length??0)>10000||(xml.match(/<si[\s>]/g)?.length??0)>10000)throw new Error("XML da planilha inválido ou complexo demais.");
    }
    pos+=46+nameLength+extra+comment;if(pos>end)throw new Error("Estrutura XLSX inválida.");
  }
}
async function xlsxRows(buffer:Buffer) {
  validateXlsxArchive(buffer);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  if(workbook.worksheets.length!==1)throw new Error("Use apenas uma aba na planilha.");
  const sheet=workbook.worksheets[0];if(sheet.rowCount>ROW_LIMIT+1)throw new Error("Planilha excede 1.000 movimentos.");
  const header=sheet.getRow(1).values as ExcelJS.CellValue[];
  const names=header.slice(1).map(value=>String(value??"").trim().toLowerCase());
  if(new Set(names).size!==names.length||!["data","descricao","valor"].every(field=>names.includes(field)))throw new Error("Use o cabeçalho do modelo de planilha.");
  const rows:{data:unknown;descricao:unknown;valor:unknown;identificador:unknown}[]=[];
  sheet.eachRow((row,index)=>{
    if(index===1)return;const values:Record<string,unknown>={};
    names.forEach((name,col)=>{const value=row.getCell(col+1).value;if(value!==null&&typeof value==="object"&&!(value instanceof Date))throw new Error(`Linha ${index}: use valores simples, sem fórmulas ou links.`);values[name]=value;});
    rows.push({data:values.data,descricao:values.descricao,valor:values.valor,identificador:values.identificador});
  });
  return normalizeRows(rows);
}
function xmlText(value:string):string {
  return value.replace(/&([^;]+);/g,(_,entity:string)=>{
    const entities:Record<string,string>={amp:"&",lt:"<",gt:">",quot:'"',apos:"'"};
    if(Object.hasOwn(entities,entity))return entities[entity];
    const numeric=/^#(x[\da-f]+|\d+)$/i.exec(entity);if(numeric){const code=numeric[1][0].toLowerCase()==="x"?parseInt(numeric[1].slice(1),16):Number(numeric[1]);if(code>0&&code<=0x10ffff)return String.fromCodePoint(code);}
    throw new Error("Entidade OFX inválida.");
  });
}
function tag(text:string,name:string):string {
  const matches=[...text.matchAll(new RegExp(`<${name}\\s*>\\s*([^<]*)`,"gi"))];
  if(matches.length>1)throw new Error(`Campo OFX repetido: ${name}.`);
  return matches.length?xmlText(matches[0][1].trim()):"";
}
function ofxRows(text:string,account:{numero:string;codigo_banco:string|null}) {
  if(!/<OFX[\s>]/i.test(text)||/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(text))throw new Error("OFX inválido; entidades/DOCTYPE não são permitidos.");
  if(tag(text,"CURDEF")!=="BRL")throw new Error("Importe um extrato em BRL.");
  const acct=tag(text,"ACCTID"),bank=tag(text,"BANKID");
  if(!acct||bankIdentity(acct)!==bankIdentity(account.numero)||account.codigo_banco&&bankIdentity(bank)!==bankIdentity(account.codigo_banco))throw new Error("A conta/banco do OFX não corresponde à conta selecionada.");
  const transactions=[...text.matchAll(/<STMTTRN\s*>([\s\S]*?)<\/STMTTRN\s*>/gi)];
  const rows=transactions.map((match,index)=>{
    const body=match[1],date=tag(body,"DTPOSTED"),id=tag(body,"FITID");
    if(!/^\d{8}(?:\d{6}(?:\.\d+)?(?:\[[^\]]+\])?)?$/.test(date)||!id)throw new Error(`Movimento OFX ${index+1}: data ou FITID inválido.`);
    return {data:`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`,descricao:tag(body,"MEMO")||tag(body,"NAME")||"Movimento bancário",valor:tag(body,"TRNAMT"),identificador:id,decimal:true};
  });
  return normalizeRows(rows);
}
export async function parseBankFile(name:string,buffer:Buffer,account:{numero:string;codigo_banco:string|null}) {
  if(buffer.length===0||buffer.length>FILE_LIMIT)throw new Error("Envie arquivo com até 5 MB.");
  const extension=name.split(".").at(-1)?.toLowerCase();
  if(!["csv","xlsx","ofx"].includes(extension??""))throw new Error("Use CSV, XLSX ou OFX.");
  const parsed=extension==="xlsx"?await xlsxRows(buffer):extension==="ofx"?ofxRows(decode(buffer),account):csvRows(decode(buffer));
  return {...parsed,formato:extension as "csv"|"xlsx"|"ofx",hash:createHash("sha256").update(buffer).digest("hex")};
}
