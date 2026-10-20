import { markReplace } from "./useFirstRoute";

export const useRouter = () => {
  const push = (path: string) => {
    if (typeof window !== "undefined") {
      // The intercepted pushState in useRoute.ts will automatically trigger path updates
      window.history.pushState(null, "", path);
    }
  };

  const replace = (path: string) => {
    if (typeof window !== "undefined") {
      // Not a navigation as far as the first-route state is concerned, see useFirstRoute.ts.
      if (path !== window.location.pathname) markReplace();
      // The intercepted replaceState in useRoute.ts will automatically trigger path updates
      window.history.replaceState(null, "", path);
    }
  };

  const back = () => {
    if (typeof window !== "undefined") {
      window.history?.back?.();
    }
  };

  return {
    push,
    replace,
    back,
  };
};
