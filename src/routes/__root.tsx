import React from "react";
import BaseLayout from "@/layouts/BaseLayout";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { UserProvider } from "@/contexts/UserContext";

export const RootRoute = createRootRoute({
  component: Root,
});

function Root() {
  return (
    <UserProvider>
      <BaseLayout>
        <Outlet />
      </BaseLayout>
    </UserProvider>
  );
}
