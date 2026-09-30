# Finbast

Sistema financeiro que substitui um BPO financeiro: o empresário administra CPF e CNPJs num só
lugar; o contador gerencia a carteira de clientes de graça, como canal de aquisição.

Em construção — ver [`prd.md`](./prd.md) (o que) e [`plan.md`](./plan.md) (em que ordem, e o
que já está pronto).

## Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript)
- [Supabase](https://supabase.com) (Postgres, Auth)
- Tailwind v4, sobre os design tokens em `src/styles/tokens/`

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com as credenciais do projeto Supabase
npm run dev
```

Abre em [http://localhost:3000](http://localhost:3000). `/design-system` mostra os componentes
do design system já portados, lado a lado com o protótipo original.

## Verificação antes de qualquer entrega

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Protótipo de referência

As telas e o design system têm origem num protótipo clicável (HTML estático, sem backend) em
`C:\Projetos Claude\finbast` — usado como maquete visual, não como código a copiar.
