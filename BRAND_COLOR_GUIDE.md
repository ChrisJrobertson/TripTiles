# TripTiles Brand Color Guide for Parks

## Brand Palette (from logo)

| Color Name | Hex Code | Usage |
|------------|----------|-------|
| **Royal Blue** | `#2455ac` | Primary brand, Magic Kingdom alternative |
| **Vibrant Orange** | `#dd4e14` | CTAs, accents, Hollywood Studios |
| **Warm Cream** | `#fce7cc` | Background |
| **Bright Blue** | `#3fa2ec` | Links, EPCOT alternative |
| **Fresh Lime** | `#a2df56` | Success, Animal Kingdom alternative |
| **Soft Sky** | `#c0d5e0` | Secondary backgrounds |
| **Light Cyan** | `#c3f5fd` | Highlights |
| **Soft Pink** | `#ffb8c2` | Accent, Epic Universe alternative |
| **Lavender** | `#d5caf8` | Accent, purple parks |

## Recommended Park Colors (for Database)

To make parks visually distinct while staying on-brand:

### Disney Parks
| Park | bg_colour | fg_colour | Notes |
|------|-----------|-----------|-------|
| **Magic Kingdom** | `#2455ac` | `#ffffff` | Royal blue - classic Disney |
| **EPCOT** | `#3fa2ec` | `#ffffff` | Bright blue - futuristic |
| **Hollywood Studios** | `#dd4e14` | `#ffffff` | Vibrant orange - action/movies |
| **Animal Kingdom** | `#a2df56` | `#1a1a2e` | Fresh lime - nature theme |

### Universal Parks
| Park | bg_colour | fg_colour | Notes |
|------|-----------|-----------|-------|
| **Universal Studios** | `#5e35b1` | `#ffffff` | Deep purple - slightly off-brand but distinct |
| **Islands of Adventure** | `#009688` | `#ffffff` | Teal - distinct from others |
| **Epic Universe** | `#d5caf8` | `#1a1a2e` | Lavender - magical/futuristic |

### Other Common Parks
| Park | bg_colour | fg_colour | Notes |
|------|-----------|-----------|-------|
| **Rest/Pool Day** | `#c0d5e0` | `#1a1a2e` | Soft sky - calming |
| **Travel/Arrival** | `#ffb8c2` | `#1a1a2e` | Soft pink - distinct marker |
| **Disneyland Park** | `#f06292` | `#ffffff` | Pink castle vibe |
| **Disney California Adventure** | `#f9a825` | `#1a1a2e` | Golden California sun |

## Color Contrast Guidelines

- Use **white (`#ffffff`)** text on dark/vibrant backgrounds (royal, orange, bright blue, purple, teal)
- Use **dark (`#1a1a2e`)** text on light backgrounds (lime, cream, sky, lavender, pink)

## Updating Park Colors

To update park colors in your database, run SQL like:

```sql
-- Example: Update Magic Kingdom
UPDATE parks 
SET bg_colour = '#2455ac', fg_colour = '#ffffff'
WHERE name ILIKE '%magic kingdom%';

-- Example: Update Hollywood Studios
UPDATE parks 
SET bg_colour = '#dd4e14', fg_colour = '#ffffff'
WHERE name ILIKE '%hollywood studios%';

-- Example: Update Animal Kingdom
UPDATE parks 
SET bg_colour = '#a2df56', fg_colour = '#1a1a2e'
WHERE name ILIKE '%animal kingdom%';
```

Or use the Supabase dashboard to edit the `parks` table directly.
