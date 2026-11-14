export default function ms(value: string): number
export default function ms(value: number, options?: { long?: boolean }): string
export default function ms(value: string | number, options?: { long?: boolean }): string | number {
  void value
  void options
  throw new Error("not implemented")
}
