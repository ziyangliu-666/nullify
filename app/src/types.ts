export interface SteamUser {
  steam_id64: string;
  account_id: string;
  account_name: string;
  persona_name: string;
  game_cfg: string;
  userdata_cfg: string | null;
  localconfig_path: string | null;
  is_most_recent: boolean;
  avatar_data: string | null;
}

export interface Settings {
  jiting: boolean;
  jiting_mode: string;
  bhop: boolean;
  jumpbug: boolean;
  jump_throw: boolean;
  fwd_jump_throw: boolean;
  sensitivity: number;
  m_yaw: number;
  m_pitch: number;
  toggle_jiting_key: string;
  jump_throw_key: string;
  fwd_jump_throw_key: string;
}

export const DEFAULT_SETTINGS: Settings = {
  jiting: true,
  jiting_mode: "jt_mode_3",
  bhop: true,
  jumpbug: false,
  jump_throw: true,
  fwd_jump_throw: false,
  sensitivity: 1.0,
  m_yaw: 0.022,
  m_pitch: 0.022,
  toggle_jiting_key: "v",
  jump_throw_key: "l",
  fwd_jump_throw_key: "p",
};

export const JITING_MODES = [
  { value: "jt_mode_1", label: "1" },
  { value: "jt_mode_1_5", label: "1.5" },
  { value: "jt_mode_2", label: "2" },
  { value: "jt_mode_3", label: "3" },
  { value: "jt_mode_4", label: "4" },
  { value: "jt_mode_5", label: "5" },
  { value: "jt_mode_6", label: "6" },
];

export type ModeDescKey =
  | "m1"
  | "m1_5"
  | "m2"
  | "m3"
  | "m4"
  | "m5"
  | "m6";

export const MODE_DESC_KEYS: Record<string, ModeDescKey> = {
  jt_mode_1: "m1",
  jt_mode_1_5: "m1_5",
  jt_mode_2: "m2",
  jt_mode_3: "m3",
  jt_mode_4: "m4",
  jt_mode_5: "m5",
  jt_mode_6: "m6",
};
