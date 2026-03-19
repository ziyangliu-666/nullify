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
  bhop: boolean;
  bhop_key: string;
  jumpbug: boolean;
  jump_throw: boolean;
  fwd_jump_throw: boolean;
  jump_throw_key: string;
  fwd_jump_throw_key: string;
  jumpbug_key: string;
}

export const DEFAULT_SETTINGS: Settings = {
  bhop: false,
  bhop_key: "",
  jumpbug: false,
  jump_throw: false,
  fwd_jump_throw: false,
  jump_throw_key: "",
  fwd_jump_throw_key: "",
  jumpbug_key: "",
};
