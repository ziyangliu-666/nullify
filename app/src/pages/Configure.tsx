import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLocale, useUsers } from "../App";
import type { Settings } from "../types";
import { DEFAULT_SETTINGS } from "../types";

export default function Configure() {
  const { t } = useLocale();
  const { selectedUser } = useUsers();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const didInitRef = useRef(false);
  const saveSeqRef = useRef(0);

  const gameCfg = selectedUser?.game_cfg ?? null;
  const userdataCfg = selectedUser?.userdata_cfg ?? null;

  function normalizeKey(k: string) {
    return (k ?? "").trim().toLowerCase();
  }

  function getKeyConflicts(s: Settings): string[] {
    const reservedFixed: Array<{ key: string; label: string }> = [
      { key: "w", label: "W(前进)" },
      { key: "a", label: "A(左)" },
      { key: "s", label: "S(后退)" },
      { key: "d", label: "D(右)" },
      { key: "b", label: "B(购买菜单)" },
      { key: "shift", label: "Shift(冲刺)" },
      { key: "ctrl", label: "Ctrl(蹲下)" },
      { key: "e", label: "E(使用)" },
      { key: "g", label: "G(丢雷)" },
      { key: "q", label: "Q(切换武器)" },
      { key: "mouse1", label: "鼠标1(攻击)" },
      { key: "mouse2", label: "鼠标2(副攻击)" },
      { key: "1", label: "1(武器槽1)" },
      { key: "2", label: "2(武器槽2)" },
      { key: "3", label: "3(武器槽3)" },
      { key: "4", label: "4(武器槽4)" },
      { key: "5", label: "5(武器槽5)" },
    ];

    const featureKeys: Array<{ key: string; label: string; enabled: boolean }> = [
      { key: s.bhop_key, label: "连跳(Bhop)", enabled: normalizeKey(s.bhop_key) !== "" },
      { key: s.jump_throw_key, label: "跳投(Jump Throw)", enabled: normalizeKey(s.jump_throw_key) !== "" },
      { key: s.fwd_jump_throw_key, label: "前跳投(Jump Throw Forward)", enabled: normalizeKey(s.fwd_jump_throw_key) !== "" },
      { key: s.jumpbug_key, label: "大跳(Jumpbug)", enabled: normalizeKey(s.jumpbug_key) !== "" },
    ];

    const all = [
      ...reservedFixed.map((r) => ({ key: r.key, name: r.label })),
      ...featureKeys
        .filter((f) => f.enabled)
        .map((f) => ({ key: normalizeKey(f.key), name: f.label })),
    ];

    // Only treat conflicts among non-empty keys.
    const keyToNames = new Map<string, string[]>();
    for (const item of all) {
      const k = normalizeKey(item.key);
      if (!k) continue;
      const arr = keyToNames.get(k) ?? [];
      arr.push(item.name);
      keyToNames.set(k, arr);
    }

    const conflicts: string[] = [];
    for (const [k, names] of keyToNames.entries()) {
      // If key appears in 2+ binds, it's a real conflict in the generated keys.cfg.
      if (names.length >= 2) {
        conflicts.push(`${k}: ${names.join(" / ")}`);
      }
    }
    return conflicts;
  }

  useEffect(() => {
    if (!gameCfg) {
      setLoading(false);
      return;
    }
    // Reset the "skip first write" flag when switching users/cfg dirs.
    didInitRef.current = false;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

    setLoading(true);
    invoke<Settings>("read_settings", { cfgDir: gameCfg })
      .then((s) => setSettings(s))
      .catch(() => setSettings(DEFAULT_SETTINGS))
      .finally(() => setLoading(false));
  }, [gameCfg]);

  async function saveSettings() {
    if (!gameCfg) return;

    const conflicts = getKeyConflicts(settings);
    if (conflicts.length > 0) {
      setToast({ ok: false, msg: `键位冲突，已跳过保存：${conflicts[0]}` });
      return;
    }

    setSaving(true);
    setToast(null);
    const seq = ++saveSeqRef.current;

    try {
      await invoke("write_settings", {
        cfgDir: gameCfg,
        userdataCfg,
        settings,
      });
      // Ignore stale completions (if settings changed again during the request)
      if (saveSeqRef.current !== seq) return;
      setToast({
        ok: true,
        msg: t("saved_ok"),
      });
    } catch (e: unknown) {
      if (saveSeqRef.current !== seq) return;
      setToast({ ok: false, msg: String(e) });
    } finally {
      if (saveSeqRef.current !== seq) return;
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  // Auto-config: whenever settings change, write cfg files (debounced).
  useEffect(() => {
    if (!gameCfg) return;
    if (loading) return;

    // Skip the first write caused by initial settings hydration.
    if (!didInitRef.current) {
      didInitRef.current = true;
      return;
    }

    if (getKeyConflicts(settings).length > 0) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void saveSettings();
    }, 450);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, loading, gameCfg, userdataCfg]);

  const keyConflicts = !loading ? getKeyConflicts(settings) : [];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-cs-muted text-sm animate-pulse">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-4 space-y-3">
      {/* Features */}
      <div className="section-card space-y-2.5">
        <SectionTitle>{t("features_title")}</SectionTitle>

        {keyConflicts.length > 0 && (
          <div className="text-cs-error text-sm font-semibold">
            {`键位冲突（已暂停自动保存）`}
          </div>
        )}

        <div className="text-[11px] text-cs-muted">
          {`按 Esc 清空键位；不绑定则不起用。`}
        </div>

        <KeyBindRow
          label={t("bhop")}
          desc={t("bhop_desc")}
          value={settings.bhop_key}
          onKeyChange={(v) => set("bhop_key", v)}
        />
        <KeyBindRow
          label={t("jumpbug")}
          desc={t("jumpbug_desc")}
          value={settings.jumpbug_key}
          onKeyChange={(v) => set("jumpbug_key", v)}
        />
        <KeyBindRow
          label={t("jump_throw")}
          desc={t("jump_throw_desc")}
          value={settings.jump_throw_key}
          onKeyChange={(v) => set("jump_throw_key", v)}
        />
        <KeyBindRow
          label={t("fwd_jump_throw")}
          desc={t("fwd_jump_throw_desc")}
          value={settings.fwd_jump_throw_key}
          onKeyChange={(v) => set("fwd_jump_throw_key", v)}
        />
      </div>

      {/* Apply */}
      <div className="flex items-center gap-4 pb-2">
        {saving && <span className="text-sm text-cs-muted">{t("saving_btn")}</span>}
        {toast && (
          <span
            className={`text-sm ${toast.ok ? "text-cs-success" : "text-cs-error"}`}
          >
            {toast.msg}
          </span>
        )}
        {!gameCfg && (
          <span className="text-xs text-cs-muted">{t("detecting")}</span>
        )}
      </div>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-widest text-cs-muted">
      {children}
    </div>
  );
}

function KeyBindRow({
  label,
  desc,
  value,
  onKeyChange,
}: {
  label: string;
  desc?: string;
  value: string;
  onKeyChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm text-cs-text">{label}</div>
        {desc && <div className="text-xs leading-5 text-cs-muted">{desc}</div>}
      </div>
      <KeyCapture value={value} onChange={onKeyChange} />
    </div>
  );
}

function browserKeyToCS2(e: KeyboardEvent): string | null {
  if (e.key === "Escape") return null;
  if (e.key === " ") return "space";
  if (e.key === "Enter") return "enter";
  if (e.key === "Backspace") return "backspace";
  if (e.key === "Tab") return "tab";
  if (e.key === "Delete") return "delete";
  if (e.key === "ArrowUp") return "uparrow";
  if (e.key === "ArrowDown") return "downarrow";
  if (e.key === "ArrowLeft") return "leftarrow";
  if (e.key === "ArrowRight") return "rightarrow";
  if (e.key === "Shift") return "shift";
  if (e.key === "Control") return "ctrl";
  if (e.key === "Alt") return "alt";
  if (/^F\d+$/.test(e.key)) return e.key.toLowerCase();
  const numpadMap: Record<string, string> = {
    Numpad0: "kp_0", Numpad1: "kp_1", Numpad2: "kp_2", Numpad3: "kp_3",
    Numpad4: "kp_4", Numpad5: "kp_5", Numpad6: "kp_6", Numpad7: "kp_7",
    Numpad8: "kp_8", Numpad9: "kp_9", NumpadEnter: "kp_enter",
    NumpadAdd: "kp_plus", NumpadSubtract: "kp_minus",
    NumpadMultiply: "kp_multiply", NumpadDivide: "kp_slash",
  };
  if (e.code in numpadMap) return numpadMap[e.code];
  if (e.key.length === 1) return e.key.toLowerCase();
  return null;
}

function mouseButtonToCS2(button: number): string {
  // CS2: mouse1=left, mouse2=right, mouse3=middle, mouse4, mouse5
  return (["mouse1", "mouse3", "mouse2", "mouse4", "mouse5"] as const)[button]
    ?? `mouse${button + 1}`;
}

function KeyCapture({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { locale } = useLocale();
  const unbound = locale === "zh" ? "未绑定" : "unbound";
  const [listening, setListening] = useState(false);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (!listening) return;
    startTimeRef.current = Date.now();

    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        onChange("");
        setListening(false);
        return;
      }
      const k = browserKeyToCS2(e);
      if (k === null) { setListening(false); return; }
      onChange(k);
      setListening(false);
    }

    function onMouseDown(e: MouseEvent) {
      if (Date.now() - startTimeRef.current < 80) return; // ignore triggering click
      e.preventDefault();
      e.stopPropagation();
      onChange(mouseButtonToCS2(e.button));
      setListening(false);
    }

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("mousedown", onMouseDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [listening, onChange]);

  return (
    <button
      className={`min-w-14 h-7 px-2 rounded border text-xs font-mono uppercase transition-colors ${
        listening
          ? "border-cs-accent text-cs-accent bg-cs-accent/10 animate-pulse"
          : "border-cs-border text-cs-muted bg-cs-bg hover:border-cs-muted hover:text-cs-text"
      }`}
      onClick={() => setListening(true)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {listening ? "···" : value || unbound}
    </button>
  );
}
