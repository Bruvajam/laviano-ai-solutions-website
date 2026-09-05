# Laviano AI — Talking Website

One-page site for **Laviano AI Solutions** with the Retell voice agent embedded, so
visitors can talk to the assistant and book a discovery call without leaving the page.

Static HTML/CSS/JS. No build step, no dependencies.

## Design language

Ported by hand from the `v0-boty` template (a v0 / Next.js / shadcn skincare shop),
recoloured to the Laviano brand. Nothing from that project is installed or imported —
it needs Node, which this machine does not have. What was carried across:

- **Type**: Playfair Display (600) for display, DM Sans (300–500) for body
- **Reveals**: the `blur-in` keyframe (opacity + `blur(12px)` + rise), staggered by
  `data-delay`; cards use `scale-fade-in` via `data-reveal="scale"`
- **Surfaces**: `rounded-3xl` radii and the six-layer low-alpha soft shadow
- **Nav**: floating translucent glass pill with backdrop blur
- **Layout**: asymmetric bento grid for "Why Laviano", wide letter-spaced eyebrows,
  hero scroll cue

## Preview locally

```powershell
powershell -ExecutionPolicy Bypass -File "_serve.ps1" -Port 8787
```

Then open <http://127.0.0.1:8787/>.

A real server (not `file://`) is required — the browser only grants microphone
access over `http://localhost` or HTTPS.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole page, including the Retell widget script tag |
| `assets/styles.css` | Design system and layout |
| `assets/app.js` | Scroll reveals, live hours, mic pre-flight, widget launch |
| `assets/favicon.svg` | Brand mark |
| `og-image.png` | Social share image |
| `_serve.ps1` | Local preview server |
| `.env` | Secrets — gitignored, never commit |

## Voice agent

| | |
| --- | --- |
| Agent ID | `agent_e61f39ec459ecfb92da7763049` |
| LLM ID | `llm_71592a9aeddfc51e6236da8255b0` |
| Voice | `retell-Maren` |
| Booking | Cal.com "Discovery Call", event type `6882095`, `America/Toronto` |
| Transfers to | The number set on the agent's `transfer_call` tool (Retell dashboard) |

The agent answers questions about services, pricing, hours, and setup, then checks
real Cal.com availability and books the 20-minute discovery call on the calendar.

The site and the agent both deliberately withhold a company phone number and
location — email and the booked call are the contact paths. The transfer tool still
dials a real number, but the agent never reads it out.

### Before this works on a live domain

Add the site's domain (and `localhost`) to the allowed domains list for the public
key in the Retell dashboard under **Keys → Public Keys**. The widget will not load
on an unlisted domain.

### Cal.com tooling deprecation

The agent uses Retell's built-in `check_availability_cal` / `book_appointment_cal`
tools. Retell freezes these on **2026-09-30** and migrates them to the Cal.com
integration on **2026-10-31**. Existing tools keep running through the migration,
but the API key on them cannot be edited after 09/30. To move early, connect
Cal.com on the dashboard's Integrations page and swap in the **Check Availability**
and **Book Appointment** integration tools.

## Editing business facts

Hours, prices, and phone number appear in three places that must stay in sync:

1. `index.html` — visible copy and the JSON-LD block
2. The agent's prompt (Retell dashboard, or `update-retell-llm`)
3. Cal.com availability, which drives the times the agent actually offers
