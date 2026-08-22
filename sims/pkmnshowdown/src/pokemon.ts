import { TeamGenerators } from "@pkmn/randoms"
import { BattleStreams, PRNG, Teams } from "@pkmn/sim"
import {
  artifact,
  artifactView,
  runEval,
  type ArtifactChoiceView,
  type ArtifactTurnView,
} from "@trunchbull/simulation"
import type {
  SimulationDriverHandlers,
  SimulationDriverStartContext,
  SimulationDriverStatus,
} from "@trunchbull/simulation/driver"

type PlayerSlot = "p1" | "p2"
type PlayerRole = "player1" | "player2"

interface PlayerView {
  log: string[]
  lastError: string | null
}

interface PokemonRequest {
  wait?: boolean
  teamPreview?: boolean
  forceSwitch?: boolean[]
  active?: Array<{
    trapped?: boolean
    moves: Array<{
      move?: string
      id?: string
      disabled?: boolean
    }>
  }>
  side?: {
    pokemon: Array<{
      ident?: string
      details?: string
      active?: boolean
      condition?: string
    }>
  }
}

interface PokemonBattleDecision {
  participantId: string
  ordinal: number
  turn: number
  phase: "action" | "forced-switch" | "team-preview"
  selection: ArtifactChoiceView
  alternatives: ArtifactChoiceView[]
  reason: string
}

interface PokemonBattleRuntime {
  battleStream: BattleStreams.BattleStream
  streams: ReturnType<typeof BattleStreams.getPlayerStreams>
  participantSlots: Map<string, PlayerSlot>
  participantRoles: Map<string, PlayerRole>
  views: Record<PlayerSlot, PlayerView>
  contractStream: string[]
  contractStreamComplete: Promise<void>
  formatId: string
  participants: Array<{ id: string; role: PlayerRole }>
  decisions: PokemonBattleDecision[]
  participantDecisionOrdinals: Map<string, number>
  revision: number
  requestSignature: string
}

export interface PokemonBattleConfiguration {
  formatId?: string
  teams?: Partial<Record<PlayerRole, string>>
}

export interface PokemonBattleAction {
  choice: string
  choiceLabel?: string
  reason?: string
}

interface PokemonActionOption extends ArtifactChoiceView {
  value: string
  label: string
  effectiveness?: "immune" | "resisted" | "neutral" | "super-effective"
  details?: string
}

export interface PokemonBattleObservation {
  revision: number
  player: PlayerSlot
  phase: "action" | "forced-switch" | "team-preview" | "waiting" | "ended"
  battleStarted: boolean
  battleEnded: boolean
  turn: number
  summary: string
  team: Array<{
    name: string
    species: string
    level: number
    types: string[]
    hp: number
    maxHp: number
    status: string | null
    active: boolean
    fainted: boolean
    stats: Record<string, number>
    ability: string
    item: string
    moves: Array<{
      name: string
      pp: number
      maxPp: number
      disabled: boolean
    }>
  }>
  opponentActive: {
    name: string
    species: string
    level: number
    types: string[]
    status: string | null
  } | null
  request: unknown
  legalActions: string[]
  actionOptions: PokemonActionOption[]
  lastError: string | null
  recentLog: string[]
}

export interface PokemonBattleSnapshot {
  ended: boolean
  turn: number
  revision: number
  winnerParticipantId: string | null
  winnerRole: PlayerRole | null
}

export interface PokemonBattleDispatchResult {
  status: "committed" | "rejected"
  revision: number
  message?: string
  choice?: string
  choiceLabel?: string
  reason?: string
}

let randomTeamFactoryInstalled = false

export function createPokemonDriverHandlers(): SimulationDriverHandlers<
  PokemonBattleRuntime,
  PokemonBattleConfiguration,
  PokemonBattleAction,
  PokemonBattleDispatchResult,
  PokemonBattleObservation,
  PokemonBattleSnapshot
> {
  return {
    start: startBattle,
    dispatch: dispatchChoice,
    observe: ({ runtime, participantId }) =>
      observeBattle(runtime, participantId),
    status: ({ runtime }) => battleStatus(runtime),
    snapshot: ({ runtime }) => snapshotBattle(runtime),
    artifacts: async ({ runtime }) => {
      await runtime.contractStreamComplete
      return [
        artifact(
          {
            source: {
              json: {
                schemaVersion: 1,
                protocol: "pokemon-showdown-battle-stream",
                framing: "ordered-chunks",
                formatId: runtime.formatId,
                participants: runtime.participants,
                chunks: [...runtime.contractStream],
                decisions: [...runtime.decisions],
                presentation: pokemonTurnView(runtime),
              },
            },
            mediaType:
              "application/vnd.trunchbull.pokemon-showdown-contract-stream+json",
            purpose: "simulation_replay",
            metadata: {
              formatId: runtime.formatId,
              chunkCount: runtime.contractStream.length,
              presentationKind: "turns",
              presentationSchemaVersion: 1,
            },
          },
          {
            name: "Pokémon Showdown battle contract stream",
            idempotencyKey: "pokemon-showdown-contract-stream",
          }
        ),
      ]
    },
    stop: async ({ runtime }) => {
      await runtime.streams.omniscient.writeEnd()
    },
  }
}

function battleStatus(runtime: PokemonBattleRuntime): SimulationDriverStatus {
  refreshRevision(runtime)
  const battle = runtime.battleStream.battle
  if (!battle) {
    return {
      state: "failed",
      revision: runtime.revision,
      readyParticipantIds: [],
      message: "The Pokémon Showdown battle is unavailable.",
    }
  }
  if (battle.ended) {
    return {
      state: "completed",
      revision: runtime.revision,
      readyParticipantIds: [],
    }
  }
  const readyParticipantIds = [...runtime.participantSlots.entries()]
    .filter(([, slot]) => {
      const side = battle.getSide(slot)
      return Boolean(
        side.activeRequest && !side.activeRequest.wait && !side.isChoiceDone()
      )
    })
    .map(([participantId]) => participantId)
  return readyParticipantIds.length > 0
    ? {
        state: "action_required",
        revision: runtime.revision,
        readyParticipantIds,
      }
    : {
        state: "waiting",
        revision: runtime.revision,
        readyParticipantIds: [],
      }
}

async function startBattle(
  context: SimulationDriverStartContext<PokemonBattleConfiguration>
): Promise<PokemonBattleRuntime> {
  if (context.participants.length !== 2) {
    throw new TypeError("The Pokémon Showdown simulation requires two players.")
  }
  installRandomTeamFactory()
  const formatId = context.configuration.formatId ?? "gen9randombattle"
  const seed = showdownSeed(context.seed)
  const generatedTeams = generateTeams(formatId, seed)
  const battleStream = new BattleStreams.BattleStream({ keepAlive: false })
  const streams = BattleStreams.getPlayerStreams(battleStream)
  const first = context.participants[0]!
  const second = context.participants[1]!
  const contractStream: string[] = []
  const contractStreamComplete = consumeContractStream(
    streams.omniscient,
    contractStream
  )
  const runtime: PokemonBattleRuntime = {
    battleStream,
    streams,
    participantSlots: new Map([
      [first.id, "p1"],
      [second.id, "p2"],
    ]),
    participantRoles: new Map([
      [first.id, requirePlayerRole(first.role)],
      [second.id, requirePlayerRole(second.role)],
    ]),
    views: {
      p1: { log: [], lastError: null },
      p2: { log: [], lastError: null },
    },
    contractStream,
    contractStreamComplete,
    formatId,
    participants: [
      { id: first.id, role: requirePlayerRole(first.role) },
      { id: second.id, role: requirePlayerRole(second.role) },
    ],
    decisions: [],
    participantDecisionOrdinals: new Map(),
    revision: 0,
    requestSignature: "",
  }
  consumePlayerStream(streams.p1, runtime.views.p1)
  consumePlayerStream(streams.p2, runtime.views.p2)
  await streams.omniscient.write(
    `>start ${JSON.stringify({ formatid: formatId, seed })}`
  )
  await streams.omniscient.write(
    `>player p1 ${JSON.stringify({
      name: first.id,
      team:
        context.configuration.teams?.[requirePlayerRole(first.role)] ??
        generatedTeams.p1,
    })}`
  )
  await streams.omniscient.write(
    `>player p2 ${JSON.stringify({
      name: second.id,
      team:
        context.configuration.teams?.[requirePlayerRole(second.role)] ??
        generatedTeams.p2,
    })}`
  )
  refreshRevision(runtime)
  await waitForInitialRequests(runtime)
  return runtime
}

async function dispatchChoice({
  runtime,
  participantId,
  action,
}: {
  runtime: PokemonBattleRuntime
  participantId: string
  action: PokemonBattleAction
}): Promise<PokemonBattleDispatchResult> {
  refreshRevision(runtime)
  const slot = requirePlayerSlot(runtime, participantId)
  const side = runtime.battleStream.battle?.getSide(slot)
  if (!side?.activeRequest || side.isChoiceDone()) {
    return {
      status: "rejected",
      revision: runtime.revision,
      message: "This player does not currently need to make a choice.",
    }
  }
  const choice = action.choice.trim()
  if (!choice) {
    return {
      status: "rejected",
      revision: runtime.revision,
      message: "A Pokémon Showdown choice is required.",
    }
  }
  const request = side.activeRequest as PokemonRequest
  const decision = {
    participantId,
    ordinal: runtime.participantDecisionOrdinals.get(participantId) ?? 0,
    turn: runtime.battleStream.battle?.turn ?? 0,
    phase: requestPhase(request),
    selection: describeChoice(request, choice),
    alternatives: legalActions(runtime, slot).map((candidate) =>
      describeChoice(request, candidate)
    ),
    reason: action.reason?.trim() || "No tactical reason was supplied.",
  } satisfies PokemonBattleDecision
  runtime.views[slot].lastError = null
  await runtime.streams[slot].write(choice)
  if (side.choice.error) {
    runtime.views[slot].lastError = side.choice.error
    return {
      status: "rejected",
      revision: runtime.revision,
      message: side.choice.error,
      choice,
    }
  }
  runtime.decisions.push(decision)
  runtime.participantDecisionOrdinals.set(participantId, decision.ordinal + 1)
  refreshRevision(runtime)
  if (runtime.battleStream.battle?.ended) {
    void runEval()
  }
  return {
    status: "committed",
    revision: runtime.revision,
    choice,
    choiceLabel: action.choiceLabel ?? decision.selection.label,
    reason: decision.reason,
  }
}

function observeBattle(
  runtime: PokemonBattleRuntime,
  participantId: string
): PokemonBattleObservation {
  refreshRevision(runtime)
  const slot = requirePlayerSlot(runtime, participantId)
  const view = runtime.views[slot]
  const battle = runtime.battleStream.battle
  const side = battle?.getSide(slot)
  const request = side?.activeRequest as PokemonRequest | null | undefined
  const actions = request ? legalActions(runtime, slot) : []
  const options = request
    ? actions.map((choice) => actionOption(runtime, slot, request, choice))
    : []
  const phase = battle?.ended
    ? "ended"
    : !request || request.wait || side?.isChoiceDone()
      ? "waiting"
      : request.teamPreview
        ? "team-preview"
        : request.forceSwitch?.some(Boolean)
          ? "forced-switch"
          : "action"
  const opponent = side?.foe.active[0]
  return {
    revision: runtime.revision,
    player: slot,
    phase,
    battleStarted: Boolean(battle),
    battleEnded: battle?.ended ?? false,
    turn: battle?.turn ?? 0,
    summary: battle?.ended
      ? `The battle ended on turn ${battle.turn}.`
      : phase === "waiting"
        ? `Turn ${battle?.turn ?? 0}: your action is committed; wait for the opponent.`
        : `Turn ${battle?.turn ?? 0}: choose one of ${options.length} legal ${phase.replace("-", " ")} actions.`,
    team: (side?.pokemon ?? []).map((pokemon) => ({
      name: pokemon.name,
      species: pokemon.species.name,
      level: pokemon.level,
      types: [...pokemon.types],
      hp: pokemon.hp,
      maxHp: pokemon.maxhp,
      status: pokemon.status || null,
      active: pokemon.isActive,
      fainted: pokemon.fainted,
      stats: { ...pokemon.storedStats },
      ability: pokemon.ability,
      item: pokemon.item,
      moves: pokemon.moveSlots.map((move) => ({
        name: move.move,
        pp: move.pp,
        maxPp: move.maxpp,
        disabled: Boolean(move.disabled),
      })),
    })),
    opponentActive: opponent
      ? {
          name: opponent.name,
          species: opponent.species.name,
          level: opponent.level,
          types: [...opponent.types],
          status: opponent.status || null,
        }
      : null,
    request: request ?? null,
    legalActions: actions,
    actionOptions: options,
    lastError:
      runtime.battleStream.battle?.getSide(slot).choice.error ?? view.lastError,
    recentLog: view.log.slice(-120),
  }
}

function actionOption(
  runtime: PokemonBattleRuntime,
  slot: PlayerSlot,
  request: PokemonRequest,
  choice: string
): PokemonActionOption {
  const described = describeChoice(request, choice)
  const [command, rawIndex] = choice.split(" ")
  const index = Number(rawIndex) - 1
  if (command !== "move" || !Number.isInteger(index) || index < 0) {
    return { ...described, value: choice, label: described.label }
  }
  const moveRequest = request.active?.[0]?.moves[index]
  const move = runtime.battleStream.battle?.dex.moves.get(
    moveRequest?.id ?? moveRequest?.move ?? ""
  )
  const opponent = runtime.battleStream.battle?.getSide(slot).foe.active[0]
  const multiplier =
    move?.exists && opponent
      ? runtime.battleStream.battle!.dex.getImmunity(move, opponent)
        ? 2 ** runtime.battleStream.battle!.dex.getEffectiveness(move, opponent)
        : 0
      : 1
  return {
    ...described,
    value: choice,
    label: move?.name ?? described.label,
    effectiveness:
      multiplier === 0
        ? "immune"
        : multiplier > 1
          ? "super-effective"
          : multiplier < 1
            ? "resisted"
            : "neutral",
    details: move?.exists
      ? `${move.type} ${move.category}; power ${move.basePower || "status"}; ${multiplier}x into ${opponent?.name ?? "the opponent"}.`
      : undefined,
  }
}

function legalActions(
  runtime: PokemonBattleRuntime,
  slot: PlayerSlot
): string[] {
  const request = runtime.battleStream.battle?.getSide(slot).activeRequest as
    | PokemonRequest
    | undefined
  if (request?.teamPreview) return ["team 123456"]
  const switches = (request?.side?.pokemon ?? []).flatMap((pokemon, index) =>
    !pokemon.active && !pokemon.condition?.startsWith("0 fnt")
      ? [`switch ${index + 1}`]
      : []
  )
  if (request?.forceSwitch?.some(Boolean)) return switches
  const active = request?.active?.[0]
  const moves = (active?.moves ?? []).flatMap((move, index) =>
    move.disabled ? [] : [`move ${index + 1}`]
  )
  return active?.trapped ? moves : [...moves, ...switches]
}

function pokemonTurnView(runtime: PokemonBattleRuntime) {
  const grouped = new Map<number, PokemonBattleDecision[]>()
  for (const decision of runtime.decisions) {
    const decisions = grouped.get(decision.turn) ?? []
    decisions.push(decision)
    grouped.set(decision.turn, decisions)
  }
  const turns: ArtifactTurnView[] = [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([turn, decisions]) => ({
      id: `turn-${turn}`,
      label: `Turn ${turn}`,
      turn,
      decisions: decisions.map((decision) => ({
        ref: {
          participantId: decision.participantId,
          ordinal: decision.ordinal,
        },
        phase: decision.phase,
        selection: decision.selection,
        alternatives: decision.alternatives,
      })),
    }))
  return artifactView.turns({
    participants: runtime.participants.map((participant) => participant.id),
    turns,
  })
}

function requestPhase(request: PokemonRequest): PokemonBattleDecision["phase"] {
  if (request.teamPreview) return "team-preview"
  return request.forceSwitch?.some(Boolean) ? "forced-switch" : "action"
}

function describeChoice(
  request: PokemonRequest,
  choice: string
): ArtifactChoiceView {
  const [command, rawIndex] = choice.split(" ")
  const index = Number(rawIndex) - 1
  if (command === "move" && Number.isInteger(index) && index >= 0) {
    const move = request.active?.[0]?.moves[index]
    return {
      value: choice,
      label: move?.move ?? move?.id ?? choice,
      kind: "move",
    }
  }
  if (command === "switch" && Number.isInteger(index) && index >= 0) {
    const pokemon = request.side?.pokemon[index]
    return {
      value: choice,
      label:
        pokemon?.ident?.replace(/^p[12]:\s*/u, "") ??
        pokemon?.details?.split(",")[0] ??
        choice,
      kind: "switch",
    }
  }
  if (command === "team") {
    return { value: choice, label: "Team order", kind: "team" }
  }
  return { value: choice, label: choice, kind: "action" }
}

function snapshotBattle(runtime: PokemonBattleRuntime): PokemonBattleSnapshot {
  refreshRevision(runtime)
  const battle = runtime.battleStream.battle
  const winnerParticipantId = battle?.ended ? battle.winner || null : null
  return {
    ended: battle?.ended ?? false,
    turn: battle?.turn ?? 0,
    revision: runtime.revision,
    winnerParticipantId,
    winnerRole: winnerParticipantId
      ? (runtime.participantRoles.get(winnerParticipantId) ?? null)
      : null,
  }
}

function installRandomTeamFactory(): void {
  if (randomTeamFactoryInstalled) return
  Teams.setGeneratorFactory(TeamGenerators)
  randomTeamFactoryInstalled = true
}

function generateTeams(
  formatId: string,
  seed: ReturnType<typeof PRNG.convertSeed>
) {
  const generator = TeamGenerators.getTeamGenerator(formatId, seed)
  return {
    p1: Teams.pack(generator.getTeam()),
    p2: Teams.pack(generator.getTeam()),
  }
}

function showdownSeed(input: unknown): ReturnType<typeof PRNG.convertSeed> {
  if (
    Array.isArray(input) &&
    input.length === 4 &&
    input.every((value) => Number.isInteger(value))
  ) {
    return PRNG.convertSeed(
      input.map((value) => Number(value) & 0xffff) as [
        number,
        number,
        number,
        number,
      ]
    )
  }
  const numeric =
    typeof input === "number" && Number.isFinite(input) ? input : 0
  let value = Math.trunc(numeric) >>> 0
  const seed: number[] = []
  for (let index = 0; index < 4; index += 1) {
    value = (Math.imul(value, 1_664_525) + 1_013_904_223) >>> 0
    seed.push(value & 0xffff)
  }
  return PRNG.convertSeed(seed as [number, number, number, number])
}

function requirePlayerSlot(
  runtime: PokemonBattleRuntime,
  participantId: string
): PlayerSlot {
  const slot = runtime.participantSlots.get(participantId)
  if (!slot) throw new TypeError("Participant is not part of this battle.")
  return slot
}

function requirePlayerRole(role: string): PlayerRole {
  if (role !== "player1" && role !== "player2") {
    throw new TypeError(`Unsupported Pokémon participant role ${role}.`)
  }
  return role
}

function refreshRevision(runtime: PokemonBattleRuntime): void {
  const battle = runtime.battleStream.battle
  if (!battle) return
  const signature = JSON.stringify(
    battle.sides.map((side) => ({
      id: side.id,
      request: side.activeRequest,
      choiceDone: side.isChoiceDone(),
      ended: battle.ended,
    }))
  )
  if (!runtime.requestSignature) {
    runtime.requestSignature = signature
  } else if (signature !== runtime.requestSignature) {
    runtime.requestSignature = signature
    runtime.revision += 1
  }
}

function consumePlayerStream(
  stream: ReturnType<typeof BattleStreams.getPlayerStreams>[PlayerSlot],
  view: PlayerView
): void {
  void Promise.resolve().then(async () => {
    for await (const chunk of stream) {
      for (const line of chunk.split("\n")) {
        if (line.startsWith("|error|")) {
          view.lastError = line.slice("|error|".length)
        }
        if (line) view.log.push(line)
      }
      if (view.log.length > 500) view.log.splice(0, view.log.length - 500)
    }
  })
}

async function consumeContractStream(
  stream: ReturnType<typeof BattleStreams.getPlayerStreams>["omniscient"],
  chunks: string[]
): Promise<void> {
  for await (const chunk of stream) chunks.push(chunk)
}

async function waitForInitialRequests(
  runtime: PokemonBattleRuntime
): Promise<void> {
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    if (
      runtime.battleStream.battle?.getSide("p1").activeRequest &&
      runtime.battleStream.battle?.getSide("p2").activeRequest
    ) {
      refreshRevision(runtime)
      return
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 1))
  }
  throw new Error("Pokémon Showdown did not issue initial player requests.")
}
