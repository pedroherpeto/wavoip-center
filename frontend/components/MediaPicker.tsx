"use client";

import * as React from "react";
import {
  Upload,
  FolderOpen,
  Music,
  Image as ImageIcon,
  FileIcon,
  X,
  Check,
} from "lucide-react";
import {
  uploadFile,
  listUploads,
  type MediaItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface MediaPickerProps {
  value: string;
  onChange: (url: string) => void;
  /** Mime accept do <input file> e do filtro da biblioteca */
  accept: string; // e.g. "audio/*", "image/*"
  placeholder?: string;
  hint?: string;
  showPreview?: boolean;
}

function kindOf(filename: string): "audio" | "image" | "other" {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (["mp3", "wav", "m4a", "ogg", "opus", "aac", "flac"].includes(ext))
    return "audio";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
    return "image";
  return "other";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function MediaPicker({
  value,
  onChange,
  accept,
  placeholder,
  hint,
  showPreview = true,
}: MediaPickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const [library, setLibrary] = React.useState<MediaItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = React.useState(false);

  const wantKind: "audio" | "image" | null = accept.startsWith("audio")
    ? "audio"
    : accept.startsWith("image")
      ? "image"
      : null;

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const result = await uploadFile(file);
      onChange(result.url);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  async function openLibrary() {
    setLibraryOpen(true);
    setLoadingLibrary(true);
    try {
      const items = await listUploads();
      setLibrary(items);
    } catch (e) {
      console.error("[MediaPicker] listUploads failed", e);
      setLibrary([]);
    } finally {
      setLoadingLibrary(false);
    }
  }

  const filtered = library.filter((it) => {
    if (!wantKind) return true;
    return kindOf(it.filename) === wantKind;
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={openLibrary}
          title="Escolher dos uploads"
        >
          <FolderOpen className="h-4 w-4" />
          <span className="hidden sm:inline">Biblioteca</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          title="Enviar arquivo do PC"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">
            {uploading ? "..." : "Upload"}
          </span>
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {showPreview && value && wantKind === "audio" && (
        <audio src={value} controls className="w-full h-8" />
      )}
      {showPreview && value && wantKind === "image" && (
        <img
          src={value}
          alt="preview"
          className="max-h-32 rounded-lg border border-[var(--border)]"
        />
      )}
      {value && (
        <button
          type="button"
          className="text-[10px] text-[var(--muted-foreground)] hover:text-red-400 self-start inline-flex items-center gap-1"
          onClick={() => onChange("")}
        >
          <X className="h-3 w-3" />
          Limpar
        </button>
      )}
      {hint && (
        <p className="text-[10px] text-[var(--muted-foreground)]">{hint}</p>
      )}
      {error && <p className="text-[10px] text-red-400">{error}</p>}

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Biblioteca de uploads</DialogTitle>
          </DialogHeader>
          {loadingLibrary ? (
            <p className="text-sm text-[var(--muted-foreground)] py-8 text-center">
              Carregando...
            </p>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              Nenhum arquivo
              {wantKind ? ` ${wantKind === "audio" ? "de audio" : "de imagem"}` : ""}
              {" "}
              ainda. Use o botao Upload para enviar.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
              {filtered.map((item) => {
                const kind = kindOf(item.filename);
                const Icon =
                  kind === "audio" ? Music : kind === "image" ? ImageIcon : FileIcon;
                const isSelected = item.url === value;
                return (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => {
                      onChange(item.url);
                      setLibraryOpen(false);
                    }}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors",
                      isSelected
                        ? "border-wavoip-500 bg-wavoip-500/10"
                        : "border-[var(--border)] hover:bg-[var(--muted)]"
                    )}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Icon className="h-4 w-4 text-wavoip-500 shrink-0" />
                      <span className="text-xs font-medium truncate flex-1">
                        {item.filename}
                      </span>
                      {isSelected && (
                        <Check className="h-3 w-3 text-wavoip-500 shrink-0" />
                      )}
                    </div>
                    {kind === "image" && (
                      <img
                        src={item.url}
                        alt={item.filename}
                        className="w-full h-20 object-cover rounded-md"
                      />
                    )}
                    {kind === "audio" && (
                      <audio
                        src={item.url}
                        controls
                        className="w-full h-8"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      {formatSize(item.size)} ·{" "}
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLibraryOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
