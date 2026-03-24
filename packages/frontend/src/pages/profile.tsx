import { useState } from "react";
import { Navigate } from "react-router";
import { Loader2, Plus, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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
import { PageHeader } from "@/components/page-header";
import { trpc, type RouterOutputs } from "@/api/trpc";
import { BLOOD_TYPES, DIETARY_PREFERENCES } from "@synaps/shared";

const FREQ_LABELS: Record<string, string> = {
  daily: "Daily",
  twice_daily: "2×/day",
  weekly: "Weekly",
  monthly: "Monthly",
  as_needed: "As needed",
  other: "Other",
};

type ProfileData = NonNullable<RouterOutputs["profile"]["get"]>;

function ProfileForm({ data }: { data: ProfileData }) {
  const utils = trpc.useUtils();
  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => utils.profile.get.invalidate(),
  });
  const addAllergy = trpc.profile.addAllergy.useMutation({
    onSuccess: () => utils.profile.get.invalidate(),
  });
  const removeAllergy = trpc.profile.removeAllergy.useMutation({
    onSuccess: () => utils.profile.get.invalidate(),
  });
  const medications = trpc.medication.list.useQuery();
  const createMedication = trpc.medication.create.useMutation({
    onSuccess: () => utils.medication.list.invalidate(),
  });
  const updateMedication = trpc.medication.update.useMutation({
    onSuccess: () => utils.medication.list.invalidate(),
  });
  const deleteMedication = trpc.medication.delete.useMutation({
    onSuccess: () => utils.medication.list.invalidate(),
  });

  const [name, setName] = useState(data.user.name);
  const [dateOfBirth, setDateOfBirth] = useState(
    new Date(data.dateOfBirth).toISOString().split("T")[0] ?? "",
  );
  const [sex, setSex] = useState(data.sex);
  const [bloodType, setBloodType] = useState(data.bloodType ?? "");
  const [heightCm, setHeightCm] = useState(data.heightCm?.toString() ?? "");
  const [dietaryPreference, setDietaryPreference] = useState(
    data.dietaryPreference,
  );
  const [smokingStatus, setSmokingStatus] = useState(data.smokingStatus ?? "never");
  const [cigarettesPerDay, setCigarettesPerDay] = useState(
    data.cigarettesPerDay?.toString() ?? "",
  );
  const [smokeQuitDate, setSmokeQuitDate] = useState(
    data.smokeQuitDate ? new Date(data.smokeQuitDate).toISOString().split("T")[0] : "",
  );
  const [latitude, setLatitude] = useState(data.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(data.longitude?.toString() ?? "");
  const [allergyName, setAllergyName] = useState("");
  const [allergySeverity, setAllergySeverity] = useState("");
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medFrequency, setMedFrequency] = useState("daily");
  const [medStartDate, setMedStartDate] = useState("");
  const [medNotes, setMedNotes] = useState("");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateProfile.mutate({
      name,
      dateOfBirth: new Date(dateOfBirth),
      sex: sex as "male" | "female" | "other",
      bloodType: bloodType ? (bloodType as (typeof BLOOD_TYPES)[number]) : null,
      heightCm: heightCm ? parseFloat(heightCm) : null,
      dietaryPreference: dietaryPreference as (typeof DIETARY_PREFERENCES)[number],
      smokingStatus: smokingStatus as "never" | "former" | "current",
      cigarettesPerDay: smokingStatus === "current" && cigarettesPerDay ? parseInt(cigarettesPerDay) : undefined,
      smokeQuitDate: smokingStatus === "former" && smokeQuitDate ? smokeQuitDate : undefined,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
    });
  }

  function handleAddMedication() {
    if (!medName.trim()) return;
    createMedication.mutate({
      name: medName.trim(),
      dosage: medDosage.trim() || undefined,
      frequency: medFrequency as "daily" | "twice_daily" | "weekly" | "monthly" | "as_needed" | "other",
      startDate: medStartDate || undefined,
      notes: medNotes.trim() || undefined,
    });
    setMedName("");
    setMedDosage("");
    setMedFrequency("daily");
    setMedStartDate("");
    setMedNotes("");
  }

  function handleAddAllergy() {
    if (!allergyName.trim()) return;
    addAllergy.mutate({
      name: allergyName.trim(),
      severity: (allergySeverity as "mild" | "moderate" | "severe") || null,
    });
    setAllergyName("");
    setAllergySeverity("");
  }

  function detectLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation requires HTTPS. Use the manual fields instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(4));
        setLongitude(pos.coords.longitude.toFixed(4));
      },
      () => toast.error("Location access denied or requires HTTPS"),
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Blood Type</Label>
                <Select
                  value={bloodType || "_none"}
                  onValueChange={(v) => setBloodType(v === "_none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Not set</SelectItem>
                    {BLOOD_TYPES.map((bt) => (
                      <SelectItem key={bt} value={bt}>
                        {bt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  min={50}
                  max={300}
                  step={0.5}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="-"
                />
              </div>
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
              <Label>Smoking Status</Label>
              <Select value={smokingStatus} onValueChange={setSmokingStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never smoked</SelectItem>
                  <SelectItem value="former">Former smoker</SelectItem>
                  <SelectItem value="current">Current smoker</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {smokingStatus === "current" && (
              <div className="space-y-2">
                <Label htmlFor="cigarettes">Cigarettes per day</Label>
                <Input
                  id="cigarettes"
                  type="number"
                  min={1}
                  max={200}
                  value={cigarettesPerDay}
                  onChange={(e) => setCigarettesPerDay(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>
            )}
            {smokingStatus === "former" && (
              <div className="space-y-2">
                <Label htmlFor="quitDate">Quit Date</Label>
                <Input
                  id="quitDate"
                  type="date"
                  value={smokeQuitDate}
                  onChange={(e) => setSmokeQuitDate(e.target.value)}
                />
              </div>
            )}
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
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving..." : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Allergies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Allergy name"
              value={allergyName}
              onChange={(e) => setAllergyName(e.target.value)}
            />
            <Select value={allergySeverity} onValueChange={setAllergySeverity}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mild">Mild</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="severe">Severe</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={handleAddAllergy}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {(data.allergies as Array<{ id: string; name: string; severity: string | null }>).map((allergy) => (
            <div
              key={allergy.id}
              className="flex items-center justify-between p-2 bg-secondary rounded text-sm"
            >
              <div>
                <span className="font-medium">{allergy.name}</span>
                {allergy.severity && (
                  <span className="text-muted-foreground ml-2 capitalize">
                    ({allergy.severity})
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => removeAllergy.mutate({ id: allergy.id })}
                aria-label={`Remove ${allergy.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Medications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Name *"
              value={medName}
              onChange={(e) => setMedName(e.target.value)}
            />
            <Input
              placeholder="Dosage (optional)"
              value={medDosage}
              onChange={(e) => setMedDosage(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={medFrequency} onValueChange={setMedFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FREQ_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="Start date"
              value={medStartDate}
              onChange={(e) => setMedStartDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Notes (optional)"
              value={medNotes}
              onChange={(e) => setMedNotes(e.target.value)}
            />
            <Button
              variant="secondary"
              onClick={handleAddMedication}
              disabled={createMedication.isPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {medications.data?.map((med) => (
            <div
              key={med.id}
              className="group flex items-center justify-between p-2 bg-secondary rounded text-sm"
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium">{med.name}</span>
                {med.dosage && (
                  <span className="text-muted-foreground ml-1">{med.dosage}</span>
                )}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                    {FREQ_LABELS[med.frequency] ?? med.frequency}
                  </Badge>
                  {med.isActive ? (
                    <Badge className="text-xs px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-600 border-0">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 text-muted-foreground">
                      Inactive
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => updateMedication.mutate({ id: med.id, isActive: !med.isActive })}
                  aria-label={med.isActive ? "Deactivate" : "Activate"}
                >
                  {med.isActive
                    ? <ToggleRight className="h-4 w-4 text-emerald-500" />
                    : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteMedication.mutate({ id: med.id })}
                  aria-label={`Delete ${med.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

export function ProfilePage() {
  const profile = trpc.profile.get.useQuery();

  if (profile.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!profile.data) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <PageHeader title="Profile" />
      <ProfileForm key={profile.data.id} data={profile.data} />
    </div>
  );
}
