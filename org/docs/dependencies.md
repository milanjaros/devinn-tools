# Kompatibilita a licence

Kontrola primárních zdrojů: 22. 10. 2026. Projekt záměrně používá kompatibilní řady, nikoliv neověřený upgrade na novou hlavní verzi. Skutečná instalace a vytvoření lockfile zůstávají blokované síťovou politikou pracovního prostředí. Tento dokument tedy není tvrzením, že build již prošel.

| Knihovna | Zvolená řada | Licence | Zdroj / poznámka |
|---|---|---|---|
| React + React DOM | 19 | MIT | https://github.com/facebook/react/blob/main/LICENSE |
| Mantine core/hooks/form/notifications | 8.3 | MIT | https://raw.githubusercontent.com/mantinedev/mantine/8.3.0/packages/@mantine/core/package.json – peer React a React DOM `^18.x || ^19.x`; všechny balíčky Mantine musejí být na shodné verzi |
| React Flow `@xyflow/react` | 12 | MIT | https://reactflow.dev/learn ; https://reactflow.dev/index |
| `@dagrejs/dagre` | 1.1 | MIT | https://raw.githubusercontent.com/dagrejs/dagre/v1.1.5/package.json – obsahuje vlastní TypeScript deklarace |
| Tabler icons React | 3 | MIT | https://github.com/tabler/tabler-icons/blob/main/LICENSE |
| idb | 8 | ISC | https://raw.githubusercontent.com/jakearchibald/idb/main/package.json |
| Zod | 4.1 | MIT | https://github.com/colinhacks/zod/blob/main/packages/zod/package.json |
| Vite + React plugin | 7 / 5 | MIT | https://github.com/vitejs/vite/blob/main/LICENSE |
| TypeScript | 5.9 | Apache-2.0 | https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt |
| Vitest | 3.2 | MIT | https://github.com/vitest-dev/vitest/blob/main/LICENSE |
| React Testing Library + jest-dom | 16 / 6 | MIT | https://github.com/testing-library/react-testing-library/blob/main/LICENSE ; https://github.com/testing-library/jest-dom/blob/main/LICENSE |
| Playwright | 1.55 | Apache-2.0 | https://github.com/microsoft/playwright/blob/main/LICENSE |
| fake-indexeddb | 6 | Apache-2.0 | https://github.com/dumbmatter/fakeIndexedDB/blob/master/LICENSE |
| jsdom | 26 | MIT | https://github.com/jsdom/jsdom/blob/main/LICENSE.txt |

API: React Flow 12 používá importy z `@xyflow/react`, vlastní typ uzlu `Node<Data, 'org'>`, `ReactFlowProvider`, řízené uzly a samostatné CSS. Dagre se používá pouze k výpočtu souřadnic. Mantine formulář validuje přes Zod `safeParse` bez dalšího resolver balíčku; JSON validace používá Zod 4 včetně `z.record(key,value)` a ISO časů. IndexedDB používá `idb` 8 s explicitním `tx.done`.

Vite 7 vyžaduje Node 20.19+ nebo 22.12+; doporučené vývojové prostředí je Node 24, který také spustí nezávislé smoke testy TypeScript domény. Oficiální průvodce Mantine pro Vite: https://mantine.dev/guides/vite/ . Rozložení React Flow: https://reactflow.dev/learn/layouting/layouting .

Po zpřístupnění npm spusťte `npm install`, `npm run licenses`, `npm run build`, `npm test` a `npm run test:e2e`. Skript `licenses` čte metadata skutečně nainstalovaných přímých závislostí a zapíše verze, licence, peer požadavky a engines do `docs/installed-dependencies.json`. Přibalené licence závislostí zachovejte při další distribuci.
