import type { PluginManifest } from "@eops/plugin-sdk";

export const manifest: PluginManifest = {
  id: "closure-reconciliation",
  name: "Conciliação de encerramento",
  shortName: "Encerramento",
  description:
    "Concilia ativos não devolvidos, entregas pendentes, despachos abertos e evidências faltantes antes do encerramento do pleito.",
  category: "operations",
  navigationGroup: "planning",
  navigationIcon: "clipboard-check",
  navigationOrder: 12,
  icon: "⊘",
  version: "0.1.0",
  status: "beta",
  route: "/closure-reconciliation",
  permissions: ["closure-reconciliation.read"],
};
