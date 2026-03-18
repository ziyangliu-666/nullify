"""
tools/gen/timers.py — generates cfg/jiting/mode/<mode>.cfg

Two-stage counter-strafe mechanism (matches original logic):

  Stage 1 — Direction timer (tmr_fwd_v1_N), advances while key is HELD:
    At threshold frames, calls stop_arm_fb_N which ARMS the corresponding
    stop hook (stop_fb_N) by pointing it at stop_fb_action.

  Stage 2 — Transition timer (tmr_f2b_N), starts when key is RELEASED:
    Calls stop_fb_0 … stop_fb_4 in sequence each tick.
    Only armed hooks fire; unarmed hooks are no-ops.
    stop_fb_action is redefined by ground.cfg / air.cfg to control
    whether lateral key releases counter-strafe or just stop.

This design separates:
  - WHEN to counter-strafe (timer thresholds — data in modes_data.py)
  - HOW to counter-strafe (ground.cfg vs air.cfg)

Run:  python tools/gen/timers.py
Output: cfg/jiting/mode/m1.cfg … m6.cfg
"""

from __future__ import annotations
from pathlib import Path
from modes_data import MODES, DIRECTIONS, DIR_LABELS, TRANSITIONS

OUT_DIR = Path(__file__).parent.parent.parent / "cfg" / "jiting" / "mode"

NUM_STOP_LEVELS = 5   # stop_N levels: 0..4


def _axis_pair(direction: str) -> str:
    """Return 'fb' or 'lr' for a given direction."""
    return "fb" if direction in ("fwd", "back") else "lr"


def gen_dir_timer(
    direction: str,
    variant: int,
    thresholds: list[int],
    cycle_len: int,
) -> str:
    """
    Stage 1: direction timer.
    Advances every &k tick (every 6 game frames) while the key is held.
    At threshold frames, calls stop_arm_<axis>_N to arm the stop hook.
    """
    prefix = f"tmr_{direction}_v{variant}"
    arm_alias = f"tmr_{direction}_arm"
    axis = _axis_pair(direction)

    # frame index → stop level
    frame_to_level: dict[int, int] = {f: i for i, f in enumerate(thresholds)}

    lines = [
        f"// --- Direction timer: {DIR_LABELS[direction]}, variant {variant} ---",
        f"// Thresholds (frame → stop level): {dict(sorted(frame_to_level.items()))}",
    ]

    for n in range(1, cycle_len + 1):
        next_n = (n % cycle_len) + 1
        parts: list[str] = [f"alias {arm_alias} {prefix}_{next_n}"]

        if n in frame_to_level:
            level = frame_to_level[n]
            parts.append(f"stop_arm_{axis}_{level}")   # arm the stop hook

        if n == cycle_len:
            parts.append(f"alias {arm_alias}")          # disarm ticker at end

        lines.append(f'alias {prefix}_{n} "{";".join(parts)}"')

    # Init: reset to frame 1 and re-arm the ticker
    lines.append(
        f'alias tmr_{direction}_v{variant}_init '
        f'"alias {arm_alias} {prefix}_1"'
    )
    lines.append("")
    return "\n".join(lines)


def gen_transition_timer(
    from_dir: str,
    to_dir: str,
    thresholds: list[int],
    cycle_len: int,
) -> str:
    """
    Stage 2: transition timer (e.g. f2b = forward→back).
    Starts when the key is released / opposite pressed.
    Fires stop_fb_0 … stop_fb_4 in sequence; only armed hooks do anything.
    """
    axis = _axis_pair(from_dir)
    name = f"tmr_{from_dir[0]}2{to_dir[0]}"  # e.g. tmr_f2b
    arm_alias = f"{name}_arm"

    lines = [
        f"// --- Transition timer: {from_dir}→{to_dir} ---",
    ]

    for n in range(1, NUM_STOP_LEVELS + 2):   # one state per stop level + reset state
        next_n = (n % (NUM_STOP_LEVELS + 1)) + 1
        parts: list[str] = [f"alias {arm_alias} {name}_{next_n}"]

        if n <= NUM_STOP_LEVELS:
            level = n - 1
            parts.append(f"stop_{axis}_{level}")       # fire (no-op if not armed)

        if n == NUM_STOP_LEVELS + 1:
            # Final state: reset all stop hooks for this axis, disarm
            parts.append(f"stop_reset_{axis}")
            parts.append(f"alias {arm_alias}")
            parts.append(f"stop_cross_reset_{axis}")   # restore SOCD lateral routing

        lines.append(f'alias {name}_{n} "{";".join(parts)}"')

    lines.append(
        f'alias {name}_init "alias {arm_alias} {name}_1"'
    )
    lines.append("")
    return "\n".join(lines)


def gen_stop_hooks(axis: str) -> str:
    """
    Generate stop hook infrastructure for one axis ('fb' or 'lr').

    stop_arm_<axis>_N  — called by direction timer to arm stop_<axis>_N
    stop_<axis>_N      — called by transition timer; no-op until armed
    stop_reset_<axis>  — clears all armed hooks back to no-op
    stop_<axis>_action — defined by ground.cfg / air.cfg (context behaviour)
    """
    lines = [
        f"// --- Stop hooks: {axis} axis ---",
        f"// stop_{axis}_action is overridden by jiting/ground.cfg or jiting/air.cfg",
        f"alias stop_{axis}_action",          # no-op until ground/air loaded
        f"alias stop_cross_reset_{axis}",     # no-op until ground/air loaded
    ]

    reset_parts: list[str] = []
    for level in range(NUM_STOP_LEVELS):
        lines.append(f"alias stop_{axis}_{level}")           # no-op by default
        lines.append(
            f'alias stop_arm_{axis}_{level} '
            f'"alias stop_{axis}_{level} stop_{axis}_action"'
        )
        reset_parts.append(f"alias stop_{axis}_{level}")    # reset to no-op

    lines.append(
        f'alias stop_reset_{axis} "{";".join(reset_parts)}"'
    )
    lines.append("")
    return "\n".join(lines)


def gen_mode_file(mode_key: str, mode: dict) -> str:
    label = mode["label"]
    cycle_len = mode["cycle_len"]
    v1 = mode["v1_thresholds"]
    v2 = mode["v2_thresholds"]

    sections: list[str] = [
        f"// {'=' * 60}",
        f"// jiting/mode/{mode_key}.cfg — {label}",
        f"// Generated by tools/gen/timers.py — DO NOT EDIT",
        f"// cycle_len={cycle_len}  v1={v1}  v2={v2}",
        f"// {'=' * 60}",
        "",
        gen_stop_hooks("fb"),
        gen_stop_hooks("lr"),
    ]

    for direction in DIRECTIONS:
        sections.append(gen_dir_timer(direction, 1, v1, cycle_len))
        sections.append(gen_dir_timer(direction, 2, v2, cycle_len))

    for from_dir, to_dir in TRANSITIONS:
        sections.append(gen_transition_timer(from_dir, to_dir, v1, cycle_len))

    # Mode activation alias
    sections += [
        "// --- Mode activation ---",
        f'alias jt_mode_{mode_key} "exec nullify/jiting/mode/{mode_key}.cfg"',
        "",
    ]

    return "\n".join(sections)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for mode_key, mode in MODES.items():
        content = gen_mode_file(mode_key, mode)
        out_path = OUT_DIR / f"{mode_key}.cfg"
        out_path.write_text(content, encoding="utf-8")
        print(f"  wrote {out_path.relative_to(Path(__file__).parent.parent.parent)}")
    print(f"Generated {len(MODES)} mode files → {OUT_DIR}")


if __name__ == "__main__":
    main()
