import { FinbastIcons } from "./FinbastIcons";

export interface IconProps {
  /** Nome do ícone Finbast (kebab-case). Inexistente cai em "circle-dashed" com warn no console. */
  name: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function Icon({ name, size = 18, strokeWidth = 2, color = "currentColor", style, className }: IconProps) {
  let inner = FinbastIcons[name];
  if (!inner) {
    // ponytail: sem dedup de "já avisei esse nome" — o protótipo tinha isso, mas mutar uma
    // variável de módulo durante o render quebra a regra de pureza do React aqui (e o Icon
    // precisa continuar podendo rodar como Server Component). É warning de dev para nome
    // errado de ícone; logar de novo a cada render é barato.
    console.warn("FinbastIcons: ícone não encontrado — " + name);
    inner = FinbastIcons["circle-dashed"];
  }
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ display: "inline-flex", flex: "none", width: size, height: size, color, lineHeight: 0, ...style }}
    >
      <svg
        viewBox="0 0 24 24"
        width="100%"
        height="100%"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: inner }}
      />
    </span>
  );
}
