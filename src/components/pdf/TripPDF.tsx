"use client";

import {
  DAYS_OF_WEEK,
  MONTHS_SHORT,
  addDays,
  endOfWeekSunday,
  formatDateKey,
  parseDate,
  startOfWeekMonday,
} from "@/lib/date-helpers";
import {
  getParkIdFromSlotValue,
  getSlotTimeFromValue,
} from "@/lib/assignment-slots";
import { sanitizeDayNote } from "@/lib/ai-sanitize-notes";
import {
  crowdPdfSymbolForTone,
  heuristicCrowdToneFromNoteText,
} from "@/lib/planner-crowd-level-meta";
import { pdfDayConditionLine } from "@/lib/planner-day-conditions";
import type {
  Assignments,
  BudgetCategory,
  CustomTile,
  Park,
  SlotAssignmentValue,
  TemperatureUnit,
  Trip,
  TripBudgetItem,
  TripChecklistItem,
} from "@/lib/types";
import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

const COLOURS = {
  royal: "#0B1E5C",
  gold: "#C9A961",
  cream: "#FAF8F3",
  muted: "#888888",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontFamily: "Times-Roman",
    fontSize: 11,
    color: COLOURS.royal,
  },
  coverPage: {
    padding: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLOURS.cream,
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: COLOURS.royal,
    marginBottom: 12,
    textAlign: "center",
  },
  coverSubtitle: {
    fontSize: 16,
    color: COLOURS.gold,
    marginBottom: 32,
    textAlign: "center",
  },
  coverMeta: {
    fontSize: 12,
    color: COLOURS.muted,
    textAlign: "center",
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLOURS.royal,
    marginBottom: 14,
  },
  strategyBody: {
    fontSize: 11,
    lineHeight: 1.45,
    color: COLOURS.royal,
  },
  dayHeader: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLOURS.royal,
    marginBottom: 6,
    marginTop: 12,
    borderBottomWidth: 2,
    borderBottomColor: COLOURS.gold,
    paddingBottom: 4,
  },
  slot: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 8,
  },
  slotLabel: {
    width: 52,
    fontSize: 9,
    color: COLOURS.muted,
    textTransform: "uppercase",
  },
  slotValue: {
    flex: 1,
    fontSize: 11,
    color: COLOURS.royal,
  },
  dayNote: {
    fontSize: 8,
    color: COLOURS.muted,
    marginTop: 4,
    paddingLeft: 8,
    lineHeight: 1.35,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: COLOURS.muted,
    textAlign: "center",
  },
  watermark: {
    position: "absolute",
    bottom: 12,
    right: 40,
    fontSize: 9,
    color: COLOURS.gold,
    fontStyle: "italic",
  },
  bookingSection: {
    marginTop: 20,
    padding: 14,
    backgroundColor: COLOURS.cream,
    borderLeftWidth: 3,
    borderLeftColor: COLOURS.gold,
  },
  bookingTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: COLOURS.royal,
    marginBottom: 6,
  },
  bookingLink: {
    fontSize: 9,
    color: COLOURS.gold,
    marginBottom: 4,
    textDecoration: "underline",
  },
  premiumBar: {
    height: 5,
    backgroundColor: COLOURS.gold,
    marginBottom: 14,
    width: "100%",
  },
  calendarDowRow: {
    flexDirection: "row",
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLOURS.gold,
  },
  calendarDowCell: {
    flex: 1,
    alignItems: "center",
  },
  calendarDowText: {
    fontSize: 7,
    fontWeight: "bold",
    color: COLOURS.muted,
    textTransform: "uppercase",
  },
  calendarWeekRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  calendarCell: {
    flex: 1,
    minHeight: 34,
    padding: 2,
    borderWidth: 0.5,
    borderColor: "#e0dcd4",
    justifyContent: "flex-start",
  },
  calendarCellOut: {
    backgroundColor: "#f4f2ec",
  },
  calendarCellDay: {
    fontSize: 7,
    fontWeight: "bold",
    color: COLOURS.royal,
    marginBottom: 1,
  },
  calendarSlotStack: {
    marginTop: 1,
    flexGrow: 1,
    justifyContent: "flex-start",
  },
  calendarSlotRow: {
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 3,
    marginBottom: 0.5,
    paddingLeft: 2,
    minHeight: 8,
  },
  calendarSlotText: {
    fontSize: 5.5,
    flex: 1,
    lineHeight: 1.15,
  },
  strategyBlock: {
    marginBottom: 12,
  },
  strategyLegendRow: {
    flexDirection: "row",
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: COLOURS.gold,
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  legendLabel: {
    fontSize: 8,
    color: COLOURS.gold,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendSymbol: {
    fontSize: 12,
    fontWeight: "bold",
  },
  legendText: {
    fontSize: 9,
    color: COLOURS.royal,
  },
  calendarCellDayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 1,
  },
  weatherLine: {
    fontSize: 8,
    fontStyle: "italic",
    color: COLOURS.muted,
    marginBottom: 4,
    paddingLeft: 8,
  },
  packingIntro: {
    fontSize: 9,
    color: COLOURS.royal,
    marginBottom: 10,
    fontStyle: "italic",
  },
  budgetSummaryLine: {
    fontSize: 10,
    color: COLOURS.royal,
    marginBottom: 3,
  },
  budgetCatTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLOURS.gold,
    marginTop: 10,
    marginBottom: 4,
  },
  budgetItemLine: {
    fontSize: 9,
    color: COLOURS.royal,
    marginBottom: 2,
    paddingLeft: 6,
  },
  packingItemLine: {
    fontSize: 10,
    color: COLOURS.royal,
    marginBottom: 3,
    paddingLeft: 4,
  },
});

const SLOT_ORDER = ["am", "pm", "lunch", "dinner"] as const;

const SLOT_BORDER_PDF: Record<(typeof SLOT_ORDER)[number], string> = {
  am: COLOURS.royal,
  pm: "#1a2f75",
  lunch: COLOURS.gold,
  dinner: COLOURS.gold,
};

function slotLineUsesCustomTime(
  raw: SlotAssignmentValue | undefined,
): boolean {
  return (
    raw != null &&
    typeof raw === "object" &&
    typeof (raw as { time?: string }).time === "string" &&
    (raw as { time: string }).time.trim().length > 0
  );
}

function formatTwelveHour(hhmm: string): string {
  const [a, b] = hhmm.split(":").map((x) => parseInt(x, 10) || 0);
  const p = a >= 12 ? "PM" : "AM";
  const h = a % 12 || 12;
  return `${h}:${String(b).padStart(2, "0")} ${p}`;
}

const BUDGET_PDF_CAT_ORDER: BudgetCategory[] = [
  "flights",
  "accommodation",
  "tickets",
  "dining",
  "transport",
  "insurance",
  "cruise",
  "shopping",
  "other",
];

const BUDGET_PDF_LABEL: Record<BudgetCategory, string> = {
  flights: "Flights",
  accommodation: "Accommodation",
  tickets: "Tickets",
  dining: "Dining",
  transport: "Transport",
  insurance: "Insurance",
  cruise: "Cruise",
  shopping: "Shopping",
  other: "Other",
};

function formatPdfMoney(amount: number, code: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

function buildPdfWeekRows(startIso: string, endIso: string): Date[][] {
  const start = parseDate(startIso);
  const end = parseDate(endIso);
  const gridStart = startOfWeekMonday(start);
  const gridEnd = endOfWeekSunday(end);
  const rows: Date[][] = [];
  let cur = new Date(gridStart);
  while (cur <= gridEnd) {
    const row: Date[] = [];
    for (let i = 0; i < 7; i++) {
      row.push(new Date(cur));
      cur = addDays(cur, 1);
    }
    rows.push(row);
  }
  return rows;
}

function dayCrowdNoteText(
  trip: Trip,
  dateKey: string,
): string | null {
  const raw = trip.preferences?.ai_day_crowd_notes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = (raw as Record<string, unknown>)[dateKey];
  if (typeof v !== "string" || !v.trim()) return null;
  return sanitizeDayNote(v.trim());
}

function dayUserNotePdf(trip: Trip, dateKey: string): string {
  const dnRaw = trip.preferences?.day_notes;
  if (!dnRaw || typeof dnRaw !== "object" || Array.isArray(dnRaw)) return "";
  const v = (dnRaw as Record<string, unknown>)[dateKey];
  return typeof v === "string" ? v.trim() : "";
}

export interface TripPDFProps {
  trip: Trip;
  parks: Park[];
  customTiles: CustomTile[];
  watermark: boolean;
  design: "standard" | "premium";
  familyName: string;
  bookingAffiliateLinks?: Array<{ label: string; url: string }>;
  /** When false: cover + itinerary slots only (no strategy, day tips, or booking links). */
  includeNotes?: boolean;
  budgetItems?: TripBudgetItem[];
  checklistItems?: TripChecklistItem[];
  temperatureUnit?: TemperatureUnit;
}

export function TripPDF({
  trip,
  parks,
  customTiles,
  watermark,
  design,
  familyName,
  bookingAffiliateLinks,
  includeNotes = true,
  budgetItems = [],
  checklistItems = [],
  temperatureUnit = "c",
}: TripPDFProps) {
  const itemsById = new Map<string, { name: string; icon?: string | null }>();
  const colourById = new Map<string, string>();
  const fgById = new Map<string, string>();
  for (const p of parks) {
    itemsById.set(p.id, { name: p.name, icon: p.icon });
    colourById.set(p.id, p.bg_colour);
    fgById.set(p.id, p.fg_colour);
  }
  for (const t of customTiles) {
    itemsById.set(t.id, { name: t.name, icon: t.icon });
    colourById.set(t.id, t.bg_colour);
    fgById.set(t.id, t.fg_colour);
  }

  const start = parseDate(trip.start_date);
  const end = parseDate(trip.end_date);
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push(formatDateKey(d));
  }

  const assignments = (trip.assignments ?? {}) as Assignments;
  const weekRows = buildPdfWeekRows(trip.start_date, trip.end_date);
  const tripDaySet = new Set(days);

  const crowdSummary =
    includeNotes &&
    typeof trip.preferences?.ai_crowd_summary === "string" &&
    trip.preferences.ai_crowd_summary.trim()
      ? sanitizeDayNote(trip.preferences.ai_crowd_summary.trim())
      : null;

  const displayCurrency =
    trip.budget_currency?.trim() ||
    budgetItems.find((x) => x.currency?.trim())?.currency?.trim() ||
    "GBP";
  const budgetTotalAll = budgetItems.reduce((s, i) => s + i.amount, 0);
  const budgetPaidSum = budgetItems
    .filter((i) => i.is_paid)
    .reduce((s, i) => s + i.amount, 0);
  const budgetOutstandingSum = budgetTotalAll - budgetPaidSum;
  const budgetTarget = trip.budget_target;
  const budgetPct =
    budgetTarget != null && budgetTarget > 0
      ? Math.round((budgetTotalAll / budgetTarget) * 100)
      : null;

  const budgetByCat = new Map<BudgetCategory, TripBudgetItem[]>();
  for (const c of BUDGET_PDF_CAT_ORDER) budgetByCat.set(c, []);
  for (const it of budgetItems) {
    const cat = it.category as BudgetCategory;
    const arr = budgetByCat.get(cat) ?? [];
    arr.push(it);
    budgetByCat.set(cat, arr);
  }

  const hasAppendixContent =
    days.some((dayKey) => {
      const noteText = dayCrowdNoteText(trip, dayKey);
      const userNote = dayUserNotePdf(trip, dayKey);
      const weatherLine = pdfDayConditionLine(
        trip.region_id,
        parseDate(dayKey),
        temperatureUnit,
      );
      return Boolean(noteText || userNote || weatherLine);
    }) ||
    Boolean(bookingAffiliateLinks && bookingAffiliateLinks.length > 0);

  return (
    <Document
      title={`${trip.adventure_name} - TripTiles`}
      author={familyName}
      creator="TripTiles"
    >
      <Page size="A4" style={styles.coverPage}>
        <Text
          style={{
            fontSize: 12,
            color: COLOURS.gold,
            marginBottom: 14,
            letterSpacing: 3,
          }}
        >
          TRIPTILES
        </Text>
        <Text style={styles.coverTitle}>{trip.adventure_name}</Text>
        <Text style={styles.coverSubtitle}>{familyName}</Text>
        <Text style={styles.coverMeta}>
          {parseDate(trip.start_date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {" → "}
          {parseDate(trip.end_date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </Text>
        <Text style={styles.coverMeta}>
          {trip.adults} adult{trip.adults !== 1 ? "s" : ""}
          {trip.children > 0
            ? `, ${trip.children} child${trip.children !== 1 ? "ren" : ""}`
            : ""}
        </Text>
        {design === "premium" ? (
          <Text
            style={{
              marginTop: 28,
              fontSize: 11,
              color: COLOURS.royal,
              letterSpacing: 2,
            }}
          >
            Premium edition
          </Text>
        ) : null}
        {watermark ? (
          <Text
            style={{
              ...styles.watermark,
              position: "absolute",
              bottom: 36,
              right: 40,
            }}
          >
            Made with TripTiles · triptiles.app
          </Text>
        ) : null}
      </Page>

      <Page size="A4" style={styles.page} wrap>
        {design === "premium" ? <View style={styles.premiumBar} /> : null}
        {crowdSummary ? (
          <View style={styles.strategyBlock} wrap>
            <Text style={styles.sectionTitle}>Crowd strategy</Text>
            <Text style={styles.strategyBody}>{crowdSummary}</Text>
            <View style={styles.strategyLegendRow} wrap>
              <Text style={styles.legendLabel}>Legend:</Text>
              <View style={styles.legendItem}>
                <Text style={[styles.legendSymbol, { color: "#22c55e" }]}>
                  ●
                </Text>
                <Text style={styles.legendText}>Quiet</Text>
              </View>
              <View style={styles.legendItem}>
                <Text style={[styles.legendSymbol, { color: "#eab308" }]}>
                  ◐
                </Text>
                <Text style={styles.legendText}>Moderate</Text>
              </View>
              <View style={styles.legendItem}>
                <Text style={[styles.legendSymbol, { color: "#ef4444" }]}>
                  ▲
                </Text>
                <Text style={styles.legendText}>Busy crowds</Text>
              </View>
              <View style={styles.legendItem}>
                <Text style={styles.legendText}>💡 Has tips (day notes)</Text>
              </View>
            </View>
          </View>
        ) : null}
        <Text style={styles.sectionTitle}>Itinerary calendar</Text>

        <View style={styles.calendarDowRow} wrap={false}>
          {DAYS_OF_WEEK.map((dow) => (
            <View key={dow} style={styles.calendarDowCell}>
              <Text style={styles.calendarDowText}>{dow}</Text>
            </View>
          ))}
        </View>

        {weekRows.map((week, wi) => (
          <View key={wi} style={styles.calendarWeekRow} wrap={false}>
            {week.map((d) => {
              const cellKey = formatDateKey(d);
              const inTrip = tripDaySet.has(cellKey);
              const dayAssign = assignments[cellKey] ?? {};
              const crowdNote =
                inTrip && includeNotes ? dayCrowdNoteText(trip, cellKey) : null;
              const crowdTone = crowdNote
                ? heuristicCrowdToneFromNoteText(crowdNote)
                : null;
              const crowdSym = crowdTone
                ? crowdPdfSymbolForTone(crowdTone)
                : null;

              return (
                <View
                  key={cellKey}
                  style={[
                    styles.calendarCell,
                    !inTrip ? styles.calendarCellOut : {},
                  ]}
                >
                  {inTrip ? (
                    <>
                      <View style={styles.calendarCellDayRow}>
                        <Text style={styles.calendarCellDay}>
                          {d.getDate()} {MONTHS_SHORT[d.getMonth()]}
                        </Text>
                        {crowdSym ? (
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "bold",
                              color: crowdSym.color,
                            }}
                          >
                            {crowdSym.symbol}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.calendarSlotStack}>
                        {SLOT_ORDER.map((slot) => {
                          const raw = dayAssign[slot];
                          const id = getParkIdFromSlotValue(raw);
                          const borderCol = SLOT_BORDER_PDF[slot];
                          const isMeal =
                            slot === "lunch" || slot === "dinner";
                          const mealPrefix = isMeal ? "🍽️ " : "";
                          const item = id ? itemsById.get(id) : undefined;
                          const bg = id
                            ? (colourById.get(id) ?? COLOURS.royal)
                            : undefined;
                          const fg = id
                            ? (fgById.get(id) ?? "#ffffff")
                            : COLOURS.muted;
                          const baseLine = item
                            ? `${mealPrefix}${item.icon ? `${item.icon} ` : ""}${item.name}`
                            : id
                              ? "—"
                              : "";
                          const mealSuffix =
                            slot === "lunch"
                              ? " (lunch)"
                              : slot === "dinner"
                                ? " (dinner)"
                                : "";
                          const line =
                            item && slotLineUsesCustomTime(raw)
                              ? `${formatTwelveHour(getSlotTimeFromValue(slot, raw))} — ${baseLine}${isMeal ? mealSuffix : ""}`
                              : baseLine || (id ? "—" : "");
                          return (
                            <View
                              key={slot}
                              style={[
                                styles.calendarSlotRow,
                                {
                                  borderLeftColor: borderCol,
                                  backgroundColor: bg ?? "transparent",
                                },
                              ]}
                            >
                              {id ? (
                                <Text
                                  style={[styles.calendarSlotText, { color: fg }]}
                                >
                                  {line}
                                </Text>
                              ) : (
                                <Text style={styles.calendarSlotText}> </Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}

        {watermark ? (
          <Text style={styles.watermark} fixed>
            Made with TripTiles · triptiles.app
          </Text>
        ) : null}
        <Text style={styles.footer} fixed>
          Generated with TripTiles · triptiles.app · Your holiday, beautifully
          planned
        </Text>
      </Page>

      {budgetItems.length > 0 ? (
        <Page size="A4" style={styles.page} wrap>
          {design === "premium" ? <View style={styles.premiumBar} /> : null}
          <Text style={styles.sectionTitle}>Budget summary</Text>
          <Text style={styles.budgetSummaryLine}>
            Total: {formatPdfMoney(budgetTotalAll, displayCurrency)}
          </Text>
          {budgetTarget != null ? (
            <Text style={styles.budgetSummaryLine}>
              Target: {formatPdfMoney(budgetTarget, displayCurrency)}
              {budgetPct != null ? ` (${budgetPct}%)` : ""}
            </Text>
          ) : null}
          <Text style={styles.budgetSummaryLine}>
            Paid: {formatPdfMoney(budgetPaidSum, displayCurrency)} | Outstanding:{" "}
            {formatPdfMoney(budgetOutstandingSum, displayCurrency)}
          </Text>
          {BUDGET_PDF_CAT_ORDER.map((cat) => {
            const rows = budgetByCat.get(cat) ?? [];
            if (rows.length === 0) return null;
            const sub = rows.reduce((s, r) => s + r.amount, 0);
            return (
              <View key={cat} wrap={false}>
                <Text style={styles.budgetCatTitle}>
                  {BUDGET_PDF_LABEL[cat]} —{" "}
                  {formatPdfMoney(sub, displayCurrency)}
                </Text>
                {rows.map((row) => (
                  <Text key={row.id} style={styles.budgetItemLine}>
                    {row.is_paid ? "✓ " : ""}
                    {row.label} — {formatPdfMoney(row.amount, row.currency || displayCurrency)}
                  </Text>
                ))}
              </View>
            );
          })}
          <Text
            style={[styles.budgetSummaryLine, { marginTop: 14, fontWeight: "bold" }]}
          >
            Total: {formatPdfMoney(budgetTotalAll, displayCurrency)}
          </Text>
          {watermark ? (
            <Text style={styles.watermark} fixed>
              Made with TripTiles · triptiles.app
            </Text>
          ) : null}
          <Text style={styles.footer} fixed>
            Generated with TripTiles · triptiles.app · Your holiday, beautifully
            planned
          </Text>
        </Page>
      ) : null}

      {checklistItems.length > 0 ? (
        <Page size="A4" style={styles.page} wrap>
          {design === "premium" ? <View style={styles.premiumBar} /> : null}
          <Text style={styles.sectionTitle}>Packing checklist</Text>
          <Text style={styles.packingIntro}>
            Print this page and tick off items as you pack.
          </Text>
          {checklistItems.map((row) => (
            <Text key={row.id} style={styles.packingItemLine}>
              ☐ {row.label}
            </Text>
          ))}
          {watermark ? (
            <Text style={styles.watermark} fixed>
              Made with TripTiles · triptiles.app
            </Text>
          ) : null}
          <Text style={styles.footer} fixed>
            Generated with TripTiles · triptiles.app · Your holiday, beautifully
            planned
          </Text>
        </Page>
      ) : null}

      {includeNotes && hasAppendixContent ? (
        <Page size="A4" style={styles.page} wrap>
          {design === "premium" ? <View style={styles.premiumBar} /> : null}
          <Text style={styles.sectionTitle}>Day notes</Text>
          {days.map((dayKey, i) => {
            const noteText = dayCrowdNoteText(trip, dayKey);
            const userNote = dayUserNotePdf(trip, dayKey);
            const date = parseDate(dayKey);
            const label = date.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            });
            const weatherLine = pdfDayConditionLine(
              trip.region_id,
              date,
              temperatureUnit,
            );
            if (!noteText && !userNote && !weatherLine) return null;
            return (
              <View key={`note-${dayKey}`} wrap={false}>
                <Text style={styles.dayHeader}>
                  Day {i + 1} · {label}
                </Text>
                {weatherLine ? (
                  <Text style={styles.weatherLine}>{weatherLine}</Text>
                ) : null}
                {noteText ? (
                  <Text style={styles.dayNote}>Why this day: {noteText}</Text>
                ) : null}
                {userNote ? (
                  <Text
                    style={[
                      styles.dayNote,
                      { marginTop: 2, fontStyle: "italic" },
                    ]}
                  >
                    📝 {userNote}
                  </Text>
                ) : null}
              </View>
            );
          })}
          {bookingAffiliateLinks && bookingAffiliateLinks.length > 0 ? (
            <View wrap={false} style={styles.bookingSection}>
              <Text style={styles.bookingTitle}>Book your trip</Text>
              {bookingAffiliateLinks.map((link, idx) => (
                <Link key={idx} src={link.url} style={styles.bookingLink}>
                  → {link.label}
                </Link>
              ))}
            </View>
          ) : null}
          {watermark ? (
            <Text style={styles.watermark} fixed>
              Made with TripTiles · triptiles.app
            </Text>
          ) : null}
          <Text style={styles.footer} fixed>
            Generated with TripTiles · triptiles.app · Your holiday, beautifully
            planned
          </Text>
        </Page>
      ) : null}
    </Document>
  );
}
