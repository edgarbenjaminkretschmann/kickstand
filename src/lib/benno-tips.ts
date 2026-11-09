// Benno's tip on a listing, one per category. German keys, translated where shown: t(lang, bennoTip(slug)).
import { tk } from "../i18n";

const TIPS: Record<string, string> = {
  "motorrad-leihen": tk("Mach bei der Übergabe Fotos von jeder Seite. Sie landen direkt im Protokoll des Leihvertrags."),
  garage: tk("Schau dir den Platz vorher an und klärt Schlüssel, Zugang und Kündigung schriftlich im Chat."),
  werkzeug: tk("Mach ein Foto vom Werkzeug, bevor es rausgeht, und vereinbart im Chat, wann es zurückkommt."),
  teile: tk("Prüf die Teilenummer vor dem Kauf. Zahl am besten bei der Abholung, nicht im Voraus."),
  hilfe: tk("Klärt vorher, wer Werkzeug und Teile mitbringt, und schraubt nie allein unter einem aufgebockten Motorrad."),
  tour: tk("Trefft euch vor der Tour einmal kurz und sprecht Tempo, Strecke und Pausen ab."),
  sonstiges: tk("Bleib im Chat auf Kickstand und zahl nichts im Voraus."),
};

export function bennoTip(categorySlug: string): string {
  return TIPS[categorySlug] ?? TIPS.sonstiges;
}
