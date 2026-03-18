# nullify — CS2 CFG scripting system (rebuild)

## Project overview

This is a clean-room rebuild of a CS2 CFG-based movement scripting system. The project name inside CS2 is **nullify** (the cfg directory loaded as `nullify/`). It includes:
- Counter-strafe (jiting) with multiple timing modes
- SOCD resolution (snap-tap equivalent via CFG)
- Bhop, jump-bug, jump-throw
- Weapon detection, sprint+, tactical wheel
- A Tauri v2 UI for installation and configuration

---

## CS2 CFG language reference

### Basic syntax

```cfg
// this is a comment
sensitivity 1.5              // set a cvar
bind "c" "crouch_toggle"     // bind a key
exec autoexec                // exec another cfg (no .cfg suffix needed)
bind "f" "cmd1;cmd2;cmd3"    // semicolon-separated command sequence
```

### Core commands

| Command | Syntax | Description |
|---|---|---|
| `bind` | `bind "key" "command"` | Bind key to command |
| `alias` | `alias "name" "commands"` | Define / redefine a named command |
| `toggle` | `toggle cvar v1 v2 v3` | Cycle cvar through values on each press |
| `incrementvar` | `incrementvar cvar min max step` | Step a cvar value |
| `exec` | `exec filename` | Execute another cfg file |
| `echo` | `echo "msg"` | Print to console |

### `+`/`-` prefix rules

```cfg
bind "c" "+myaction"
// press c   → executes +myaction
// release c → executes -myaction  (automatic, no extra bind needed)
```

Any alias prefixed with `+` will have its `-` counterpart auto-called on key release.

### Alias state machine pattern

CFG has **no if/else, no variables, no loops**. All state is simulated by aliases that redefine themselves:

```cfg
// Two-state toggle
alias "toggle_on"  "cl_crosshairsize 1;alias mytoggle toggle_off"
alias "toggle_off" "cl_crosshairsize 5;alias mytoggle toggle_on"
alias "mytoggle"   "toggle_on"
bind  "c"          "mytoggle"
```

This is the foundation for everything in this codebase: SOCD state machines, timer chains, feature on/off routing.

### Constraints

| Constraint | Detail |
|---|---|
| No `wait` | Disabled in CS2; timing via `-testscript` instead |
| No variables | State only via alias self-redefinition |
| No conditionals | Simulate with alias state machines |
| No loops | Simulate with chained alias redefinition |
| Max command len | 510 characters |
| Max arguments | 64 per command |
| Alias name limit | 31 characters, case-insensitive |
| No file I/O | Only `host_writeconfig` can write state |
| Multi-input | `cl_allow_multi_input_binds 0` on official servers |

### Axis (joystick) commands

CS2 exposes analog input commands from Source engine:
```cfg
forward 99 0 0     // apply forward axis (clamped to 1)
forward -99 0 0    // cancel forward axis (clamped to -1)
```
Used instead of `+forward`/`-forward` to allow explicit cancel of each axis independently. Values ±99 are safe margin for the [-1, 1] clamp.

---

## Per-frame callback (`-testscript`)

CS2's `wait` is disabled, but the Source engine QA test framework provides per-frame callbacks:

**`cfg/.vtest`:**
```
Test_WaitForCheckPoint frame_end
&r
Test_Run
```
Start CS2 with `+exec nullify/setup -testscript "../../csgo/cfg/nullify/.vtest"`.

### Frame loop structure (`core/ticker.cfg`)

```
&r = &t0 ; &o ; &k0       ← called every render frame

&t  fires every 2 frames   ← half-frequency ticker (unused currently)
&o  fires every frame      ← per-frame logic (event dispatch)
&k  fires every 6 frames   ← counter-strafe timer advance
```

`&o` dispatch (set by `jiting/engine.cfg`):
```cfg
alias &o "evt_fwd;evt_back;evt_left;evt_right;evt_switch;evt_sprint;evt_jump"
```

`&k` dispatch:
```cfg
alias &k "tmr_fwd_arm;tmr_back_arm;...;tmr_jump_arm"
```

---

## Movement layer (`core/movement.cfg`)

Low-level axis commands. All other code calls these, never raw CS2 axis commands.

```cfg
alias mv_fwd      "back -99 0 0;forward 99 0 0"
alias mv_back     "forward -99 0 0;back 99 0 0"
alias mv_left     "right -99 0 0;left 99 0 0"
alias mv_right    "left -99 0 0;right 99 0 0"
alias mv_stop_fb  "forward -99 0 0;back -99 0 0"
alias mv_stop_lr  "right -99 0 0;left -99 0 0"
alias mv_stop_all "mv_stop_fb;mv_stop_lr"
```

---

## Counter-strafe engine (`jiting/engine.cfg`)

### Two-stage timer mechanism

**Stage 1 — Direction timer** (`tmr_fwd_v1_N`, driven by `&k`, 6-frame ticks):
- Advances while key is HELD
- At threshold frames → calls `stop_arm_fb_N` to ARM the stop hook

**Stage 2 — Transition timer** (`tmr_f2b_N`, driven by `&k`):
- Starts when key RELEASED / opposite pressed
- Calls `stop_fb_0`…`stop_fb_4` in sequence
- Only armed hooks fire; unarmed are no-ops
- Final state resets all hooks + calls `stop_cross_reset_fb` (restores SOCD routing)

**Stop hook infrastructure** (defined in mode files, `gen_stop_hooks()`):
```cfg
stop_fb_action       ← overridden by ground.cfg / air.cfg
stop_fb_N            ← no-op by default; armed to call stop_fb_action
stop_arm_fb_N        ← arms stop_fb_N
stop_reset_fb        ← resets all stop_fb_N to no-op
stop_cross_reset_fb  ← restores socd_left_rel / socd_right_rel routing
```

### Ground vs air behavior

- **`ground.cfg`**: `stop_fb_action` → `mv_stop_fb` + route lateral releases to opposing direction (cross-axis counter-strafe)
- **`air.cfg`**: `stop_fb_action` → `mv_stop_fb` + route lateral releases to stop (no counter-strafe in air)

### SOCD state machine

5 states per axis (FB, LR):
- `idle` → no key held
- `fwd_held` / `back_held` → single direction
- `fwd_then_back` / `back_then_fwd` → direction change (routes to v2 timer)

### Movement layers

| Layer | Aliases | Purpose |
|---|---|---|
| L0 | `+dir_fwd`, `-dir_fwd`, etc. | Raw axis + timer init |
| L1 | `+jt_fwd`, `-jt_fwd`, etc. | Frame-event indirection (jiting ON) |
| Keys | `+fwd_key`, `-fwd_key`, etc. | SOCD → L0 router |
| User | bound in `user/keys.cfg` | User-facing binds |

---

## Mode files (`jiting/mode/mN.cfg`)

Generated by `tools/gen/timers.py` from data in `tools/gen/modes_data.py`.

**Never edit these files manually.** To change timing: edit `modes_data.py`, then run:
```sh
cd tools/gen && python timers.py
```

| Mode | Description |
|---|---|
| m1 | Minimum strafe (low-fps) |
| m1_5 | Small strafe |
| m2 | Medium-small |
| m3 | Medium — default |
| m4 | Large, no direction-change variation |
| m5 | Large (high-fps) |
| m6 | Maximum, no direction-change variation |

---

## Jump state management (`jiting/jump.cfg`)

`+_jump` is patched to:
1. Fire the actual jump (`+jump`)
2. Exec `air.cfg` (disable cross-axis counter-strafe)
3. Arm `evt_jump` with a 72-frame landing timer

At frame 72 (via `&o`), `ground.cfg` is exec'd to restore ground state.

**Bhop** (`jiting/bhop.cfg`): overrides `+if_jump`/`-if_jump` to run an 8-frame jump cycle via `evt_jump`. Locks `fps_max 64`. Bypasses jump state manager.

**Jumpbug** (`jiting/jumpbug.cfg`): overrides `+if_jumpbug` to do the +jump → +duck → release sequence across 2 `evt_jump` frames.

---

## File structure

```
cfg/
├── .vtest                     # testscript entry: per-frame &r loop
├── setup.cfg                  # entry point; exec chain
├── core/
│   ├── ticker.cfg             # &r, &t, &o, &k frame loop infrastructure
│   └── movement.cfg           # mv_* axis command aliases
├── jiting/
│   ├── engine.cfg             # full counter-strafe engine (SOCD, timers, toggles)
│   ├── open.cfg               # enable jiting (route keys through SOCD)
│   ├── close.cfg              # disable jiting (direct axis binds)
│   ├── ground.cfg             # ground stop behavior
│   ├── air.cfg                # airborne stop behavior
│   ├── jump.cfg               # air/ground state management + landing timer
│   ├── bhop.cfg               # bunny-hop (8-frame cycle)
│   ├── jumpbug.cfg            # jump-bug sequence
│   ├── detect.cfg             # weapon slot detection
│   └── mode/
│       └── m1.cfg … m6.cfg   # GENERATED — do not edit
├── lunpan/
│   ├── setup.cfg              # tactical wheel entry
│   └── throw.cfg              # jump-throw via mouse axis rebind
└── user/
    ├── settings.cfg           # UI-generated feature toggles + sensitivity
    └── keys.cfg               # key bindings template

tools/
└── gen/
    ├── modes_data.py          # JT_MODE timing data table
    └── timers.py              # generates cfg/jiting/mode/*.cfg

app/                           # Tauri v2 UI (Rust + React/TypeScript/Tailwind)
```

---

## UI (Tauri v2)

Stack: Rust backend + React/TypeScript + Tailwind CSS frontend, ~8MB bundle, WebView2 (built-in on Win11, available Win10), MSI installer with Programs and Features uninstall entry.

The UI writes `cfg/user/settings.cfg` with feature toggles and sensitivity aliases. It detects the CS2 installation path via the Steam registry key.

---

## Code generation

Repetitive CFG (mode files) is generated, not hand-written:

```
tools/gen/modes_data.py  →  defines MODES dict with thresholds
tools/gen/timers.py      →  generates cfg/jiting/mode/*.cfg
```

Files marked `// Generated by tools/gen/timers.py — DO NOT EDIT` must not be manually modified.

---

## Development conventions

- **Alias naming**: `snake_case`, max 31 chars. No CamelCase.
- **Axis values**: ±99 for cancel/apply (never ±999, engine clamps to [-1,1])
- **No `exec` in per-frame hot paths** except: `+_jump` (once per jump, acceptable), bhop close, jumpbug end
- **State machine pattern**: `alias foo_on "...; alias mytoggle foo_off"` — self-redefining aliases simulate state
- **CRLF line endings**: all `.cfg` files use CRLF (Windows), Python files use LF
