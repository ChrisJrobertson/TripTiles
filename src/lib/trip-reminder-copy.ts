/** Destination-aware lines for trip milestone emails (UK English). */

export function reminderExtraLines(
  daysBefore: number,
  regionId: string | null,
): string[] {
  const rid = regionId ?? "";
  const lines: string[] = [];
  if (daysBefore === 90) {
    if (rid === "orlando" || rid === "florida_combo") {
      lines.push(
        "Disney World dining reservations open 60 days ahead — set a calendar nudge so you don’t miss your favourites.",
      );
    } else if (rid === "paris") {
      lines.push(
        "Disneyland Paris lets you book many meals up to 60 days ahead in the app — worth planning early.",
      );
    } else {
      lines.push(
        "Book popular restaurants early — many parks and city venues fill up weeks ahead.",
      );
    }
  }
  if (daysBefore === 14 && (rid === "orlando" || rid === "florida_combo")) {
    lines.push(
      "August trips are often hot and humid (around 33°C / 91°F) — pack sunscreen, ponchos, and refillable water bottles.",
    );
  }
  return lines;
}

export function reminderDefaultBullets(daysBefore: number): string[] {
  switch (daysBefore) {
    case 90:
      return [
        "Book or adjust dining for your big park days.",
        "Download the official park apps and log in ahead of time.",
        "Check passport validity and any visa or ESTA rules for your party.",
      ];
    case 60:
      return [
        "Confirm passports, ESTA / visas, and travel insurance.",
        "Photograph or scan important documents and save them offline.",
      ];
    case 30:
      return [
        "Print or save your TripTiles PDF itinerary for the group chat.",
        "Skim your packing list — add chargers and adapters.",
        "Tell your bank you’re travelling if needed.",
      ];
    case 14:
      return [
        "Glance at the long-range forecast and tweak layers or rain gear.",
        "Confirm airport transfers or hire-car pickup details.",
        "Download offline maps for the resort area.",
      ];
    case 7:
      return [
        "Walk through your checklist — chargers, medicines, comfortable shoes.",
        "Charge power banks and kids’ tablets the night before.",
      ];
    case 1:
      return [
        "Have a brilliant time — your itinerary is ready in TripTiles.",
        "Screenshot or print your day plan if you like a paper backup.",
      ];
    default:
      return ["Open TripTiles and give your plan a final skim."];
  }
}

export function reminderSubject(daysBefore: number): string {
  switch (daysBefore) {
    case 90:
      return "3 months to go! Time to book dining";
    case 60:
      return "2 months! Check your documents";
    case 30:
      return "1 month! Getting exciting";
    case 14:
      return "2 weeks! Almost time";
    case 7:
      return "1 week to go!";
    case 1:
      return "Tomorrow's the day!";
    default:
      return "Your trip is coming up";
  }
}
