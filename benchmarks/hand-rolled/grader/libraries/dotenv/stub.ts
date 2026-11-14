export interface DotenvParseOptions {
  fast?: boolean
}

export interface DotenvConfigOptions {
  path?: string | string[] | URL
  encoding?: string
  quiet?: boolean
  debug?: boolean
  override?: boolean
  fast?: boolean
  processEnv?: Record<string, string | undefined>
}

export interface DotenvConfigOutput {
  parsed?: Record<string, string>
  error?: Error & { code?: string }
}

export interface DotenvPopulateOptions {
  debug?: boolean
  override?: boolean
}

export function parse(src: string | Buffer, options?: DotenvParseOptions): Record<string, string> {
  void src
  void options
  throw new Error("not implemented")
}

export function populate(
  processEnv: Record<string, string | undefined>,
  parsed: Record<string, string | undefined>,
  options?: DotenvPopulateOptions
): Record<string, string | undefined> {
  void processEnv
  void parsed
  void options
  throw new Error("not implemented")
}

export function configDotenv(options?: DotenvConfigOptions | null): DotenvConfigOutput {
  void options
  throw new Error("not implemented")
}

export function config(options?: DotenvConfigOptions | null): DotenvConfigOutput {
  void options
  throw new Error("not implemented")
}
