import assert from "node:assert/strict"
import test from "node:test"
import { createSimulationDriverProtocol } from "@trunchbull/simulation/driver"
import type {
  PokemonBattleObservation,
  PokemonBattleSnapshot,
} from "./pokemon.ts"
import { createPokemonDriverHandlers } from "./pokemon.ts"

test("two scripted participants complete a deterministic Pokémon battle", async () => {
  const lifecycleEvents: Array<{ type: string; evalId: string | null }> = []
  const protocol = createSimulationDriverProtocol(createPokemonDriverHandlers(), {
    onLifecycleEvent: (event) => {
      lifecycleEvents.push(event)
    },
  })
  assert.equal(
    (
      await protocol.handle({
        id: "start",
        method: "start",
        params: {
          sessionId: "local-test",
          seed: 42,
          participants: [
            { id: "alice", role: "player1" },
            { id: "bob", role: "player2" },
          ],
          configuration: { formatId: "gen9randombattle" },
        },
      })
    ).ok,
    true
  )

  let snapshot = await readSnapshot(protocol)
  for (let step = 0; step < 2_000 && !snapshot.ended; step += 1) {
    const status = await readStatus(protocol, step)
    assert.notEqual(status.state, "failed")
    for (const participantId of status.readyParticipantIds) {
      const observation = await observe(protocol, participantId, step)
      const choice = legalChoice(observation.request)
      assert.ok(observation.legalActions.includes(choice))
      const response = await protocol.handle({
        id: `action-${participantId}-${step}`,
        method: "dispatch",
        params: {
          participantId,
          action: { choice },
        },
      })
      assert.equal(response.ok, true)
      if (response.ok) {
        assert.equal(
          (response.result as { status: string }).status,
          "committed"
        )
      }
    }
    snapshot = await readSnapshot(protocol)
  }

  assert.equal(snapshot.ended, true)
  assert.ok(snapshot.turn > 0)
  assert.ok(
    snapshot.winnerParticipantId === "alice" ||
      snapshot.winnerParticipantId === "bob"
  )
  assert.ok(
    snapshot.winnerRole === "player1" || snapshot.winnerRole === "player2"
  )
  assert.deepEqual(
    lifecycleEvents.map((event) => ({ type: event.type, evalId: event.evalId })),
    [{ type: "run_eval", evalId: null }]
  )
  const artifacts = await protocol.handle({
    id: "artifacts",
    method: "artifacts",
    params: {},
  })
  assert.equal(artifacts.ok, true)
  if (!artifacts.ok) throw new Error("Artifact collection failed.")
  const [replay] = artifacts.result as Array<{
    name: string
    source: {
      json: {
        chunks: string[]
        presentation: {
          kind: string
          turns: Array<{
            turn: number
            decisions: Array<{
              phase: string
              selection: { value: string; label: string; kind: string }
            }>
          }>
        }
      }
    }
    metadata: {
      presentationKind: string
      presentationSchemaVersion: number
    }
  }>
  assert.equal(replay?.name, "Pokémon Showdown battle contract stream")
  const chunks = replay?.source.json.chunks ?? []
  assert.ok(chunks.length > 0)
  assert.ok(chunks.some((chunk) => chunk.includes("|start")))
  assert.ok(chunks.some((chunk) => chunk.includes("|turn|")))
  assert.ok(chunks.some((chunk) => chunk.includes("|win|")))
  assert.equal(replay?.metadata.presentationKind, "turns")
  assert.equal(replay?.source.json.presentation.kind, "turns")
  assert.ok(replay?.source.json.presentation.turns.length)
  const decisions = replay?.source.json.presentation.turns.flatMap(
    (turn) => turn.decisions
  )
  assert.ok(decisions?.length)
  assert.ok(
    decisions?.every(
      (decision) =>
        decision.selection.value.length > 0 &&
        decision.selection.label.length > 0
    )
  )
  assert.ok(decisions?.some((decision) => decision.selection.kind === "move"))
  assert.ok(decisions?.some((decision) => decision.selection.kind === "switch"))
  assert.equal(
    (
      await protocol.handle({
        id: "stop",
        method: "stop",
        params: {},
      })
    ).ok,
    true
  )
})

async function observe(
  protocol: ReturnType<typeof createSimulationDriverProtocol>,
  participantId: string,
  step: number
): Promise<PokemonBattleObservation> {
  const response = await protocol.handle({
    id: `observe-${participantId}-${step}`,
    method: "observe",
    params: { participantId },
  })
  assert.equal(response.ok, true)
  if (!response.ok) throw new Error("Observation failed.")
  return response.result as PokemonBattleObservation
}

async function readStatus(
  protocol: ReturnType<typeof createSimulationDriverProtocol>,
  step: number
) {
  const response = await protocol.handle({
    id: `status-${step}`,
    method: "status",
    params: {},
  })
  assert.equal(response.ok, true)
  if (!response.ok) throw new Error("Status failed.")
  return response.result as {
    state: "waiting" | "action_required" | "completed" | "failed"
    readyParticipantIds: readonly string[]
  }
}

async function readSnapshot(
  protocol: ReturnType<typeof createSimulationDriverProtocol>
): Promise<PokemonBattleSnapshot> {
  const response = await protocol.handle({
    id: "snapshot",
    method: "snapshot",
    params: {},
  })
  assert.equal(response.ok, true)
  if (!response.ok) throw new Error("Snapshot failed.")
  return response.result as PokemonBattleSnapshot
}

function legalChoice(input: unknown): string {
  const request = input as {
    teamPreview?: boolean
    forceSwitch?: boolean[]
    active?: Array<{ moves: Array<{ disabled?: boolean }> }>
    side?: {
      pokemon: Array<{ active?: boolean; condition?: string }>
    }
  }
  if (request.teamPreview) return "team 123456"
  if (request.forceSwitch?.some(Boolean)) {
    const index = request.side?.pokemon.findIndex(
      (pokemon) => !pokemon.active && !pokemon.condition?.startsWith("0 fnt")
    )
    if (index === undefined || index < 0)
      throw new Error("No legal switch found.")
    return `switch ${index + 1}`
  }
  if (request.active?.length) {
    return request.active
      .map((active) => {
        const index = active.moves.findIndex((move) => !move.disabled)
        if (index < 0) throw new Error("No legal move found.")
        return `move ${index + 1}`
      })
      .join(", ")
  }
  throw new Error("Unsupported Pokémon Showdown request.")
}
