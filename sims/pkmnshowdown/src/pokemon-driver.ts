import { runSimulationDriver } from "@trunchbull/simulation/driver"
import { createPokemonDriverHandlers } from "./pokemon.ts"

await runSimulationDriver(createPokemonDriverHandlers())
