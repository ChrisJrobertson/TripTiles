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
import { formatMoney } from "@/lib/format";
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
import type { TripPayment } from "@/types/payments";
import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

export type PdfExportMode =
  | "with_notes"
  | "clean_printable"
  | "payments_schedule";

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
  paymentsPdfBlock: {
    marginBottom: 14,
    padding: 12,
    backgroundColor: COLOURS.cream,
    borderLeftWidth: 3,
    borderLeftColor: COLOURS.gold,
  },
  paymentPdfLine: {
    fontSize: 9,
    color: COLOURS.royal,
    marginBottom: 3,
    paddingLeft: 4,
  },
  paymentPdfTotal: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLOURS.royal,
    marginTop: 8,
  },
  paymentsSchedulePage: {
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 34,
    fontFamily: "Times-Roman",
    fontSize: 10,
    color: COLOURS.royal,
    backgroundColor: COLOURS.cream,
  },
  paymentsHeaderBand: {
    backgroundColor: COLOURS.royal,
    paddingTop: 18,
    paddingBottom: 12,
    paddingHorizontal: 14,
    marginLeft: -34,
    marginRight: -34,
    marginBottom: 0,
  },
  paymentsHeaderTitle: {
    fontSize: 22,
    color: COLOURS.cream,
    fontWeight: "bold",
    letterSpacing: 0.3,
  },
  paymentsHeaderSubtitle: {
    marginTop: 3,
    fontSize: 10,
    color: "#E4D7B5",
  },
  paymentsAccentRule: {
    height: 4,
    backgroundColor: COLOURS.gold,
    marginLeft: -34,
    marginRight: -34,
    marginBottom: 14,
  },
  paymentsMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  paymentsMetaText: {
    fontSize: 9,
    color: COLOURS.royal,
  },
  paymentsTableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLOURS.gold,
    backgroundColor: "#F3EEE2",
    paddingVertical: 6,
    paddingHorizontal: 5,
  },
  paymentsTableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.6,
    borderBottomColor: "#DCCFAF",
    paddingVertical: 6,
    paddingHorizontal: 5,
    alignItems: "flex-start",
  },
  paymentsTableLabelCol: {
    width: "34%",
    paddingRight: 6,
  },
  paymentsTableAmountCol: {
    width: "16%",
    paddingRight: 6,
  },
  paymentsTableBookingCol: {
    width: "16%",
    paddingRight: 6,
  },
  paymentsTableDueCol: {
    width: "16%",
    paddingRight: 6,
  },
  paymentsTableDaysCol: {
    width: "18%",
  },
  paymentsTableHeadText: {
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: COLOURS.royal,
  },
  paymentsTableCellText: {
    fontSize: 9,
    color: COLOURS.royal,
    lineHeight: 1.25,
  },
  paymentsTableCellMuted: {
    color: "#6F6A5D",
  },
  paymentsOverdueText: {
    color: "#B42318",
    fontWeight: "bold",
  },
  paymentsTotalsWrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLOURS.gold,
    backgroundColor: "#FFFDF6",
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  paymentsTotalsTitle: {
    fontSize: 8,
    textTransform: "uppercase",
    color: COLOURS.royal,
    marginBottom: 4,
    fontWeight: "bold",
    letterSpacing: 0.4,
  },
  paymentsTotalsLine: {
    fontSize: 10,
    color: COLOURS.royal,
    marginBottom: 2,
  },
  paymentsNoRowsText: {
    marginTop: 10,
    fontSize: 10,
    color: COLOURS.royal,
    fontStyle: "italic",
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
  return formatMoney(Math.round(amount * 100), code);
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
  familyName: string;
  bookingAffiliateLinks?: Array<{ label: string; url: string }>;
  /** When false: cover + itinerary slots only (no strategy, day tips, or booking links). */
  includeNotes?: boolean;
  budgetItems?: TripBudgetItem[];
  checklistItems?: TripChecklistItem[];
  /** Shown on the itinerary page when `includeNotes` is true (not in clean printable). */
  tripPayments?: TripPayment[];
  temperatureUnit?: TemperatureUnit;
  exportMode?: PdfExportMode;
}

export function TripPDF({
  trip,
  parks,
  customTiles,
  watermark,
  familyName,
  bookingAffiliateLinks,
  includeNotes = true,
  budgetItems = [],
  checklistItems = [],
  tripPayments = [],
  temperatureUnit = "c",
  exportMode = "with_notes",
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

  const sortedTripPayments = [...tripPayments].sort((a, b) => {
    const da = a.due_date;
    const db = b.due_date;
    if (da == null && db == null) return a.sort_order - b.sort_order;
    if (da == null) return 1;
    if (db == null) return -1;
    if (da < db) return -1;
    if (da > db) return 1;
    return a.sort_order - b.sort_order;
  });

  const paymentTotalsGbp = sortedTripPayments
    .filter((p) => p.currency === "GBP")
    .reduce((s, p) => s + p.amount_pence, 0);
  const paymentTotalsUsd = sortedTripPayments
    .filter((p) => p.currency === "USD")
    .reduce((s, p) => s + p.amount_pence, 0);
  const paymentTotalByCurrency = new Map<string, number>();
  for (const payment of sortedTripPayments) {
    const curr = payment.currency || "GBP";
    paymentTotalByCurrency.set(
      curr,
      (paymentTotalByCurrency.get(curr) ?? 0) + payment.amount_pence,
    );
  }

  const paymentPdfTotalsText =
    [
      paymentTotalsGbp > 0 ? formatPdfMoney(paymentTotalsGbp / 100, "GBP") : "",
      paymentTotalsUsd > 0 ? formatPdfMoney(paymentTotalsUsd / 100, "USD") : "",
    ]
      .filter(Boolean)
      .join(" + ") || formatPdfMoney(0, "GBP");

  const todayDate = new Date();
  const todayNoon = new Date(
    todayDate.getFullYear(),
    todayDate.getMonth(),
    todayDate.getDate(),
    12,
  );
  const paymentsScheduleRows = sortedTripPayments.map((payment) => {
    const dueDate =
      payment.due_date != null ? parseDate(payment.due_date) : null;
    const dueNoon = dueDate
      ? new Date(
          dueDate.getFullYear(),
          dueDate.getMonth(),
          dueDate.getDate(),
          12,
        )
      : null;
    const daysUntilDue =
      dueNoon != null
        ? Math.round((dueNoon.getTime() - todayNoon.getTime()) / (24 * 60 * 60 * 1000))
        : null;
    return { payment, daysUntilDue };
  });

  if (exportMode === "payments_schedule") {
    return (
      <Document
        title={`${trip.adventure_name} - Payments schedule`}
        author={familyName}
        creator="TripTiles"
      >
        <Page size="A4" style={styles.paymentsSchedulePage}>
          <View style={styles.paymentsHeaderBand}>
            <Text style={styles.paymentsHeaderTitle}>Payments schedule</Text>
            <Text style={styles.paymentsHeaderSubtitle}>
              {trip.adventure_name} · {familyName}
            </Text>
          </View>
          <View style={styles.paymentsAccentRule} />

          <View style={styles.paymentsMetaRow}>
            <Text style={styles.paymentsMetaText}>
              Generated{" "}
              {todayDate.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </Text>
            <Text style={styles.paymentsMetaText}>
              Rows: {paymentsScheduleRows.length}
            </Text>
          </View>

          <View style={styles.paymentsTableHeader}>
            <View style={styles.paymentsTableLabelCol}>
              <Text style={styles.paymentsTableHeadText}>Label</Text>
            </View>
            <View style={styles.paymentsTableAmountCol}>
              <Text style={styles.paymentsTableHeadText}>Amount</Text>
            </View>
            <View style={styles.paymentsTableBookingCol}>
              <Text style={styles.paymentsTableHeadText}>Booking date</Text>
            </View>
            <View style={styles.paymentsTableDueCol}>
              <Text style={styles.paymentsTableHeadText}>Due date</Text>
            </View>
            <View style={styles.paymentsTableDaysCol}>
              <Text style={styles.paymentsTableHeadText}>Days until due</Text>
            </View>
          </View>

          {paymentsScheduleRows.length === 0 ? (
            <Text style={styles.paymentsNoRowsText}>
              No payments recorded for this trip yet.
            </Text>
          ) : (
            paymentsScheduleRows.map(({ payment, daysUntilDue }) => (
              <View key={payment.id} style={styles.paymentsTableRow}>
                <View style={styles.paymentsTableLabelCol}>
                  <Text style={styles.paymentsTableCellText}>{payment.label}</Text>
                </View>
                <View style={styles.paymentsTableAmountCol}>
                  <Text style={styles.paymentsTableCellText}>
                    {formatPdfMoney(payment.amount_pence / 100, payment.currency)}
                  </Text>
                </View>
                <View style={styles.paymentsTableBookingCol}>
                  <Text
                    style={
                      payment.booking_date
                        ? styles.paymentsTableCellText
                        : [
                            styles.paymentsTableCellText,
                            styles.paymentsTableCellMuted,
                          ]
                    }
                  >
                    {payment.booking_date ?? "—"}
                  </Text>
                </View>
                <View style={styles.paymentsTableDueCol}>
                  <Text
                    style={
                      payment.due_date
                        ? styles.paymentsTableCellText
                        : [
                            styles.paymentsTableCellText,
                            styles.paymentsTableCellMuted,
                          ]
                    }
                  >
                    {payment.due_date ?? "—"}
                  </Text>
                </View>
                <View style={styles.paymentsTableDaysCol}>
                  <Text
                    style={
                      daysUntilDue == null
                        ? [
                            styles.paymentsTableCellText,
                            styles.paymentsTableCellMuted,
                          ]
                        : daysUntilDue < 0
                          ? [
                              styles.paymentsTableCellText,
                              styles.paymentsOverdueText,
                            ]
                          : styles.paymentsTableCellText
                    }
                  >
                    {daysUntilDue == null
                      ? "—"
                      : daysUntilDue < 0
                        ? `Overdue by ${Math.abs(daysUntilDue)}`
                        : daysUntilDue === 0
                          ? "Due today"
                          : `${daysUntilDue}`}
                  </Text>
                </View>
              </View>
            ))
          )}

          <View style={styles.paymentsTotalsWrap}>
            <Text style={styles.paymentsTotalsTitle}>Totals per currency</Text>
            {[...paymentTotalByCurrency.entries()].map(([currency, totalPence]) => (
              <Text key={currency} style={styles.paymentsTotalsLine}>
                {currency}: {formatPdfMoney(totalPence / 100, currency)}
              </Text>
            ))}
            {paymentTotalByCurrency.size === 0 ? (
              <Text style={styles.paymentsTotalsLine}>
                GBP: {formatPdfMoney(0, "GBP")}
              </Text>
            ) : null}
          </View>

          {watermark ? (
            <Text style={styles.watermark} fixed>
              Made with TripTiles · triptiles.app
            </Text>
          ) : null}
          <Text style={styles.footer} fixed>
            Generated with TripTiles · triptiles.app · Payments schedule
          </Text>
        </Page>
      </Document>
    );
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
        {includeNotes && sortedTripPayments.length > 0 ? (
          <View style={styles.paymentsPdfBlock} wrap>
            <Text style={styles.sectionTitle}>Payments</Text>
            {sortedTripPayments.map((p) => (
              <Text key={p.id} style={styles.paymentPdfLine}>
                {p.label} —{" "}
                {formatPdfMoney(p.amount_pence / 100, p.currency)}
                {p.due_date ? ` · due ${p.due_date}` : ""}
              </Text>
            ))}
            <Text style={styles.paymentPdfTotal}>
              Totals: {paymentPdfTotalsText}
            </Text>
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
