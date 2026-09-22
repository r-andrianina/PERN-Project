// Contexte du flux SSE partagé, isolé du composant qui le fournit.
//
// Séparé de sse.jsx pour la seule raison qu'un module exportant à la fois un
// composant et autre chose casse le rafraîchissement à chaud de Vite
// (react-refresh/only-export-components). Le fournisseur vit dans sse.jsx, les
// abonnements dans sseHooks.js, et les deux se rejoignent ici.

import { createContext } from 'react';

// `EventSource` exige un écouteur par nom d'événement : la liste doit donc
// être explicite. Elle correspond aux émissions du serveur — `init` est écrit
// par notifications.controller.js à l'ouverture du flux, les quatre autres
// passent par sseManager.broadcast()/sendToUser().
export const EVENEMENTS = ['init', 'new_activity', 'presence_update', 'permissions_changed', 'account_updated'];

export const SseContext = createContext(null);
