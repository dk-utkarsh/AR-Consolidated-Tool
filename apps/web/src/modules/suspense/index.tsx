import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UncategorizedTab } from "@/components/UncategorizedTab";
import { LedgerTab } from "@/components/LedgerTab";
import { fetchMe, refreshCache } from "@/lib/api";

const ORG = "VASA DENTICITY LIMITED";

export default function SuspenseModule() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [canMatch, setCanMatch] = useState(false);

  useEffect(() => {
    fetchMe()
      .then((m) => setCanMatch(m.canMatch))
      .catch(() => setCanMatch(false));
  }, []);

  const onRefresh = async () => {
    await refreshCache().catch(() => {});
    setRefreshKey((k) => k + 1);
    setLastRefreshed(new Date());
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {ORG} · live from Zoho Books API
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            Last refreshed: {lastRefreshed.toLocaleString()}
          </span>
          <Button onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="uncategorized">
        <TabsList>
          <TabsTrigger value="uncategorized">
            Uncategorized (ICICI Bank-1286)
          </TabsTrigger>
          <TabsTrigger value="suspense">Suspense</TabsTrigger>
          <TabsTrigger value="misc-debtor">Miscellaneous Debtor</TabsTrigger>
        </TabsList>

        <TabsContent value="uncategorized">
          <UncategorizedTab
            refreshKey={refreshKey}
            canCategorize={canMatch}
            onCategorized={onRefresh}
          />
        </TabsContent>

        <TabsContent value="suspense">
          <LedgerTab
            account="suspense"
            title="Suspense"
            organizationName={ORG}
            fileSlug="suspense"
            refreshKey={refreshKey}
            hideDetails
          />
        </TabsContent>

        <TabsContent value="misc-debtor">
          <LedgerTab
            account="misc-debtor"
            title="Miscellaneous Debtor"
            organizationName={ORG}
            fileSlug="misc_debtor"
            refreshKey={refreshKey}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
