"use client";
import { Button } from "@/components/ui/button";
export default function EmpresasError({ reset }: { reset: () => void }) {
  return <div className="space-y-4"><h1 className="text-xl font-bold">Não foi possível carregar esta conta</h1><p className="text-muted-foreground">Tente novamente em alguns instantes.</p><Button onClick={reset}>Tentar novamente</Button></div>;
}
