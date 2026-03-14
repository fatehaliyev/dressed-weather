<div align="center">

# Dressed.

**Weather that tells you what to wear.**

[![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](https://github.com/fatehaliyev/dressed-weather/blob/main/LICENSE)

</div>

---

> Most weather apps tell you the temperature. **Dressed.** tells you what to do about it.

---

## Demo

https://github.com/user-attachments/assets/557a657a-f0eb-438b-9ace-ad92b46a2906

---

## Screenshots

<div align="center">

<table>
  <tr>
    <td align="center"><b>Main Screen</b></td>
    <td align="center"><b>°F Mode — New York</b></td>
    <td align="center"><b>City Search</b></td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/fatehaliyev/dressed-weather/main/ss_main.png" width="200"/></td>
    <td><img src="https://raw.githubusercontent.com/fatehaliyev/dressed-weather/main/ss_newyork.png" width="200"/></td>
    <td><img src="https://raw.githubusercontent.com/fatehaliyev/dressed-weather/main/ss_search.png" width="200"/></td>
  </tr>
  <tr>
    <td align="center"><b>Smart Warnings</b></td>
    <td align="center"><b>7-Day Forecast & Chart</b></td>
    <td align="center"><b>Language Picker</b></td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/fatehaliyev/dressed-weather/main/ss_warnings.png" width="200"/></td>
    <td><img src="https://raw.githubusercontent.com/fatehaliyev/dressed-weather/main/ss_forecast.png" width="200"/></td>
    <td><img src="https://raw.githubusercontent.com/fatehaliyev/dressed-weather/main/ss_language.png" width="200"/></td>
  </tr>
</table>

</div>

---

## What is Dressed.?

Dressed. is a weather web app built around one simple idea: weather data should translate directly into real-world decisions — starting with what you put on in the morning.

You open the app, it reads your location (or you search a city), and instead of just showing you "18°C, partly cloudy" it says: *light jacket, long sleeve, maybe bring an umbrella — here's why.*

Everything is derived purely from public APIs. No backend. No auth. No database. Just smart logic on the frontend.

---

## Features

### 🌤️ Real-Time Weather
- Current temperature, feels-like, humidity, wind speed, UV index
- Live clock synced to the searched city's timezone
- Animated temperature counter on data load
- Skeleton loading state while fetching

### 👔 Outfit Recommendations
- 6-level clothing system (freezing → scorching) based on feels-like temperature, not just the raw number
- Dynamic clothing tags (heavy coat, thermals, shorts, sunglasses, umbrella...)
- Storm detection overrides — heavy rain means no sandals regardless of temperature
- 8-point **Insights panel** combining temp swing, precipitation, UV, wind, and feels-like into human-readable advice

### ⚠️ Smart Weather Warnings
- Grouped warning cards for precipitation, wind, and temperature
- Time-range detection — warns you *when* wind peaks, not just that it will
- Detects: thunderstorms, heavy/light rain, drizzle, snow, fog, extreme heat, near-freezing, wind chill, humidity, black ice risk, evening drops, and large daily swings

### 📅 7-Day Forecast
- Expandable rows per day with condition, high/low, rain chance, sunrise & sunset
- Temperature bar scaled relative to the week's global min/max
- Clicking a forecast day re-renders the full UI — outfit, story, insights, hourly strip, and warnings all update
- "← Back to Today" badge to return to current view

### ⏱️ Hourly Strip & Temperature Chart
- 24-hour scrollable strip with icons and temperatures
- Clicking any hour updates the main widget to that hour's conditions
- Chart.js line chart showing the temperature curve for the selected day

### 🌍 Multi-Language Support
- **7 languages**: English, Azerbaijani, Turkish, German, French, Russian, Spanish
- Language picker modal with flag icons on first launch
- All UI labels, outfit text, warnings, story card, and insights are fully translated
- Language preference saved to `localStorage`

### 🧭 City Search & Autocomplete
- Live autocomplete powered by Open-Meteo Geocoding API (300ms debounce)
- Region and country shown in suggestions
- Recent searches stored locally (last 3 cities)
- GPS button for instant current location

### °C / °F Toggle
- Instant unit switching without re-fetching
- All temperatures recalculate in real-time including the chart

---

## Tech Stack

| Layer | Tech |
|---|---|
| Structure | HTML5 (semantic) |
| Styling | Vanilla CSS3 (custom properties, flexbox, grid) |
| Logic | Vanilla JavaScript (ES2020+, async/await, DOM API) |
| Charts | [Chart.js](https://www.chartjs.org/) via CDN |
| Weather Data | [Open-Meteo API](https://open-meteo.com/) — free, no key required |
| Geocoding | [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) |
| Fonts | Google Fonts — DM Sans + DM Serif Display |
| Flags | [flagcdn.com](https://flagcdn.com/) |
| Storage | `localStorage` (language, unit, recent cities) |

**No frameworks. No build tools. No npm. No API keys.**

---

## How It Works

### Data Flow

```
fetchData(lat, lon)
  → Open-Meteo API (single request — current + 8 days hourly + daily)
  → renderUI(data)
      ├── updateMainWidget()          // temp, condition, stats
      ├── renderOutfit()              // 6-level clothing engine
      ├── renderInsights()            // 8-point insight rows
      ├── renderStory()               // narrative day summary
      ├── computeAndRenderWarnings()  // grouped smart alerts with time ranges
      ├── renderHourlyAndChart()      // hourly strip + Chart.js curve
      └── renderWeeklyForecast()      // 7-day expandable rows
```

The entire 8-day API response is stored in memory. Every user interaction (clicking a forecast day, selecting an hour, toggling °C/°F) re-renders from cached data — no extra fetches.

### Outfit Engine

The outfit level is determined by the **effective minimum temperature** — the lower of the day's minimum and the current feels-like. This prevents suggesting summer clothing on a cold windy morning just because the afternoon will be warm.

```
effectiveMin = min(daily_min, current_feels_like)

≤  0°C  →  Level 1: Heavy thermals, serious winter coat, boots
≤  8°C  →  Level 2: Winter coat, sweater, gloves
≤ 15°C  →  Level 3: Light jacket or hoodie
≤ 20°C  →  Level 4: Long sleeve, chinos
≤ 25°C  →  Level 5: T-shirt, jeans
>  25°C →  Level 6: Light breathable fabrics, shorts
```

Heavy storm codes (80, 81, 82, 95, 96, 99) automatically downgrade warm levels to at least Level 3.

### Warning System

Warnings are grouped into three categories:

- **Precipitation** — Storm, rain (heavy/moderate/light), drizzle, snow, fog
- **Wind** — Gusts by threshold (25 / 45 / 60 km/h), wind chill
- **Temperature** — Extreme heat, near-freezing, black ice, humidity, big swing, evening drop

Each warning extracts **time ranges** from the hourly data via a `findRanges()` function that scans for consecutive matching hours — so users see *"⛈️ Thunderstorm risk. (14:00–18:00)"* instead of a vague all-day alert.

---

## Getting Started

No installation needed — fully static frontend.

```bash
git clone https://github.com/fatehaliyev/dressed-weather.git
cd dressed-weather
open index.html
```

Or serve locally:

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Open `http://localhost:8000`, allow location access or use the search bar.

---

## Project Structure

```
dressed-weather/
├── index.html        # App shell — layout, skeleton, HTML templates
├── style.css         # All styling — variables, components, animations
├── app.js            # All logic — fetch, render, warnings, outfit, chart
└── translations.js   # 7-language string definitions
```

---

## API Reference

Uses [Open-Meteo](https://open-meteo.com/) — free, no account needed.

**Weather:**
```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}&longitude={lon}
  &current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index,is_day,...
  &hourly=temperature_2m,weather_code,precipitation_probability,...
  &daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,...
  &timezone=auto&forecast_days=8
```

**Geocoding:**
```
GET https://geocoding-api.open-meteo.com/v1/search
  ?name={city}&count=5&language={lang}&format=json
```

WMO weather codes are interpreted locally via a lookup table mapping codes to emoji and translated descriptions.

---

## Roadmap

- [ ] PWA support (offline + installable)
- [ ] Severe weather push notifications
- [ ] Weather map layer
- [ ] More languages

---

## License

MIT — use it, fork it, build on it.

---

<div align="center">

Built with vanilla JS, zero dependencies, and an obsession with useful design.

**[⭐ Star this repo](https://github.com/fatehaliyev/dressed-weather)** if you found it useful.

</div>

