export type ClassValue = ClassArray | ClassDictionary | string | number | bigint | null | boolean | undefined
export type ClassDictionary = Record<string, any>
export type ClassArray = ClassValue[]

export function clsx(...inputs: ClassValue[]): string {
  void inputs
  throw new Error("not implemented")
}

export default clsx
