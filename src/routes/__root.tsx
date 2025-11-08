import React from "react";
import BaseLayout from "@/layouts/BaseLayout";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { UserProvider } from "@/contexts/UserContext";
import { ServerStatusProvider } from "@/contexts/ServerStatusContext";

export const RootRoute = createRootRoute({
  component: Root,
});

function Root() {
  return (
    <ServerStatusProvider>
      <UserProvider>
        <BaseLayout>
          <Outlet />
        </BaseLayout>
      </UserProvider>
    </ServerStatusProvider>
  );
}
