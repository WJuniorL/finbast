import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, '../..');
const originalRepo = process.env.INBOX_SOURCE_REPO || 'C:/Projetos Claude/estallo-crm';
const output = path.join(workspace, 'public/previews/inbox-layout');
const require = createRequire(path.join(workspace, 'package.json'));
const originalRequire = createRequire(path.join(originalRepo, 'package.json'));
const pnpmPackages = await fs.readdir(path.join(originalRepo, 'node_modules/.pnpm'));
const esbuildPackage = pnpmPackages.find(name => /^esbuild@/.test(name));
if (!esbuildPackage) throw new Error('esbuild nao encontrado nas dependencias locais do CRM.');
const esbuild = require(path.join(originalRepo, 'node_modules/.pnpm', esbuildPackage, 'node_modules/esbuild/lib/main.js'));
const adapter = path.join(here, 'sidebar-adapters.tsx.txt');
const snapshots = new Map();
await fs.mkdir(output, { recursive: true });

async function snapshot(originalPath) {
  const relative = path.relative(originalRepo, originalPath).replaceAll('\\', '/');
  if (relative.startsWith('../')) throw new Error('Snapshot fora do repositorio de referencia.');
  const bytes = await fs.readFile(originalPath);
  const target = path.join(here, 'source', `${relative}.txt`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
  snapshots.set(relative, { file: relative, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });
  return bytes.toString('utf8');
}

const mockedModules = new Set([
  '@/hooks/auth/AuthProvider', '@/hooks/i18n/useT', '@/hooks/i18n/useLocaleDeData',
  '@/hooks/tasks/useTasks', '@/hooks/kanban/useBulkAction', '@/hooks/kanban/useUpdateLead',
  '@/hooks/contacts/useTagsDoContato', '@/hooks/pipelines/useDefaultPipeline',
  '@/hooks/contacts/useRoteirosDoContato', '@/components/tags/CoresDasEtiquetas',
  '@/lib/api/client', 'next/link', 'sonner',
  '@/components/kanban/LoseLeadDialog', '@/components/kanban/NewLeadDialog',
  '@/components/kanban/LeadDossierDoFunil', '@/app/app/tasks/_components/FormularioDeTarefa',
  '@/components/shell/MobileSidebar', '@/components/shell/CommandPalette',
  '@/components/shell/OrganizationTransitionProvider', '@/app/actions/shell/setActiveOrg',
  '@/app/actions/shell/toggleSidebar', '@/app/actions/settings/trocarIdioma',
  '@/hooks/ai/useAgentInbox', '@/hooks/notifications/useSonsDaCentral',
  '@/lib/i18n/IdiomaProvider', '@/lib/theme', '@/hooks/kanban/useFunisFixados',
  '@/lib/branding/contexto', '@/hooks/inbox/useConversationCounts', '@/hooks/ai/useCases',
  '@/hooks/channels/useChannelSessions', '@/hooks/system/useSystemVersion', 'next/navigation',
]);

async function resolveSource(candidate) {
  for (const extension of ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts']) {
    try { if ((await fs.stat(candidate + extension)).isFile()) return candidate + extension; } catch {}
  }
  throw new Error(`Arquivo de referencia nao encontrado: ${candidate}`);
}

await esbuild.build({
  entryPoints: [path.join(here, 'sidebar-entry.tsx.txt')],
  outfile: path.join(output, 'sidebar-runtime.js'), bundle: true, minify: true,
  format: 'iife', platform: 'browser', target: 'es2022', jsx: 'automatic',
  loader: { '.txt': 'tsx' }, define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'eof',
  plugins: [{
    name: 'original-sidebar-with-offline-data',
    setup(build) {
      build.onResolve({ filter: /.*/ }, async args => {
        if (args.pluginData?.resolved) return;
        if (mockedModules.has(args.path)) return { path: adapter };
        if (/^react(?:\/|$)|^react-dom(?:\/|$)/.test(args.path)) return { path: require.resolve(args.path) };
        if (args.path.startsWith('@/')) return { path: await resolveSource(path.join(originalRepo, args.path.slice(2))), namespace: 'original-sidebar' };
        if (args.namespace === 'original-sidebar' && args.path.startsWith('.')) {
          const filename = await resolveSource(path.resolve(path.dirname(args.importer), args.path));
          const canonical = '@/' + path.relative(originalRepo, filename).replaceAll('\\','/').replace(/\.[jt]sx?$/,'');
          if (mockedModules.has(canonical)) return { path: adapter };
          return { path: filename, namespace: 'original-sidebar' };
        }
        if (!args.path.startsWith('.') && !path.isAbsolute(args.path)) {
          const settings = { kind: args.kind, resolveDir: args.resolveDir || originalRepo, pluginData: { resolved: true } };
          let result = await build.resolve(args.path, settings);
          if (result.errors.length) result = await build.resolve(args.path, { ...settings, resolveDir: originalRepo });
          if (result.errors.length) return { path: originalRequire.resolve(args.path) };
          return result;
        }
      });
      build.onLoad({ filter: /.*/, namespace: 'original-sidebar' }, async args => ({
        contents: await snapshot(args.path), loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: path.dirname(args.path),
      }));
    },
  }],
});

const globals = await snapshot(path.join(originalRepo, 'app/globals.css'));
const scannerPath = path.join(here, 'source').replaceAll('\\', '/');
let scanned = false;
const cssInput = globals.replace(/^@source\s+"[^"]+";/gm, () => {
  if (scanned) return '';
  scanned = true;
  return `@source "${scannerPath}";`;
});
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const css = await postcss([tailwind()]).process(cssInput, { from: path.join(originalRepo, 'app/globals.css'), map: false });
await fs.writeFile(path.join(output, 'sidebar-original.css'), css.css);
await fs.copyFile(path.join(originalRepo, 'app/fonts/manrope-200-800-latin.woff2'), path.join(output, 'manrope.woff2'));
await fs.copyFile(path.join(originalRepo, 'app/fonts/manrope-OFL.txt'), path.join(output, 'manrope-OFL.txt'));
await fs.copyFile(path.join(originalRepo, 'LICENSE'), path.join(output, 'LICENSE-sidebar.txt'));
await fs.writeFile(path.join(output, 'source-manifest.json'), JSON.stringify({
  source: 'estallo-crm', generated: new Date().toISOString(),
  note: 'Componentes e tokens copiados byte a byte. Somente dados, autenticacao e destinos de acoes externas usam adaptadores locais de demonstracao.',
  files: [...snapshots.values()].sort((a, b) => a.file.localeCompare(b.file)),
}, null, 2) + '\n');
console.log(JSON.stringify({ copiedOriginalFiles: snapshots.size, output: path.relative(workspace, output), sidebarBytes: (await fs.stat(path.join(output, 'sidebar-runtime.js'))).size }));
