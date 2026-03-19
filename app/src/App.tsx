import { createContext, useContext, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Install from "./pages/Install";
import Configure from "./pages/Configure";
import type { Locale } from "./i18n";
import { makeT } from "./i18n";
import type { SteamUser } from "./types";

// ─── Locale context ───────────────────────────────────────────────────────────

interface LocaleCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: ReturnType<typeof makeT>;
}

export const LocaleContext = createContext<LocaleCtx>({
  locale: "zh",
  setLocale: () => {},
  t: makeT("zh"),
});

export function useLocale() {
  return useContext(LocaleContext);
}

// ─── User context ─────────────────────────────────────────────────────────────

interface UserCtx {
  users: SteamUser[];
  setUsers: (u: SteamUser[]) => void;
  selectedUser: SteamUser | null;
  setSelectedUser: (u: SteamUser | null) => void;
}

export const UserContext = createContext<UserCtx>({
  users: [],
  setUsers: () => {},
  selectedUser: null,
  setSelectedUser: () => {},
});

export function useUsers() {
  return useContext(UserContext);
}

// ─── App ──────────────────────────────────────────────────────────────────────

type Tab = "install" | "configure";

const RUFUS_URL = "https://space.bilibili.com/108063845";
const FOREVER_RISE_URL = "https://space.bilibili.com/393111255";
const GITHUB_URL = "https://github.com/ziyangliu-666/nullify";

export default function App() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [tab, setTab] = useState<Tab>("install");
  const [users, setUsers] = useState<SteamUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SteamUser | null>(null);

  const t = makeT(locale);

  async function openExternalLink(url: string) {
    try {
      await invoke("open_external_link", { url });
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      <UserContext.Provider
        value={{ users, setUsers, selectedUser, setSelectedUser }}
      >
        <div className="flex flex-col h-screen w-screen bg-cs-bg">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-0 shrink-0">
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-cs-accent font-bold text-lg tracking-widest uppercase">
                nullify
              </span>
              <span className="text-cs-muted text-xs tracking-wider">CS2 CFG</span>
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-center px-2">
              <div className="min-w-0 truncate text-[11px] tracking-wide text-cs-muted">
                <button
                  type="button"
                  onClick={() => void openExternalLink(RUFUS_URL)}
                  className="credit-link inline-flex items-center gap-1 font-semibold text-cs-accent"
                >
                  <span aria-hidden="true" className="text-[10px] leading-none">
                    ♥
                  </span>
                  {t("credit_by")}
                </button>
                <span className="mx-2 text-cs-border">|</span>
                <button
                  type="button"
                  onClick={() => void openExternalLink(FOREVER_RISE_URL)}
                  className="credit-link"
                >
                  {t("credit_reference")}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void openExternalLink(GITHUB_URL)}
                className="credit-link inline-flex h-9 w-9 items-center justify-center text-cs-muted hover:text-cs-text"
                aria-label="Open GitHub repository"
                title="GitHub"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5 fill-current"
                >
                  <path d="M12 .5C5.648.5.5 5.648.5 12c0 5.082 3.292 9.395 7.86 10.916.575.106.785-.25.785-.556 0-.274-.01-1-.016-1.962-3.197.695-3.872-1.54-3.872-1.54-.523-1.328-1.278-1.681-1.278-1.681-1.045-.714.08-.699.08-.699 1.155.081 1.763 1.186 1.763 1.186 1.026 1.758 2.691 1.25 3.347.956.104-.744.402-1.25.732-1.537-2.552-.29-5.236-1.276-5.236-5.682 0-1.255.448-2.281 1.184-3.085-.119-.29-.513-1.458.112-3.04 0 0 .966-.309 3.165 1.178A10.99 10.99 0 0 1 12 6.04c.977.005 1.962.132 2.881.388 2.197-1.487 3.161-1.178 3.161-1.178.627 1.582.233 2.75.114 3.04.738.804 1.182 1.83 1.182 3.085 0 4.417-2.688 5.389-5.248 5.674.413.356.781 1.059.781 2.135 0 1.542-.014 2.786-.014 3.166 0 .309.207.668.79.555C20.21 21.392 23.5 17.08 23.5 12 23.5 5.648 18.352.5 12 .5Z" />
                </svg>
              </button>

              {/* Tabs */}
              <div className="flex gap-1 bg-cs-surface border border-cs-border rounded-lg p-0.5">
                {(["install", "configure"] as Tab[]).map((tabKey) => (
                  <button
                    key={tabKey}
                    onClick={() => setTab(tabKey)}
                    className={`px-4 py-1.5 rounded text-xs font-medium tracking-wider uppercase transition-colors duration-150 ${
                      tab === tabKey
                        ? "bg-cs-accent text-[#0f1117]"
                        : "text-cs-muted hover:text-cs-text"
                    }`}
                  >
                    {t(tabKey === "install" ? "tab_install" : "tab_configure")}
                  </button>
                ))}
              </div>

              {/* Language toggle */}
              <button
                onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
                className="text-xs text-cs-muted hover:text-cs-text border border-cs-border hover:border-cs-muted rounded px-2 py-1.5 transition-colors duration-150 font-mono"
              >
                {t("lang_toggle")}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-6 mt-4 border-b border-cs-border" />

          {/* Page */}
          <div className="flex-1 overflow-hidden">
            {tab === "install" ? (
              <Install onOpenConfigure={() => setTab("configure")} />
            ) : (
              <Configure />
            )}
          </div>
        </div>
      </UserContext.Provider>
    </LocaleContext.Provider>
  );
}
