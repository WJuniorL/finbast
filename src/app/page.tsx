export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-4)",
        background: "var(--bg-canvas)",
        color: "var(--text-primary)",
        font: "var(--type-body)",
        textAlign: "center",
        padding: "var(--space-8)",
      }}
    >
      <h1 style={{ font: "var(--type-h1)", letterSpacing: "var(--tracking-h1)", margin: 0 }}>
        Finbast
      </h1>
      <p style={{ color: "var(--text-muted)", margin: 0 }}>
        Sistema em construção — nada aqui ainda. Confira{" "}
        <a href="/design-system">/design-system</a> para o checkpoint do design system portado.
      </p>
    </main>
  );
}
