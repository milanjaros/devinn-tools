import { useEffect, useRef, useState } from 'react';
import { Avatar, Button, FileInput, Group, Stack, TagsInput, Text, Textarea, TextInput } from '@mantine/core';
import { IconEdit, IconUsers } from '@tabler/icons-react';
import { avatar } from '../data/demo';
import { DepartmentInput } from './DepartmentInput';

export function InlineField({ value, label, onSave, required = false, multiline = false, className = '', suggestions }: {
  value: string; label: string; onSave: (value: string) => void; required?: boolean; multiline?: boolean; className?: string; suggestions?: string[];
}) {
  const [draft, setDraft] = useState(value), [error, setError] = useState('');
  const cancelled = useRef(false);
  useEffect(() => { setDraft(value); setError(''); }, [value]);
  const props = {
    'aria-label': label,
    value: draft,
    placeholder: label,
    error: error || undefined,
    className: `inline-field ${className}`,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setDraft(event.currentTarget.value); setError(''); },
    onBlur: () => {
      if (cancelled.current) { cancelled.current = false; return; }
      const next = draft.trim();
      if (required && !next) { setError('Toto pole nesmí být prázdné.'); return; }
      setDraft(next);
      if (next !== value) onSave(next);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault(); cancelled.current = true; setDraft(value); setError(''); event.currentTarget.blur();
      } else if (event.key === 'Enter' && (!multiline || event.ctrlKey || event.metaKey)) {
        event.preventDefault(); event.currentTarget.blur();
      }
    },
  };
  return multiline ? <Textarea {...props} autosize minRows={2} /> : suggestions ? <DepartmentInput {...props} suggestions={suggestions} /> : <TextInput {...props} />;
}

export function InlineTags({ names, catalog, onSave }: { names: string[]; catalog: string[]; onSave: (names: string[]) => void }) {
  return <TagsInput className="inline-tags" aria-label="Štítky zaměstnance nebo pozice" data={catalog} value={names}
    onChange={onSave} placeholder="Přidat štítek…" clearable acceptValueOnBlur
    description="Vyberte štítek nebo napište nový a stiskněte Enter." />;
}

export function ProfilePhoto({ name, photo, editing, onSave, index }: { name: string; photo: string | null; editing: boolean; onSave: (photo: string | null) => void; index: number }) {
  const [opened, setOpened] = useState(false), [draft, setDraft] = useState(photo || ''), [error, setError] = useState(''), [reading, setReading] = useState(false);
  const reader = useRef<FileReader | null>(null);
  useEffect(() => () => reader.current?.abort(), []);
  useEffect(() => { if (!editing) { setOpened(false); reader.current?.abort(); } }, [editing]);
  const valid = (value: string) => !value || /^https?:\/\//i.test(value) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value);
  return <>
    <button type="button" className={`profile-photo ${editing ? 'profile-photo-editable' : ''}`} disabled={!editing}
      aria-label={editing ? 'Upravit fotografii' : 'Fotografie zaměstnance'}
      onClick={() => { setDraft(photo || ''); setError(''); setOpened(v => !v); }}>
      <Avatar size={76} radius="xl" src={photo || avatar(name, index)}><IconUsers /></Avatar>
      {editing && <span className="profile-photo-pencil"><IconEdit size={14} /></span>}
    </button>
    {opened && editing && <Stack gap="xs" className="photo-inline-editor">
      <Avatar mx="auto" size={64} radius="xl" src={draft && valid(draft) ? draft : avatar(name, index)} />
      <FileInput label="Lokální fotografie" accept="image/png,image/jpeg,image/webp,image/gif" disabled={reading} onChange={file => {
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { setError('Fotografie smí mít nejvýše 3 MB.'); return; }
        if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { setError('Vyberte PNG, JPEG, WebP nebo GIF.'); return; }
        reader.current?.abort(); const next = new FileReader(); reader.current = next; setReading(true); setError('');
        next.onload = () => { setDraft(String(next.result)); setReading(false); };
        next.onerror = () => { setError('Obrázek nelze načíst.'); setReading(false); };
        next.onabort = () => setReading(false);
        next.readAsDataURL(file);
      }} />
      <TextInput label="URL fotografie" placeholder="https://…" value={draft.startsWith('data:') ? '' : draft} disabled={reading}
        onChange={event => { const value = event.currentTarget.value; setDraft(value); setError(valid(value) ? '' : 'Zadejte platnou HTTP(S) adresu.'); }} />
      {error && <Text size="xs" c="red" role="alert">{error}</Text>}
      <Group gap="xs" justify="space-between">
        <Button size="xs" variant="subtle" color="gray" disabled={reading} onClick={() => { setDraft(''); setError(''); }}>Odebrat fotku</Button>
        <Button size="xs" variant="default" onClick={() => { reader.current?.abort(); setOpened(false); }}>Zrušit</Button>
        <Button size="xs" disabled={reading || !!error || !valid(draft)} onClick={() => { onSave(draft || null); setOpened(false); }}>Uložit fotku</Button>
      </Group>
      <Text size="xs" c="dimmed">Lokální obrázek se uloží do prohlížeče.</Text>
    </Stack>}
  </>;
}
