import { createContext, useContext, useState } from "react";
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

export default function App() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [tab, setTab] = useState<Tab>("install");
  const [users, setUsers] = useState<SteamUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SteamUser | null>(null);

  const t = makeT(locale);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      <UserContext.Provider
        value={{ users, setUsers, selectedUser, setSelectedUser }}
      >
        <div className="flex flex-col h-screen w-screen bg-cs-bg">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-0 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-cs-accent font-bold text-lg tracking-widest uppercase">
                nullify
              </span>
              <span className="text-cs-muted text-xs tracking-wider">CS2 CFG</span>
            </div>

            <div className="flex items-center gap-2">
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
            {tab === "install" ? <Install /> : <Configure />}
          </div>
        </div>
      </UserContext.Provider>
    </LocaleContext.Provider>
  );
}
