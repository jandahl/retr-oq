# c64/ — internal notes

See root `CLAUDE.md` → Theme invariants → `c64/` for the baseline
(single-tasking like `dos/`, real two-step `LOAD"NAME",8` then `RUN`,
hand-drawn chrome, C64 Pro Mono).

- BASIC-style command line: `runCommand(line)` in `app.js` (~line 965).
  `LOAD"$",8` / `LIST` prints the fake directory; `LOAD"NAME",8[,1]` sets
  `loadedProgram`; a bare `RUN` starts it via `runProgram()`.
- `SYS 64738` (also accepts `SYS64738`) quits to the hub
  (`window.location.href = "../"`). This is the real, well-known C64
  machine-code jump to the KERNAL reset vector — an authentic "reboot"
  command, not an invented one, so it's intentionally undocumented in any
  on-screen help the same way a real C64 never advertised it either.
- `MORPH` is the built-in minigame, `KALQ` is Klax-alike — both loaded and
  run the same LOAD/RUN way as `DICT`.
- RUN/STOP is the in-app "abort" key for whatever's currently running
  (dict/morph/kalq), separate from `SYS 64738` which quits the whole
  emulator.
