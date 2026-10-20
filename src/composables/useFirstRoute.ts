import { ref, watch } from "vue";
import { path } from "./useRouteObserver";

const isFirstRoute = ref(true);
let hasNavigated = false;
let replacing = false;

/**
 * A `replace` swaps the URL without leaving an entry to go back through, so
 * it must not count as having navigated: a book opened cold closes onto
 * /library by replacing itself, and the header's back button on that page
 * has to know there is still nothing behind it and go home rather than call
 * history.back(), which would leave the site. useRouter.replace calls this.
 */
export const markReplace = () => {
  replacing = true;
};

export function useFirstRoute() {
  watch(path, (newPath, oldPath) => {
    if (replacing) {
      replacing = false;
      return;
    }
    if (!hasNavigated && newPath !== oldPath) {
      hasNavigated = true;
      isFirstRoute.value = false;
    }
  });

  return {
    isFirstRoute,
  };
}
