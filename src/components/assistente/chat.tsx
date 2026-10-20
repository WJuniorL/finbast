"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { confirmarProposta, perguntar, type Resposta } from "@/app/empresas/[id]/assistente/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Item = { role: "user" | "assistant"; texto: string; resposta?: Resposta; estado?: "pendente" | "confirmada" | "descartada"; aviso?: string };

export function Chat({ empresaId, somenteLeitura }: { empresaId: string; somenteLeitura: boolean }) {
  const [itens, setItens] = useState<Item[]>([]), [texto, setTexto] = useState(""), [pending, start] = useTransition();
  const fim = useRef<HTMLDivElement>(null);
  const historico = (lista: Item[]) => lista.slice(-6).map((i) => ({ role: i.role, content: i.texto.slice(0, 1500) }));

  function enviar(pergunta: string, semAjuda = false, base: Item[] = itens) {
    const comPergunta: Item[] = semAjuda ? base : [...base, { role: "user", texto: pergunta }];
    setItens(comPergunta);
    start(async () => {
      const resposta = await perguntar(empresaId, { pergunta, semAjuda, historico: historico(semAjuda ? base.slice(0, -1) : base) });
      setItens([...comPergunta, { role: "assistant", texto: resposta.texto, resposta, estado: resposta.proposta ? "pendente" : undefined }]);
      setTimeout(() => fim.current?.scrollIntoView({ block: "end" }), 0);
    });
  }
  const atualizar = (indice: number, mudanca: Partial<Item>) => setItens((atual) => atual.map((i, n) => (n === indice ? { ...i, ...mudanca } : i)));
  function confirmar(indice: number) {
    const proposta = itens[indice]?.resposta?.proposta;
    if (!proposta) return;
    start(async () => {
      const r = await confirmarProposta(empresaId, proposta.proposta);
      atualizar(indice, r.ok ? { estado: "confirmada", aviso: r.mensagem } : { aviso: r.mensagem });
    });
  }

  return <div className="space-y-4">
    <div className="space-y-3" aria-live="polite">
      {itens.length === 0 && <p className="text-sm text-muted-foreground">Pergunte como usar o sistema ou sobre os dados desta conta{somenteLeitura ? "" : ", ou peça para criar um lançamento ou cadastro"}.</p>}
      {itens.map((item, n) => <div key={n} className={item.role === "user" ? "ml-auto max-w-[85%] rounded-lg bg-primary p-3 text-primary-foreground" : "max-w-[85%] space-y-3 rounded-lg border p-3"}>
        <p className="whitespace-pre-wrap text-sm">{item.texto}</p>
        {item.resposta?.link && <Link className="block text-sm underline" href={item.resposta.link.href}>{item.resposta.link.rotulo}</Link>}
        {item.resposta?.daAjuda && n === itens.length - 1 && <Button variant="outline" size="sm" disabled={pending} onClick={() => enviar(itens[n - 1].texto, true, itens.slice(0, n))}>Perguntar ao assistente</Button>}
        {item.resposta?.proposta && <div className="space-y-2 rounded-md border bg-muted p-3 text-sm" data-testid="proposta">
          <p className="font-medium">{item.resposta.proposta.titulo}</p>
          <ul>{item.resposta.proposta.linhas.map((l) => <li key={l}>{l}</li>)}</ul>
          {item.estado === "pendente" && <div className="flex flex-wrap gap-2"><Button size="sm" disabled={pending} onClick={() => confirmar(n)}>Confirmar e criar</Button><Button size="sm" variant="outline" disabled={pending} onClick={() => atualizar(n, { estado: "descartada", aviso: "Proposta descartada." })}>Descartar</Button></div>}
          {item.estado === "confirmada" && <p role="status" className="text-success">{item.aviso}</p>}
          {item.estado === "descartada" && <p className="text-muted-foreground">{item.aviso}</p>}
          {item.estado === "pendente" && item.aviso && <p role="alert" className="text-destructive">{item.aviso}</p>}
        </div>}
      </div>)}
      {pending && <p className="text-sm text-muted-foreground" role="status">Pensando…</p>}
      <div ref={fim} />
    </div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); const p = texto.trim(); if (!p || pending) return; setTexto(""); enviar(p); }}>
      <div className="min-w-64 flex-1 space-y-2"><Label htmlFor="assistente-pergunta">Sua pergunta</Label><Input id="assistente-pergunta" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} autoComplete="off" /></div>
      <Button type="submit" disabled={pending || !texto.trim()}>Perguntar</Button>
    </form>
  </div>;
}
