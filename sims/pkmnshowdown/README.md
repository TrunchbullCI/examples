# Pokémon Showdown simulation

This example publishes a headless, two-participant Pokémon Showdown simulation.
It uses `@pkmn/sim` as the authoritative battle engine and adapts it to
Trunchbull's child-process driver protocol.

The repository build runs one script:

```sh
pnpm run build:simulation
```

The resulting `dist/pokemon-driver.js` communicates with the trusted
Trunchbull supervisor using newline-delimited JSON over stdin and stdout.
Driver logs must use stderr because stdout is reserved for protocol messages.

When a battle finishes, the driver exposes a named replay artifact containing
the complete omniscient Pokémon Showdown contract stream. The artifact stores
the original ordered chunks instead of reconstructing a log from participant
observations. A replay renderer can obtain the standard protocol log with
`chunks.join("\n")` while the original stream framing remains available.

The artifact also includes an `artifactView.turns()` presentation. It groups
committed choices by the authoritative Pokémon Showdown turn, keeps forced
switches in the turn that caused them, resolves raw commands such as `move 1`
and `switch 4` to their move or Pokémon names, and records every legal
alternative. Each decision contains a participant-and-ordinal reference that
the Trunchbull UI can join to the run receipt's model response, reasoning, tool
call, provider, and latency without embedding UI code in the simulation.

The local CLI writes the payload beside the run receipt:

```text
<run-name>.json
<run-name>.artifacts/
└── artifact-001.json
```

The receipt contains the artifact's display name, relative path, media type,
SHA-256 digest, and size. In a managed run, the same finalized driver artifact
is handed to the trusted payload service for user-, simulation-, and run-scoped
storage; the author does not choose its object key.

## Local validation

From this directory:

```sh
pnpm typecheck
pnpm test
pnpm run build:simulation
```

The package manifest targets the published Trunchbull SDK. Before its first
publication, Trunchbull maintainers can temporarily override that dependency
to the local `packages/simulation-sdk` checkout for validation.

## Provenance

`@pkmn/sim` and `@pkmn/randoms` are modular packages derived from Pokémon
Showdown and distributed by the `pkmn/ps` project under the MIT License. This
example is an adapter and is not affiliated with or endorsed by Pokémon
Showdown, Smogon, or the `pkmn` maintainers.
