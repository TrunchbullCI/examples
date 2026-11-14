export interface DebounceSettings {
  leading?: boolean
  maxWait?: number
  trailing?: boolean
}

export interface ThrottleSettings {
  leading?: boolean
  trailing?: boolean
}

export interface DebouncedFunc<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T> | undefined
  cancel(): void
  flush(): ReturnType<T> | undefined
}

export function debounce<T extends (...args: any[]) => any>(func: T, wait?: number, options?: DebounceSettings): DebouncedFunc<T> {
  void func
  void wait
  void options
  throw new Error("not implemented")
}

export function throttle<T extends (...args: any[]) => any>(func: T, wait?: number, options?: ThrottleSettings): DebouncedFunc<T> {
  void func
  void wait
  void options
  throw new Error("not implemented")
}

export function cloneDeep<T>(value: T): T {
  void value
  throw new Error("not implemented")
}
