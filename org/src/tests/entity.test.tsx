import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import { EntityEditor } from '../components/Editors';
import { demoDataset } from '../data/demo';
const change=vi.fn();
vi.mock('../app/store',()=>({useStore:()=>{const data=demoDataset();return {data,scenario:{...data.scenarios[0],protected:false},change};}}));
describe('Formulář zaměstnance',()=>{it('ověří povinné údaje a nepustí prázdný formulář',async()=>{render(<MantineProvider><EntityEditor kind="person" onClose={()=>{}}/></MantineProvider>);fireEvent.submit(screen.getByRole('button',{name:'Uložit'}).closest('form')!);await waitFor(()=>expect(screen.getByText('Vyplňte jméno.')).toBeInTheDocument());expect(change).not.toHaveBeenCalled();});});
