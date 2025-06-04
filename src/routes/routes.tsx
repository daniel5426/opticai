import { createRoute } from "@tanstack/react-router";
import { RootRoute } from "./__root";
import HomePage from "../pages/HomePage";
import SecondPage from "@/pages/SecondPage";
import ClientsPage from "@/pages/ClientsPage";
import ClientDetailPage from "@/pages/ClientDetailPage";
import NewClientPage from "@/pages/NewClientPage";
import ExamDetailPage from "@/pages/ExamDetailPage";
import ExamCreatePage from "@/pages/ExamCreatePage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import OrderCreatePage from "@/pages/OrderCreatePage";

// TODO: Steps to add a new route:
// 1. Create a new page component in the '../pages/' directory (e.g., NewPage.tsx)
// 2. Import the new page component at the top of this file
// 3. Define a new route for the page using createRoute()
// 4. Add the new route to the routeTree in RootRoute.addChildren([...])
// 5. Add a new Link in the navigation section of RootRoute if needed

// Example of adding a new route:
// 1. Create '../pages/NewPage.tsx'
// 2. Import: import NewPage from '../pages/NewPage';
// 3. Define route:
//    const NewRoute = createRoute({
//      getParentRoute: () => RootRoute,
//      path: '/new',
//      component: NewPage,
//    });
// 4. Add to routeTree: RootRoute.addChildren([HomeRoute, NewRoute, ...])
// 5. Add Link: <Link to="/new">New Page</Link>

export const HomeRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/",
  component: HomePage,
});

export const SecondPageRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/second-page",
  component: SecondPage,
});

export const ClientsRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/clients",
  component: ClientsPage,
});

export const NewClientRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/clients/new",
  component: NewClientPage,
});

export const ClientDetailRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/clients/$clientId",
  component: ClientDetailPage,
});

export const ExamDetailRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/clients/$clientId/exams/$examId",
  component: ExamDetailPage,
});

export const ExamCreateRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/clients/$clientId/exams/new",
  component: ExamCreatePage,
});

export const OrderDetailRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/clients/$clientId/orders/$orderId",
  component: OrderDetailPage,
});

export const OrderCreateRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/clients/$clientId/orders/new",
  component: OrderCreatePage,
});

export const rootTree = RootRoute.addChildren([
  HomeRoute,
  SecondPageRoute,
  ClientsRoute,
  NewClientRoute,
  ClientDetailRoute,
  ExamDetailRoute,
  ExamCreateRoute,
  OrderDetailRoute,
  OrderCreateRoute,
]);
