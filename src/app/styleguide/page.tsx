import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { tokenGroups } from "./tokens";

function Swatch({ name, value }: { name: string; value?: string }) {
  return <div className="overflow-hidden rounded-lg border bg-card"><div className="h-16 border-b" style={{ background: `var(${name})` }} /><div className="space-y-1 p-3"><code className="block break-all text-[11px]">{name}</code>{value && <span className="block break-all text-xs text-muted-foreground">{value}</span>}</div></div>;
}

export default function StyleguidePage() {
  const colors = tokenGroups.find((group) => group.name === "colors")!;
  const typography = tokenGroups.find((group) => group.name === "typography")!;
  const spacing = tokenGroups.find((group) => group.name === "spacing")!;
  const effects = tokenGroups.find((group) => group.name === "effects")!;
  return <>
    <div className="space-y-3"><Badge variant="secondary">Finbast + shadcn/ui</Badge><h1 className="text-4xl font-extrabold tracking-tight">Uma base para cada tela.</h1><p className="max-w-2xl text-muted-foreground">Vermelho de marca, superfícies neutras e tipografia clara. Os tokens existentes orientam os novos componentes.</p></div>
    <section id="cores" className="scroll-mt-6 space-y-6"><h2 className="text-2xl font-bold">Cores</h2>
      {["red", "gray", "ink", "green", "amber", "blue"].map((prefix) => <div key={prefix} className="space-y-3"><h3 className="font-semibold capitalize">{prefix === "red" ? "Marca · vermelho" : prefix === "gray" ? "Neutros" : prefix}</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">{colors.tokens.filter((token) => token.name.startsWith(`--${prefix}-`)).map((token) => <Swatch key={token.name} {...token} />)}</div></div>)}
      <h3 className="font-semibold">Papéis semânticos Finbast</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{colors.tokens.filter((token) => !/^--(red|gray|ink|green|amber|blue)-/.test(token.name) && token.name !== "--focus-ring").map((token) => <Swatch key={token.name} {...token} />)}</div>
      <h3 className="font-semibold">Papéis shadcn/ui · tema atual</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{["background","foreground","card","card-foreground","popover","popover-foreground","primary","primary-foreground","secondary","secondary-foreground","muted","muted-foreground","accent","accent-foreground","destructive","destructive-foreground","border","input","ring","chart-1","chart-2","chart-3","chart-4","chart-5","sidebar","sidebar-foreground","sidebar-primary","sidebar-primary-foreground","sidebar-accent","sidebar-accent-foreground","sidebar-border","sidebar-ring","success","success-foreground","warning","warning-foreground","info","info-foreground"].map((name) => <Swatch key={name} name={`--${name}`} />)}</div>
    </section>
    <section id="tipografia" className="scroll-mt-6 space-y-6"><h2 className="text-2xl font-bold">Tipografia</h2><p className="text-muted-foreground">Manrope · interface / JetBrains Mono · código</p><Card><CardContent className="space-y-6 pt-6">{typography.tokens.filter((token) => token.name.startsWith("--type-")).map((token) => <div key={token.name} className="space-y-2"><code className="text-xs text-muted-foreground">{token.name} · {token.value}</code><p style={{ font: `var(${token.name})` }} className="break-words">{token.name.includes("kpi") ? "R$ 24.680,00" : "Clareza para decidir o próximo passo."}</p></div>)}<p className="font-mono">0123456789 · R$ 1.234,56</p><div className="space-y-1">{typography.tokens.filter((token) => !token.name.startsWith("--type-")).map((token) => <code key={token.name} className="block break-all text-xs text-muted-foreground">{token.name}: {token.value}</code>)}</div></CardContent></Card></section>
    <section id="espacamento" className="scroll-mt-6 space-y-6"><h2 className="text-2xl font-bold">Espaçamento e dimensões</h2><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{spacing.tokens.map((token) => <div key={token.name} className="min-w-0 rounded-lg border bg-card p-4"><code className="text-xs">{token.name} · {token.value}</code><div className="mt-3 h-3 max-w-full rounded bg-primary" style={{ width: `var(${token.name})` }} /></div>)}</div></section>
    <section id="efeitos" className="scroll-mt-6 space-y-6"><h2 className="text-2xl font-bold">Raios, sombras e movimento</h2><div className="grid gap-6 sm:grid-cols-3">{effects.tokens.map((token) => <div key={token.name} className="flex min-h-24 items-center justify-center border bg-card p-4" style={{ borderRadius: token.name.startsWith("--radius") ? `var(${token.name})` : undefined, boxShadow: token.name.startsWith("--shadow") ? `var(${token.name})` : undefined }}><code className="break-all text-xs">{token.name}<br />{token.value}</code></div>)}</div><code className="text-xs">--focus-ring: {colors.tokens.find((token) => token.name === "--focus-ring")?.value}</code></section>
    <section id="componentes" className="scroll-mt-6 space-y-6"><h2 className="text-2xl font-bold">Primitivas shadcn/ui</h2><Card><CardHeader><CardTitle>Componentes com a identidade Finbast</CardTitle><CardDescription>Interações, estados e campos para as próximas telas.</CardDescription></CardHeader><CardContent className="space-y-6">
      <div className="flex flex-wrap gap-3"><Button>Continuar</Button><Button variant="secondary">Secundário</Button><Button variant="outline">Contorno</Button><Button variant="ghost">Discreto</Button><Button variant="destructive">Excluir</Button><Button disabled>Indisponível</Button></div>
      <div className="flex flex-wrap items-center gap-3"><Button size="sm">Pequeno</Button><Button>Padrão</Button><Button size="lg">Grande</Button><Button className="rounded-full">Pill</Button></div>
      <div className="flex flex-wrap gap-3"><Badge>Principal</Badge><Badge variant="secondary">Secundário</Badge><Badge variant="outline">Contorno</Badge><Badge variant="destructive">Atenção</Badge></div>
      <Alert><AlertTitle>Pronto para começar</AlertTitle><AlertDescription>Cadastre sua primeira empresa para organizar os acessos.</AlertDescription></Alert>
      <Alert variant="destructive"><AlertTitle>Confira os dados</AlertTitle><AlertDescription>Revise o documento informado antes de continuar.</AlertDescription></Alert>
      <div className="max-w-sm space-y-2"><Label htmlFor="demo-input">Nome da empresa</Label><Input id="demo-input" placeholder="Sua empresa" /></div>
      <fieldset><legend className="mb-3 text-sm font-medium">Tipo de conta</legend><RadioGroup defaultValue="empresa" className="flex gap-6"><div className="flex items-center gap-2"><RadioGroupItem value="empresa" id="demo-empresa" /><Label htmlFor="demo-empresa">Empresa</Label></div><div className="flex items-center gap-2"><RadioGroupItem value="pessoal" id="demo-pessoal" /><Label htmlFor="demo-pessoal">Pessoal</Label></div></RadioGroup></fieldset>
    </CardContent></Card></section>
  </>;
}
