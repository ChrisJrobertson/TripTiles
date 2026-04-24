/**
 * Run: npx tsx src/lib/skip-line-clashes.test.ts
 * or: npm test -- --skip-line-clashes
 */
import assert from "node:assert/strict";
import { detectSkipLineClashes } from "./skip-line-clashes";

function run() {
  const a = (id: string, name: string, ret: string | null) => ({
    id,
    attractionName: name,
    skipLineReturnHhmm: ret,
  });

  {
    const m = detectSkipLineClashes({
      rides: [a("1", "A", "10:00"), a("2", "B", "13:00")],
      aiTimelineItems: [],
      userSlotTimes: [],
    });
    assert.equal(m.size, 0, "1) 3h apart, no extra sources → no clash");
  }

  {
    const m = detectSkipLineClashes({
      rides: [a("1", "Kili", "14:00"), a("2", "Avatar", "14:30")],
      aiTimelineItems: [],
      userSlotTimes: [],
    });
    assert.ok(m.get("1")?.length, "2) Kili return_overlap");
    assert.ok(m.get("2")?.length, "2) Avatar return_overlap");
  }

  {
    const m = detectSkipLineClashes({
      rides: [a("1", "Kili", "14:30")],
      aiTimelineItems: [
        {
          tag: "adr",
          time: "17:30",
          title: "Character Dining — Example",
        },
      ],
      userSlotTimes: [],
    });
    assert.equal(
      m.size,
      0,
      "3) 14:30 vs 17:30 ADR → 3h apart, no dining clash",
    );
  }

  {
    const m = detectSkipLineClashes({
      rides: [a("1", "Kili", "17:00")],
      aiTimelineItems: [
        {
          tag: "adr",
          time: "17:30",
          title: "Character Dining",
        },
      ],
      userSlotTimes: [],
    });
    const c = m.get("1");
    assert.ok(
      c?.some((x) => x.kind === "dining_overlap"),
      "4) 17:00 vs ADR 17:30 → dining_overlap",
    );
  }

  {
    const m = detectSkipLineClashes({
      rides: [a("1", "Kili", "14:15")],
      aiTimelineItems: [
        {
          tag: "show",
          time: "14:00",
          title: "Festival of the Lion King",
        },
      ],
      userSlotTimes: [],
    });
    const c = m.get("1");
    assert.ok(
      c?.some((x) => x.kind === "show_overlap"),
      "5) return 14:15 vs show 14:00",
    );
  }

  {
    const m = detectSkipLineClashes({
      rides: [a("1", "Kili", "15:00")],
      aiTimelineItems: [],
      userSlotTimes: [
        { slot: "lunch", time: "14:30", label: "Lunch (Magic Kingdom)" },
      ],
    });
    const c = m.get("1");
    assert.ok(
      c?.some((x) => x.kind === "slot_time_overlap"),
      "6) return vs user lunch object slot",
    );
  }

  {
    const m = detectSkipLineClashes({
      rides: [a("1", "X", null), a("2", "Y", "15:00")],
      aiTimelineItems: [],
      userSlotTimes: [],
    });
    assert.equal(m.size, 0, "7) null return never in clash map for that row");
  }

  {
    const m = detectSkipLineClashes({
      rides: [a("1", "A", "10:00"), a("2", "B", "10:20")],
      aiTimelineItems: [],
      userSlotTimes: [],
    });
    assert.ok(m.get("1")?.length && m.get("2")?.length, "8) fresh trip arrays");
  }

  console.log("skip-line-clashes tests: all passed");
}

run();
