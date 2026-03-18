"""
JT_MODE timer threshold data.

For each mode, `fwd_thresholds` defines which frames (within a 24-frame cycle,
advanced every 6 game frames = ~6 ticks) trigger each stop-hook level.

Stop-hook levels (0-indexed):
  0 → stop_0  (lightest counter-strafe)
  1 → stop_1
  2 → stop_2
  3 → stop_3
  4 → stop_4  (heaviest counter-strafe)

Thresholds are empirical values tuned for different FPS ranges.
All four directions (fwd, back, left, right) share the same threshold set
within a mode — directional asymmetry is not currently modelled.

cycle_len: total number of states in the timer chain before it resets.
           At 6 game-frames per tick, cycle_len=24 means ~144 game frames
           between full resets (~2s at 70fps).

v1_thresholds: used on initial key press
v2_thresholds: used on direction-change (already moving, reverse pressed)
"""

MODES: dict = {
    "m1": {
        "label": "Mode 1 — minimal (low FPS)",
        "cycle_len": 24,
        "v1_thresholds": [2, 3, 4, 5, 6],
        "v2_thresholds": [1, 2, 3, 4, 5],
    },
    "m1_5": {
        "label": "Mode 1.5 — light",
        "cycle_len": 24,
        "v1_thresholds": [2, 4, 5, 6, 7],
        "v2_thresholds": [2, 3, 5, 6, 8],
    },
    "m2": {
        "label": "Mode 2 — medium-light",
        "cycle_len": 24,
        "v1_thresholds": [2, 4, 5, 6, 8],
        "v2_thresholds": [2, 4, 6, 8, 12],
    },
    "m3": {
        "label": "Mode 3 — medium (default)",
        "cycle_len": 24,
        "v1_thresholds": [2, 4, 5, 7, 8],
        "v2_thresholds": [5, 6, 9, 16, 24],
    },
    "m4": {
        "label": "Mode 4 — heavy",
        "cycle_len": 32,
        "v1_thresholds": [2, 5, 8, 12, 16],
        "v2_thresholds": [3, 6, 10, 18, 26],
    },
    "m5": {
        "label": "Mode 5 — heavy (high FPS)",
        "cycle_len": 40,
        "v1_thresholds": [3, 6, 10, 16, 24],
        "v2_thresholds": [4, 8, 14, 22, 32],
    },
    "m6": {
        "label": "Mode 6 — maximum (high FPS)",
        "cycle_len": 48,
        "v1_thresholds": [3, 7, 12, 20, 32],
        "v2_thresholds": [4, 9, 16, 26, 40],
    },
}

DIRECTIONS = ["fwd", "back", "left", "right"]

# Human-readable direction labels for comments
DIR_LABELS = {
    "fwd":   "forward  (W)",
    "back":  "back     (S)",
    "left":  "left     (A)",
    "right": "right    (D)",
}

# Transition timer names:  dir_a → dir_b
TRANSITIONS = [
    ("fwd",  "back"),   # tmr_f2b
    ("back", "fwd"),    # tmr_b2f
    ("left", "right"),  # tmr_l2r
    ("right","left"),   # tmr_r2l
]
