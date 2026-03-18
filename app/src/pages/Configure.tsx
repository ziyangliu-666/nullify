import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLocale, useUsers } from "../App";
import type { Settings } from "../types";
import { DEFAULT_SETTINGS, JITING_MODES, MODE_DESC_KEYS } from "../types";
import type { TKey } from "../i18n";

export default function Configure() {
  const { t } = useLocale();
  const { selectedUser } = useUsers();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const gameCfg = selectedUser?.game_cfg ?? null;
  const userdataCfg = selectedUser?.userdata_cfg ?? null;

  useEffect(() => {
    if (!gameCfg) {
      setLoading(false);
      return;
    }
    setLoading(true);
    invoke<Settings>("read_settings", { cfgDir: gameCfg, userdataCfg })
      .then((s) => setSettings(s))
      .catch(() => setSettings(DEFAULT_SETTINGS))
      .finally(() => setLoading(false));
  }, [gameCfg, userdataCfg]);

  async function handleApply() {
    if (!gameCfg) return;
    setSaving(true);
    setToast(null);
    try {
      await invoke("write_settings", { cfgDir: gameCfg, userdataCfg, settings });
      setToast({ ok: true, msg: t("saved_ok") });
    } catch (e: unknown) {
      setToast({ ok: false, msg: String(e) });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-cs-muted text-sm animate-pulse">
        {t("loading")}
      </div>
    );
  }

  const modeDescKey = MODE_DESC_KEYS[settings.jiting_mode] as TKey | undefined;

  return (
    <div className="h-full overflow-y-auto px-6 py-4 space-y-3">
      {/* Counter-strafe */}
      <div className="section-card space-y-3">
        <SectionTitle>{t("counter_strafe_title")}</SectionTitle>

        <ToggleRow
          label={t("cs_enable")}
          checked={settings.jiting}
          onChange={(v) => set("jiting", v)}
        />

        {settings.jiting && (
          <div className="space-y-2">
            <div className="text-xs text-cs-muted">{t("cs_mode")}</div>
            <div className="flex flex-wrap gap-1.5">
              {JITING_MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => set("jiting_mode", m.value)}
                  className={`pill-btn ${
                    settings.jiting_mode === m.value
                      ? "bg-cs-accent text-[#0f1117]"
                      : "bg-cs-bg border border-cs-border text-cs-muted hover:text-cs-text"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {modeDescKey && (
              <div className="text-xs text-cs-muted">{t(modeDescKey)}</div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-cs-text">{t("key_toggle_jiting")}</div>
          <KeyCapture
            value={settings.toggle_jiting_key}
            onChange={(v) => set("toggle_jiting_key", v)}
          />
        </div>
      </div>

      {/* Features */}
      <div className="section-card space-y-2.5">
        <SectionTitle>{t("features_title")}</SectionTitle>

        <ToggleRow
          label={t("bhop")}
          desc={t("bhop_desc")}
          checked={settings.bhop}
          onChange={(v) => set("bhop", v)}
        />
        <ToggleRow
          label={t("jumpbug")}
          desc={t("jumpbug_desc")}
          checked={settings.jumpbug}
          onChange={(v) => set("jumpbug", v)}
        />
        <ToggleRow
          label={t("jump_throw")}
          desc={t("jump_throw_desc")}
          checked={settings.jump_throw}
          onChange={(v) => set("jump_throw", v)}
          keyValue={settings.jump_throw_key}
          onKeyChange={(v) => set("jump_throw_key", v)}
        />
        <ToggleRow
          label={t("fwd_jump_throw")}
          desc={t("fwd_jump_throw_desc")}
          checked={settings.fwd_jump_throw}
          onChange={(v) => set("fwd_jump_throw", v)}
          keyValue={settings.fwd_jump_throw_key}
          onKeyChange={(v) => set("fwd_jump_throw_key", v)}
        />
      </div>

      {/* Sensitivity */}
      <div className="section-card space-y-3">
        <SectionTitle>{t("sens_title")}</SectionTitle>

        <div className="grid grid-cols-3 gap-3">
          <NumberInput
            label="sensitivity"
            value={settings.sensitivity}
            onChange={(v) => set("sensitivity", v)}
            step={0.1}
            min={0.1}
            max={20}
          />
          <NumberInput
            label="m_yaw"
            value={settings.m_yaw}
            onChange={(v) => set("m_yaw", v)}
            step={0.001}
            min={0.001}
            max={1}
          />
          <NumberInput
            label="m_pitch"
            value={settings.m_pitch}
            onChange={(v) => set("m_pitch", v)}
            step={0.001}
            min={0.001}
            max={1}
          />
        </div>
      </div>

      {/* Apply */}
      <div className="flex items-center gap-4 pb-2">
        <button
          className="btn-primary"
          disabled={saving || !gameCfg}
          onClick={handleApply}
        >
          {saving ? t("saving_btn") : t("apply_btn")}
        </button>
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

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
  keyValue,
  onKeyChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  keyValue?: string;
  onKeyChange?: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm text-cs-text">{label}</div>
        {desc && <div className="text-xs text-cs-muted truncate">{desc}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {keyValue !== undefined && onKeyChange && (
          <KeyCapture value={keyValue} onChange={onKeyChange} />
        )}
        <button
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`toggle-track ${checked ? "bg-cs-accent" : "bg-cs-border"}`}
        >
          <span className={`toggle-thumb ${checked ? "translate-x-4" : "translate-x-0"}`} />
        </button>
      </div>
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
  const [listening, setListening] = useState(false);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (!listening) return;
    startTimeRef.current = Date.now();

    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
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
      className={`w-14 h-7 rounded border text-xs font-mono uppercase transition-colors ${
        listening
          ? "border-cs-accent text-cs-accent bg-cs-accent/10 animate-pulse"
          : "border-cs-border text-cs-muted bg-cs-bg hover:border-cs-muted hover:text-cs-text"
      }`}
      onClick={() => setListening(true)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {listening ? "···" : value || "—"}
    </button>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-cs-muted font-mono">{label}</div>
      <input
        type="number"
        className="input-field"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
      />
    </div>
  );
}
