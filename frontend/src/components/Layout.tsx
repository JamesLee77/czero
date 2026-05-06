import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link, NavLink, Outlet } from "react-router-dom";

export default function Layout() {
  const linkBase = "px-3 py-2 rounded-md text-sm font-medium transition";
  const linkActive = "bg-neutral-800 text-white";
  const linkInactive = "text-neutral-400 hover:bg-neutral-900 hover:text-white";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-bold tracking-tight text-lg">
              C-ZERO <span className="text-green-400">$CZM</span>
            </Link>
            <nav className="flex gap-1">
              <NavLink to="/" end className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
                Overview
              </NavLink>
              <NavLink to="/dashboard" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
                Dashboard
              </NavLink>
              <NavLink to="/vesting" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
                Vesting
              </NavLink>
              <NavLink to="/migrate" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
                Migrate
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}>
                Settings
              </NavLink>
            </nav>
          </div>
          <ConnectButton chainStatus="icon" showBalance={false} accountStatus={{ smallScreen: "avatar", largeScreen: "full" }} />
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        <Outlet />
      </main>
      <footer className="border-t border-neutral-800 py-6 text-center text-xs text-neutral-500">
        Testnet (Base Sepolia) — Phase 1 demo. NOT for mainnet use.
      </footer>
    </div>
  );
}
