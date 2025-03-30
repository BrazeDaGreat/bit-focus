"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Heading from "@tiptap/extension-heading";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import BulletList from "@tiptap/extension-bullet-list";
import CharacterCount from "@tiptap/extension-character-count";
import CodeBlock from "@tiptap/extension-code-block";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import OrderedList from "@tiptap/extension-ordered-list";
import Paragraph from "@tiptap/extension-paragraph";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Table from "@tiptap/extension-table";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  FaBold, FaItalic, FaHeading, FaListUl, FaListOl, FaLink,
  FaStrikethrough, FaCode, FaQuoteLeft, FaHighlighter, FaImage,
  FaTasks, FaSubscript, FaSuperscript, FaAlignLeft, FaAlignCenter, 
  FaAlignRight, FaTable, FaMinus
} from "react-icons/fa";

import "@/components/editor.css";

interface MarkdownEditorProps {
  content?: string;
  title: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
}

export default function MarkdownEditor(props: MarkdownEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start typing…",
      }),
      Heading.configure({ levels: [1, 2, 3] }),
      Bold,
      Italic,
      BulletList,
      CharacterCount,
      CodeBlock,
      FontFamily,
      Highlight,
      HorizontalRule,
      Image,
      Link,
      OrderedList,
      Paragraph,
      Subscript,
      Superscript,
      Table,
      TableHeader,
      TableCell,
      TableRow,
      TaskItem,
      TaskList,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Typography,
      Underline,
    ],
    content: props.content ?? "<p>Welcome to your Notion-like editor! 🎉</p>",
    autofocus: false,
    editable: true,
    onUpdate: () => {
      console.log("Updated")
    }
  });

  if (!editor) return null;

  editor.on("update", () => {
    props.setContent(editor.getHTML());
  });

  return (
    <Card className="h-full flex flex-col _editor">
      <CardHeader className="sticky top-4 z-10">
        <Toolbar editor={editor} title={props.title} />
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-1">
        <EditorContent
          editor={editor}
          className="flex-1 min-h-full outline-none"
        />
      </CardContent>
    </Card>
  );
}

interface ToolbarProps {
  editor: Editor;
  title?: string;
}

const Toolbar: React.FC<ToolbarProps> = ({ editor, title }) => {
  return (
    <Card className="shadow-md">
      <CardContent className="flex gap-2 items-center flex-wrap">
        {title && <span className="font-bold border-r pr-4">{title}</span>}

        {/* Bold */}
        <ToggleWithTooltip
          label="Bold"
          icon={<FaBold className="w-4 h-4" />}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />

        {/* Italic */}
        <ToggleWithTooltip
          label="Italic"
          icon={<FaItalic className="w-4 h-4" />}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />

        {/* Strikethrough */}
        <ToggleWithTooltip
          label="Strikethrough"
          icon={<FaStrikethrough className="w-4 h-4" />}
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />

        {/* Code Block */}
        <ToggleWithTooltip
          label="Code Block"
          icon={<FaCode className="w-4 h-4" />}
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />

        {/* Blockquote */}
        <ToggleWithTooltip
          label="Blockquote"
          icon={<FaQuoteLeft className="w-4 h-4" />}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />

        {/* Heading */}
        <ButtonWithTooltip
          label="Heading 2"
          icon={<FaHeading className="w-4 h-4" />}
          onClick={() => editor.chain().focus().setHeading({ level: 2 }).run()}
        />

        {/* Bullet List */}
        <ButtonWithTooltip
          label="Bullet List"
          icon={<FaListUl className="w-4 h-4" />}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />

        {/* Ordered List */}
        <ButtonWithTooltip
          label="Ordered List"
          icon={<FaListOl className="w-4 h-4" />}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />

        {/* Link */}
        <ButtonWithTooltip
          label="Insert Link"
          icon={<FaLink className="w-4 h-4" />}
          onClick={() => {
            const url = prompt("Enter URL:");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
        />

        {/* Highlight */}
        <ButtonWithTooltip
          label="Highlight"
          icon={<FaHighlighter className="w-4 h-4" />}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        />

        {/* Image */}
        <ButtonWithTooltip
          label="Insert Image"
          icon={<FaImage className="w-4 h-4" />}
          onClick={() => {
            const url = prompt("Enter image URL:");
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }}
        />

        {/* Task List */}
        <ButtonWithTooltip
          label="Task List"
          icon={<FaTasks className="w-4 h-4" />}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        />

        {/* Subscript */}
        <ButtonWithTooltip
          label="Subscript"
          icon={<FaSubscript className="w-4 h-4" />}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
        />

        {/* Superscript */}
        <ButtonWithTooltip
          label="Superscript"
          icon={<FaSuperscript className="w-4 h-4" />}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
        />

        {/* Alignment: Left */}
        <ButtonWithTooltip
          label="Align Left"
          icon={<FaAlignLeft className="w-4 h-4" />}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        />

        {/* Alignment: Center */}
        <ButtonWithTooltip
          label="Align Center"
          icon={<FaAlignCenter className="w-4 h-4" />}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        />

        {/* Alignment: Right */}
        <ButtonWithTooltip
          label="Align Right"
          icon={<FaAlignRight className="w-4 h-4" />}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        />

        {/* Table */}
        <ButtonWithTooltip
          label="Insert Table"
          icon={<FaTable className="w-4 h-4" />}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run()}
        />

        {/* Horizontal Rule */}
        <ButtonWithTooltip
          label="Insert Horizontal Rule"
          icon={<FaMinus className="w-4 h-4" />}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
      </CardContent>
    </Card>
  );
};

// Reusable Toggle Button with Tooltip
const ToggleWithTooltip = ({ label, icon, active, onClick }: {
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Toggle pressed={active} onPressedChange={onClick}>
        {icon}
      </Toggle>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

// Reusable Button with Tooltip
const ButtonWithTooltip = ({ label, icon, onClick }: {
  label: string
  icon: React.ReactNode
  onClick: () => void
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline" onClick={onClick}>
        {icon}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);