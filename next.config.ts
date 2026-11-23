import type { NextConfig } from "next";

// CSP fica no src/proxy.ts (precisa de nonce por requisição).
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // SAMEORIGIN: as prévias estáticas em public/previews usam iframe da mesma origem. As páginas
  // do app continuam inembutíveis pelo frame-ancestors 'none' da CSP (que prevalece).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Embutido no bundle no build: servidor e navegador da mesma versão têm o mesmo valor.
  // O aviso de nova versão compara o do navegador com o de /api/versao.
  env: { FINBAST_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now()) },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
