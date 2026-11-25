# PFM perso

Application de suivi de finances personnelles, 100 % côté navigateur.

- `index.html` : l'application publiée sur GitHub Pages (fichier généré, ne pas modifier à la main).
- `src/` : sources (`core.js` = logique métier, `ui.html` = interface). Regénérer avec `python3 src/build.py`.
- `extension-simple/` : extension Chrome qui exporte les opérations Attijarinet en JSON.

Les données restent dans le navigateur ; la synchronisation entre appareils passe par un fichier
chiffré (AES-256, phrase secrète) dans le dossier caché de l'application sur Google Drive.
Aucune donnée personnelle n'est stockée dans ce dépôt.
