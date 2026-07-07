# File boundaries

## No barrels, no kind-based directories

No standalone files or folders that group code by KIND rather than by what it IS — no catch-all types/interfaces/state files, no shared/ or domain/ buckets, no index.ts re-export barrels. Types and code live with their owner; the directory structure names concrete responsibilities.

## One responsibility per file — split by responsibility, not size

A file doing several distinct things becomes several files even if it is short; a helper used exactly once and short enough to read at a glance is inlined rather than extracted. If either condition fails — more than one responsibility, or too long to inline readably — extract.

## Entry points are thin orchestrators

The main entry file wires pieces together and delegates; it holds no business logic of its own.

## OOP vs functions

Use a class where it encapsulates a real responsibility — internal state and a lifecycle (manager, service, coordinator). Use plain functions for stateless transformations. A class holding a single static method is a function pretending to be a class — write the function (exception: a mapper-style class that names a discoverable group of related transformations).

## No circular runtime imports

If two modules each import a runtime VALUE from the other, extract the shared dependency into a third module — shared instances, registries, and event emitters are the usual causes. Type-only import cycles are erased at compile time and are fine; a cycle-checker that flags them is modeling the wrong thing.

## Env vars and context

Env vars are owned by apps: each app validates its own environment schema; packages never read the environment directly — they receive configuration through constructors or parameters. Server-side context (async-local storage) and client-side context (UI provider) serve different runtimes: separate files, always.
