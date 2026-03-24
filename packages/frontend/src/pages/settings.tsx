import { useState } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { trpc } from "@/api/trpc";
import { AI_LANGUAGES } from "@synaps/shared";

export function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [langSaved, setLangSaved] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string | undefined>(undefined);

  const { data: langSetting } = trpc.settings.get.useQuery({ key: "ai_language" });
  const currentLanguage = selectedLanguage ?? langSetting?.value ?? "en";

  const setSetting = trpc.settings.set.useMutation({
    onSuccess: () => {
      setSaved(true);
      setApiKey("");
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const setLangSetting = trpc.settings.set.useMutation({
    onSuccess: () => {
      setLangSaved(true);
      setTimeout(() => setLangSaved(false), 3000);
    },
  });

  const testConnection = trpc.settings.testClaudeConnection.useMutation();

  function handleSaveApiKey(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setSetting.mutate({ key: "claude_api_key", value: apiKey.trim() });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claude API Key</CardTitle>
          <CardDescription>
            Required for AI-powered report analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSaveApiKey} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={setSetting.isPending}>
                {setSetting.isPending ? "Saving..." : "Save Key"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => testConnection.mutate()}
                disabled={testConnection.isPending}
              >
                {testConnection.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                Test Connection
              </Button>
            </div>
          </form>

          {saved && (
            <div className="flex items-center gap-2 text-sm text-status-normal">
              <CheckCircle className="h-4 w-4" />
              API key saved
            </div>
          )}

          {testConnection.data && (
            <div
              className={`flex items-center gap-2 text-sm ${
                testConnection.data.success
                  ? "text-status-normal"
                  : "text-destructive"
              }`}
            >
              {testConnection.data.success ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Connected ({"model" in testConnection.data ? String(testConnection.data.model) : ""})
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  {"error" in testConnection.data ? testConnection.data.error : "Unknown error"}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Response Language</CardTitle>
          <CardDescription>
            Language used for AI analysis summaries, notes and chat replies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={currentLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => setLangSetting.mutate({ key: "ai_language", value: currentLanguage })}
            disabled={setLangSetting.isPending}
          >
            {setLangSetting.isPending ? "Saving..." : "Save"}
          </Button>
          {langSaved && (
            <div className="flex items-center gap-2 text-sm text-status-normal">
              <CheckCircle className="h-4 w-4" />
              Language saved
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
