import {z} from "zod";
import {revalidatePath} from "next/cache";
import {requireEmpresa} from "@/lib/empresa";
import {FILE_LIMIT,parseBankFile} from "@/lib/bank-import";
const BODY_LIMIT=6*1024*1024;
const reply=(body:Record<string,unknown>,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});

export async function POST(request:Request,{params}:{params:Promise<{id:string;conta:string}>}){
 if(request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"Origem da solicitação inválida."},403);
 const {id,conta}=await params;
 if(!z.string().uuid().safeParse(conta).success)return reply({error:"Conta inválida."},404);
 const {empresa,supabase,canEdit}=await requireEmpresa(id);
 if(!canEdit)return reply({error:"Seu acesso permite somente consultar."},403);
 const account=await supabase.from("contas_bancarias").select("numero,codigo_banco,ativo").eq("empresa_id",empresa.id).eq("id",conta).maybeSingle();
 if(account.error||!account.data?.ativo)return reply({error:"A conta está arquivada ou indisponível."},409);
 if(Number(request.headers.get("content-length"))>BODY_LIMIT)return reply({error:"Envie arquivo com até 5 MB."},413);
 const reader=request.body?.getReader();if(!reader)return reply({error:"Envie um arquivo."},400);
 const chunks:Uint8Array[]=[];let size=0;
 try{
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>BODY_LIMIT){await reader.cancel();return reply({error:"Envie arquivo com até 5 MB."},413);}chunks.push(part.value);}
  const multipart=new Request(request.url,{method:"POST",headers:{"content-type":request.headers.get("content-type")??""},body:new Uint8Array(Buffer.concat(chunks))});
  const form=await multipart.formData(),file=form.get("arquivo");
  if(!file||typeof file==="string"||!file.size||file.size>FILE_LIMIT)return reply({error:"Envie CSV, XLSX ou OFX com até 5 MB."},400);
  const parsed=await parseBankFile(file.name,Buffer.from(await file.arrayBuffer()),account.data);
  const {data,error}=await supabase.rpc("previa_importacao",{p_empresa:empresa.id,p_conta:conta,p_nome:file.name.replace(/^.*[\\/]/,"").slice(0,160),p_formato:parsed.formato,p_hash:parsed.hash,p_linhas:parsed.rows});
  if(error)return reply({error:"Não foi possível criar a prévia. Confira os dados e tente novamente."},400);
  if(data?.codigo!=="ok")return reply({error:data?.codigo==="conta_inativa"?"A conta está arquivada ou indisponível.":"Confira datas (a partir do saldo inicial, até hoje), valores e identificadores do arquivo."},400);
  revalidatePath(`/empresas/${empresa.id}/bancos/${conta}`);
  return reply({id:data.id});
 }catch(error){return reply({error:error instanceof Error?error.message:"Não foi possível ler o arquivo."},400);}
 finally{reader.releaseLock();}
}
