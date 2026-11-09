// Words for the standalone app's own screens (the room screens use the module's copy).
// Brand voice: first person singular, "I" / "jag".
// English and Swedish; the phone's language decides unless the person picks one (lang.ts).
// The footer lines are the shared Ellenial ones, word for word the same as ellenial maps.

const en = {
  appName: 'Split',
  appNameLong: 'Split, by Ellenial',
  description: 'Split shared costs with friends. No sign-up, no ads, end-to-end encrypted.',
  common: {
    back: 'Back',
    loading: 'Loading',
  },
  home: {
    title: 'Split costs with friends',
    lead: 'Who paid what, and the fewest transfers to settle up. No sign-up, nothing to install.',
    start: 'Start a room',
    yourRooms: 'Your rooms on this phone',
    paste: 'Got a link? Paste it here',
    pastePlaceholder: 'Paste the room link',
    open: 'Open',
    badLink: 'That doesn’t look like a whole room link. Chat apps sometimes cut off the end: try copying the full message.',
    promises: ['Free, no ads, no tracking', 'Locked on your phone: I can’t read your room', 'Rooms tidy themselves away'],
  },
  create: {
    title: 'Start a room',
    roomName: 'What’s it for?',
    roomPlaceholder: 'e.g. Göteborg weekend',
    myName: 'Your nickname',
    myNamePlaceholder: 'e.g. Alex',
    create: 'Create room',
    errors: {
      name: 'Give the room a name',
      myName: 'Add your nickname',
      generic: 'Couldn’t create the room. Check your connection and try again.',
      rate: 'That’s a lot of new rooms from here. Try again in a little while.',
    },
  },
  theme: {
    label: 'Theme',
    auto: 'Auto',
    light: 'Light',
    dark: 'Dark',
    autoHint: 'Follows your phone',
  },
  language: 'Language',
  footer: {
    drawn: 'Drawn',
    made: ' and designed by me, coded with the help of AI.',
    promise: 'Free · no ads · no trackers',
    counter: 'In this app: a simple visit counter',
    by: 'An Ellenial tool',
    source: 'Source',
    thanks: 'Thanks',
  },
}

export type AppCopy = typeof en

const sv: AppCopy = {
  appName: 'Split',
  appNameLong: 'Split, av Ellenial',
  description: 'Dela gemensamma kostnader med vänner. Ingen registrering, inga annonser, krypterat hela vägen.',
  common: {
    back: 'Tillbaka',
    loading: 'Laddar',
  },
  home: {
    title: 'Dela kostnader med vänner',
    lead: 'Vem som betalade vad, och så få överföringar som möjligt för att göra upp. Ingen registrering, inget att installera.',
    start: 'Starta ett rum',
    yourRooms: 'Dina rum på den här telefonen',
    paste: 'Har du en länk? Klistra in den här',
    pastePlaceholder: 'Klistra in rummets länk',
    open: 'Öppna',
    badLink: 'Det där ser inte ut som en hel rumslänk. Chattappar klipper ibland av slutet: prova att kopiera hela meddelandet.',
    promises: ['Gratis, inga annonser, ingen spårning', 'Låst på din telefon: jag kan inte läsa ditt rum', 'Rum städar bort sig själva'],
  },
  create: {
    title: 'Starta ett rum',
    roomName: 'Vad gäller det?',
    roomPlaceholder: 't.ex. Helg i Göteborg',
    myName: 'Ditt smeknamn',
    myNamePlaceholder: 't.ex. Alex',
    create: 'Skapa rum',
    errors: {
      name: 'Ge rummet ett namn',
      myName: 'Lägg till ditt smeknamn',
      generic: 'Kunde inte skapa rummet. Kolla uppkopplingen och försök igen.',
      rate: 'Det har skapats många nya rum härifrån. Försök igen om en stund.',
    },
  },
  theme: {
    label: 'Tema',
    auto: 'Auto',
    light: 'Ljust',
    dark: 'Mörkt',
    autoHint: 'Följer telefonen',
  },
  language: 'Språk',
  footer: {
    drawn: 'Ritat',
    made: ' och designat av mig, kodat med hjälp av AI.',
    promise: 'Gratis · inga annonser · inga trackers',
    counter: 'I den här appen: en enkel besöksräknare',
    by: 'Ett Ellenial-verktyg',
    source: 'GitHub',
    thanks: 'Tack',
  },
}

export const appCopies = { en, sv }

/** The current words. A live binding: App switches it, then re-renders. */
export let appCopy: AppCopy = en

export function setAppCopy(lang: keyof typeof appCopies) {
  appCopy = appCopies[lang]
}
