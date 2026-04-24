# Prompt: Update TripTiles Park Colors in Supabase

## Your Goal
Update the `parks` table in Supabase to use brand-aligned colors that are visually distinct and consistent with the TripTiles logo palette.

## Brand Color Palette (from TripTiles Logo)

| Color Name | Hex Code | Usage |
|------------|----------|-------|
| **Royal Blue** | `#2455ac` | Primary brand, Magic Kingdom |
| **Vibrant Orange/Gold** | `#dd4e14` | CTAs, Hollywood Studios |
| **Warm Cream** | `#fce7cc` | Background |
| **Bright Blue** | `#3fa2ec` | EPCOT, links |
| **Fresh Lime** | `#a2df56` | Animal Kingdom, success |
| **Soft Sky** | `#c0d5e0` | Rest days, secondary |
| **Light Cyan** | `#c3f5fd` | Highlights |
| **Soft Pink** | `#ffb8c2` | Epic Universe, travel days |
| **Lavender** | `#d5caf8` | Accents |

## Park Color Assignments

### Disney World Parks (Orlando)
| Park | bg_colour | fg_colour | Reasoning |
|------|-----------|-----------|-----------|
| **Magic Kingdom** | `#2455ac` | `#ffffff` | Royal blue - classic Disney castle |
| **EPCOT** | `#3fa2ec` | `#ffffff` | Bright futuristic blue |
| **Hollywood Studios** | `#dd4e14` | `#ffffff` | Orange - movies/action/energy |
| **Animal Kingdom** | `#a2df56` | `#1a1a2e` | Lime green - nature/wildlife |
| **Disney Springs** | `#d5caf8` | `#1a1a2e` | Lavender - shopping/magic |
| **Typhoon Lagoon** | `#3fa2ec` | `#ffffff` | Bright blue - water |
| **Blizzard Beach** | `#c3f5fd` | `#1a1a2e` | Cyan - ice/snow theme |

### Disneyland Parks (California)
| Park | bg_colour | fg_colour | Reasoning |
|------|-----------|-----------|-----------|
| **Disneyland Park** | `#2455ac` | `#ffffff` | Royal blue - classic |
| **Disney California Adventure** | `#f59e0b` | `#1a1a2e` | Amber/gold - California sun |
| **Downtown Disney** | `#d5caf8` | `#1a1a2e` | Lavender |

### Universal Parks
| Park | bg_colour | fg_colour | Reasoning |
|------|-----------|-----------|-----------|
| **Universal Studios Florida** | `#7c3aed` | `#ffffff` | Deep purple - distinct from Disney |
| **Islands of Adventure** | `#0d9488` | `#ffffff` | Teal - adventure/nature |
| **Epic Universe** | `#d5caf8` | `#1a1a2e` | Lavender - futuristic/magical |
| **Universal Studios Hollywood** | `#7c3aed` | `#ffffff` | Deep purple |
| **CityWalk** | `#f43f5e` | `#ffffff` | Rose pink - nightlife/energy |

### International Disney
| Park | bg_colour | fg_colour | Reasoning |
|------|-----------|-----------|-----------|
| **Disneyland Paris** | `#2455ac` | `#ffffff` | Royal blue |
| **Walt Disney Studios Paris** | `#dd4e14` | `#ffffff` | Orange - studios |
| **Tokyo Disneyland** | `#2455ac` | `#ffffff` | Royal blue |
| **Tokyo DisneySea** | `#3fa2ec` | `#ffffff` | Bright blue - ocean |
| **Hong Kong Disneyland** | `#2455ac` | `#ffffff` | Royal blue |
| **Shanghai Disneyland** | `#2455ac` | `#ffffff` | Royal blue |

### Other Major Parks
| Park | bg_colour | fg_colour | Reasoning |
|------|-----------|-----------|-----------|
| **Legoland Florida** | `#a2df56` | `#1a1a2e` | Lime - Lego/bright |
| **Legoland California** | `#a2df56` | `#1a1a2e` | Lime |
| **SeaWorld Orlando** | `#3fa2ec` | `#ffffff` | Bright blue - ocean |
| **SeaWorld San Diego** | `#3fa2ec` | `#ffffff` | Bright blue |
| **Busch Gardens Tampa** | `#a2df56` | `#1a1a2e` | Lime - nature/adventure |
| **Knotts Berry Farm** | `#f43f5e` | `#ffffff` | Rose - berry theme |
| **Six Flags Magic Mountain** | `#dd4e14` | `#ffffff` | Orange - thrill/energy |
| **Cedar Point** | `#3fa2ec` | `#ffffff` | Bright blue |
| **Hersheypark** | `#78350f` | `#ffffff` | Brown - chocolate theme |
| **Silver Dollar City** | `#b45309` | `#ffffff` | Amber/brown - rustic |

### Special/Non-Park Days
| Type | bg_colour | fg_colour | Reasoning |
|------|-----------|-----------|-----------|
| **Rest Day / Pool Day** | `#c0d5e0` | `#1a1a2e` | Soft sky - calming |
| **Travel/Arrival Day** | `#ffb8c2` | `#1a1a2e` | Soft pink - distinct marker |
| **Shopping/Dining** | `#d5caf8` | `#1a1a2e` | Lavender |
| **Water Park (Generic)** | `#3fa2ec` | `#ffffff` | Bright blue |
| **Unknown/Other** | `#6b7280` | `#ffffff` | Gray - neutral |

## SQL Commands to Execute

Run these SQL commands in your Supabase SQL Editor:

```sql
-- ========== DISNEY WORLD (Orlando) ==========
UPDATE parks SET bg_colour = '#2455ac', fg_colour = '#ffffff' WHERE name ILIKE '%magic kingdom%';
UPDATE parks SET bg_colour = '#3fa2ec', fg_colour = '#ffffff' WHERE name ILIKE '%epcot%';
UPDATE parks SET bg_colour = '#dd4e14', fg_colour = '#ffffff' WHERE name ILIKE '%hollywood studios%';
UPDATE parks SET bg_colour = '#a2df56', fg_colour = '#1a1a2e' WHERE name ILIKE '%animal kingdom%' AND name NOT ILIKE '%disneyland%';
UPDATE parks SET bg_colour = '#d5caf8', fg_colour = '#1a1a2e' WHERE name ILIKE '%disney springs%';
UPDATE parks SET bg_colour = '#3fa2ec', fg_colour = '#ffffff' WHERE name ILIKE '%typhoon lagoon%';
UPDATE parks SET bg_colour = '#c3f5fd', fg_colour = '#1a1a2e' WHERE name ILIKE '%blizzard beach%';

-- ========== DISNEYLAND (California) ==========
UPDATE parks SET bg_colour = '#2455ac', fg_colour = '#ffffff' WHERE name ILIKE '%disneyland%' AND name NOT ILIKE '%disneyland paris%' AND name NOT ILIKE '%hong kong%' AND name NOT ILIKE '%shanghai%' AND name NOT ILIKE '%tokyo%';
UPDATE parks SET bg_colour = '#f59e0b', fg_colour = '#1a1a2e' WHERE name ILIKE '%california adventure%';
UPDATE parks SET bg_colour = '#d5caf8', fg_colour = '#1a1a2e' WHERE name ILIKE '%downtown disney%';

-- ========== UNIVERSAL ==========
UPDATE parks SET bg_colour = '#7c3aed', fg_colour = '#ffffff' WHERE name ILIKE '%universal studios%' AND name NOT ILIKE '%hollywood%';
UPDATE parks SET bg_colour = '#0d9488', fg_colour = '#ffffff' WHERE name ILIKE '%islands of adventure%';
UPDATE parks SET bg_colour = '#d5caf8', fg_colour = '#1a1a2e' WHERE name ILIKE '%epic universe%';
UPDATE parks SET bg_colour = '#7c3aed', fg_colour = '#ffffff' WHERE name ILIKE '%universal studios hollywood%';
UPDATE parks SET bg_colour = '#f43f5e', fg_colour = '#ffffff' WHERE name ILIKE '%citywalk%';

-- ========== INTERNATIONAL DISNEY ==========
UPDATE parks SET bg_colour = '#2455ac', fg_colour = '#ffffff' WHERE name ILIKE '%disneyland paris%';
UPDATE parks SET bg_colour = '#dd4e14', fg_colour = '#ffffff' WHERE name ILIKE '%walt disney studios%' AND name ILIKE '%paris%';
UPDATE parks SET bg_colour = '#2455ac', fg_colour = '#ffffff' WHERE name ILIKE '%tokyo disneyland%';
UPDATE parks SET bg_colour = '#3fa2ec', fg_colour = '#ffffff' WHERE name ILIKE '%disneysea%' OR name ILIKE '%disney sea%';
UPDATE parks SET bg_colour = '#2455ac', fg_colour = '#ffffff' WHERE name ILIKE '%hong kong disneyland%';
UPDATE parks SET bg_colour = '#2455ac', fg_colour = '#ffffff' WHERE name ILIKE '%shanghai disneyland%';

-- ========== OTHER MAJOR PARKS ==========
UPDATE parks SET bg_colour = '#a2df56', fg_colour = '#1a1a2e' WHERE name ILIKE '%legoland%';
UPDATE parks SET bg_colour = '#3fa2ec', fg_colour = '#ffffff' WHERE name ILIKE '%seaworld%';
UPDATE parks SET bg_colour = '#a2df56', fg_colour = '#1a1a2e' WHERE name ILIKE '%busch gardens%';
UPDATE parks SET bg_colour = '#f43f5e', fg_colour = '#ffffff' WHERE name ILIKE '%knotts%' OR name ILIKE '%knott''s%';
UPDATE parks SET bg_colour = '#dd4e14', fg_colour = '#ffffff' WHERE name ILIKE '%six flags%';
UPDATE parks SET bg_colour = '#3fa2ec', fg_colour = '#ffffff' WHERE name ILIKE '%cedar point%';
UPDATE parks SET bg_colour = '#78350f', fg_colour = '#ffffff' WHERE name ILIKE '%hersheypark%' OR name ILIKE '%hershey park%';
UPDATE parks SET bg_colour = '#b45309', fg_colour = '#ffffff' WHERE name ILIKE '%silver dollar city%';

-- ========== SPECIAL DAY TYPES ==========
UPDATE parks SET bg_colour = '#c0d5e0', fg_colour = '#1a1a2e' WHERE name ILIKE '%rest day%' OR name ILIKE '%pool day%' OR name ILIKE '%rest/pool%';
UPDATE parks SET bg_colour = '#ffb8c2', fg_colour = '#1a1a2e' WHERE name ILIKE '%travel%' OR name ILIKE '%arrival%' OR name ILIKE '%fly out%' OR name ILIKE '%departure%';
UPDATE parks SET bg_colour = '#d5caf8', fg_colour = '#1a1a2e' WHERE name ILIKE '%shopping%' OR name ILIKE '%dining%';
```

## Verification Query

After running updates, verify with:

```sql
SELECT name, bg_colour, fg_colour FROM parks ORDER BY name;
```

## Instructions for AI Assistant

1. Connect to the user's Supabase project (they'll provide credentials)
2. Run the SQL commands above in order
3. Verify the updates with the verification query
4. Report back which parks were updated and their new colors
5. If any parks weren't matched, list them so the user can review

## Notes
- Use `ILIKE` for case-insensitive matching
- The `%` wildcard matches any characters
- Some parks may have slightly different names in the database
- fg_colour should be white (#ffffff) for dark backgrounds, dark (#1a1a2e) for light backgrounds
- If a park isn't matched, it will keep its current color
