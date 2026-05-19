import { lazy, Suspense, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Login } from "@/components/Login";
import { clearSession, getEmail, getToken } from "@/lib/auth";
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
type ModuleId = (typeof MODULES)[number];

export default function App() {
  const [authedEmail, setAuthedEmail] = useState<string | null>(
    getToken() ? getEmail() : null,
  );
  const [tab, setTab] = useHashTab<ModuleId>(MODULES, "suspense");

  if (!authedEmail) {
    return <Login onSuccess={(email) => setAuthedEmail(email)} />;
  }

  const onLogout = () => {
    clearSession();
    setAuthedEmail(null);
  };

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

      <Tabs value={tab} onValueChange={(v) => setTab(v as ModuleId)}>
        <TabsList>
          <TabsTrigger value="tds194q">TDS 194Q</TabsTrigger>
          <TabsTrigger value="cheques">Cheques</TabsTrigger>
          <TabsTrigger value="suspense">Uncategorized Suspense</TabsTrigger>
        </TabsList>

        <TabsContent value="tds194q">
          <Suspense fallback={<ModuleFallback />}>
            <Tds194qModule />
          </Suspense>
        </TabsContent>

        <TabsContent value="cheques">
          <Suspense fallback={<ModuleFallback />}>
            <ChequesModule />
          </Suspense>
        </TabsContent>

        <TabsContent value="suspense">
          <Suspense fallback={<ModuleFallback />}>
            <SuspenseModule />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
