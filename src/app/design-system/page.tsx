import { Button } from "@/components/core/Button";
import { createClient } from "@/lib/supabase/server";

const variants = ["primary", "secondary", "outline", "ghost", "destructive", "success"] as const;
const sizes = ["sm", "md", "lg"] as const;

async function checkSupabase() {
  // Consultar uma tabela de teste inexistente confirma uma resposta da Data API:
  // se voltar PGRST205 (PostgREST: "tabela não encontrada no schema cache"), a conexão está
  // viva — chegou no banco, autenticou e o PostgREST respondeu de forma específica. Erro de
  // rede/timeout apareceria como outra coisa bem diferente (fetch failed, ECONNREFUSED etc.).
  const supabase = await createClient();
  const { error } = await supabase.from("_conexao_probe_").select("*").limit(1);
  if (error?.code === "PGRST205") return { ok: true, detail: "Data API acessível. Este teste não verifica schema, RLS ou autenticação." };
  if (error) return { ok: false, detail: "Não foi possível verificar a conexão agora." };
  return { ok: true, detail: "Conectado." };
}

export default async function DesignSystemPage() {
  const supabaseStatus = await checkSupabase();
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg-canvas)",
        padding: "var(--space-8)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-8)",
      }}
    >
      <div>
        <h1 style={{ font: "var(--type-h1)", letterSpacing: "var(--tracking-h1)", color: "var(--text-primary)", margin: 0 }}>
          Design System — checkpoint
        </h1>
        <p style={{ font: "var(--type-body)", color: "var(--text-muted)", marginTop: 8 }}>
          Button portado do protótipo. Compare com{" "}
          <code style={{ font: "var(--type-body-sm)" }}>finbast/components/core/Button.jsx</code>{" "}
          renderizado no navegador.
        </p>
      </div>

      <section
        style={{
          background: "var(--surface-card)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-card)",
          padding: "var(--card-pad-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <h2 style={{ font: "var(--type-h4)", margin: 0 }}>Variantes (size md)</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
          {variants.map((v) => (
            <Button key={v} variant={v} icon="check">
              {v}
            </Button>
          ))}
        </div>

        <h2 style={{ font: "var(--type-h4)", margin: 0 }}>Tamanhos</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {sizes.map((s) => (
            <Button key={s} size={s} icon="sparkles">
              size {s}
            </Button>
          ))}
        </div>

        <h2 style={{ font: "var(--type-h4)", margin: 0 }}>Estados</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <Button icon="download">Normal</Button>
          <Button loading>Carregando</Button>
          <Button disabled icon="lock">
            Desabilitado
          </Button>
          <Button iconRight="arrow-right">Ícone à direita</Button>
        </div>
      </section>

      <section
        style={{
          background: "var(--surface-card)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-card)",
          padding: "var(--card-pad-lg)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: supabaseStatus.ok ? "var(--success)" : "var(--error)",
            flex: "none",
          }}
        />
        <div>
          <div style={{ font: "var(--type-h5)" }}>
            Supabase {supabaseStatus.ok ? "conectado" : "com problema"}
          </div>
          <div style={{ font: "var(--type-body-sm)", color: "var(--text-muted)" }}>
            {supabaseStatus.detail}
          </div>
        </div>
      </section>
    </main>
  );
}
