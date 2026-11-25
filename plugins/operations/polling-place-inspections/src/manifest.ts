import type { PluginManifest } from "@eops/plugin-sdk";
export const manifest: PluginManifest = {
  id: "polling-place-inspections",
  name: "Vistorias de Locais",
  shortName: "Vistorias",
  description:
    "Planejamento, execução e revisão das condições dos locais de votação.",
  category: "operations",
  navigationGroup: "planning",
  navigationIcon: "file-search",
  navigationOrder: 11,
  icon: "⌕",
  version: "0.1.0",
  status: "beta",
  route: "/polling-place-inspections",
  permissions: ["polling-place-inspections.read"],
};
