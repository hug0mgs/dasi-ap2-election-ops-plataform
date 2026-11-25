import type { PlatformPlugin } from "@eops/plugin-sdk";
import { manifest } from "./manifest";
import { InspectionsDashboardPage } from "./client/pages/InspectionsDashboardPage";
import { InspectionsListPage } from "./client/pages/InspectionsListPage";
import { NewInspectionPage } from "./client/pages/NewInspectionPage";
import { InspectionDetailPage } from "./client/pages/InspectionDetailPage";
import { InspectionFindingsPage } from "./client/pages/InspectionFindingsPage";
import { InspectionHistoryPage } from "./client/pages/InspectionHistoryPage";
export * from "./types";
export const pollingPlaceInspectionsPlugin: PlatformPlugin = {
  manifest,
  View: InspectionsDashboardPage,
  routes: [
    { path: "/polling-place-inspections", Component: InspectionsDashboardPage },
    { path: "/polling-place-inspections/list", Component: InspectionsListPage },
    { path: "/polling-place-inspections/new", Component: NewInspectionPage },
    { path: "/polling-place-inspections/:id", Component: InspectionDetailPage },
    {
      path: "/polling-place-inspections/:id/findings",
      Component: InspectionFindingsPage,
    },
    {
      path: "/polling-place-inspections/:id/history",
      Component: InspectionHistoryPage,
    },
  ],
};
