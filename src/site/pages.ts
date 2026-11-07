// Each page's script, loaded on demand. The nav preloads the next one as the pointer heads for its link.
type PageModule = { mount?: (page: unknown) => void };
export const PAGES: Record<string, () => Promise<PageModule>> = {
  "/": () => import("./home.js"),
  "/how-it-works": () => import("./how.js"),
  "/features": () => import("./features.js"),
  "/privacy": () => import("./privacy.js"),
  "/download": () => import("./download.js"),
};
