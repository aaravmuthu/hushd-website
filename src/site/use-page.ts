// Mounts a page's script once its markup is in the document, and stops it when the page leaves.
// site.js touches the DOM as it loads, so it is imported here, in the browser, never on the server.
import { useEffect, useRef } from "react";
import { PAGES } from "./pages";

export function usePage(path: string, html: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    void import("./site.js").then(({ mountPage }) => {
      const load = PAGES[path];
      if (!dead && ref.current && load) off = mountPage(load, ref.current, html);
    });
    return () => { dead = true; off?.(); };
  }, [path, html]);
  return ref;
}
