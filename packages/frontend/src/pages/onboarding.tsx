import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/api/trpc";
import { AI_LANGUAGES, BLOOD_TYPES, DIETARY_PREFERENCES } from "@synaps/shared";

type Step = "profile" | "allergies" | "apikey" | "language" | "done";

export function OnboardingPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [step, setStep] = useState<Step>("profile");
  const [error, setError] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState("male");
  const [bloodType, setBloodType] = useState("");
  const [dietaryPreference, setDietaryPreference] = useState("omnivore");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [allergyName, setAllergyName] = useState("");
  const [allergySeverity, setAllergySeverity] = useState("");
  const [allergies, setAllergies] = useState<
    Array<{ name: string; severity: string | null }>
  >([]);
  const [apiKey, setApiKey] = useState("");
  const [aiLanguage, setAiLanguage] = useState("en");

  const createProfile = trpc.profile.create.useMutation();
  const addAllergy = trpc.profile.addAllergy.useMutation();
  const setSetting = trpc.settings.set.useMutation();

  async function handleProfileSubmit() {
    setError("");
    try {
      await createProfile.mutateAsync({
        dateOfBirth: new Date(dateOfBirth),
        sex: sex as "male" | "female" | "other",
        bloodType: bloodType
          ? (bloodType as (typeof BLOOD_TYPES)[number])
          : null,
        dietaryPreference:
          dietaryPreference as (typeof DIETARY_PREFERENCES)[number],
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      });
      setStep("allergies");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update profile");
    }
  }

  function handleAddAllergy() {
    if (!allergyName.trim()) return;
    setAllergies([
      ...allergies,
      { name: allergyName.trim(), severity: allergySeverity || null },
    ]);
    setAllergyName("");
    setAllergySeverity("");
  }

  async function handleAllergiesSubmit() {
    setError("");
    try {
      for (const allergy of allergies) {
        await addAllergy.mutateAsync({
          name: allergy.name,
          severity: allergy.severity as "mild" | "moderate" | "severe" | null,
        });
      }
      setStep("apikey");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save allergies");
    }
  }

  async function handleApiKeySubmit() {
    setError("");
    try {
      if (apiKey.trim()) {
        await setSetting.mutateAsync({
          key: "claude_api_key",
          value: apiKey.trim(),
        });
        setStep("language");
      } else {
        setStep("done");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save API key");
    }
  }

  async function handleLanguageSubmit() {
    setError("");
    try {
      await setSetting.mutateAsync({ key: "ai_language", value: aiLanguage });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save language");
    }
  }

  function detectLocation() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(4));
        setLongitude(pos.coords.longitude.toFixed(4));
      },
      () => setError("Could not detect location — geolocation requires HTTPS"),
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to Synaps</CardTitle>
          <CardDescription>
            {step === "profile" && "Complete your health profile"}
            {step === "allergies" && "Add allergies (optional)"}
            {step === "apikey" && "Configure Claude API (optional)"}
            {step === "language" && "AI response language"}
            {step === "done" && "You're all set!"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "profile" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleProfileSubmit();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Sex</Label>
                <Select value={sex} onValueChange={setSex}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Blood Type</Label>
                <Select value={bloodType} onValueChange={setBloodType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOD_TYPES.map((bt) => (
                      <SelectItem key={bt} value={bt}>
                        {bt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dietary Preference</Label>
                <Select
                  value={dietaryPreference}
                  onValueChange={setDietaryPreference}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIETARY_PREFERENCES.map((dp) => (
                      <SelectItem key={dp} value={dp}>
                        {dp.charAt(0).toUpperCase() + dp.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Location</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={detectLocation}
                  >
                    Detect
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Latitude"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                  />
                  <Input
                    placeholder="Longitude"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full">
                Next
              </Button>
            </form>
          )}

          {step === "allergies" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Allergy name"
                  value={allergyName}
                  onChange={(e) => setAllergyName(e.target.value)}
                />
                <Select
                  value={allergySeverity}
                  onValueChange={setAllergySeverity}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddAllergy}
                >
                  Add
                </Button>
              </div>
              {allergies.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {allergies.map((a, i) => (
                    <li
                      key={i}
                      className="flex justify-between items-center p-2 bg-secondary rounded"
                    >
                      <span>{a.name}</span>
                      {a.severity && (
                        <span className="text-muted-foreground capitalize">
                          {a.severity}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("apikey")}
                >
                  Skip
                </Button>
                <Button className="flex-1" onClick={handleAllergiesSubmit}>
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === "apikey" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">Claude API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                />
                <p className="text-xs text-muted-foreground">
                  Required for AI analysis of medical reports. You can configure
                  this later in Settings.
                </p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("done")}
                >
                  Skip
                </Button>
                <Button className="flex-1" onClick={handleApiKeySubmit}>
                  Save
                </Button>
              </div>
            </div>
          )}

          {step === "language" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Language for AI responses</Label>
                <Select value={aiLanguage} onValueChange={setAiLanguage}>
                  <SelectTrigger>
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
                <p className="text-xs text-muted-foreground">
                  AI analysis summaries, notes and chat replies will be written in this language. You can change it later in Settings.
                </p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={handleLanguageSubmit} disabled={setSetting.isPending}>
                {setSetting.isPending ? "Saving..." : "Continue"}
              </Button>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4 text-center">
              <p className="text-muted-foreground">
                Your profile is set up. Start by uploading your first medical
                report.
              </p>
              <Button className="w-full" onClick={async () => {
                await utils.profile.get.fetch();
                navigate("/");
              }}>
                Go to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
