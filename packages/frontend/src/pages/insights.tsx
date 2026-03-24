import { useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { GraphTab } from "./graph";
import { EnvironmentTab } from "./environment";
import { TrendsTab } from "./trends-tab";

export function InsightsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "graph";

  return (
    <div className="space-y-5">
      <PageHeader title="Insights" />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>
        <TabsContent value="graph"><GraphTab /></TabsContent>
        <TabsContent value="environment"><EnvironmentTab /></TabsContent>
        <TabsContent value="trends"><TrendsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
