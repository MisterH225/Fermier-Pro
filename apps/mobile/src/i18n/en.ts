export const en = {
  account: {
    title: "Account",
    identity: "Identity",
    noName: "Name not provided",
    linkedAccount: "Account linked to your sign-in.",
    activeProfile: "Active profile",
    profileHint:
      "To switch role, use the selector on the “My farms” screen or the equivalent on your dashboard.",
    noProfile: "No profile selected.",
    language: "Language",
    localeHints: {
      fr: "French interface and help texts",
      en: "English UI"
    },
    languagePersistHint:
      "The language is saved on this device and applied to translated screens.",
    help: "Help & information",
    refresh: "Refresh my data",
    signOut: "Sign out",
    helpTitle: "Fermier Pro help",
    helpBody:
      "Field documentation, FAQ and support contact: content to integrate according to your offer.",
    profileTypes: {
      producer: "Producer",
      technician: "Technician",
      veterinarian: "Veterinarian",
      buyer: "Buyer"
    }
  },
  shell: {
    tabs: {
      home: "Home",
      lots: "Lots",
      events: "Events",
      profile: "Profile"
    }
  },
  producer: {
    welcomeLine: "Welcome",
    profileTitle: "My profile",
    close: "Close",
    identitySection: "Identity & farm",
    photoHint: "Photo (gallery or camera)",
    pickGallery: "Gallery",
    pickCamera: "Camera",
    firstName: "First name",
    lastName: "Last name",
    farmName: "Farm name (home)",
    farmNameHint: "Shown at the top when set; otherwise your first created farm.",
    locationSection: "Location",
    locationPlaceholder: "Address or place (manual)",
    useGps: "Use my current position",
    gpsSuccess: "GPS position saved (you can edit the label above).",
    gpsDenied: "Location permission denied or unavailable.",
    save: "Save",
    saving: "Saving…",
    settingsSection: "Account settings",
    demoNoSave: "Demo mode: profile API save is disabled.",
    saveError: "Could not save. Check your connection.",
    photoUploadError: "Photo upload failed (Supabase “avatars” bucket required)."
  }
} as const;
