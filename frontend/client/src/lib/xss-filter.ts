import { FilterXSS } from "xss";

// Whitelist tag rich-text (mis. output editor novel/tiptap)
const filter = new FilterXSS({
  whiteList: {
    p: ["class", "style"],
    br: [],
    hr: [],
    span: ["class", "style"],
    div: ["class", "style"],
    h1: ["class"],
    h2: ["class"],
    h3: ["class"],
    h4: ["class"],
    strong: [],
    b: [],
    em: [],
    i: [],
    u: [],
    s: [],
    mark: ["class", "style"],
    blockquote: ["class"],
    code: ["class"],
    pre: ["class"],
    ul: ["class"],
    ol: ["class", "start"],
    li: ["class"],
    a: ["href", "target", "rel", "class"],
    img: ["src", "alt", "title", "width", "height", "class"],
    table: ["class"],
    thead: [],
    tbody: [],
    tr: [],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style"],
});

export function sanitizeHtml(html: string | null | undefined): string {
  return filter.process(html ?? "");
}
