/* Suggestions d'aliments à valider (👍/👎) + plan de repas 7 jours VARIÉ, basé sur tes goûts.
   Cible : ~2200 kcal / ~180g protéines / ~200g glucides / ~72g lipides. Évite ce que tu n'aimes pas.
   ⚠️ Riz et pâtes indiqués en POIDS CRU (peser avant cuisson). */

const SUGGESTIONS = [
  { nom: "Cottage cheese", categorie: "Protéines maigres", pourquoi: "Fromage frais granuleux ultra protéiné, top en collation ou au petit-déj.", kcal: 98, proteines: 11, glucides: 3.4, lipides: 4.3 },
  { nom: "Saumon fumé", categorie: "Protéines maigres", pourquoi: "Les oméga-3 du saumon en version pratique, riche en protéines.", kcal: 180, proteines: 25, glucides: 0, lipides: 9 },
  { nom: "Maquereau", categorie: "Protéines maigres", pourquoi: "Poisson gras bon marché, riche en oméga-3 et en protéines.", kcal: 205, proteines: 19, glucides: 0, lipides: 14 },
  { nom: "Feta", categorie: "Produits laitiers", pourquoi: "Fromage savoureux et moins gras que les pâtes dures, relève salades et wraps.", kcal: 264, proteines: 14, glucides: 4, lipides: 21 },
  { nom: "Protéine en poudre (whey)", categorie: "Snacks protéinés", pourquoi: "Shaker rapide post-training pour atteindre facilement tes 180g de protéines.", kcal: 380, proteines: 80, glucides: 8, lipides: 6 },
  { nom: "Edamame", categorie: "Légumes/protéines", pourquoi: "Fèves de soja riches en protéines et fibres, parfaites à grignoter.", kcal: 121, proteines: 12, glucides: 9, lipides: 5 },
];

/* Ton petit-déj par défaut (tous les jours) */
const PDJ = {
  moment: "Petit-déj",
  nom: "Mon omelette 3 œufs, pain complet, skyr & banane",
  ingredients: [
    { aliment: "œufs", grammes: 150 },
    { aliment: "champignons", grammes: 50 },
    { aliment: "poivron", grammes: 30 },
    { aliment: "oignon rouge", grammes: 20 },
    { aliment: "pain complet", grammes: 40 },
    { aliment: "skyr", grammes: 150 },
    { aliment: "banane", grammes: 120 },
  ],
  kcal: 540, proteines: 43, glucides: 53, lipides: 16,
  preparation: "Bats les 3 œufs, cuis l'omelette avec champignons, poivron et oignon rouge. Sers avec 1 tranche de pain complet grillé, un skyr et une banane.",
};

/* Repas rapides — loggables en 1 clic depuis l'accueil */
const QUICK_MEALS = [
  { nom: "Mon petit-déj (omelette 3 œufs, pain, skyr, banane)", slot: "Petit-déj", kcal: 540, proteines: 43, glucides: 53, lipides: 16 },
];

const MEAL_PLAN = {
  days: [
    { jour: "Lundi · Street workout", repas: [
      PDJ,
      { moment: "Déjeuner", nom: "Poulet, riz & brocoli à l'huile d'olive", ingredients: [{ aliment: "poulet", grammes: 210 }, { aliment: "riz (cru)", grammes: 85 }, { aliment: "brocoli", grammes: 150 }, { aliment: "huile d'olive", grammes: 10 }], kcal: 670, proteines: 59, glucides: 72, lipides: 16, preparation: "Saisir le poulet à la poêle, cuire le riz et le brocoli à la vapeur. Assaisonner d'un filet d'huile d'olive." },
      { moment: "Collation", nom: "Fromage blanc, banane & beurre de cacahuète", ingredients: [{ aliment: "fromage blanc 0%", grammes: 250 }, { aliment: "banane", grammes: 110 }, { aliment: "beurre de cacahuète", grammes: 20 }], kcal: 332, proteines: 26, glucides: 37, lipides: 11, preparation: "Mélanger le fromage blanc avec la banane écrasée et une cuillère de beurre de cacahuète." },
      { moment: "Dîner", nom: "Cabillaud, patate douce, épinards & avocat", ingredients: [{ aliment: "cabillaud", grammes: 210 }, { aliment: "patate douce", grammes: 200 }, { aliment: "épinards", grammes: 100 }, { aliment: "avocat", grammes: 90 }, { aliment: "huile d'olive", grammes: 8 }], kcal: 587, proteines: 46, glucides: 44, lipides: 24, preparation: "Cuire le cabillaud au four, rôtir la patate douce en dés. Faire tomber les épinards et ajouter l'avocat en lamelles." },
    ], totaux: { kcal: 2129, proteines: 174, glucides: 206, lipides: 67 } },

    { jour: "Mardi · Course à pied", repas: [
      PDJ,
      { moment: "Déjeuner", nom: "Dinde, pâtes & poivron", ingredients: [{ aliment: "escalope de dinde", grammes: 180 }, { aliment: "pâtes (crues)", grammes: 95 }, { aliment: "poivron", grammes: 100 }, { aliment: "oignon", grammes: 40 }, { aliment: "huile d'olive", grammes: 8 }], kcal: 649, proteines: 56, glucides: 77, lipides: 12, preparation: "Poêler l'escalope de dinde en lanières avec poivron et oignon. Cuire les pâtes al dente et mélanger le tout." },
      { moment: "Collation", nom: "Skyr, ananas & amandes", ingredients: [{ aliment: "skyr", grammes: 250 }, { aliment: "ananas", grammes: 120 }, { aliment: "amandes", grammes: 18 }], kcal: 314, proteines: 32, glucides: 28, lipides: 10, preparation: "Mélanger le skyr avec l'ananas en morceaux et parsemer d'amandes." },
      { moment: "Dîner", nom: "Steak de bœuf, pommes de terre, salade & avocat", ingredients: [{ aliment: "steak de bœuf", grammes: 170 }, { aliment: "pommes de terre", grammes: 210 }, { aliment: "concombre", grammes: 100 }, { aliment: "tomates cerises", grammes: 80 }, { aliment: "avocat", grammes: 60 }, { aliment: "huile d'olive", grammes: 8 }], kcal: 622, proteines: 51, glucides: 42, lipides: 26, preparation: "Griller le steak selon la cuisson voulue, cuire les pommes de terre vapeur. Accompagner d'une salade concombre-tomates-avocat à l'huile d'olive." },
    ], totaux: { kcal: 2125, proteines: 182, glucides: 200, lipides: 64 } },

    { jour: "Mercredi · Street workout", repas: [
      PDJ,
      { moment: "Déjeuner", nom: "Saumon, riz & brocoli", ingredients: [{ aliment: "saumon", grammes: 160 }, { aliment: "riz (cru)", grammes: 90 }, { aliment: "brocoli", grammes: 150 }, { aliment: "oignon", grammes: 30 }], kcal: 698, proteines: 43, glucides: 79, lipides: 22, preparation: "Cuire le saumon à la poêle côté peau, faire revenir l'oignon. Servir avec le riz et le brocoli vapeur." },
      { moment: "Collation", nom: "Yaourt grec, fraises & noix", ingredients: [{ aliment: "yaourt grec", grammes: 250 }, { aliment: "fraises", grammes: 120 }, { aliment: "noix", grammes: 8 }], kcal: 333, proteines: 25, glucides: 18, lipides: 18, preparation: "Napper le yaourt grec de fraises coupées et de cerneaux de noix." },
      { moment: "Dîner", nom: "Poulet, pâtes & champignons", ingredients: [{ aliment: "poulet", grammes: 205 }, { aliment: "pâtes (crues)", grammes: 90 }, { aliment: "champignons", grammes: 120 }, { aliment: "tomates cerises", grammes: 80 }, { aliment: "huile d'olive", grammes: 4 }], kcal: 628, proteines: 62, glucides: 68, lipides: 10, preparation: "Poêler le poulet et les champignons, ajouter les tomates cerises. Mélanger aux pâtes avec un filet d'huile d'olive." },
    ], totaux: { kcal: 2199, proteines: 173, glucides: 218, lipides: 66 } },

    { jour: "Jeudi · Course à pied", repas: [
      PDJ,
      { moment: "Déjeuner", nom: "Bœuf haché, riz & poivron", ingredients: [{ aliment: "bœuf haché 5%", grammes: 215 }, { aliment: "riz (cru)", grammes: 80 }, { aliment: "poivron", grammes: 100 }, { aliment: "oignon", grammes: 40 }, { aliment: "huile d'olive", grammes: 8 }], kcal: 678, proteines: 52, glucides: 71, lipides: 20, preparation: "Faire revenir le bœuf haché avec oignon et poivron. Servir sur un lit de riz cuit." },
      { moment: "Collation", nom: "Skyr, myrtilles & amandes", ingredients: [{ aliment: "skyr", grammes: 250 }, { aliment: "myrtilles", grammes: 100 }, { aliment: "amandes", grammes: 18 }], kcal: 311, proteines: 32, glucides: 26, lipides: 10, preparation: "Mélanger le skyr et les myrtilles, parsemer d'amandes concassées." },
      { moment: "Dîner", nom: "Crevettes, patate douce, épinards & avocat", ingredients: [{ aliment: "crevettes", grammes: 215 }, { aliment: "patate douce", grammes: 190 }, { aliment: "épinards", grammes: 100 }, { aliment: "avocat", grammes: 80 }, { aliment: "huile d'olive", grammes: 7 }], kcal: 578, proteines: 50, glucides: 41, lipides: 22, preparation: "Poêler les crevettes à l'ail, rôtir la patate douce. Servir avec les épinards fondus et l'avocat." },
    ], totaux: { kcal: 2107, proteines: 177, glucides: 191, lipides: 68 } },

    { jour: "Vendredi · Street workout", repas: [
      PDJ,
      { moment: "Déjeuner", nom: "Thon, pâtes & tomates cerises", ingredients: [{ aliment: "thon au naturel", grammes: 160 }, { aliment: "pâtes (crues)", grammes: 75 }, { aliment: "tomates cerises", grammes: 120 }, { aliment: "oignon", grammes: 30 }, { aliment: "huile d'olive", grammes: 9 }], kcal: 563, proteines: 52, glucides: 60, lipides: 12, preparation: "Cuire les pâtes, mélanger le thon égoutté, les tomates cerises et l'oignon. Assaisonner d'huile d'olive." },
      { moment: "Collation", nom: "Fromage blanc, pomme & noix", ingredients: [{ aliment: "fromage blanc 0%", grammes: 250 }, { aliment: "pomme", grammes: 130 }, { aliment: "noix", grammes: 18 }], kcal: 297, proteines: 23, glucides: 31, lipides: 12, preparation: "Servir le fromage blanc avec la pomme en dés et quelques cerneaux de noix." },
      { moment: "Dîner", nom: "Poulet, riz, brocoli & avocat", ingredients: [{ aliment: "poulet", grammes: 190 }, { aliment: "riz (cru)", grammes: 75 }, { aliment: "brocoli", grammes: 150 }, { aliment: "avocat", grammes: 80 }, { aliment: "huile d'olive", grammes: 8 }], kcal: 722, proteines: 55, glucides: 67, lipides: 25, preparation: "Griller le poulet, cuire le riz et le brocoli vapeur. Ajouter l'avocat en lamelles et un filet d'huile d'olive." },
    ], totaux: { kcal: 2122, proteines: 173, glucides: 211, lipides: 65 } },

    { jour: "Samedi · Course à pied", repas: [
      PDJ,
      { moment: "Déjeuner", nom: "Dinde hachée, riz & poivron", ingredients: [{ aliment: "dinde hachée", grammes: 205 }, { aliment: "riz (cru)", grammes: 95 }, { aliment: "poivron", grammes: 100 }, { aliment: "oignon", grammes: 40 }, { aliment: "huile d'olive", grammes: 4 }], kcal: 722, proteines: 49, glucides: 82, lipides: 22, preparation: "Faire revenir la dinde hachée avec oignon et poivron. Mélanger au riz cuit." },
      { moment: "Collation", nom: "Yaourt grec, kiwi & amandes", ingredients: [{ aliment: "yaourt grec", grammes: 250 }, { aliment: "kiwi", grammes: 120 }, { aliment: "amandes", grammes: 12 }], kcal: 384, proteines: 26, glucides: 27, lipides: 19, preparation: "Mélanger le yaourt grec avec le kiwi coupé et parsemer d'amandes." },
      { moment: "Dîner", nom: "Cabillaud, pommes de terre & brocoli", ingredients: [{ aliment: "cabillaud", grammes: 230 }, { aliment: "pommes de terre", grammes: 240 }, { aliment: "brocoli", grammes: 150 }, { aliment: "huile d'olive", grammes: 6 }], kcal: 481, proteines: 51, glucides: 47, lipides: 9, preparation: "Cuire le cabillaud au four avec un filet d'huile d'olive. Servir avec pommes de terre vapeur et brocoli." },
    ], totaux: { kcal: 2127, proteines: 169, glucides: 209, lipides: 66 } },

    { jour: "Dimanche · Repos", repas: [
      PDJ,
      { moment: "Déjeuner", nom: "Saumon, patate douce & épinards", ingredients: [{ aliment: "saumon", grammes: 165 }, { aliment: "patate douce", grammes: 240 }, { aliment: "épinards", grammes: 120 }, { aliment: "huile d'olive", grammes: 4 }], kcal: 610, proteines: 40, glucides: 49, lipides: 26, preparation: "Poêler le saumon, rôtir la patate douce. Faire tomber les épinards à l'huile d'olive." },
      { moment: "Collation", nom: "Skyr, banane, fraises & chocolat noir", ingredients: [{ aliment: "skyr", grammes: 270 }, { aliment: "banane", grammes: 110 }, { aliment: "fraises", grammes: 100 }, { aliment: "chocolat noir 70%", grammes: 12 }, { aliment: "amandes", grammes: 8 }], kcal: 405, proteines: 34, glucides: 45, lipides: 10, preparation: "Mélanger le skyr avec la banane et les fraises, râper un peu de chocolat noir et ajouter quelques amandes." },
      { moment: "Dîner", nom: "Steak de bœuf, pommes de terre & salade au comté", ingredients: [{ aliment: "steak de bœuf", grammes: 180 }, { aliment: "pommes de terre", grammes: 210 }, { aliment: "concombre", grammes: 100 }, { aliment: "tomates cerises", grammes: 80 }, { aliment: "comté", grammes: 12 }, { aliment: "huile d'olive", grammes: 5 }], kcal: 563, proteines: 56, glucides: 40, lipides: 19, preparation: "Griller le steak, cuire les pommes de terre vapeur. Accompagner d'une salade avec quelques copeaux de comté." },
    ], totaux: { kcal: 2118, proteines: 173, glucides: 187, lipides: 71 } },
  ],
  notes: "Petit-déj identique tous les jours (ton omelette). Pèse le riz et les pâtes crus et ajuste les féculents de ±15 g selon ta faim. Bois au moins 2 L d'eau/jour et concentre les glucides autour des entraînements. Base d'équilibrage, ne remplace pas l'avis d'un diététicien.",
};
