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
  Code2, Eye, Heading1, Heading2, Pilcrow, Highlighter,
  Type, Undo, Redo, List, ListOrdered, MousePointer, X,
} from "lucide-react";

/* ─── custom FontSize extension ─── */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    customFontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    customFontFamily: {
      setFontFamily: (family: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
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
          parseHTML: (el: HTMLElement) => el.style.fontSize?.replace(/['"]+/g, "") || null,
          renderHTML: (attrs: Record<string, unknown>) =>
            attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
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

const FontFamilyExt = Extension.create({
  name: "customFontFamily",
  addOptions() { return { types: ["textStyle"] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontFamily: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontFamily?.replace(/['"]+/g, "") || null,
          renderHTML: (attrs: Record<string, unknown>) =>
            attrs.fontFamily ? { style: `font-family: ${attrs.fontFamily}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontFamily: (family: string) => ({ chain }: any) =>
        chain().setMark("textStyle", { fontFamily: family }).run(),
      unsetFontFamily: () => ({ chain }: any) =>
        chain().setMark("textStyle", { fontFamily: null }).removeEmptyTextStyle().run(),
    };
  },
});

/* ─── helpers ─── */
const SIZES = [
  { label: "11 px", value: "11px" }, { label: "13 px", value: "13px" },
  { label: "15 px", value: "15px" }, { label: "18 px", value: "18px" },
  { label: "22 px", value: "22px" }, { label: "26 px", value: "26px" },
  { label: "32 px", value: "32px" }, { label: "40 px", value: "40px" },
];

const FONTS = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Impact", value: "Impact, Charcoal, sans-serif" },
];

function Btn({ active, disabled, title, onClick, children }: {
  active?: boolean; disabled?: boolean; title: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick}
      className={`h-7 w-7 rounded flex items-center justify-center transition-colors flex-shrink-0
        ${active ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-200 hover:text-slate-900"}
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
      {children}
    </button>
  );
}

function Sep() { return <div className="w-px h-5 bg-slate-300 mx-0.5 flex-shrink-0" />; }

/* ─── component ─── */
export interface EmailEditorProps { value: string; onChange: (html: string) => void; minHeight?: number; }

export function EmailEditor({ value, onChange, minHeight = 340 }: EmailEditorProps) {
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [htmlDraft, setHtmlDraft] = useState(value);

  /* popover state */
  const [linkUrl, setLinkUrl] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [showImg, setShowImg] = useState(false);
  const [showBtn, setShowBtn] = useState(false);
  const [btnText, setBtnText] = useState("Click here");
  const [btnUrl, setBtnUrl] = useState("");
  const [btnColor, setBtnColor] = useState("#2563eb");

  /* color pickers */
  const [textColor, setTextColor] = useState("#1e293b");
  const [hlColor, setHlColor] = useState("#fde047");
  const textColorRef = useRef<HTMLInputElement>(null);
  const hlColorRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      TextStyle,
      FontSizeExt,
      FontFamilyExt,
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
      attributes: {
        class: "outline-none px-5 py-4 text-sm leading-relaxed",
        style: "color:#1e293b; background:#fff;",
      },
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
  const doBtn = () => {
    if (!editor || !btnText) return;
    const html = `<a href="${btnUrl || '#'}" target="_blank" style="display:inline-block;padding:12px 28px;background-color:${btnColor};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;line-height:1;">${btnText}</a>`;
    editor.chain().focus().insertContent(html).run();
    setBtnText("Click here"); setBtnUrl(""); setShowBtn(false);
  };

  const closeAll = () => { setShowLink(false); setShowImg(false); setShowBtn(false); };

  const curSize = editor?.getAttributes("textStyle").fontSize || "";
  const curFont = editor?.getAttributes("textStyle").fontFamily || "";

  return (
    <div className="border border-slate-300 rounded-xl overflow-visible bg-white shadow-sm">
      {/* ── Toolbar ── */}
      <div className="bg-slate-50 border-b border-slate-200 px-2 py-1.5 flex flex-wrap items-center gap-0.5 rounded-t-xl">

        {/* History */}
        <Btn title="Undo" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}>
          <Undo className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Redo" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}>
          <Redo className="w-3.5 h-3.5" />
        </Btn>
        <Sep />

        {/* Block type */}
        <Btn title="Normal paragraph" active={editor?.isActive("paragraph") && !editor.isActive("heading")} onClick={() => editor?.chain().focus().setParagraph().run()}>
          <Pilcrow className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Heading 1" active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Heading 2" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="w-3.5 h-3.5" />
        </Btn>
        <Sep />

        {/* Inline marks */}
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

        {/* Lists */}
        <Btn title="Bullet list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Ordered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="w-3.5 h-3.5" />
        </Btn>
        <Sep />

        {/* Font family */}
        <select value={curFont} onChange={e => {
          const v = e.target.value;
          if (!v) editor?.chain().focus().unsetFontFamily().run();
          else editor?.chain().focus().setFontFamily(v).run();
        }} className="h-7 pl-2 pr-1 text-[11px] border border-slate-300 rounded bg-white text-slate-700 cursor-pointer flex-shrink-0" style={{ minWidth: 90 }} title="Font family">
          {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        {/* Font size */}
        <select value={curSize} onChange={e => {
          const v = e.target.value;
          if (!v) editor?.chain().focus().unsetFontSize().run();
          else editor?.chain().focus().setFontSize(v).run();
        }} className="h-7 pl-2 pr-1 text-[11px] border border-slate-300 rounded bg-white text-slate-700 cursor-pointer flex-shrink-0" style={{ minWidth: 68 }} title="Font size">
          <option value="">Size</option>
          {SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <Sep />

        {/* Text color */}
        <button type="button" title="Text color" onClick={() => textColorRef.current?.click()}
          className="h-7 w-7 rounded flex flex-col items-center justify-center hover:bg-slate-200 transition-colors relative flex-shrink-0 gap-0.5">
          <span className="text-[11px] font-extrabold leading-none" style={{ color: textColor }}>A</span>
          <span className="w-4 h-[3px] rounded-sm" style={{ backgroundColor: textColor }} />
          <input ref={textColorRef} type="color" value={textColor}
            onChange={e => { setTextColor(e.target.value); editor?.chain().focus().setColor(e.target.value).run(); }}
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
        </button>

        {/* Highlight / bg color */}
        <button type="button" title="Text highlight color" onClick={() => hlColorRef.current?.click()}
          className="h-7 w-7 rounded flex flex-col items-center justify-center hover:bg-slate-200 transition-colors relative flex-shrink-0 gap-0.5">
          <Highlighter className="w-3.5 h-3.5 text-slate-600" />
          <span className="w-4 h-[3px] rounded-sm" style={{ backgroundColor: hlColor }} />
          <input ref={hlColorRef} type="color" value={hlColor}
            onChange={e => { setHlColor(e.target.value); editor?.chain().focus().toggleHighlight({ color: e.target.value }).run(); }}
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
        </button>
        <Sep />

        {/* Alignment */}
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

        {/* Link popover */}
        <div className="relative flex-shrink-0">
          <Btn title="Insert link" active={editor?.isActive("link") || showLink} onClick={() => { closeAll(); setShowLink(v => !v); setLinkUrl(editor?.isActive("link") ? editor.getAttributes("link").href || "" : ""); }}>
            <LinkIcon className="w-3.5 h-3.5" />
          </Btn>
          {showLink && (
            <div className="absolute left-0 top-9 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl p-3 w-72 space-y-2">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-700">Insert Link</p><button type="button" onClick={() => setShowLink(false)}><X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-700" /></button></div>
              <input autoFocus type="url" placeholder="https://…" value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && doLink()}
                className="w-full h-8 px-2.5 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 outline-none focus:border-blue-400" />
              <div className="flex gap-2">
                <button type="button" onClick={doLink} className="flex-1 h-7 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Apply</button>
                {editor?.isActive("link") && <button type="button" onClick={() => { editor.chain().focus().unsetLink().run(); setShowLink(false); }} className="h-7 px-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50">Remove</button>}
              </div>
            </div>
          )}
        </div>

        {/* Image popover */}
        <div className="relative flex-shrink-0">
          <Btn title="Insert image URL" active={showImg} onClick={() => { closeAll(); setShowImg(v => !v); setImgUrl(""); }}>
            <ImageIcon className="w-3.5 h-3.5" />
          </Btn>
          {showImg && (
            <div className="absolute left-0 top-9 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl p-3 w-72 space-y-2">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-700">Insert Image</p><button type="button" onClick={() => setShowImg(false)}><X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-700" /></button></div>
              <input autoFocus type="url" placeholder="https://example.com/image.png" value={imgUrl}
                onChange={e => setImgUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && doImg()}
                className="w-full h-8 px-2.5 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 outline-none focus:border-blue-400" />
              <div className="flex gap-2">
                <button type="button" onClick={doImg} className="flex-1 h-7 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Insert</button>
                <button type="button" onClick={() => setShowImg(false)} className="h-7 px-2 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100">✕</button>
              </div>
            </div>
          )}
        </div>

        {/* CTA Button popover */}
        <div className="relative flex-shrink-0">
          <Btn title="Insert CTA button" active={showBtn} onClick={() => { closeAll(); setShowBtn(v => !v); }}>
            <MousePointer className="w-3.5 h-3.5" />
          </Btn>
          {showBtn && (
            <div className="absolute left-0 top-9 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl p-3 w-80 space-y-2">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-700">Insert Button</p><button type="button" onClick={() => setShowBtn(false)}><X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-700" /></button></div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Button Text</label>
                <input autoFocus type="text" placeholder="e.g. Get Started" value={btnText}
                  onChange={e => setBtnText(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 outline-none focus:border-blue-400" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Link URL</label>
                <input type="url" placeholder="https://…" value={btnUrl}
                  onChange={e => setBtnUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && doBtn()}
                  className="w-full h-8 px-2.5 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-800 outline-none focus:border-blue-400" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Button Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={btnColor} onChange={e => setBtnColor(e.target.value)}
                    className="h-8 w-8 rounded border border-slate-300 cursor-pointer p-0.5" />
                  <span className="text-xs text-slate-600 font-mono">{btnColor}</span>
                  <div className="flex-1 h-8 rounded-lg flex items-center justify-center text-white text-xs font-semibold" style={{ background: btnColor }}>{btnText || "Button"}</div>
                </div>
              </div>
              <button type="button" onClick={doBtn} className="w-full h-8 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Insert Button</button>
            </div>
          )}
        </div>

        <Btn title="Horizontal divider" onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
          <Minus className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Clear all formatting" onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}>
          <Eraser className="w-3.5 h-3.5" />
        </Btn>

        {/* HTML toggle */}
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

      {/* ── Editor canvas ── */}
      {mode === "visual" ? (
        <div
          className="rounded-b-xl overflow-hidden cursor-text"
          style={{ minHeight, background: "#fff" }}
          onClick={() => editor?.commands.focus()}
        >
          <EditorContent editor={editor} style={{ minHeight }} />
        </div>
      ) : (
        <div style={{ minHeight }} className="rounded-b-xl overflow-hidden bg-slate-50">
          <textarea
            value={htmlDraft}
            onChange={e => { setHtmlDraft(e.target.value); onChange(e.target.value); }}
            className="w-full font-mono text-[11px] text-slate-800 bg-transparent p-4 outline-none resize-none block"
            style={{ minHeight }}
            spellCheck={false}
            placeholder="<div>Your HTML email here…</div>"
          />
        </div>
      )}

      <style>{`
        .tiptap {
          min-height: inherit;
          color: #1e293b !important;
          background: #ffffff !important;
          caret-color: #1e293b;
        }
        .tiptap * { box-sizing: border-box; }
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
          float: left;
          height: 0;
        }
        .tiptap h1 { font-size: 2em; font-weight: 700; margin: 0.5em 0; color: #0f172a; }
        .tiptap h2 { font-size: 1.5em; font-weight: 700; margin: 0.5em 0; color: #0f172a; }
        .tiptap h3 { font-size: 1.17em; font-weight: 700; margin: 0.5em 0; color: #0f172a; }
        .tiptap p  { margin: 0.4em 0; min-height: 1.4em; }
        .tiptap ul { list-style: disc; padding-left: 1.5em; margin: 0.4em 0; }
        .tiptap ol { list-style: decimal; padding-left: 1.5em; margin: 0.4em 0; }
        .tiptap a  { color: #2563eb; text-decoration: underline; cursor: pointer; }
        .tiptap img { max-width: 100%; height: auto; display: block; border-radius: 4px; margin: 0.5em 0; }
        .tiptap hr  { border: none; border-top: 1px solid #cbd5e1; margin: 1em 0; }
        .tiptap mark { padding: 0.05em 0.15em; border-radius: 2px; }
        .tiptap blockquote { border-left: 3px solid #cbd5e1; margin: 0.5em 0; padding-left: 1em; color: #64748b; }
        .tiptap code { background: #f1f5f9; color: #0f172a; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
        .tiptap pre { background: #1e293b; color: #e2e8f0; padding: 1em; border-radius: 8px; overflow-x: auto; }
      `}</style>
    </div>
  );
}
