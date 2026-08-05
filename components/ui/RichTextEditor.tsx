"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
};

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something…",
  className,
  editorClassName,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const userHasTyped = useRef(false);

  useEffect(() => {
    if (!editorRef.current) return;
    if (!userHasTyped.current || value === "") {
      editorRef.current.innerHTML = value;
      if (value === "") userHasTyped.current = false;
    }
  }, [value]);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val ?? undefined);
    editorRef.current?.focus();
  };

  const setBlock = (tag: string) => {
    document.execCommand("formatBlock", false, tag);
    editorRef.current?.focus();
  };

  const toolbarBtn =
    "w-8 h-8 rounded flex items-center justify-center text-muted hover:bg-white/5 hover:text-light transition-colors font-headline font-bold text-[13px]";

  return (
    <div
      className={cn(
        "border border-dark-lighter rounded-md overflow-hidden focus-within:border-primary transition-colors",
        className,
      )}
    >
      <div className="flex items-center gap-1 px-3 py-2 border-b border-dark-lighter bg-white/[0.02] flex-wrap">
        <button type="button" title="Bold (Ctrl+B)" onClick={() => exec("bold")} className={toolbarBtn}>
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button type="button" title="Italic (Ctrl+I)" onClick={() => exec("italic")} className={toolbarBtn}>
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button type="button" title="Underline (Ctrl+U)" onClick={() => exec("underline")} className={toolbarBtn}>
          <Underline className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-5 bg-dark-lighter mx-1" />
        <button
          type="button"
          title="Heading"
          onClick={() => setBlock("h3")}
          className={`${toolbarBtn} text-[11px] font-black uppercase tracking-widest`}
        >
          H
        </button>
        <button
          type="button"
          title="Subheading"
          onClick={() => setBlock("h4")}
          className={`${toolbarBtn} text-[10px] font-black uppercase tracking-widest`}
        >
          H2
        </button>
        <button type="button" title="Normal text" onClick={() => setBlock("p")} className={toolbarBtn}>
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-5 bg-dark-lighter mx-1" />
        <button
          type="button"
          title="Bullet list"
          onClick={() => exec("insertUnorderedList")}
          className={`${toolbarBtn} text-[11px]`}
        >
          • List
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          userHasTyped.current = true;
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        onKeyDown={(e) => {
          if (e.ctrlKey || e.metaKey) {
            if (e.key === "b") {
              e.preventDefault();
              exec("bold");
            }
            if (e.key === "i") {
              e.preventDefault();
              exec("italic");
            }
            if (e.key === "u") {
              e.preventDefault();
              exec("underline");
            }
          }
        }}
        data-placeholder={placeholder}
        className={cn(
          "min-h-[220px] px-4 py-3 font-headline text-[14px] text-light focus:outline-none prose prose-sm max-w-none",
          "[&_h3]:font-headline [&_h3]:font-black [&_h3]:text-[16px] [&_h3]:text-light [&_h3]:mt-3 [&_h3]:mb-1",
          "[&_h4]:font-headline [&_h4]:font-bold [&_h4]:text-[14px] [&_h4]:text-light [&_h4]:mt-2 [&_h4]:mb-1",
          "[&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_li]:mb-0.5",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-dark empty:before:pointer-events-none",
          editorClassName,
        )}
      />
    </div>
  );
}
