export interface Arguments {
  _: (string | number)[]
  "--"?: (string | number)[]
  [argName: string]: any
}

export interface Configuration {
  "boolean-negation": boolean
  "camel-case-expansion": boolean
  "dot-notation": boolean
  "duplicate-arguments-array": boolean
  "flatten-duplicate-arrays": boolean
  "greedy-arrays": boolean
  "halt-at-non-option": boolean
  "nargs-eats-options": boolean
  "negation-prefix": string
  "parse-numbers": boolean
  "parse-positional-numbers": boolean
  "populate--": boolean
  "set-placeholder-key": boolean
  "short-option-groups": boolean
  "strip-aliased": boolean
  "strip-dashed": boolean
  "unknown-options-as-args": boolean
}

export type ArrayOption = string | { key: string; boolean?: boolean; string?: boolean; number?: boolean }

export interface Options {
  alias?: Record<string, string | string[]>
  array?: ArrayOption | ArrayOption[]
  boolean?: string | string[]
  coerce?: Record<string, (arg: any) => any>
  count?: string | string[]
  default?: Record<string, any>
  narg?: Record<string, number>
  normalize?: string | string[]
  number?: string | string[]
  string?: string | string[]
  configuration?: Partial<Configuration>
}

export interface DetailedArguments {
  argv: Arguments
  error: Error | null
  aliases: Record<string, string[]>
  newAliases: Record<string, boolean>
  defaulted: Record<string, boolean>
  configuration: Configuration
}

export interface Parser {
  (args: string | any[], opts?: Options): Arguments
  detailed(args: string | any[], opts?: Options): DetailedArguments
  camelCase(str: string): string
  decamelize(str: string, joinString?: string): string
  looksLikeNumber(x: null | undefined | number | string): boolean
}

const notImplemented = (): never => {
  throw new Error("not implemented")
}

const parser: Parser = Object.assign((args: string | any[], opts?: Options): Arguments => notImplemented(), {
  detailed: (args: string | any[], opts?: Options): DetailedArguments => notImplemented(),
  camelCase: (str: string): string => notImplemented(),
  decamelize: (str: string, joinString?: string): string => notImplemented(),
  looksLikeNumber: (x: null | undefined | number | string): boolean => notImplemented(),
})

export default parser
