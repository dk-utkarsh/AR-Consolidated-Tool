import { lazy, Suspense, useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Login } from "@/components/Login";
import { clearSession, getEmail, getToken } from "@/lib/auth";
import { fetchMe, type ModuleId } from "@/lib/api";
import { useHashTab } from "@/lib/useHashTab";

const Tds194qModule = lazy(() => import("@/modules/tds194q"));
const ChequesModule = lazy(() => import("@/modules/cheques"));
const SuspenseModule = lazy(() => import("@/modules/suspense"));

function ModuleFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-slate-400">
      Loading…
    </div>
  );
}

const MODULES = ["tds194q", "cheques", "suspense"] as const;

export default function App() {
  const [authedEmail, setAuthedEmail] = useState<string | null>(
    getToken() ? getEmail() : null,
  );
  // null = still loading /api/me; [] = signed in but no modules enabled.
  const [modules, setModules] = useState<ModuleId[] | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [tab, setTab] = useHashTab<ModuleId>(MODULES, "suspense");

  // Load the user's module permissions whenever they sign in.
  useEffect(() => {
    if (!authedEmail) {
      setModules(null);
      setMeError(null);
      return;
    }
    let cancelled = false;
    setModules(null);
    setMeError(null);
    fetchMe()
      .then((me) => {
        if (!cancelled) setModules(me.modules);
      })
      .catch((err) => {
        if (!cancelled) setMeError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [authedEmail]);

  const allowed = modules ?? [];
  // Keep the active tab on a module the user can actually see.
  const effectiveTab = allowed.includes(tab) ? tab : (allowed[0] ?? tab);

  // Snap the URL hash to a permitted tab once permissions have loaded.
  useEffect(() => {
    if (allowed.length > 0 && tab !== effectiveTab) setTab(effectiveTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTab, tab, allowed.length]);

  const onLogout = () => {
    clearSession();
    setAuthedEmail(null);
  };

  if (!authedEmail) {
    return <Login onSuccess={(email) => setAuthedEmail(email)} />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AR Consolidated</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">{authedEmail}</span>
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      {meError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Could not load your permissions: {meError}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      ) : modules === null ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
      ) : modules.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Your account has no modules enabled. Please contact an administrator.
        </div>
      ) : (
        <Tabs value={effectiveTab} onValueChange={(v) => setTab(v as ModuleId)}>
          <TabsList>
            {modules.includes("tds194q") && (
              <TabsTrigger value="tds194q">TDS 194Q</TabsTrigger>
            )}
            {modules.includes("cheques") && (
              <TabsTrigger value="cheques">Cheques</TabsTrigger>
            )}
            {modules.includes("suspense") && (
              <TabsTrigger value="suspense">Uncategorized Suspense</TabsTrigger>
            )}
          </TabsList>

          {modules.includes("tds194q") && (
            <TabsContent value="tds194q">
              <Suspense fallback={<ModuleFallback />}>
                <Tds194qModule />
              </Suspense>
            </TabsContent>
          )}

          {modules.includes("cheques") && (
            <TabsContent value="cheques">
              <Suspense fallback={<ModuleFallback />}>
                <ChequesModule />
              </Suspense>
            </TabsContent>
          )}

          {modules.includes("suspense") && (
            <TabsContent value="suspense">
              <Suspense fallback={<ModuleFallback />}>
                <SuspenseModule />
              </Suspense>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
