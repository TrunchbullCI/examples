// ESM shims import the module under test (named by HR_SUBJECT) from here.
import { pathToFileURL } from "node:url"

if (!process.env.HR_SUBJECT) throw new Error("HR_SUBJECT is not set.")
export const subject = await import(pathToFileURL(process.env.HR_SUBJECT).href)
