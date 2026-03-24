import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { Camera, Upload, X, Sparkles, FileText, Brain } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { TagInput } from "@/components/tag-input";
import { trpc } from "@/api/trpc";

type Mode = "manual" | "ai";
type FileEntry = { uid: string; file: File };

export function ReportNewPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("ai");
  const [title, setTitle] = useState("");
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split("T")[0]!,
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<"creating" | "uploading" | "analyzing" | null>(null);

  const createReport = trpc.report.create.useMutation();
  const deleteReport = trpc.report.delete.useMutation();
  const analyzeNotesMutation = trpc.report.analyzeNotes.useMutation();

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).map((file) => ({
      uid: `${file.name}-${file.size}-${file.lastModified}`,
      file,
    }));
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.uid));
      return [...prev, ...selected.filter((f) => !existing.has(f.uid))];
    });
    e.target.value = "";
  }

  function removeFile(uid: string) {
    setFiles((prev) => prev.filter((f) => f.uid !== uid));
  }

  async function uploadFiles(reportId: string) {
    if (files.length === 0) return;
    const formData = new FormData();
    formData.append("reportId", reportId);
    for (const { file } of files) {
      formData.append("file", file);
    }
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Upload failed");
    }
  }

  async function createAndNavigate(enhance: boolean) {
    if (mode === "ai" && files.length === 0) {
      toast.error("Add at least one file for AI analysis");
      return;
    }
    if (mode === "manual" && !title.trim()) {
      toast.error("Title is required");
      return;
    }

    setSubmitting(true);
    let reportId: string | undefined;

    try {
      setPhase("creating");
      const report = await createReport.mutateAsync({
        title: title || "Untitled",
        reportDate: new Date(reportDate),
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        notes: notes || null,
      });
      reportId = report.id;

      if (files.length > 0) {
        setPhase(mode === "ai" ? "analyzing" : "uploading");
        await uploadFiles(report.id);
      }

      if (enhance && notes.trim()) {
        setPhase("analyzing");
        await analyzeNotesMutation.mutateAsync({ id: report.id, notes });
      }

      navigate(`/reports/${report.id}`);
    } catch (err) {
      if (reportId) deleteReport.mutate({ id: reportId });
      toast.error(
        err instanceof Error ? err.message : "Failed to create report",
      );
    } finally {
      setSubmitting(false);
      setPhase(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">New Report</h1>

      <div className="flex gap-1 p-1 bg-secondary rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === "ai"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Brain className="h-4 w-4" />
          AI Analysis
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === "manual"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          Manual
        </button>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report Details</CardTitle>
            {mode === "ai" ? (
              <CardDescription>
                Upload your files — AI will fill in title, notes, and
                biomarkers automatically.
              </CardDescription>
            ) : (
              <CardDescription>
                Describe your visit. Use &ldquo;Enhance with AI&rdquo; to
                extract structured data from your notes.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Title
                {mode === "manual" && (
                  <span className="text-destructive ml-0.5">*</span>
                )}
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  mode === "ai"
                    ? "Leave blank — AI will fill it in"
                    : "e.g. Blood Test, Cardiology Visit"
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <TagInput
                selectedIds={selectedTagIds}
                onChange={setSelectedTagIds}
              />
            </div>

            {mode === "manual" && (
              <div className="space-y-2">
                <Label htmlFor="notes">
                  Doctor&apos;s Notes / Summary
                  <span className="text-destructive ml-0.5">*</span>
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe what the doctor said, test results, medications... Include numeric values like 'glucose 95 mg/dL' for AI extraction."
                  rows={6}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {mode === "ai" ? "Files" : "Attach Files (optional)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose Files
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.setAttribute(
                      "capture",
                      "environment",
                    );
                    fileInputRef.current.click();
                    fileInputRef.current.removeAttribute("capture");
                  }
                }}
              >
                <Camera className="h-4 w-4 mr-2" />
                Camera
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                onChange={handleFileSelect}
              />
            </div>

            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map(({ uid, file }) => (
                  <li
                    key={uid}
                    className="flex items-center justify-between p-2 bg-secondary rounded text-sm"
                  >
                    <span className="truncate">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => removeFile(uid)}
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-xs text-muted-foreground">
              JPEG, PNG, WebP, PDF · max 20MB per file
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          {mode === "manual" && notes.trim().length > 0 && (
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => createAndNavigate(true)}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {phase === "analyzing" ? "Analyzing..." : "Enhance with AI"}
            </Button>
          )}
          <Button
            type="button"
            className="flex-1"
            disabled={submitting}
            onClick={() => createAndNavigate(false)}
          >
            {phase === "creating" && "Creating report..."}
            {phase === "uploading" && "Uploading files..."}
            {phase === "analyzing" && "AI is analyzing..."}
            {!phase &&
              (mode === "ai" ? "Create & Analyze" : "Create Report")}
          </Button>
        </div>
      </div>
    </div>
  );
}
