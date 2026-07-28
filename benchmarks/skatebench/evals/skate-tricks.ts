export default {
  id: "skate-tricks",
  title: "Technical Trick Terminology",
  description:
    "Checks which skateboard tricks a model can correctly name from a description.",
  systemPrompt:
    "You are a skateboard trick naming assistant. You are given a description of a trick and you need to give the name of the trick. If the trick has multiple names, you should give the common name that most skateboarders would use. Keep answers concise and to the point - don't include names of other tricks.",
  cases: "./skate-tricks.jsonl",
  evaluate: { kind: "non_empty" },
}
