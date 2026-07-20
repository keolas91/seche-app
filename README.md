# 🔥 Sèche — Suivi repas & entraînements

Application web **100 % locale** pour suivre ta sèche : repas (avec analyse photo par IA), macros,
plan de la semaine, entraînements, score de progression et courbe de poids.
Tes données restent sur **ton appareil** (localStorage) — rien n'est envoyé sur un serveur,
sauf la photo d'un repas si tu actives l'analyse IA (voir plus bas).

---

## ▶️ Lancer l'application

Ouvre un terminal dans ce dossier et lance un mini serveur local :

```bash
cd ~/Desktop/Food
python3 -m http.server 5173
```

Puis va sur **http://localhost:5173** dans ton navigateur.

> Pourquoi un serveur et pas un double-clic sur `index.html` ? Certains navigateurs bloquent
> `localStorage` et les requêtes réseau depuis un fichier `file://`. Le serveur local évite ça.
> (Alternative si tu as Node : `npx serve -l 5173`.)

Au premier lancement, tu renseignes ton profil (taille, poids, âge, objectif, intensité de sèche)
et l'app calcule automatiquement tes objectifs (méthode **Mifflin-St Jeor**).

---

## 📸 Activer l'analyse de repas par photo (optionnel)

Par défaut, tu saisis tes repas à la main (ou en piochant dans la base de 70 aliments).
Pour que **Claude estime automatiquement les calories et macros depuis une photo** :

1. Récupère une clé API sur https://console.anthropic.com (facturation à l'usage).
2. Dans l'app → onglet **Réglages** → colle ta clé et choisis le modèle.
3. L'analyse photo est débloquée dans « Ajouter un repas ».

**Modèle conseillé : Haiku 4.5** (largement suffisant pour lire une assiette, ~5× moins cher).

| Modèle | Coût / photo | ~90 photos/mois (3/jour) |
|---|---|---|
| Haiku 4.5 | ~0,003 € | **~0,26 €/mois** |
| Sonnet 5 | ~0,009 € | ~0,79 €/mois |
| Opus 4.8 | ~0,015 € | ~1,32 €/mois |

> 🔒 En local, ta clé est stockée sur ton appareil. Dans un navigateur elle reste visible côté
> client : c'est OK pour un usage perso. Pour une **mise en ligne publique**, ne mets jamais ta clé
> dans le code — passe par un petit serveur relais (proxy) qui garde la clé côté serveur.

---

## ⌚ Apple Santé / BeReal

Une app **web** locale **ne peut pas** se connecter automatiquement à :
- **Apple Santé** : les données vivent sur l'iPhone et ne sont accessibles qu'à une **app iOS**
  (via HealthKit). Contournement possible plus tard : exporter Santé en fichier `.xml` et l'importer.
- **BeReal** : aucune API publique.

👉 Tes séances se notent donc **à la main** dans l'onglet **Sport** (durée, distance, notes).
Le planning est déjà pré-réglé : **Lun/Mer/Ven = street workout**, **Mar/Jeu/Sam = course**, **Dim = repos**.

---

## 🌍 Mettre l'app en ligne — combien ça coûte ?

Comme c'est une app statique, l'**hébergement est gratuit** et le seul vrai coût est le nom de domaine.

| Poste | Coût |
|---|---|
| Hébergement (Cloudflare Pages / GitHub Pages / Netlify) | **0 €** (free tier, HTTPS inclus) |
| Nom de domaine `.com` (Cloudflare Registrar, prix coûtant) | **~9–10 €/an** |
| Nom de domaine `.fr` (OVH) | **~8 €/an** (souvent ~5 € la 1re année) |
| **Total réaliste** | **≈ 8–14 € / an** |

- **Sans domaine perso** : c'est carrément **0 €** (ex. `ton-app.pages.dev`).
- **VPS inutile** ici (4–9 €/mois) : réservé si un jour tu ajoutes un vrai backend.
- Si tu ajoutes l'analyse photo en ligne, prévois en plus le petit coût API (~0,26 €/mois avec Haiku).

**Le plus simple pour publier gratuitement :** pousse ce dossier sur un dépôt GitHub, puis connecte-le
à **Cloudflare Pages** (build : aucun, dossier racine). En ligne en ~2 minutes.

---

## 🗂️ Structure

```
Food/
├── index.html          Structure de l'app
├── styles.css          Thème sombre, responsive mobile
├── app.js              Toute la logique (profil, repas, IA, sport, score, poids)
└── data/
    ├── foods.js        Base de 70 aliments (kcal + macros /100g)
    └── mealplan.js     Plan 7 jours + suggestions d'aliments
```

Tout est modifiable : ajoute des aliments, ajuste le plan, change les objectifs dans Réglages.

## 💾 Sauvegarde

Onglet **Réglages → Exporter (JSON)** pour sauvegarder tes données, **Importer** pour les restaurer
(utile si tu changes de navigateur ou vides le cache).
