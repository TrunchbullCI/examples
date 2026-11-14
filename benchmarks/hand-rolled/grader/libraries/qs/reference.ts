import qs from "qs"

export const parse = qs.parse
export const stringify = qs.stringify
export const formats = (qs as unknown as { formats: { default: "RFC3986"; RFC1738: "RFC1738"; RFC3986: "RFC3986"; WHATWG: "WHATWG"; formatters: Record<"RFC1738" | "RFC3986" | "WHATWG", (value: string) => string> } }).formats
