import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { rootTree } from "./routes";

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Create the memory history with error handling
const history = createMemoryHistory({
  initialEntries: ["/"],
});

// Create router with error handlers
export const router = createRouter({ 
  routeTree: rootTree, 
  history: history,
  defaultErrorComponent: ({ error }) => {
    console.error('Router error:', error);
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Navigation Error</h2>
        <p>There was a problem loading this page.</p>
        <button 
          onClick={() => window.location.reload()}
          style={{ padding: '8px 16px', marginTop: '16px', cursor: 'pointer' }}
        >
          Try Again
        </button>
      </div>
    );
  },
  defaultPreloadStaleTime: 0,
  defaultStaleTime: 0,
});
