import { useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { trpc } from "@/api/trpc";

interface TagInputProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function TagInput({ selectedIds, onChange }: TagInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const utils = trpc.useUtils();

  const tags = trpc.tag.list.useQuery();
  const createTag = trpc.tag.create.useMutation({
    onSuccess: (newTag) => {
      utils.tag.list.invalidate();
      onChange([...selectedIds, newTag.id]);
      setInputValue("");
    },
  });

  const allTags = tags.data ?? [];
  const selectedTags = allTags.filter((t) => selectedIds.includes(t.id));

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  }

  function handleCreate() {
    const name = inputValue.trim();
    if (!name || createTag.isPending) return;
    createTag.mutate({ name });
  }

  const filtered = allTags.filter((t) =>
    t.name.toLowerCase().includes(inputValue.toLowerCase()),
  );

  const canCreate =
    inputValue.trim().length > 0 &&
    !allTags.some(
      (t) => t.name.toLowerCase() === inputValue.trim().toLowerCase(),
    );

  return (
    <div className="space-y-2">
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              style={{ backgroundColor: tag.color, color: "#fff" }}
              className="gap-1 pr-1"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => toggle(tag.id)}
                className="rounded-full hover:bg-white/20 transition-colors"
                aria-label={`Remove ${tag.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="text-muted-foreground">Add tags...</span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-64" align="start">
          <Command>
            <CommandInput
              placeholder="Search or create..."
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                {canCreate ? (
                  <button
                    type="button"
                    className="flex items-center gap-2 px-4 py-2 text-sm w-full hover:bg-accent rounded"
                    onClick={handleCreate}
                  >
                    <Plus className="h-4 w-4" />
                    Create &ldquo;{inputValue.trim()}&rdquo;
                  </button>
                ) : (
                  "No tags found."
                )}
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.name}
                    onSelect={() => toggle(tag.id)}
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedIds.includes(tag.id)
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
                {canCreate && (
                  <CommandItem
                    value={`__create__${inputValue}`}
                    onSelect={handleCreate}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create &ldquo;{inputValue.trim()}&rdquo;
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
