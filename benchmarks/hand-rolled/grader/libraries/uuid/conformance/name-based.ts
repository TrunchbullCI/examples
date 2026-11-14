import { v3, v5 } from "./index.js"

const dns: string = v3.DNS
const url: string = v5.URL
const fromV3: string = v3("hello.example.com", v3.DNS)
const fromBytes: string = v3(Uint8Array.of(104, 105), new Uint8Array(16))
const intoV3: Uint8Array = v3("hello", "0f5abcd1-c194-47f3-905b-2df7263a084b", new Uint8Array(19), 3)
const fromV5: string = v5("https://www.w3.org/", v5.URL)
const intoV5: Uint8Array = v5("hello", dns, new Uint8Array(16))
void [url, fromV3, fromBytes, intoV3, fromV5, intoV5]
