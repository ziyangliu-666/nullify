import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useLocale, useUsers } from "../App";
import type { SteamUser } from "../types";
import clearSteamLaunchExample from "../assets/clear-steam-launch-example.png";
import officialSteamLaunchExample from "../assets/official-steam-launch-example.png";
import thirdPartyLaunchExample from "../assets/third-party-launch-example.png";

const FALLBACK_LAUNCH_OPTION =
  `+exec nullify/setup -testscript "../../csgo/cfg/nullify/.vtest"`;

// Avatar color palette — pick by account_id hash
const AVATAR_COLORS = [
  "#e8a24a", // accent orange
  "#4c9af5", // blue
  "#4caf7a", // green
  "#9b59b6", // purple
  "#1abc9c", // teal
  "#e05252", // red
];

function avatarColor(accountId: string): string {
  const n = parseInt(accountId || "0", 10) || 0;
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function Avatar({
  user,
  size = 36,
}: {
  user: SteamUser;
  size?: number;
}) {
  const initial = (user.persona_name || user.account_name || "?")[0].toUpperCase();
  const color = avatarColor(user.account_id);

  if (user.avatar_data) {
    return (
      <img
        src={user.avatar_data}
        alt={user.persona_name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0"
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-bold text-sm text-[#0f1117]"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      {initial}
    </div>
  );
}

type PlatformMode = "official" | "third_party" | null;

export default function Install({
  onOpenConfigure,
}: {
  onOpenConfigure: () => void;
}) {
  const { t } = useLocale();
  const { users, setUsers, selectedUser, setSelectedUser } = useUsers();

  const [loadError, setLoadError] = useState<string | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [installMsg, setInstallMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [closeMsg, setCloseMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [launchOption, setLaunchOption] = useState(FALLBACK_LAUNCH_OPTION);
  const [platformMode, setPlatformMode] = useState<PlatformMode>(null);

  useEffect(() => {
    invoke<string>("nullify_launch_option")
      .then(setLaunchOption)
      .catch(() => setLaunchOption(FALLBACK_LAUNCH_OPTION));
  }, []);

  useEffect(() => {
    setPlatformMode(null);
    setCopied(false);
  }, [selectedUser?.account_id]);

  // Load users on mount
  useEffect(() => {
    invoke<SteamUser[]>("detect_users")
      .then((u) => {
        setUsers(u);
        const most_recent = u.find((x) => x.is_most_recent) ?? u[0] ?? null;
        setSelectedUser(most_recent);
      })
      .catch((e: unknown) => setLoadError(String(e)));
  }, []);

  useEffect(() => {
    if (!selectedUser?.game_cfg) {
      setInstalled(false);
      return;
    }

    invoke<boolean>("install_status", {
      gameCfgDir: selectedUser.game_cfg,
    })
      .then(setInstalled)
      .catch(() => setInstalled(false));
  }, [selectedUser?.game_cfg]);

  async function handleInstall() {
    if (!selectedUser) return;
    setInstalling(true);
    setInstallMsg(null);
    try {
      await invoke("install_cfg", { gameCfgDir: selectedUser.game_cfg });
      const ok = await invoke<boolean>("install_status", {
        gameCfgDir: selectedUser.game_cfg,
      });
      setInstalled(ok);
      setInstallMsg({ ok: true, text: t("install_ok") });
    } catch (e: unknown) {
      setInstallMsg({ ok: false, text: String(e) });
    } finally {
      setInstalling(false);
    }
  }

  async function handleUninstall() {
    if (!selectedUser) return;
    setUninstalling(true);
    setInstallMsg(null);
    try {
      await invoke("uninstall_cfg", {
        gameCfgDir: selectedUser.game_cfg,
        userdataCfg: selectedUser.userdata_cfg,
      });
      const ok = await invoke<boolean>("install_status", {
        gameCfgDir: selectedUser.game_cfg,
      });
      setInstalled(ok);
      setInstallMsg({ ok: true, text: t("uninstall_ok") });
    } catch (e: unknown) {
      setInstallMsg({ ok: false, text: String(e) });
    } finally {
      setUninstalling(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(launchOption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCloseInstaller() {
    setCloseMsg(null);
    try {
      await getCurrentWindow().close();
    } catch (e: unknown) {
      setCloseMsg(String(e));
    }
  }

  const gameCfg = selectedUser?.game_cfg ?? null;
  const canChoosePlatform = Boolean(selectedUser && installed);
  const canConfigure = Boolean(selectedUser && installed && platformMode);

  return (
    <div className="h-full overflow-y-auto px-6 py-4 space-y-3">
      {/* User switcher */}
      {loadError ? (
        <div className="section-card flex items-center gap-2 text-cs-error text-sm">
          <WarningIcon />
          {loadError}
        </div>
      ) : users.length === 0 ? (
        <div className="section-card text-cs-muted text-sm animate-pulse">
          {t("detecting")}
        </div>
      ) : (
        <UserSwitcher
          users={users}
          selected={selectedUser}
          onSelect={(u) => {
            setSelectedUser(u);
          }}
        />
      )}

      {/* Step 1 */}
      {gameCfg && (
        <FlowSection
          step="1"
          title={t("step_install_cfg_title")}
        >
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-widest text-cs-muted">
              {t("game_cfg_title")}
            </div>
            <div className="flex items-start gap-2">
              <CheckIcon className="text-cs-success mt-0.5 shrink-0" />
              <span className="text-xs text-cs-text font-mono break-all leading-relaxed">
                {gameCfg}
              </span>
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-xs text-cs-muted">
                {t("install_shared_hint")}
              </span>
              <span
                className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${
                  installed
                    ? "border-cs-success text-cs-success bg-cs-success/10"
                    : "border-cs-muted text-cs-muted"
                }`}
              >
                {installed ? t("status_installed") : t("status_not_installed")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              className="btn-primary"
              disabled={installing || uninstalling}
              onClick={handleInstall}
            >
              {installing
                ? t("installing_btn")
                : installed
                ? t("reinstall_btn")
                : t("install_btn")}
            </button>
            {installed && (
              <button
                className="btn-ghost"
                disabled={installing || uninstalling}
                onClick={handleUninstall}
              >
                {uninstalling ? t("uninstalling_btn") : t("uninstall_btn")}
              </button>
            )}
            {installMsg && (
              <span
                className={`text-sm ${
                  installMsg.ok ? "text-cs-success" : "text-cs-error"
                }`}
              >
                {installMsg.text}
              </span>
            )}
          </div>
        </FlowSection>
      )}

      {/* Step 2 */}
      {selectedUser && (
        <FlowSection
          step="2"
          title={t("step_choose_platform_title")}
          muted={!canChoosePlatform}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <button
              className={`rounded-lg border px-4 py-3 text-left transition-colors duration-150 ${
                platformMode === "official"
                  ? "border-cs-accent bg-cs-accent/10"
                  : "border-cs-border bg-cs-bg hover:border-cs-muted"
              } ${!canChoosePlatform ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={!canChoosePlatform}
              onClick={() => setPlatformMode("official")}
            >
              <div className="text-sm font-semibold text-cs-text">
                {t("official_launch_title")}
              </div>
              <p className="mt-1 text-xs text-cs-muted">
                {t("platform_choice_official_hint")}
              </p>
            </button>

            <button
              className={`rounded-lg border px-4 py-3 text-left transition-colors duration-150 ${
                platformMode === "third_party"
                  ? "border-cs-accent bg-cs-accent/10"
                  : "border-cs-border bg-cs-bg hover:border-cs-muted"
              } ${!canChoosePlatform ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={!canChoosePlatform}
              onClick={() => setPlatformMode("third_party")}
            >
              <div className="text-sm font-semibold text-cs-text">
                {t("third_party_launch_title")}
              </div>
              <p className="mt-1 text-xs text-cs-muted">
                {t("platform_choice_third_party_hint")}
              </p>
            </button>
          </div>
        </FlowSection>
      )}

      {/* Step 3 */}
      {selectedUser && (
        <FlowSection
          step="3"
          title={t("step_apply_platform_title")}
          muted={!installed || !platformMode}
        >
          {!installed ? (
            <p className="text-xs text-cs-muted">
              {t("step_apply_platform_wait_install")}
            </p>
          ) : !platformMode ? (
            <p className="text-xs text-cs-muted">
              {t("step_apply_platform_wait_choice")}
            </p>
          ) : platformMode === "official" && !selectedUser.localconfig_path ? (
            <div className="space-y-3 rounded border border-cs-border bg-cs-bg/40 px-3 py-3">
              <p className="text-xs text-cs-muted">
                {t("official_manual_desc")}
              </p>
              <LaunchOptionCode
                copied={copied}
                launchOption={launchOption}
                onCopy={handleCopy}
              />
            </div>
          ) : platformMode === "official" ? (
            <div className="space-y-3 rounded border border-cs-border bg-cs-bg/40 px-3 py-3">
              <div>
                <div className="text-sm text-cs-text">
                  {t("official_launch_title")}
                </div>
                <p className="mt-1 text-xs text-cs-muted">
                  {t("official_launch_desc")}
                </p>
              </div>

              <div className="text-xs text-cs-muted">{t("official_action_hint")}</div>

              <div className="space-y-2">
                <div className="text-xs text-cs-muted">
                  {t("launch_option_reference_title")}
                </div>
                <LaunchOptionCode
                  copied={copied}
                  launchOption={launchOption}
                  onCopy={handleCopy}
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-cs-muted">
                  {t("official_example_title")}
                </div>
                <img
                  src={officialSteamLaunchExample}
                  alt={t("official_example_alt")}
                  className="mx-auto max-h-56 w-full max-w-2xl rounded-lg border border-cs-border bg-cs-bg object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded border border-cs-border bg-cs-bg/40 px-3 py-3">
              <div className="text-sm text-cs-text">
                {t("third_party_launch_title")}
              </div>

              <div className="rounded border border-yellow-600/50 bg-yellow-600/10 px-3 py-2 text-xs text-yellow-400 font-medium">
                {t("third_party_launch_warning")}
              </div>

              <div className="space-y-2">
                <div className="text-xs text-cs-muted">
                  {t("third_party_action_hint")}
                </div>
                <img
                  src={clearSteamLaunchExample}
                  alt={t("third_party_clear_example_alt")}
                  className="mx-auto max-h-56 w-full max-w-2xl rounded-lg border border-cs-border bg-cs-bg object-contain"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-cs-muted">
                  {t("third_party_copy_title")}
                </div>
                <LaunchOptionCode
                  copied={copied}
                  launchOption={launchOption}
                  onCopy={handleCopy}
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-cs-muted">
                  {t("third_party_example_title")}
                </div>
                <img
                  src={thirdPartyLaunchExample}
                  alt={t("third_party_example_alt")}
                  className="mx-auto max-h-56 w-full max-w-2xl rounded-lg border border-cs-border bg-cs-bg object-contain"
                />
              </div>
            </div>
          )}
        </FlowSection>
      )}

      {/* Step 4 */}
      {selectedUser && (
        <FlowSection
          step="4"
          title={t("step_configure_title")}
          muted={!canConfigure}
        >
          <div className="flex items-center gap-3">
            <button
              className="btn-primary"
              disabled={!canConfigure}
              onClick={onOpenConfigure}
            >
              {t("open_configure_btn")}
            </button>
            <span className="text-xs text-cs-muted">
              {t("configure_step_hint")}
            </span>
          </div>
        </FlowSection>
      )}

      <FlowSection step="5" title={t("step_close_title")}>
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={handleCloseInstaller}>
            {t("close_installer_btn")}
          </button>
          <span className="text-xs text-cs-muted">{t("close_step_hint")}</span>
        </div>
        {closeMsg && <div className="text-xs text-cs-error">{closeMsg}</div>}
      </FlowSection>

      {/* Cloud sync notice */}
      <div className="flex items-start gap-2 px-1 pb-1">
        <svg className="w-3.5 h-3.5 text-yellow-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-[10px] text-cs-muted leading-relaxed">
          {t("cloud_sync_notice")}
        </p>
      </div>
    </div>
  );
}

// ─── User switcher ────────────────────────────────────────────────────────────

function FlowSection({
  step,
  title,
  muted = false,
  children,
}: {
  step: string;
  title: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`section-card space-y-3 ${muted ? "opacity-80" : ""}`}>
      <div className="flex items-center gap-3 pt-1">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
            muted
              ? "border-cs-border text-cs-muted bg-cs-bg"
              : "border-cs-accent/40 bg-cs-accent/10 text-cs-accent"
          }`}
        >
          {step}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-cs-text">{title}</div>
        </div>
      </div>

      {children}
    </div>
  );
}

function LaunchOptionCode({
  launchOption,
  copied,
  onCopy,
}: {
  launchOption: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const { t } = useLocale();

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 bg-cs-bg border border-cs-border rounded px-3 py-2 text-xs text-cs-text font-mono break-all select-text">
        {launchOption}
      </code>
      <button className="btn-ghost shrink-0" onClick={onCopy}>
        {copied ? t("copied_btn") : t("copy_btn")}
      </button>
    </div>
  );
}

function UserSwitcher({
  users,
  selected,
  onSelect,
}: {
  users: SteamUser[];
  selected: SteamUser | null;
  onSelect: (u: SteamUser) => void;
}) {
  const { t } = useLocale();

  if (users.length === 1 && users[0]) {
    const u = users[0];
    return (
      <div className="flex items-center gap-2 py-1">
        <Avatar user={u} size={28} />
        <div>
          <span className="text-sm font-medium text-cs-text">
            {u.persona_name || u.account_name}
          </span>
          {u.account_name && u.account_name !== u.persona_name && (
            <span className="text-xs text-cs-muted ml-1.5">
              {u.account_name}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="section-card space-y-2">
      <div className="text-xs font-semibold uppercase tracking-widest text-cs-muted">
        {t("accounts_title")}
      </div>
      <div className="flex gap-2 flex-wrap">
        {users.map((u) => (
          <UserCard
            key={u.steam_id64 || u.account_id}
            user={u}
            selected={selected?.account_id === u.account_id}
            onClick={() => onSelect(u)}
          />
        ))}
      </div>
    </div>
  );
}

function UserCard({
  user,
  selected,
  onClick,
}: {
  user: SteamUser;
  selected: boolean;
  onClick: () => void;
}) {
  const { t } = useLocale();
  const [launchOk, setLaunchOk] = useState<boolean | null>(null);
  const [launchOption, setLaunchOption] = useState(FALLBACK_LAUNCH_OPTION);

  useEffect(() => {
    invoke<string>("nullify_launch_option")
      .then(setLaunchOption)
      .catch(() => setLaunchOption(FALLBACK_LAUNCH_OPTION));
  }, []);

  useEffect(() => {
    if (!user.localconfig_path) return;
    invoke<string>("get_launch_options", {
      localconfigPath: user.localconfig_path,
    })
      .then((val) => setLaunchOk(val === launchOption))
      .catch(() => setLaunchOk(null));
  }, [launchOption, user.localconfig_path]);

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all duration-150 ${
        selected
          ? "border-cs-accent bg-cs-accent/5"
          : "border-cs-border hover:border-cs-muted bg-cs-bg"
      }`}
    >
      <Avatar user={user} size={32} />
      <div className="text-left">
        <div className="text-sm font-medium text-cs-text leading-tight">
          {user.persona_name || user.account_name || user.account_id}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {launchOk === true && (
            <span className="text-[10px] text-cs-success">
              ✓ {t("account_launch_set")}
            </span>
          )}
          {launchOk === false && (
            <span className="text-[10px] text-cs-muted">
              {t("account_launch_missing")}
            </span>
          )}
          {!user.userdata_cfg && (
            <span className="text-[10px] text-cs-muted">
              {t("no_userdata")}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`w-4 h-4 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      className="w-4 h-4 text-cs-error shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  );
}
