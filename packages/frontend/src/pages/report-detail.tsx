import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  FileText,
  Loader2,
  MoreVertical,
  Plus,
  RotateCcw,
  RotateCw,
  Send,
  Trash2,
  ZoomIn,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TagInput } from "@/components/tag-input";
import { trpc } from "@/api/trpc";

function statusVariant(
  status: string | null,
): "normal" | "high" | "low" | "critical" | "secondary" {
  if (!status) return "secondary";
  if (status === "normal") return "normal";
  if (status === "high") return "high";
  if (status === "low") return "low";
  if (status.startsWith("critical")) return "critical";
  return "secondary";
}

type FileRecord = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

function ImageModal({
  file,
  open,
  onClose,
}: {
  file: FileRecord;
  open: boolean;
  onClose: () => void;
}) {
  const [rotation, setRotation] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setRotation(0);
        }
      }}
    >
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden flex flex-col">
        <DialogTitle className="sr-only">{file.originalName}</DialogTitle>
        <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
          <span className="text-sm text-muted-foreground truncate">
            {file.originalName}
          </span>
          <div className="flex gap-1 ml-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setRotation((r) => r - 90)}
              aria-label="Rotate left"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setRotation((r) => r + 90)}
              aria-label="Rotate right"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0">
          <img
            src={`/api/files/${file.id}`}
            alt={file.originalName}
            className="max-w-none transition-transform duration-200"
            style={{
              transform: `rotate(${rotation}deg)`,
              maxHeight:
                rotation % 180 === 0 ? "calc(95vh - 80px)" : "calc(95vw - 80px)",
              maxWidth:
                rotation % 180 === 0 ? "calc(95vw - 80px)" : "calc(95vh - 80px)",
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FileViewer({ file }: { file: FileRecord }) {
  const [open, setOpen] = useState(false);
  const url = `/api/files/${file.id}`;
  const isImage = file.mimeType.startsWith("image/");
  const isPdf = file.mimeType === "application/pdf";

  if (isImage) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative group w-full aspect-video bg-secondary rounded overflow-hidden flex items-center justify-center hover:opacity-90 transition-opacity"
          aria-label={`View ${file.originalName}`}
        >
          <img
            src={url}
            alt={file.originalName}
            className="object-contain w-full h-full"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
            <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="absolute bottom-1 left-2 right-2 text-xs text-white/80 truncate drop-shadow text-left">
            {file.originalName}
          </span>
        </button>
        <ImageModal
          file={file}
          open={open}
          onClose={() => setOpen(false)}
        />
      </>
    );
  }

  if (isPdf) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 p-3 bg-secondary rounded text-sm hover:bg-secondary/80 transition-colors w-full text-left"
        >
          <FileText className="h-5 w-5 shrink-0 text-red-400" />
          <span className="truncate flex-1">{file.originalName}</span>
          <span className="text-muted-foreground shrink-0 text-xs">
            {(file.sizeBytes / 1024).toFixed(0)} KB
          </span>
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-5xl h-[95vh] p-2 flex flex-col">
            <DialogTitle className="sr-only">{file.originalName}</DialogTitle>
            <iframe
              src={url}
              title={file.originalName}
              className="flex-1 w-full rounded border-0"
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-3 bg-secondary rounded text-sm hover:bg-secondary/80 transition-colors"
    >
      <FileText className="h-5 w-5 shrink-0" />
      <span className="truncate flex-1">{file.originalName}</span>
      <span className="text-muted-foreground shrink-0 text-xs">
        {(file.sizeBytes / 1024).toFixed(0)} KB
      </span>
    </a>
  );
}

type ChatMessage = { role: "user" | "assistant"; content: string };

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const report = trpc.report.get.useQuery(
    { id: id! },
    {
      refetchInterval: (query) => {
        const analyses = query.state.data?.aiAnalyses ?? [];
        const pending = analyses.some(
          (a) => a.status === "pending" || a.status === "processing",
        );
        return pending ? 3000 : false;
      },
    },
  );

  const updateReport = trpc.report.update.useMutation({
    onSuccess: (data) => {
      utils.report.get.setData({ id: id! }, data);
      toast.success("Saved");
      setDirty(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteReport = trpc.report.delete.useMutation({
    onSuccess: () => navigate("/reports"),
    onError: (err) => toast.error(err.message),
  });

  const addEntry = trpc.report.addEntry.useMutation({
    onSuccess: () => utils.report.get.invalidate({ id: id! }),
    onError: (err) => toast.error(err.message),
  });

  const deleteEntry = trpc.report.deleteEntry.useMutation({
    onSuccess: () => utils.report.get.invalidate({ id: id! }),
    onError: (err) => toast.error(err.message),
  });

  const chat = trpc.report.chat.useMutation();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editTagIds, setEditTagIds] = useState<string[]>([]);
  const [editFacility, setEditFacility] = useState("");
  const [editExamType, setEditExamType] = useState("");
  const [editDoctorName, setEditDoctorName] = useState("");
  const [editDoctorSpecialty, setEditDoctorSpecialty] = useState("");
  const [initialized, setInitialized] = useState(false);

  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryName, setEntryName] = useState("");
  const [entryValue, setEntryValue] = useState("");
  const [entryUnit, setEntryUnit] = useState("");
  const [entryRefMin, setEntryRefMin] = useState("");
  const [entryRefMax, setEntryRefMax] = useState("");

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    if (!initialized && report.data) {
      const r = report.data;
      setEditTitle(r.title);
      setEditDate(new Date(r.reportDate).toISOString().split("T")[0] ?? "");
      setEditNotes(r.notes ?? "");
      setEditTagIds(r.tags.map((t) => t.tag.id));
      setEditFacility(r.facility ?? "");
      setEditExamType(r.examType ?? "");
      setEditDoctorName(r.doctor?.name ?? "");
      setEditDoctorSpecialty(r.doctor?.specialty ?? "");
      setInitialized(true);
    }
  }, [report.data, initialized]);

  if (report.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!report.data) {
    return <p className="text-muted-foreground">Report not found</p>;
  }

  const r = report.data;

  function markDirty() {
    setDirty(true);
  }

  function handleSave() {
    updateReport.mutate({
      id: id!,
      title: editTitle || r.title,
      reportDate: new Date(editDate),
      notes: editNotes || null,
      tagIds: editTagIds,
      facility: editFacility || null,
      examType: editExamType || null,
      doctorName: editDoctorName || null,
      doctorSpecialty: editDoctorSpecialty || null,
    });
  }

  function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(entryValue);
    if (isNaN(value)) return;

    type BiomarkerStatus =
      | "normal"
      | "high"
      | "low"
      | "critical-high"
      | "critical-low";
    let status: BiomarkerStatus | null = null;
    const min = entryRefMin ? parseFloat(entryRefMin) : null;
    const max = entryRefMax ? parseFloat(entryRefMax) : null;
    if (min !== null && value < min) status = "low";
    else if (max !== null && value > max) status = "high";
    else if (min !== null || max !== null) status = "normal";

    addEntry.mutate({
      reportId: id!,
      biomarkerName: entryName,
      value,
      unit: entryUnit,
      referenceMin: min,
      referenceMax: max,
      status,
    });
    setEntryName("");
    setEntryValue("");
    setEntryUnit("");
    setEntryRefMin("");
    setEntryRefMax("");
    setShowAddEntry(false);
  }

  async function handleChatSend(e: React.FormEvent) {
    e.preventDefault();
    const message = chatInput.trim();
    if (!message || chat.isPending) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: message }]);
    try {
      const result = await chat.mutateAsync({ id: id!, message });
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.answer },
      ]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to get a response";
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: msg },
      ]);
      toast.error(msg);
    }
  }

  const imageFiles = r.files.filter((f) => f.mimeType.startsWith("image/"));
  const otherFiles = r.files.filter((f) => !f.mimeType.startsWith("image/"));

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <input
            className="text-2xl font-bold bg-transparent border-none outline-none w-full focus:ring-0 truncate"
            value={editTitle}
            onChange={(e) => {
              setEditTitle(e.target.value);
              markDirty();
            }}
            aria-label="Report title"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dirty && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateReport.isPending}
            >
              {updateReport.isPending ? "Saving..." : "Save"}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete report?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The report and all its data will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteReport.mutate({ id: id! })}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {r.aiAnalyses.some(
        (a) => a.status === "pending" || a.status === "processing",
      ) && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 text-sm">
          <Loader2 className="h-4 w-4 animate-spin shrink-0 text-primary" />
          <span>AI is analyzing your files — biomarkers and notes will appear shortly.</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={editDate}
              onChange={(e) => {
                setEditDate(e.target.value);
                markDirty();
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Exam type</Label>
            <Input
              value={editExamType}
              onChange={(e) => {
                setEditExamType(e.target.value);
                markDirty();
              }}
              placeholder="e.g. Blood Panel, Nerve Conduction Study"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Facility</Label>
            <Input
              value={editFacility}
              onChange={(e) => {
                setEditFacility(e.target.value);
                markDirty();
              }}
              placeholder="Hospital or clinic name"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tags</Label>
            <TagInput
              selectedIds={editTagIds}
              onChange={(ids) => {
                setEditTagIds(ids);
                markDirty();
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Doctor</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={editDoctorName}
              onChange={(e) => {
                setEditDoctorName(e.target.value);
                markDirty();
              }}
              placeholder="Dr. Name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Specialty</Label>
            <Input
              value={editDoctorSpecialty}
              onChange={(e) => {
                setEditDoctorSpecialty(e.target.value);
                markDirty();
              }}
              placeholder="e.g. Neurology"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={editNotes}
            onChange={(e) => {
              setEditNotes(e.target.value);
              markDirty();
            }}
            placeholder="Findings, observations..."
            rows={5}
            className="resize-none"
          />
        </CardContent>
      </Card>

      {r.files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {imageFiles.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {imageFiles.map((file) => (
                  <FileViewer key={file.id} file={file} />
                ))}
              </div>
            )}
            {otherFiles.length > 0 && (
              <div className="space-y-2">
                {otherFiles.map((file) => (
                  <FileViewer key={file.id} file={file} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Biomarkers</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddEntry(!showAddEntry)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddEntry && (
            <>
              <form
                onSubmit={handleAddEntry}
                className="grid gap-2 sm:grid-cols-5"
              >
                <Input
                  placeholder="Name"
                  value={entryName}
                  onChange={(e) => setEntryName(e.target.value)}
                  required
                />
                <Input
                  placeholder="Value"
                  type="number"
                  step="any"
                  value={entryValue}
                  onChange={(e) => setEntryValue(e.target.value)}
                  required
                />
                <Input
                  placeholder="Unit"
                  value={entryUnit}
                  onChange={(e) => setEntryUnit(e.target.value)}
                  required
                />
                <Input
                  placeholder="Ref min"
                  type="number"
                  step="any"
                  value={entryRefMin}
                  onChange={(e) => setEntryRefMin(e.target.value)}
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Ref max"
                    type="number"
                    step="any"
                    value={entryRefMax}
                    onChange={(e) => setEntryRefMax(e.target.value)}
                  />
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </div>
              </form>
              <Separator />
            </>
          )}

          {r.entries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No entries yet. Add manually or wait for AI analysis.
            </p>
          )}

          <div className="space-y-2">
            {r.entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 p-3 bg-secondary rounded"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {entry.biomarkerName}
                    </span>
                    <Badge variant={statusVariant(entry.status)}>
                      {entry.status ?? "unknown"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {entry.value} {entry.unit}
                    {(entry.referenceMin !== null ||
                      entry.referenceMax !== null) && (
                      <>
                        {" "}
                        (ref: {entry.referenceMin ?? "?"} –{" "}
                        {entry.referenceMax ?? "?"})
                      </>
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => deleteEntry.mutate({ id: entry.id })}
                  aria-label={`Delete ${entry.biomarkerName}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {r.aiAnalyses.some((a) => a.status === "failed") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {r.aiAnalyses
              .filter((a) => a.status === "failed")
              .map((analysis) => (
                <div
                  key={analysis.id}
                  className="p-3 bg-secondary rounded text-sm flex items-center gap-2"
                >
                  <Badge variant="destructive">failed</Badge>
                  <span className="text-destructive text-xs">
                    {analysis.errorMessage}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ask AI about this report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {chatMessages.length > 0 && (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {chatMessages.map((msg, idx) => (
                <div
                  key={`${msg.role}-${idx}`}
                  className={`text-sm p-3 rounded-lg ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground ml-8"
                      : "bg-secondary mr-8"
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {chat.isPending && (
                <div className="bg-secondary rounded-lg p-3 mr-8">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleChatSend} className="flex gap-2">
            <Textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask a question about this report..."
              rows={2}
              className="resize-none flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSend(e);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!chatInput.trim() || chat.isPending}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Requires Claude API key configured in Settings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
