"use client";

import { addDays, formatDateKey, parseDate } from "@/lib/date-helpers";
import type { Assignments, CustomTile, Park, Trip } from "@/lib/types";
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
  weekLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLOURS.gold,
    marginTop: 10,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
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
});

const SLOT_ORDER = ["am", "pm", "lunch", "dinner"] as const;

function slotLabel(slot: string): string {
  if (slot === "am") return "AM";
  if (slot === "pm") return "PM";
  if (slot === "lunch") return "LUN";
  if (slot === "dinner") return "DIN";
  return slot;
}

function dayCrowdNoteText(
  trip: Trip,
  dateKey: string,
): string | null {
  const raw = trip.preferences?.ai_day_crowd_notes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = (raw as Record<string, unknown>)[dateKey];
  return typeof v === "string" && v.trim() ? v.trim() : null;
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
}: TripPDFProps) {
  const itemsById = new Map<string, { name: string; icon?: string | null }>();
  for (const p of parks) {
    itemsById.set(p.id, { name: p.name, icon: p.icon });
  }
  for (const t of customTiles) {
    itemsById.set(t.id, { name: t.name, icon: t.icon });
  }

  const start = parseDate(trip.start_date);
  const end = parseDate(trip.end_date);
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push(formatDateKey(d));
  }

  const assignments = (trip.assignments ?? {}) as Assignments;

  const crowdSummary =
    includeNotes &&
    typeof trip.preferences?.ai_crowd_summary === "string" &&
    trip.preferences.ai_crowd_summary.trim()
      ? trip.preferences.ai_crowd_summary.trim()
      : null;

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

      {crowdSummary ? (
        <Page size="A4" style={styles.page} wrap={false}>
          {design === "premium" ? <View style={styles.premiumBar} /> : null}
          <Text style={styles.sectionTitle}>Crowd strategy</Text>
          <Text style={styles.strategyBody}>{crowdSummary}</Text>
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

      <Page size="A4" style={styles.page} wrap>
        {design === "premium" ? <View style={styles.premiumBar} /> : null}
        <Text style={styles.sectionTitle}>Your day-by-day itinerary</Text>

        {days.map((dayKey, i) => {
          const dayAssign = assignments[dayKey] ?? {};
          const date = parseDate(dayKey);
          const label = date.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
          const hasSlot = SLOT_ORDER.some((s) => Boolean(dayAssign[s]));
          const noteText = includeNotes ? dayCrowdNoteText(trip, dayKey) : null;

          return (
            <View key={dayKey}>
              {i % 7 === 0 ? (
                <Text style={styles.weekLabel}>
                  Trip week {Math.floor(i / 7) + 1} · starting{" "}
                  {date.toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </Text>
              ) : null}
              <View wrap={false}>
                <Text style={styles.dayHeader}>
                  Day {i + 1} · {label}
                </Text>
                {SLOT_ORDER.map((slot) => {
                  const id = dayAssign[slot];
                  if (!id) return null;
                  const item = itemsById.get(id);
                  const line = item
                    ? `${item.icon ? `${item.icon} ` : ""}${item.name}`
                    : `(${id})`;
                  return (
                    <View key={slot} style={styles.slot}>
                      <Text style={styles.slotLabel}>{slotLabel(slot)}</Text>
                      <Text style={styles.slotValue}>{line}</Text>
                    </View>
                  );
                })}
                {!hasSlot ? (
                  <Text
                    style={{
                      fontSize: 9,
                      color: COLOURS.muted,
                      paddingLeft: 8,
                      fontStyle: "italic",
                    }}
                  >
                    Rest day — nothing planned yet
                  </Text>
                ) : null}
                {noteText ? (
                  <Text style={styles.dayNote}>Why this day: {noteText}</Text>
                ) : null}
              </View>
            </View>
          );
        })}

        {includeNotes &&
        bookingAffiliateLinks &&
        bookingAffiliateLinks.length > 0 ? (
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
    </Document>
  );
}
