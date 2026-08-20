import {
  createSim,
  defineEvals,
  modelParticipant,
  resolveSimulation,
  simulationDriver,
} from "@trunchbull/simulation"
import type { PokemonBattleSnapshot } from "./src/pokemon.ts"

export default createSim({
  name: "pkmnshowdown",
  version: "1.0.0",
  systemPrompt:
    "You are competing in a Pokémon Showdown battle. Use your private observations and submit only legal choices.",
  build: {
    script: "build:simulation",
  },
  driver: simulationDriver({
    entrypoint: "./dist/pokemon-driver.js",
  }),
  models: {
    player1: modelParticipant(),
    player2: modelParticipant(),
  },
  evals: defineEvals([
    {
      id: "complete-battle",
      task: "Play the battle until Pokémon Showdown declares a winner.",
      participants: ["player1", "player2"],
      seed: 42,
      grade: ({ result }) => {
        const battle = result as PokemonBattleSnapshot
        return {
          participantScores: {
            player1: battle.winnerRole === "player1" ? 1 : 0,
            player2: battle.winnerRole === "player2" ? 1 : 0,
          },
          passed: battle.ended && battle.winnerRole !== null,
          metadata: {
            turns: battle.turn,
            winnerRole: battle.winnerRole,
          },
        }
      },
    },
  ]),
  onModelFailure: (event) => {
    const winner = event.participantId === "player1" ? "player2" : "player1"
    return resolveSimulation({
      winner,
      losers: event.participantId,
      forfeited: event.participantId,
      reason: `${event.participantId} forfeited after ${event.code}.`,
      runEval: "complete-battle",
    })
  },
})
