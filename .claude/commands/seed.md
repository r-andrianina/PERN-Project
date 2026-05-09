# /seed — Peupler la base de données

Exécute le seed qui crée le compte admin + tous les référentiels du Dictionnaire.

## Instructions

Vérifie d'abord que le container Docker tourne :
```bash
! docker ps --filter "publish=5435" --format "{{.Names}} {{.Status}}"
```

Puis lance le seed :
```bash
! cd backend && npm run seed
```

## Ce qui est créé

- **Compte admin** : `andrianinar@pasteur.mg` / `Admin1234!`
- **Taxonomie spécimens** : Culicidae (Anopheles, Aedes, Culex, Mansonia), Ixodidae (Amblyomma, Rhipicephalus), Pulicidae (Xenopsylla, Pulex, Ctenocephalides)
- **Taxonomie hôtes** : Rattus, Pteropus, Bos, Tenrec, Canis…
- **9 types de méthode** : CDC-LT, BG-SENT, HLC, DRAGGING, etc.
- **6 solutions de conservation** : Ethanol 70/95%, RNAlater, Azote liquide…
- **7 environnements** + **9 habitats**

> Idempotent — peut être relancé sans risque si la base n'est pas vide (upsert).
