import React from "react";
import BaseLayout from "@/layouts/BaseLayout";
import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { UserProvider } from "@/contexts/UserContext";
import { ServerStatusProvider } from "@/contexts/ServerStatusContext";

export const RootRoute = createRootRoute({
  component: Root,
});

function Root() {
  const isAppearanceGallery = useRouterState({
    select: state => import.meta.env.DEV && state.location.pathname === "/dev/appearance",
  });
  const content = (
    <UserProvider>
      <BaseLayout>
        <Outlet />
      </BaseLayout>
    </UserProvider>
  );
  // The synthetic gallery must remain inspectable when the clinic API is offline.
  if (isAppearanceGallery) return content;
  return (
    <ServerStatusProvider>
      {content}
    </ServerStatusProvider>
  );
}
