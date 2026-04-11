/**
 * RichTextEmailEditor — Word-like WYSIWYG email editor powered by TipTap v3.
 * Paste a paragraph and format it like Microsoft Word.
 */
import { useCallback, useState, useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle, Color, FontFamily, FontSize } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Link2, Link2Off, Heading1, Heading2, Heading3, Heading4,
  Pilcrow, Palette, Highlighter, Undo2, Redo2, Type,
} from "lucide-react";

/* ─── Email wrapper ─── */
function wrapRichTextInEmail(bodyHtml: string, settings: { bgColor: string; cardBgColor: string; cardPadding: number; fontFamily: string; companyName: string }): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email</title></head>
<body style="margin:0;padding:0;background-color:${settings.bgColor};font-family:${settings.fontFamily};">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${settings.bgColor};padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${settings.cardBgColor};border-radius:12px;padding:${settings.cardPadding}px;box-sizing:border-box;">
<tr><td>
<div style="font-family:${settings.fontFamily};font-size:15px;line-height:1.7;color:#374151;">
${bodyHtml}
</div>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

/* ─── Toolbar Button ─── */
function TB({ onClick, active, title, children, disabled }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      disabled={disabled}
      className={`h-7 min-w-[28px] px-1.5 flex items-center justify-center rounded text-xs font-medium transition-colors
        ${active ? "bg-blue-600 text-white" : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"}
        ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-slate-200 mx-0.5 flex-shrink-0" />;
}

/* ─── Link Dialog ─── */
function LinkDialog({ onConfirm, onClose, current }: { onConfirm: (url: string) => void; onClose: () => void; current: string }) {
  const [url, setUrl] = useState(current || "https://");
  return (
    <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl p-3 w-72" onClick={e => e.stopPropagation()}>
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Insert Link</p>
      <input
        autoFocus
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") onConfirm(url); if (e.key === "Escape") onClose(); }}
        className="w-full h-8 px-2.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 outline-none focus:border-blue-400 mb-2"
        placeholder="https://example.com"
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => onConfirm(url)}
          className="flex-1 h-7 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">Insert</button>
        <button type="button" onClick={onClose}
          className="flex-1 h-7 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">Cancel</button>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export interface RichTextEmailEditorProps {
  value: string;
  onChange: (html: string) => void;
  settings: { bgColor: string; cardBgColor: string; cardPadding: number; fontFamily: string; companyName: string };
}

const FONT_SIZES = ["12", "13", "14", "15", "16", "18", "20", "22", "24", "28", "32", "36", "48"];
const FONT_FAMILIES = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
];

/* Extract the inner body HTML from a full email wrapper (for TipTap init) */
function extractBodyContent(html: string): string {
  if (!html || html.trim().length < 10) return "";
  // If it's a full HTML doc, try to extract body div content
  const divMatch = html.match(/<div style="font-family[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/td>/);
  if (divMatch) return divMatch[1].trim();
  // If it's already just fragment HTML (no <!DOCTYPE>)
  if (!html.includes("<!DOCTYPE")) return html;
  return "";
}

export function RichTextEmailEditor({ value, onChange, settings }: RichTextEmailEditorProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#374151");
  const [selectedHighlight, setSelectedHighlight] = useState("#fef08a");
  const linkBtnRef = useRef<HTMLDivElement>(null);

  const initialContent = extractBodyContent(value) || "<p>Start typing or paste your email content here. Select text to format it.</p>";

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, underline: false } as any),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
    ],
    content: initialContent,
    onUpdate({ editor }) {
      const bodyHtml = editor.getHTML();
      onChange(wrapRichTextInEmail(bodyHtml, settings));
    },
  }, []);

  // Close link dialog on outside click
  useEffect(() => {
    if (!showLinkDialog) return;
    const handler = (e: MouseEvent) => {
      if (linkBtnRef.current && !linkBtnRef.current.contains(e.target as Node)) setShowLinkDialog(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showLinkDialog]);

  const insertLink = useCallback((url: string) => {
    if (!editor) return;
    setShowLinkDialog(false);
    if (!url || url === "https://") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  const currentFontSize = editor.getAttributes("textStyle").fontSize?.replace("px", "") ?? "15";
  const currentFontFamily = editor.getAttributes("textStyle").fontFamily ?? settings.fontFamily;

  return (
    <div className="flex flex-col h-full text-gray-900">
      {/* ── Toolbar ── */}
      <div className="bg-slate-50 border-b border-slate-200 px-2 py-1.5 flex items-center gap-0.5 flex-wrap flex-shrink-0">

        {/* Block type */}
        <TB onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive("paragraph")} title="Paragraph">
          <Pilcrow className="w-3.5 h-3.5" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
          <Heading1 className="w-3.5 h-3.5" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
          <Heading2 className="w-3.5 h-3.5" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
          <Heading3 className="w-3.5 h-3.5" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} active={editor.isActive("heading", { level: 4 })} title="Heading 4">
          <Heading4 className="w-3.5 h-3.5" />
        </TB>

        <Divider />

        {/* Inline marks */}
        <TB onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)">
          <Bold className="w-3.5 h-3.5" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)">
          <Italic className="w-3.5 h-3.5" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline (Ctrl+U)">
          <UnderlineIcon className="w-3.5 h-3.5" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
          <Strikethrough className="w-3.5 h-3.5" />
        </TB>

        <Divider />

        {/* Text color */}
        <div className="relative flex items-center" title="Text Color">
          <label className="h-7 min-w-[28px] px-1 flex flex-col items-center justify-center rounded cursor-pointer hover:bg-slate-100 gap-0.5">
            <Type className="w-3 h-3 text-slate-600" />
            <div className="w-4 h-1 rounded-sm" style={{ backgroundColor: selectedColor }} />
            <input type="color" className="sr-only" value={selectedColor}
              onChange={e => {
                setSelectedColor(e.target.value);
                editor.chain().focus().setColor(e.target.value).run();
              }}
            />
          </label>
        </div>

        {/* Highlight */}
        <div className="relative flex items-center" title="Highlight Color">
          <label className="h-7 min-w-[28px] px-1 flex flex-col items-center justify-center rounded cursor-pointer hover:bg-slate-100 gap-0.5">
            <Highlighter className="w-3 h-3 text-slate-600" />
            <div className="w-4 h-1 rounded-sm" style={{ backgroundColor: selectedHighlight }} />
            <input type="color" className="sr-only" value={selectedHighlight}
              onChange={e => {
                setSelectedHighlight(e.target.value);
                editor.chain().focus().setHighlight({ color: e.target.value }).run();
              }}
            />
          </label>
        </div>

        <Divider />

        {/* Lists */}
        <TB onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
          <List className="w-3.5 h-3.5" />
        </TB>
        <TB onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Ordered List">
          <ListOrdered className="w-3.5 h-3.5" />
        </TB>

        <Divider />

        {/* Alignment */}
        <TB onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align Left">
          <AlignLeft className="w-3.5 h-3.5" />
        </TB>
        <TB onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align Center">
          <AlignCenter className="w-3.5 h-3.5" />
        </TB>
        <TB onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align Right">
          <AlignRight className="w-3.5 h-3.5" />
        </TB>

        <Divider />

        {/* Link */}
        <div className="relative" ref={linkBtnRef}>
          <TB onClick={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run();
            } else {
              setShowLinkDialog(v => !v);
            }
          }} active={editor.isActive("link")} title={editor.isActive("link") ? "Remove Link" : "Insert Link"}>
            {editor.isActive("link") ? <Link2Off className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          </TB>
          {showLinkDialog && (
            <LinkDialog
              current={editor.getAttributes("link").href ?? ""}
              onConfirm={insertLink}
              onClose={() => setShowLinkDialog(false)}
            />
          )}
        </div>

        <Divider />

        {/* Font Family */}
        <select
          value={currentFontFamily}
          onChange={e => editor.chain().focus().setFontFamily(e.target.value).run()}
          onMouseDown={e => e.stopPropagation()}
          title="Font Family"
          className="h-7 px-1.5 text-[11px] border border-slate-200 rounded bg-white text-slate-700 outline-none cursor-pointer hover:border-slate-300"
          style={{ maxWidth: 90 }}
        >
          {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        {/* Font Size */}
        <select
          value={currentFontSize}
          onChange={e => editor.chain().focus().setFontSize(e.target.value + "px").run()}
          onMouseDown={e => e.stopPropagation()}
          title="Font Size"
          className="h-7 px-1 text-[11px] border border-slate-200 rounded bg-white text-slate-700 outline-none cursor-pointer hover:border-slate-300 w-14"
        >
          {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
        </select>

        <Divider />

        {/* Undo / Redo */}
        <TB onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!editor.can().undo()}>
          <Undo2 className="w-3.5 h-3.5" />
        </TB>
        <TB onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!editor.can().redo()}>
          <Redo2 className="w-3.5 h-3.5" />
        </TB>
      </div>

      {/* ── Editing Canvas ── */}
      <div className="flex-1 overflow-y-auto p-4" style={{ background: settings.bgColor }}>
        <div
          className="mx-auto rounded-xl shadow-sm"
          style={{ maxWidth: 560, background: settings.cardBgColor, padding: settings.cardPadding }}
        >
          <EditorContent
            editor={editor}
            className="rich-email-editor outline-none"
          />
        </div>
        <p className="text-center text-[10px] text-slate-400 mt-3">
          Select any text to format it · Use toolbar for headings, lists, colors, and links
        </p>
      </div>

      <style>{`
        .rich-email-editor .tiptap {
          outline: none;
          min-height: 280px;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 15px;
          line-height: 1.7;
          color: #374151;
        }
        .rich-email-editor .tiptap p { margin: 0 0 12px; }
        .rich-email-editor .tiptap h1 { font-size: 26px; font-weight: 700; color: #111827; margin: 0 0 16px; }
        .rich-email-editor .tiptap h2 { font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 14px; }
        .rich-email-editor .tiptap h3 { font-size: 17px; font-weight: 700; color: #111827; margin: 0 0 12px; }
        .rich-email-editor .tiptap h4 { font-size: 15px; font-weight: 700; color: #111827; margin: 0 0 10px; }
        .rich-email-editor .tiptap ul { padding-left: 24px; margin: 0 0 16px; }
        .rich-email-editor .tiptap ol { padding-left: 24px; margin: 0 0 16px; }
        .rich-email-editor .tiptap li { margin-bottom: 6px; }
        .rich-email-editor .tiptap a { color: #2563eb; text-decoration: underline; }
        .rich-email-editor .tiptap strong { font-weight: 700; }
        .rich-email-editor .tiptap em { font-style: italic; }
        .rich-email-editor .tiptap s { text-decoration: line-through; }
        .rich-email-editor .tiptap u { text-decoration: underline; }
        .rich-email-editor .tiptap mark { border-radius: 2px; padding: 0 2px; }
        .rich-email-editor .tiptap p.is-editor-empty:first-child::before {
          color: #94a3b8;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
