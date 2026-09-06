import { Input } from '@mantine/core'
import { RichTextEditor } from '@mantine/tiptap'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useTranslation } from 'react-i18next'
import { Markdown, type MarkdownStorage } from 'tiptap-markdown'

/**
 * The announcement body (mockup 18b): a WYSIWYG with exactly five controls,
 * whose value is a Markdown subset. The API renders it for the portal and
 * the email and takes the first paragraph for alerts and WhatsApp, so no
 * headings, images or colors are offered; they would have nowhere to go.
 */
export function AnnouncementEditor({
  error,
  hint,
  label,
  onChange,
  value,
}: {
  error?: string
  hint: string
  label: string
  onChange: (markdown: string) => void
  value: string
}) {
  const { t } = useTranslation('common')
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: { openOnClick: false, autolink: true },
      }),
      Markdown.configure({ html: false, linkify: false, tightLists: true }),
    ],
    content: value,
    onUpdate: ({ editor: current }) => onChange((current.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown()),
  })

  return (
    <Input.Wrapper description={hint} error={error} label={label}>
      <RichTextEditor
        editor={editor}
        labels={{
          boldControlLabel: t('announcements.editor.bold'),
          italicControlLabel: t('announcements.editor.italic'),
          bulletListControlLabel: t('announcements.editor.bulletList'),
          orderedListControlLabel: t('announcements.editor.orderedList'),
          linkControlLabel: t('announcements.editor.link'),
          unlinkControlLabel: t('announcements.editor.unlink'),
          linkEditorInputLabel: t('announcements.editor.linkUrl'),
          linkEditorInputPlaceholder: 'https://',
          linkEditorSave: t('actions.save'),
        }}
        mt={6}
        // Mantine paints the editor with the page background; it follows the
        // app's field token like every other input instead.
        styles={{
          root: { backgroundColor: 'var(--wa-field)' },
          toolbar: { backgroundColor: 'var(--wa-field)' },
          content: { backgroundColor: 'var(--wa-field)' },
        }}
      >
        <RichTextEditor.Toolbar>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.BulletList />
            <RichTextEditor.OrderedList />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Link />
            <RichTextEditor.Unlink />
          </RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>
        <RichTextEditor.Content className="min-h-44 text-sm" />
      </RichTextEditor>
    </Input.Wrapper>
  )
}
