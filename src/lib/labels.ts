// German UI labels for stored enum values. They are translation keys: show them with t(lang, LABEL[x]).
import { tk } from "../i18n";

export const BOARD_KINDS: Record<string, string> = {
  garage: tk("Garage / Stellplatz"),
  tools: tk("Werkzeug"),
  help_offered: tk("Biete Hilfe"),
  help_wanted: tk("Suche Hilfe"),
};

export const LOAN_STATUS: Record<string, string> = {
  draft: tk("Entwurf"),
  active: tk("Verliehen"),
  returned: tk("Zurückgegeben"),
};

export const REQUEST_STATUS: Record<string, string> = {
  open: tk("Offen"),
  accepted: tk("Angenommen"),
  declined: tk("Abgelehnt"),
};
