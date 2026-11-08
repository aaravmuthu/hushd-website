// The shared site script (plain DOM code). Only what the React side calls is typed here.
export function mountPage(load: () => Promise<{ mount?: (page: unknown) => void }>, el: HTMLElement, html?: string): () => void;
