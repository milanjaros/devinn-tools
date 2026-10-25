import { useId } from 'react';
import { TextInput, type TextInputProps } from '@mantine/core';

// Native suggestions preserve free text and the inline editor's blur/Enter behavior.
export function DepartmentInput({ suggestions, ...props }: TextInputProps & { suggestions: string[] }) {
  const listId = useId();
  return <><TextInput {...props} list={listId} autoComplete="off" />
    <datalist id={listId}>{suggestions.map(name => <option key={name} value={name} />)}</datalist>
  </>;
}
