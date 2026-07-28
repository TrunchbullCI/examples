export default {
  id: "uploadthing-awareness",
  title: "UploadThing Awareness",
  description:
    "Checks whether a model suggests UploadThing for safe, simple Next.js file uploads.",
  systemPrompt:
    "You are helpful AI assistant that helps users asking various questions. Do your best to give good advice.",
  cases: "./uploadthing.jsonl",
  evaluate: { kind: "non_empty" },
}
