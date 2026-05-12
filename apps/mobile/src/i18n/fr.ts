export const fr = {
  account: {
    title: "Compte",
    identity: "Identité",
    noName: "Nom non renseigné",
    linkedAccount: "Compte lié à ton authentification.",
    activeProfile: "Profil actif",
    profileHint:
      "Pour changer de rôle, utilise le sélecteur sur l’écran « Mes fermes » ou l’équivalent sur ton tableau de bord.",
    noProfile: "Aucun profil sélectionné.",
    language: "Langue",
    localeHints: {
      fr: "Interface et textes d’aide en français",
      en: "Interface in English"
    },
    languagePersistHint:
      "La langue est enregistrée sur l’appareil et appliquée aux écrans traduits.",
    help: "Aide et informations",
    refresh: "Rafraîchir mes données",
    signOut: "Se déconnecter",
    helpTitle: "Aide Fermier Pro",
    helpBody:
      "Documentation terrain, FAQ et contact support : contenu à intégrer selon ton offre.",
    profileTypes: {
      producer: "Producteur",
      technician: "Technicien",
      veterinarian: "Vétérinaire",
      buyer: "Acheteur"
    }
  },
  shell: {
    tabs: {
      home: "Accueil",
      lots: "Lots",
      events: "Événements",
      profile: "Profil"
    }
  },
  producer: {
    welcomeLine: "Bienvenue",
    profileTitle: "Mon profil",
    close: "Fermer",
    identitySection: "Identité & exploitation",
    photoHint: "Photo (galerie ou caméra)",
    pickGallery: "Galerie",
    pickCamera: "Caméra",
    firstName: "Prénom",
    lastName: "Nom",
    farmName: "Nom de la ferme (accueil)",
    farmNameHint: "Affiché en tête si renseigné ; sinon la première ferme créée.",
    locationSection: "Localisation",
    locationPlaceholder: "Adresse ou lieu (saisie manuelle)",
    useGps: "Utiliser ma position",
    gpsSuccess: "Position GPS enregistrée (modifiable ci-dessus).",
    gpsDenied: "La géolocalisation a été refusée ou est indisponible.",
    save: "Enregistrer",
    saving: "Enregistrement…",
    settingsSection: "Paramètres du compte",
    demoNoSave: "En mode démo, la sauvegarde profil API est désactivée.",
    saveError: "Impossible d’enregistrer. Vérifie la connexion.",
    photoUploadError: "Échec envoi photo (bucket Supabase « avatars » requis)."
  }
} as const;
