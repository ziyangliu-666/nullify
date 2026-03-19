import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLocale, useUsers } from "../App";
import type { SteamUser } from "../types";

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

type LaunchStatus = "unknown" | "ok" | "missing" | "different";

function useLaunchStatus(user: SteamUser | null, launchOption: string) {
  const [status, setStatus] = useState<LaunchStatus>("unknown");
  const [currentValue, setCurrentValue] = useState<string>("");

  useEffect(() => {
    if (!user?.localconfig_path) {
      setStatus("unknown");
      return;
    }
    invoke<string>("get_launch_options", {
      localconfigPath: user.localconfig_path,
    })
      .then((val) => {
        setCurrentValue(val);
        if (val === launchOption) setStatus("ok");
        else if (!val.trim()) setStatus("missing");
        else setStatus("different");
      })
      .catch(() => setStatus("unknown"));
  }, [user?.localconfig_path, launchOption]);

  return { status, currentValue, setStatus };
}

export default function Install() {
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

  const [writing, setWriting] = useState(false);
  const [writeMsg, setWriteMsg] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [pendingSteamRestart, setPendingSteamRestart] = useState(false);
  const [copied, setCopied] = useState(false);
  const [launchOption, setLaunchOption] = useState(FALLBACK_LAUNCH_OPTION);

  const { status: launchStatus, setStatus: setLaunchStatus } =
    useLaunchStatus(selectedUser, launchOption);

  useEffect(() => {
    invoke<string>("nullify_launch_option")
      .then(setLaunchOption)
      .catch(() => setLaunchOption(FALLBACK_LAUNCH_OPTION));
  }, []);

  useEffect(() => {
    if (!pendingSteamRestart) return;

    let cancelled = false;

    async function checkSteam() {
      try {
        const running = await invoke<boolean>("steam_running_status");
        if (!cancelled && !running) {
          setPendingSteamRestart(false);
          setWriteMsg(null);
        }
      } catch {
        // Ignore transient checks; keep the message until a successful check clears it.
      }
    }

    void checkSteam();
    const intervalId = window.setInterval(() => {
      void checkSteam();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [pendingSteamRestart]);

  useEffect(() => {
    setPendingSteamRestart(false);
  }, [selectedUser?.account_id]);

  // Load users on mount
  useEffect(() => {
    invoke<SteamUser[]>("detect_users")
      .then((u) => {
        setUsers(u);
        const most_recent = u.find((x) => x.is_most_recent) ?? u[0] ?? null;
        setSelectedUser(most_recent);
        if (most_recent) {
          invoke<boolean>("install_status", {
            gameCfgDir: most_recent.game_cfg,
          }).then(setInstalled);
        }
      })
      .catch((e: unknown) => setLoadError(String(e)));
  }, []);

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

  async function handleWriteLaunchOption() {
    if (!selectedUser?.localconfig_path) return;
    setWriting(true);
    setWriteMsg(null);
    try {
      const needsRestart = await invoke<boolean>("set_launch_options", {
        localconfigPath: selectedUser.localconfig_path,
        value: launchOption,
      });
      setLaunchStatus("ok");
      setPendingSteamRestart(needsRestart);
      setWriteMsg({
        ok: true,
        text: needsRestart ? t("write_need_restart") : t("write_ok_no_restart"),
      });
    } catch (e: unknown) {
      setPendingSteamRestart(false);
      setWriteMsg({ ok: false, text: String(e) });
    } finally {
      setWriting(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(launchOption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const gameCfg = selectedUser?.game_cfg ?? null;

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
            invoke<boolean>("install_status", {
              gameCfgDir: u.game_cfg,
            }).then(setInstalled);
          }}
        />
      )}

      {/* CFG path + install */}
      {gameCfg && (
        <div className="section-card space-y-2">
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
            <span className="text-xs text-cs-muted">{t("install_shared_hint")}</span>
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
        </div>
      )}

      {/* Launch option */}
      {selectedUser && (
        <div className="section-card space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-widest text-cs-muted">
              {t("launch_option_title")}
            </div>
            <LaunchStatusBadge status={launchStatus} />
          </div>
          <p className="text-xs text-cs-muted">{t("launch_option_desc")}</p>

          <div className="flex items-center gap-2">
            <code className="flex-1 bg-cs-bg border border-cs-border rounded px-3 py-2 text-xs text-cs-text font-mono break-all select-text">
              {launchOption}
            </code>
            <button className="btn-ghost shrink-0" onClick={handleCopy}>
              {copied ? t("copied_btn") : t("copy_btn")}
            </button>
          </div>

          {selectedUser.localconfig_path ? (
            <div className="flex items-center gap-3">
              <button
                className="btn-primary"
                disabled={writing}
                onClick={handleWriteLaunchOption}
              >
                {writing
                  ? t("writing_btn")
                  : launchStatus === "ok"
                  ? t("rewrite_btn")
                  : t("write_btn")}
              </button>
              {writeMsg && (
                <span
                  className={`text-xs ${
                    writeMsg.ok ? "text-cs-success" : "text-cs-error"
                  }`}
                >
                  {writeMsg.text}
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-cs-muted">
              {t("no_userdata")} — 请手动粘贴启动项
            </p>
          )}
        </div>
      )}

      {/* Steps */}
      <div className="section-card text-xs text-cs-muted space-y-1">
        <div className="font-semibold uppercase tracking-widest mb-1.5">
          {t("steps_title")}
        </div>
        <ol className="list-decimal list-inside space-y-1">
          <li>{t("step_1")}</li>
          <li>{t("step_2")}</li>
          <li>{t("step_3")}</li>
          <li>{t("step_4")}</li>
        </ol>
      </div>

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

function LaunchStatusBadge({ status }: { status: LaunchStatus }) {
  const { t } = useLocale();

  if (status === "unknown") return null;

  const map: Record<LaunchStatus, { cls: string; text: string }> = {
    unknown: { cls: "", text: "" },
    ok: { cls: "border-cs-success text-cs-success bg-cs-success/10", text: t("launch_status_ok") },
    missing: { cls: "border-cs-muted text-cs-muted", text: t("launch_status_missing") },
    different: { cls: "border-yellow-600 text-yellow-500", text: t("launch_status_different") },
  };

  const { cls, text } = map[status];
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {text}
    </span>
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
