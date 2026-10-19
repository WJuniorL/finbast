export interface NavSection { title: string; items: { name: string; href: string }[] }
export const navigation: NavSection[] = [
  { title: "Fundação", items: [
    { name: "Cores", href: "/styleguide#cores" },
    { name: "Tipografia", href: "/styleguide#tipografia" },
    { name: "Espaçamento", href: "/styleguide#espacamento" },
    { name: "Raios e sombras", href: "/styleguide#efeitos" },
  ] },
  { title: "Componentes", items: [{ name: "Primitivas shadcn/ui", href: "/styleguide#componentes" }] },
];
