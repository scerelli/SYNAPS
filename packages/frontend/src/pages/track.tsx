import { useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { SleepTab } from "./sleep";
import { DietTab } from "./diet";
import { ActivityTab } from "./activity";
import { DiaryTab } from "./diary";
import { WeightTab } from "./weight-tab";

const TABS = ["sleep", "diet", "activity", "diary", "body"] as const;
type Tab = (typeof TABS)[number];

export function TrackPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) ?? "sleep";

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader title="Track" />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="sleep">Sleep</TabsTrigger>
          <TabsTrigger value="diet">Diet</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="diary">Diary</TabsTrigger>
          <TabsTrigger value="body">Body</TabsTrigger>
        </TabsList>
        <TabsContent value="sleep"><SleepTab /></TabsContent>
        <TabsContent value="diet"><DietTab /></TabsContent>
        <TabsContent value="activity"><ActivityTab /></TabsContent>
        <TabsContent value="diary"><DiaryTab /></TabsContent>
        <TabsContent value="body"><WeightTab /></TabsContent>
      </Tabs>
    </div>
  );
}
