import type { PlatformPlugin } from "@eops/plugin-sdk";
import { manifest } from "./manifest";
import { ClosureDashboardPage } from "./client/pages/ClosureDashboardPage";
import { ClosureListPage } from "./client/pages/ClosureListPage";
import { NewClosurePage } from "./client/pages/NewClosurePage";
import { ClosureDetailPage } from "./client/pages/ClosureDetailPage";
import { ClosureExceptionsPage } from "./client/pages/ClosureExceptionsPage";
import { ClosureHistoryPage } from "./client/pages/ClosureHistoryPage";

export * from "./types";

export const closureReconciliationPlugin: PlatformPlugin = {
  manifest,
  View: ClosureDashboardPage,
  routes: [
    { path: "/closure-reconciliation", Component: ClosureDashboardPage },
    { path: "/closure-reconciliation/list", Component: ClosureListPage },
    { path: "/closure-reconciliation/new", Component: NewClosurePage },
    { path: "/closure-reconciliation/:id", Component: ClosureDetailPage },
    {
      path: "/closure-reconciliation/:id/exceptions",
      Component: ClosureExceptionsPage,
    },
    {
      path: "/closure-reconciliation/:id/history",
      Component: ClosureHistoryPage,
    },
  ],
};
