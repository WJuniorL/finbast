import {test} from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {parseBankFile,validateXlsxArchive,FILE_LIMIT} from "../src/lib/bank-import.ts";
import {signedCentavos,contaBancariaSchema} from "../src/lib/bancos.ts";
const account={numero:"12345-6",codigo_banco:"001"};
const csv='data;descricao;valor;identificador\r\n31/01/2026;"Saída; serviço";-100,01;debito-1\r\n2026-01-31;Recebimento;200,00;credito-1\r\n';
test("CSV preserva centavos, aspas, sinais e identificadores",async()=>{
 const parsed=await parseBankFile("extrato.csv",Buffer.from(csv),account);assert.equal(parsed.rows[0].valor_centavos,-10001);assert.equal(parsed.rows[0].descricao,"Saída; serviço");assert.equal(parsed.rows[1].valor_centavos,20000);assert.equal(parsed.rows[0].chave,"id:debito-1");assert.equal(parsed.warning,null);
});
test("CSV sem identificador preserva movimentos iguais e sinaliza ambiguidade",async()=>{
 const content="data;descricao;valor\n31/01/2026;Tarifa;-1,00\n31/01/2026;Tarifa;-1,00";
 const parsed=await parseBankFile("extrato.csv",Buffer.from(content),account),again=await parseBankFile("extrato.csv",Buffer.from(content),account);
 assert.notEqual(parsed.rows[0].chave,parsed.rows[1].chave);assert.deepEqual(parsed.rows,again.rows);assert.ok(parsed.warning);
});
test("CSV invalido nao libera lote parcial",async()=>{
 for(const value of [csv.replace("-100,01","0,00"),csv.replace("credito-1","debito-1"),csv.replace("31/01/2026","31/02/2026"),csv.replace("data;","outra;"),csv+'2026-01-31;Linha errada;-1,001;novo'])await assert.rejects(parseBankFile("teste.csv",Buffer.from(value),account));
 await assert.rejects(parseBankFile("arquivo.exe",Buffer.from(csv),account));await assert.rejects(parseBankFile("arquivo.csv",Buffer.alloc(FILE_LIMIT+1),account));
});
function ofx(xml:boolean){return `${xml?'<?xml version="1.0"?>':'OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n\n'}<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL${xml?'</CURDEF>':''}<BANKACCTFROM><BANKID>001${xml?'</BANKID>':''}<ACCTID>12345-6${xml?'</ACCTID>':''}</BANKACCTFROM><BANKTRANLIST><STMTTRN><DTPOSTED>20260131120000[-3:BRT]${xml?'</DTPOSTED>':''}<TRNAMT>-100.01${xml?'</TRNAMT>':''}<FITID>ofx-1${xml?'</FITID>':''}<MEMO>Serviço &amp; tarifa${xml?'</MEMO>':''}</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;}
test("OFX XML e SGML normalizam data, FITID e valor decimal",async()=>{
 for(const xml of [true,false]){const parsed=await parseBankFile("extrato.ofx",Buffer.from(ofx(xml)),account);assert.equal(parsed.rows[0].valor_centavos,-10001);assert.equal(parsed.rows[0].data_movimento,"2026-01-31");assert.equal(parsed.rows[0].descricao,"Serviço & tarifa");}
});
test("OFX rejeita entidades, moeda, conta errada e multi-conta",async()=>{
 for(const value of [ofx(true).replace("BRL","USD"),ofx(true).replace("12345-6","9999"),ofx(true).replace("<OFX>",'<!DOCTYPE OFX [<!ENTITY x SYSTEM "file:///x">]><OFX>'),ofx(true).replace("<BANKACCTFROM>","<ACCTID>12345-6</ACCTID><BANKACCTFROM>")])await assert.rejects(parseBankFile("extrato.ofx",Buffer.from(value),account));
});
test("XLSX aceita datas/valores Excel e recusa formulas e ZIP invalido",async()=>{
 const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet("Extrato");sheet.addRow(["data","descricao","valor","identificador"]);sheet.addRow([new Date("2026-01-31T00:00:00Z"),"Venda",123.45,"xlsx-1"]);sheet.getCell("A2").numFmt="dd/mm/yyyy";
 const parsed=await parseBankFile("extrato.xlsx",Buffer.from(await workbook.xlsx.writeBuffer()),account);assert.equal(parsed.rows[0].valor_centavos,12345);assert.equal(parsed.rows[0].data_movimento,"2026-01-31");
 sheet.getCell("C2").value={formula:"1+1",result:2};await assert.rejects(parseBankFile("extrato.xlsx",Buffer.from(await workbook.xlsx.writeBuffer()),account));assert.throws(()=>validateXlsxArchive(Buffer.from("not a zip")));
});
test("conta bancaria aceita saldo negativo exato e recusa data futura",()=>{
 assert.equal(signedCentavos("-1.234,56"),-123456);assert.equal(contaBancariaSchema.safeParse({nome:"Conta",banco:"Banco",codigo_banco:"",agencia:"",numero:"123",saldo_inicial_centavos:"-1,00",data_saldo_inicial:"2100-01-01"}).success,false);
});
test("XLSX recusa metadados adulterados de descompactação",async()=>{
 const workbook=new ExcelJS.Workbook();workbook.addWorksheet("Extrato").addRow(["data","descricao","valor"]);
 const buffer=Buffer.from(await workbook.xlsx.writeBuffer());
 let end=-1;for(let pos=buffer.length-22;pos>=0;pos--)if(buffer.readUInt32LE(pos)===0x06054b50){end=pos;break;}
 assert.ok(end>=0);const directory=buffer.readUInt32LE(end+16);
 let entry=directory;while(buffer.readUInt32LE(entry+24)===0)entry+=46+buffer.readUInt16LE(entry+28)+buffer.readUInt16LE(entry+30)+buffer.readUInt16LE(entry+32);
 buffer.writeUInt32LE(1,entry+24);assert.throws(()=>validateXlsxArchive(buffer),/inconsistente/);
});
