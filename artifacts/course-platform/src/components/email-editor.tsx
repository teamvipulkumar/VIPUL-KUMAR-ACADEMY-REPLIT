import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { useState, useRef } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, Image as ImageIcon, Minus, Eraser,
  Code2, Eye, Heading1, Heading2, Pilcrow, Highlighter, Type,
  Undo, Redo, List, ListOrdered,
} from "lucide-react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    customFontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const FontSizeExt = Extension.create({
  name: "customFontSize",
  addOptions() { return { types: ["textStyle"] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: el => el.style.fontSize?.replace(/['"]+/g, "") || null,
          renderHTML: (attrs: Record<string, unknown>) => {
            if (!attrs.fontSize) return {};
            return { style: `font-size: ${attrs.fontSize}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: any) =>
        chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: any) =>
        chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

const SIZES = [
  { label: "XS · 11px", value: "11px" },
  { label: "S · 13px", value: "13px" },
  { label: "M · 15px", value: "15px" },
  { label: "L · 18px", value: "18px" },
  { label: "XL · 22px", value: "22px" },
  { label: "2XL · 26px", value: "26px" },
  { label: "3XL · 32px", value: "32px" },
  { label: "4XL · 40px", value: "40px" },
];

interface Props { value: string; onChange: (html: string) => void; minHeight?: number; }

function Btn({ active, disabled, title, onClick, children }: {
  active?: boolean; disabled?: boolean; title: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick}
      className={`h-7 w-7 rounded flex items-center justify-center transition-colors flex-shrink-0 text-xs
        ${active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"}
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
      {children}
    </button>
  );
}

function Sep() { return <div className="w-px h-5 bg-slate-300 mx-0.5 flex-shrink-0" />; }

export function EmailEditor({ value, onChange, minHeight = 340 }: Props) {
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [htmlDraft, setHtmlDraft] = useState(value);
  const [linkUrl, setLinkUrl] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [showImg, setShowImg] = useState(false);
  const [textColor, setTextColor] = useState("#1e293b");
  const [hlColor, setHlColor] = useState("#fde047");
  const textColorRef = useRef<HTMLInputElement>(null);
  const hlColorRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      FontSizeExt,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false }),
      Underline,
      Highlight.configure({ multicolor: true }),
    ],
    content: value,
    onUpdate({ editor }) {
      const html = editor.getHTML();
      onChange(html);
      setHtmlDraft(html);
    },
    editorProps: {
      attributes: { class: "outline-none px-5 py-4 text-sm leading-relaxed" },
    },
  });

  const goHtml = () => { if (editor) setHtmlDraft(editor.getHTML()); setMode("html"); };
  const goVisual = () => {
    if (editor) { editor.commands.setContent(htmlDraft); onChange(htmlDraft); }
    setMode("visual");
  };

  const doLink = () => {
    if (!editor) return;
    if (!linkUrl) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
    setLinkUrl(""); setShowLink(false);
  };
  const doImg = () => {
    if (!editor || !imgUrl) return;
    editor.chain().focus().setImage({ src: imgUrl }).run();
    setImgUrl(""); setShowImg(false);
  };

  const curSize = editor?.getAttributes("textStyle").fontSize || "";

  return (
    <div className="border border-slate-300 rounded-xl overflow-visible bg-white shadow-sm">
      <div className="bg-slate-100 border-b border-slate-300 px-2 py-1.5 flex flex-wrap items-center gap-0.5 rounded-t-xl">

        <Btn title="Undo" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}>
          <Undo className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Redo" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}>
          <Redo className="w-3.5 h-3.5" />
        </Btn>
        <Sep />

        <Btn title="Normal text" active={editor?.isActive("paragraph") && !editor.isActive("heading")} onClick={() => editor?.chain().focus().setParagraph().run()}>
          <Pilcrow className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Heading 1" active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Heading 2" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="w-3.5 h-3.5" />
        </Btn>
        <Sep />

        <Btn title="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Underline" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Strikethrough" active={editor?.isActive("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()}>
          <Strikethrough className="w-3.5 h-3.5" />
        </Btn>
        <Sep />

        <Btn title="Bullet list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Ordered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="w-3.5 h-3.5" />
        </Btn>
        <Sep />

        <div className="relative flex-shrink-0">
          <select value={curSize} onChange={e => {
            const v = e.target.value;
            if (!v) editor?.chain().focus().unsetFontSize().run();
            else editor?.chain().focus().setFontSize(v).run();
          }} className="h-7 pl-1.5 pr-5 text-xs border border-slate-300 rounded bg-white text-slate-700 appearance-none cursor-pointer" style={{ minWidth: 64 }}>
            <option value="">Size</option>
            {SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <Type className="w-3 h-3 text-slate-400 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <Sep />

        <button type="button" title="Text color" onClick={() => textColorRef.current?.click()}
          className="h-7 w-7 rounded flex items-center justify-center hover:bg-slate-200 transition-colors relative flex-shrink-0">
          <span className="text-[11px] font-extrabold" style={{ color: textColor }}>A</span>
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3.5 h-[3px] rounded-sm" style={{ backgroundColor: textColor }} />
          <input ref={textColorRef} type="color" value={textColor}
            onChange={e => { setTextColor(e.target.value); editor?.chain().focus().setColor(e.target.value).run(); }}
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
        </button>

        <button type="button" title="Highlight / background color" onClick={() => hlColorRef.current?.click()}
          className="h-7 w-7 rounded flex items-center justify-center hover:bg-slate-200 transition-colors relative flex-shrink-0">
          <Highlighter className="w-3.5 h-3.5 text-slate-500" />
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3.5 h-[3px] rounded-sm" style={{ backgroundColor: hlColor }} />
          <input ref={hlColorRef} type="color" value={hlColor}
            onChange={e => { setHlColor(e.target.value); editor?.chain().focus().toggleHighlight({ color: e.target.value }).run(); }}
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
        </button>
        <Sep />

        <Btn title="Align left" active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Align center" active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Align right" active={editor?.isActive({ textAlign: "right" })} onClick={() => editor?.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Justify" active={editor?.isActive({ textAlign: "justify" })} onClick={() => editor?.chain().focus().setTextAlign("justify").run()}>
          <AlignJustify className="w-3.5 h-3.5" />
        </Btn>
        <Sep />

        <div className="relative flex-shrink-0">
          <Btn title="Insert / edit link" active={editor?.isActive("link") || showLink} onClick={() => {
            setShowLink(v => !v); setShowImg(false);
            setLinkUrl(editor?.isActive("link") ? editor.getAttributes("link").href || "" : "");
          }}>
            <LinkIcon className="w-3.5 h-3.5" />
          </Btn>
          {showLink && (
            <div className="absolute left-0 top-9 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-72 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Insert Link</p>
              <input autoFocus type="url" placeholder="https://..." value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && doLink()}
                className="w-full h-8 px-2.5 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 outline-none focus:border-blue-400" />
              <div className="flex gap-2">
                <button type="button" onClick={doLink} className="flex-1 h-7 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">Apply</button>
                {editor?.isActive("link") && (
                  <button type="button" onClick={() => { editor.chain().focus().unsetLink().run(); setShowLink(false); }}
                    className="h-7 px-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">Remove</button>
                )}
                <button type="button" onClick={() => setShowLink(false)}
                  className="h-7 px-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">✕</button>
              </div>
            </div>
          )}
        </div>

        <div className="relative flex-shrink-0">
          <Btn title="Insert image from URL" active={showImg} onClick={() => { setShowImg(v => !v); setShowLink(false); setImgUrl(""); }}>
            <ImageIcon className="w-3.5 h-3.5" />
          </Btn>
          {showImg && (
            <div className="absolute left-0 top-9 z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-72 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Insert Image</p>
              <input autoFocus type="url" placeholder="https://example.com/image.png" value={imgUrl}
                onChange={e => setImgUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && doImg()}
                className="w-full h-8 px-2.5 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 outline-none focus:border-blue-400" />
              <div className="flex gap-2">
                <button type="button" onClick={doImg} className="flex-1 h-7 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">Insert</button>
                <button type="button" onClick={() => setShowImg(false)}
                  className="h-7 px-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">✕</button>
              </div>
            </div>
          )}
        </div>

        <Btn title="Horizontal divider" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
          <Minus className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Clear all formatting" onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}>
          <Eraser className="w-3.5 h-3.5" />
        </Btn>

        <div className="ml-auto flex-shrink-0">
          <button type="button" onClick={mode === "visual" ? goHtml : goVisual}
            className={`h-7 px-2.5 text-[11px] font-semibold rounded-lg flex items-center gap-1.5 transition-colors border ${
              mode === "html" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
            }`}>
            <Code2 className="w-3 h-3" />
            {mode === "visual" ? "HTML" : "← Visual"}
          </button>
        </div>
      </div>

      {mode === "visual" ? (
        <div className="bg-white cursor-text rounded-b-xl" style={{ minHeight }} onClick={() => editor?.commands.focus()}>
          <EditorContent editor={editor} style={{ minHeight }} />
        </div>
      ) : (
        <div style={{ minHeight }} className="rounded-b-xl overflow-hidden bg-slate-50">
          <textarea value={htmlDraft} onChange={e => { setHtmlDraft(e.target.value); onChange(e.target.value); }}
            className="w-full font-mono text-[11px] text-slate-800 bg-transparent p-4 outline-none resize-none block"
            style={{ minHeight }} spellCheck={false} placeholder="<div>Your HTML email here…</div>" />
        </div>
      )}

      <style>{`
        .tiptap { min-height: inherit; }
        .tiptap h1 { font-size: 2em; font-weight: 700; margin: 0.5em 0; }
        .tiptap h2 { font-size: 1.5em; font-weight: 700; margin: 0.5em 0; }
        .tiptap h3 { font-size: 1.17em; font-weight: 700; margin: 0.5em 0; }
        .tiptap p { margin: 0.4em 0; min-height: 1.4em; }
        .tiptap ul { list-style: disc; padding-left: 1.5em; margin: 0.4em 0; }
        .tiptap ol { list-style: decimal; padding-left: 1.5em; margin: 0.4em 0; }
        .tiptap a { color: #2563eb; text-decoration: underline; cursor: pointer; }
        .tiptap img { max-width: 100%; height: auto; display: block; border-radius: 4px; }
        .tiptap hr { border: none; border-top: 1px solid #cbd5e1; margin: 1em 0; }
        .tiptap mark { padding: 0.05em 0.1em; border-radius: 2px; }
        .tiptap blockquote { border-left: 3px solid #cbd5e1; margin: 0.5em 0; padding-left: 1em; color: #64748b; }
        .tiptap code { background: #f1f5f9; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
        .tiptap pre { background: #1e293b; color: #e2e8f0; padding: 1em; border-radius: 8px; overflow-x: auto; }
      `}</style>
    </div>
  );
}
