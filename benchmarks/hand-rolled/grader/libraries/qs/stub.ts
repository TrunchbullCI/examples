export type Format = "RFC1738" | "RFC3986" | "WHATWG"
export type DefaultDecoder = (str: string, defaultDecoder?: unknown, charset?: string) => string
export type DefaultEncoder = (str: unknown, defaultEncoder?: unknown, charset?: string, type?: "key" | "value", format?: Format) => string

export interface ParseOptions {
  allowDots?: boolean
  allowEmptyArrays?: boolean
  allowPrototypes?: boolean
  allowSparse?: boolean
  arrayLimit?: number
  charset?: "utf-8" | "iso-8859-1"
  charsetSentinel?: boolean
  comma?: boolean
  decodeDotInKeys?: boolean
  decoder?: (str: string, defaultDecoder: DefaultDecoder, charset: string, type: "key" | "value") => unknown
  delimiter?: string | RegExp
  depth?: number | false
  duplicates?: "combine" | "first" | "last"
  ignoreQueryPrefix?: boolean
  interpretNumericEntities?: boolean
  parameterLimit?: number
  parseArrays?: boolean
  plainObjects?: boolean
  strictDepth?: boolean
  strictMerge?: boolean
  strictNullHandling?: boolean
  throwOnLimitExceeded?: boolean
}

export interface StringifyOptions {
  addQueryPrefix?: boolean
  allowDots?: boolean
  allowEmptyArrays?: boolean
  arrayFormat?: "indices" | "brackets" | "repeat" | "comma"
  charset?: "utf-8" | "iso-8859-1"
  charsetSentinel?: boolean
  commaRoundTrip?: boolean
  delimiter?: string
  depth?: number
  encode?: boolean
  encodeDotInKeys?: boolean
  encoder?: (str: unknown, defaultEncoder: DefaultEncoder, charset: string, type: "key" | "value", format: Format) => string
  encodeValuesOnly?: boolean
  filter?: Array<string | number> | ((prefix: string, value: any) => any)
  format?: Format
  indices?: boolean
  serializeDate?: (date: Date) => string
  skipNulls?: boolean
  sort?: (a: string, b: string) => number
  strictNullHandling?: boolean
}

export const formats: {
  default: "RFC3986"
  RFC1738: "RFC1738"
  RFC3986: "RFC3986"
  WHATWG: "WHATWG"
  formatters: Record<Format, (value: string) => string>
} = {
  default: "RFC3986",
  RFC1738: "RFC1738",
  RFC3986: "RFC3986",
  WHATWG: "WHATWG",
  formatters: {
    RFC1738: (value: string): string => {
      void value
      throw new Error("not implemented")
    },
    RFC3986: (value: string): string => {
      void value
      throw new Error("not implemented")
    },
    WHATWG: (value: string): string => {
      void value
      throw new Error("not implemented")
    },
  },
}

export function parse(str: string | Record<string, unknown> | null | undefined, options?: ParseOptions): Record<string, unknown> {
  void str
  void options
  throw new Error("not implemented")
}

export function stringify(object: unknown, options?: StringifyOptions): string {
  void object
  void options
  throw new Error("not implemented")
}
