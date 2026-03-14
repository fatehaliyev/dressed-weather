// State
let currentLang = localStorage.getItem('dressed_lang') || 'en';
let currentWeatherData = null;
let currentUnit = localStorage.getItem('dressed_unit') || 'c';
let currentLocName = 'Current Location';
let currentHourlyIndex = 0;
let currentTimezoneId = null;
let chartInstance = null;

try { currentTimezoneId = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const GEO_URL  = 'https://geocoding-api.open-meteo.com/v1/search';

const DOM = {
    langModal:    document.getElementById('lang-modal'),
    langGrid:     document.getElementById('lang-grid'),
    btnLang:      document.getElementById('open-lang-btn'),
    uiChooseLang: document.getElementById('ui-choose-lang'),
    loadingState: document.getElementById('loading-state'),
    contentState: document.getElementById('content-state'),
    errorState:   document.getElementById('error-state'),
    searchInput:  document.getElementById('city-search'),
    geoBtn:       document.getElementById('geo-btn'),
    clockDisplay: document.getElementById('clock-display'),
    warningsContainer: document.getElementById('warnings-container'),
    tplWarning:   document.getElementById('tpl-warning'),
    location:     document.getElementById('location-text'),
    temp:         document.getElementById('current-temp'),
    icon:         document.getElementById('current-icon'),
    condition:    document.getElementById('current-condition'),
    feels:        document.getElementById('stat-feels'),
    humidity:     document.getElementById('stat-humidity'),
    wind:         document.getElementById('stat-wind'),
    uv:           document.getElementById('stat-uv'),
    story:        document.getElementById('day-story'),
    outfitTags:   document.getElementById('outfit-tags'),
    outfitHeadline: document.getElementById('outfit-headline'),
    outfitAdvice: document.getElementById('outfit-advice'),
    hourlyScroll: document.getElementById('hourly-scroll'),
    sunrise:      document.getElementById('sunrise-time'),
    sunset:       document.getElementById('sunset-time'),
    lastUpdated:  document.getElementById('last-updated'),
    lblFeels:     document.getElementById('lbl-feels'),
    lblHumidity:  document.getElementById('lbl-humidity'),
    lblWind:      document.getElementById('lbl-wind'),
    lblUv:        document.getElementById('lbl-uv'),
    lblOutfitTitle:  document.getElementById('lbl-outfit-title'),
    lblStoryTitle:   document.getElementById('lbl-story-title'),
    lblChartTitle:   document.getElementById('lbl-chart-title'),
    lblSunrise:      document.getElementById('lbl-sunrise'),
    lblSunset:       document.getElementById('lbl-sunset')
};

// --- Helpers ---

function convertTemp(c) {
    if (currentUnit === 'f') return (c * 9/5) + 32;
    return c;
}

function formatTemp(c) {
    return Math.round(convertTemp(c));
}

function formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function animateTemp(element, target) {
    const isF = currentUnit === 'f';
    const targetVal = isF ? Math.round((target * 9/5) + 32) : Math.round(target);
    let current = 0;
    const step = Math.max(1, Math.round(Math.abs(targetVal) / 30));
    element.textContent = "0";
    clearInterval(element._timer);
    element._timer = setInterval(() => {
        if (current < targetVal)      { current += step; if (current > targetVal) current = targetVal; }
        else if (current > targetVal) { current -= step; if (current < targetVal) current = targetVal; }
        else { clearInterval(element._timer); }
        element.textContent = current;
    }, 30);
}

function getWeatherDetails(code, isDay = true) {
    const t = translations[currentLang].weather;
    const wmo = {
        0:  { desc: t.clear,         icon: isDay ? '☀️' : '🌙' },
        1:  { desc: t.mainlyClear,   icon: isDay ? '🌤️' : '🌙' },
        2:  { desc: t.partlyCloudy,  icon: isDay ? '⛅' : '🌙' },
        3:  { desc: t.overcast,      icon: isDay ? '☁️' : '🌙' },
        45: { desc: t.fog,           icon: '🌫️' },
        48: { desc: t.fog,           icon: '🌫️' },
        51: { desc: t.drizzle,       icon: '🌦️' },
        53: { desc: t.drizzle,       icon: '🌦️' },
        55: { desc: t.drizzle,       icon: '🌦️' },
        56: { desc: t.drizzle,       icon: '🌧️' },
        57: { desc: t.drizzle,       icon: '🌧️' },
        61: { desc: t.rain,          icon: '🌧️' },
        63: { desc: t.rain,          icon: '🌧️' },
        65: { desc: t.rain,          icon: '🌧️' },
        66: { desc: t.rain,          icon: '🌧️' },
        67: { desc: t.rain,          icon: '🌧️' },
        71: { desc: t.snow,          icon: '🌨️' },
        73: { desc: t.snow,          icon: '🌨️' },
        75: { desc: t.snow,          icon: '❄️' },
        77: { desc: t.snow,          icon: '❄️' },
        80: { desc: t.showers,       icon: '🌧️' },
        81: { desc: t.showers,       icon: '🌧️' },
        82: { desc: t.showers,       icon: '⛈️' },
        85: { desc: t.showers,       icon: '🌨️' },
        86: { desc: t.showers,       icon: '❄️' },
        95: { desc: t.thunderstorm,  icon: '⛈️' },
        96: { desc: t.thunderstorm,  icon: '🌩️' },
        99: { desc: t.thunderstorm,  icon: '🌩️' }
    };
    return wmo[code] || { desc: t.clear, icon: '☀️' };
}

// Returns localized "X hours until midnight" label for the story card
function midnightLabel(hoursLeft) {
    const labels = {
        en: h => h === 0 ? 'Less than an hour until midnight.' : `${h} hour${h === 1 ? '' : 's'} left until midnight.`,
        az: h => h === 0 ? 'Günün sonuna az qalıb.' : `Günün bitməsinə ${h} saat qalıb.`,
        tr: h => h === 0 ? 'Günün sonuna az kaldı.' : `Günün bitmesine ${h} saat kaldı.`,
        de: h => h === 0 ? 'Fast Mitternacht.' : `Noch ${h} Stunde${h === 1 ? '' : 'n'} bis Mitternacht.`,
        fr: h => h === 0 ? 'Presque minuit.' : `${h} heure${h === 1 ? '' : 's'} avant minuit.`,
        ru: h => h === 0 ? 'До полуночи совсем мало.' : `До полуночи осталось ${h} ч.`,
        es: h => h === 0 ? 'Casi medianoche.' : `Quedan ${h} hora${h === 1 ? '' : 's'} para medianoche.`
    };
    const fn = labels[currentLang] || labels.en;
    return `<span style="font-size:13px;opacity:0.5;display:block;margin-top:14px;font-family:var(--font-sans);font-style:normal;font-weight:500;letter-spacing:0.3px;">${fn(hoursLeft)}</span>`;
}

// --- UI State ---

function showLoading() {
    DOM.loadingState.style.display = 'flex';
    DOM.contentState.style.display = 'none';
    DOM.errorState.style.display = 'none';
}

function showEnableLocation() {
    DOM.loadingState.style.display = 'none';
    DOM.contentState.style.display = 'none';
    DOM.errorState.style.display = 'block';
    DOM.errorState.textContent = translations[currentLang]?.ui?.enableLocation || "Please enable location or search for a city";
}

// --- Language ---

function initLangModal() {
    DOM.langGrid.innerHTML = '';
    Object.keys(translations).forEach(key => {
        const lang = translations[key];
        const btn = document.createElement('button');
        btn.className = `lang-pill ${key === currentLang ? 'active' : ''}`;
        btn.innerHTML = `<img src="https://flagcdn.com/w40/${lang.flagCode}.png" width="20" style="border-radius:2px; box-shadow: 0 1px 3px rgba(0,0,0,0.2)"> ${lang.name}`;
        btn.onclick = () => {
            const isFirstVisit = !localStorage.getItem('dressed_lang');
            currentLang = key;
            localStorage.setItem('dressed_lang', key);
            updateLangUI();
            closeLangModal();
            if (isFirstVisit) {
                startApp();
            } else if (currentWeatherData) {
                renderUI(currentWeatherData);
            }
        };
        DOM.langGrid.appendChild(btn);
    });
}

function updateLangUI() {
    const t = translations[currentLang].ui;
    DOM.uiChooseLang.textContent   = t.chooseLang;
    DOM.searchInput.placeholder    = t.searchPlaceholder;
    DOM.lblFeels.textContent       = t.feelsLike;
    DOM.lblHumidity.textContent    = t.humidity;
    DOM.lblWind.textContent        = t.wind;
    DOM.lblUv.textContent          = t.uv;
    DOM.lblOutfitTitle.textContent = t.outfitTitle;
    DOM.lblStoryTitle.textContent  = t.storyTitle;
    DOM.lblChartTitle.textContent  = t.chartTitle;
    DOM.lblSunrise.textContent     = t.sunrise;
    DOM.lblSunset.textContent      = t.sunset;

    const lblForecast = document.getElementById('lbl-forecast-title');
    if (lblForecast) lblForecast.textContent = t.forecastTitle || '7-DAY FORECAST';

    if (DOM.errorState.style.display === 'block' || DOM.errorState.style.display === 'flex') {
        DOM.errorState.textContent = t.enableLocation;
    }

    initLangModal();
}

function openLangModal()  { DOM.langModal.classList.add('visible'); }
function closeLangModal() { DOM.langModal.classList.remove('visible'); }

// --- Clock ---

function updateClock() {
    const opts = { hour: '2-digit', minute: '2-digit', hour12: false };
    if (currentTimezoneId) opts.timeZone = currentTimezoneId;
    try {
        DOM.clockDisplay.textContent = new Date().toLocaleTimeString([], opts);
    } catch (e) {
        DOM.clockDisplay.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
}

// --- Warnings ---

function updateWarningsVisibility() {
    if (!DOM.warningsContainer) return;
    const empty = DOM.warningsContainer.children.length === 0;
    DOM.warningsContainer.style.display = empty ? 'none' : '';
}

function computeAndRenderWarnings(ctx) {
    const { daily, hourly, current, dayIdx = 0, isToday = true, t } = ctx || {};
    if (!DOM.warningsContainer || !daily || !hourly || !t) return;

    const container = DOM.warningsContainer;
    container.innerHTML = '';

    const w = t.warnings || {};

    const warnGroups = {
        precip: [], // Storm, Rain, Snow, Drizzle, Fog
        wind:   [], // Wind speed, Wind chill
        temp:   []  // Heat, Humidity, Near freezing, Ice, Swing, Drop
    };

    const addWarn = (emoji, text) => {
        if (!text) return;
        const clone = DOM.tplWarning.content.cloneNode(true);
        // Use innerHTML to allow line breaks or specific formatting if needed, 
        // but textContent is safer if we just join with characters.
        clone.querySelector('.warning-text').textContent = emoji ? `${emoji}  ${text}` : text;
        container.appendChild(clone);
    };

    const pushWarn = (grp, emoji, text) => {
        if (!text) return;
        warnGroups[grp].push({ emoji, text });
    };

    const dayStart = dayIdx * 24;
    const dayEnd   = Math.min(dayStart + 24, hourly.time ? hourly.time.length : dayStart);
    if (dayEnd <= dayStart) { updateWarningsVisibility(); return; }

    const hSlice = arr => arr ? arr.slice(dayStart, dayEnd) : [];
    const hTimes = hSlice(hourly.time);

    const fmtHour = iso => {
        try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); }
        catch (e) { return ''; }
    };

    const findRanges = (arr, testFn, valFn) => {
        const ranges = [];
        let inRange = false, rangeStart = 0, peakVal = 0, peakIdx = 0;
        for (let i = 0; i < arr.length; i++) {
            if (testFn(arr[i], i)) {
                if (!inRange) { inRange = true; rangeStart = i; peakVal = valFn ? valFn(arr[i]) : arr[i]; peakIdx = i; }
                else if (valFn && valFn(arr[i]) > peakVal) { peakVal = valFn(arr[i]); peakIdx = i; }
            } else if (inRange) {
                ranges.push({ start: rangeStart, end: i - 1, peak: peakVal, peakIdx });
                inRange = false;
            }
        }
        if (inRange) ranges.push({ start: rangeStart, end: arr.length - 1, peak: peakVal, peakIdx });
        return ranges;
    };

    const rangeStr = r => {
        const s = fmtHour(hTimes[r.start]);
        const e = fmtHour(hTimes[r.end]);
        if (!s) return '';
        return s === e || r.start === r.end ? s : `${s}–${e}`;
    };

    const toTimeDetail = ranges => {
        if (!ranges.length || !hTimes.length) return '';
        const times = ranges.map(r => rangeStr(r)).filter(Boolean);
        return times.length ? ` (${times.join(', ')})` : '';
    };

    const todayMin  = Math.round(daily.temperature_2m_min[dayIdx]);
    const todayMax  = Math.round(daily.temperature_2m_max[dayIdx]);
    const dailyCode = daily.weather_code[dayIdx];
    const swing     = todayMax - todayMin;

    const temps      = hSlice(hourly.temperature_2m).map(Math.round);
    const appTemps   = hSlice(hourly.apparent_temperature || []).map(v => Math.round(v));
    const wcodes     = hSlice(hourly.weather_code);
    const precipProb = hSlice(hourly.precipitation_probability);
    const windSpeeds = hSlice(hourly.wind_speed_10m);
    const humids     = hSlice(hourly.relative_humidity_2m);

    const dailyPrecipMax = daily.precipitation_probability_max?.[dayIdx] ?? 0;
    const maxPrecip = Math.max(dailyPrecipMax, precipProb.length ? Math.max(...precipProb) : 0);

    const rainCodes    = [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99];
    const snowCodes    = [71,73,75,77,85,86];
    const stormCodes   = [95,96,99];
    const fogCodes     = [45,48];
    const drizzleCodes = [51,53,55,56,57];

    const hasRainCode = wcodes.some(c => rainCodes.includes(c))  || rainCodes.includes(dailyCode);
    const hasSnowCode = wcodes.some(c => snowCodes.includes(c))  || snowCodes.includes(dailyCode);
    const hasStorm    = wcodes.some(c => stormCodes.includes(c)) || stormCodes.includes(dailyCode);
    const hasFog      = wcodes.some(c => fogCodes.includes(c))   || fogCodes.includes(dailyCode);
    const hasDrizzle  = wcodes.some(c => drizzleCodes.includes(c));

    // --- Collect Precipitation & Visibility ---
    if (hasStorm) {
        const ranges = findRanges(wcodes, c => stormCodes.includes(c));
        pushWarn('precip', '⛈️', (w.storm || 'Thunderstorm risk.') + toTimeDetail(ranges));
    } else if (hasRainCode || maxPrecip >= 20) {
        const ranges = findRanges(wcodes, c => rainCodes.includes(c), c => c);
        const isHeavy = wcodes.some(c => [65,67,82].includes(c)) || maxPrecip >= 70;
        const isMod   = wcodes.some(c => [63,66,81,61].includes(c)) || maxPrecip >= 45;
        const msg = isHeavy ? (w.rainHeavy || w.rain || 'Heavy rain.')
                  : isMod   ? (w.rain || 'Rain expected.')
                  :           (w.rainLight || w.rain || 'Light rain.');
        pushWarn('precip', '🌧️', msg + toTimeDetail(ranges));
    } else if (hasDrizzle && maxPrecip >= 15) {
        const ranges = findRanges(wcodes, c => drizzleCodes.includes(c));
        pushWarn('precip', '🌦️', (w.rainLight || w.rain || 'Light drizzle possible.') + toTimeDetail(ranges));
    }

    if (hasSnowCode && !hasStorm) {
        const ranges = findRanges(wcodes, c => snowCodes.includes(c));
        const isHeavy = wcodes.some(c => [75,77,86].includes(c)) || maxPrecip >= 60;
        pushWarn('precip', '❄️', (isHeavy ? (w.snowHeavy || 'Heavy snow.') : (w.snowLight || 'Light snow.')) + toTimeDetail(ranges));
    }

    if (hasFog) {
        const ranges = findRanges(wcodes, c => fogCodes.includes(c));
        pushWarn('precip', '🌫️', (w.fog || 'Dense fog expected — reduced visibility.') + toTimeDetail(ranges));
    }

    // --- Collect Wind ---
    if (windSpeeds.length) {
        const maxWind = Math.round(Math.max(...windSpeeds));
        if (maxWind >= 25) {
            const threshold = maxWind >= 45 ? 45 : 25;
            const ranges = findRanges(windSpeeds, v => v >= threshold, v => v);
            const msg = maxWind >= 60 ? (w.windExtreme || w.windStrong || w.wind || `Extreme wind up to ${maxWind} km/h.`)
                      : maxWind >= 45 ? (w.windStrong || w.wind || `Strong gusts up to ${maxWind} km/h.`)
                      :                 (w.wind || `Wind up to ${maxWind} km/h.`);
            pushWarn('wind', '💨', msg + toTimeDetail(ranges));
        }
    }

    // --- Collect Temp & Feels ---
    if (appTemps.length && temps.length) {
        const minApp    = Math.min(...appTemps);
        const minActual = Math.min(...temps);
        if (minActual - minApp >= 5 && minApp <= 8) {
            const ranges = findRanges(appTemps, v => (minActual - v) >= 4 && v <= 10);
            pushWarn('wind', '🥶', (w.coldFeel || `Feels like ${minApp}° — wind chill bites hard.`) + toTimeDetail(ranges));
        }

        const maxApp    = Math.max(...appTemps);
        const maxActual = Math.max(...temps);
        if (maxApp - maxActual >= 4 && maxApp >= 30) {
            const ranges = findRanges(appTemps, v => v >= 30 && (v - (temps[appTemps.indexOf(v)] || v)) >= 3);
            pushWarn('temp', '🌢️', (w.hotHumid || `Feels like ${maxApp}° — humidity makes it muggy.`) + toTimeDetail(ranges));
        }
    }

    if (humids.length && !hasRainCode && !hasSnowCode) {
        const maxHumid = Math.max(...humids);
        if (maxHumid >= 85 && todayMax >= 22) {
            pushWarn('temp', '💧', w.humid || w.hotHumid || `High humidity (${maxHumid}%) — heavier than the temperature suggests.`);
        }
    }

    if (todayMax >= 35) {
        const ranges = findRanges(temps, v => v >= 35);
        pushWarn('temp', '🔥', (w.heatExtreme || `Extreme heat — ${formatTemp(todayMax)}${currentUnit === 'f' ? '°F' : '°C'}. Stay hydrated.`) + toTimeDetail(ranges));
    } else if (todayMax >= 30) {
        pushWarn('temp', '☀️', w.heat || `Hot day ahead — peak ${formatTemp(todayMax)}${currentUnit === 'f' ? '°F' : '°C'}.`);
    }

    if (todayMin < 3) {
        const ranges = findRanges(temps, v => v < 3);
        pushWarn('temp', '🧊', (w.coldExtreme || 'Near freezing — dress very warm.') + toTimeDetail(ranges));

        if (todayMin < -1) {
            const precipCodes = [...rainCodes, ...snowCodes];
            const iceHours = temps.map((v, i) => v < -1 && precipCodes.includes(wcodes[i]));
            const iceRanges = findRanges(iceHours, v => v === true);
            if (iceRanges.length) {
                pushWarn('temp', '⚠️', (w.iceRisk || 'Freezing precipitation — black ice possible.') + toTimeDetail(iceRanges));
            }
        }
    }

    if (swing >= 12) {
        pushWarn('temp', '🌡️', w.swing || `${swing}° swing today — dress in layers.`);
    }

    if (swing > 8 && todayMin < 14) {
        const threshold = todayMin + 4;
        const dropRanges = findRanges(temps, (v, i) => i >= Math.floor(temps.length * 0.5) && v <= threshold);
        let timeDetail = '';
        if (dropRanges.length && hTimes.length) {
            const t0 = rangeStr(dropRanges[0]);
            if (t0) timeDetail = ` (from ${t0})`;
        }
        pushWarn('temp', '🌙', (w.drop || 'Evening gets cold fast — take a jacket.') + timeDetail);
    }

    // --- Render Combined Groups ---
    const renderGroup = (grp, mainEmoji) => {
        const items = warnGroups[grp];
        if (items.length === 0) return;
        
        // Combine all messages into one card
        const combinedText = items.map(it => `${it.emoji} ${it.text}`).join(' • ');
        addWarn(mainEmoji, combinedText);
    };

    renderGroup('precip', '⚠️');
    renderGroup('wind',   '💨');
    renderGroup('temp',   '🌡️');

    updateWarningsVisibility();
}

// --- Outfit (shared between renderUI and selectForecastDay) ---

function renderOutfit(dayIdx, data) {
    const daily  = data.daily;
    const hourly = data.hourly;
    const t      = translations[currentLang];
    const isToday = dayIdx === 0;

    const todayMin = Math.round(daily.temperature_2m_min[dayIdx]);
    const todayMax = Math.round(daily.temperature_2m_max[dayIdx]);
    const code     = daily.weather_code[dayIdx];

    // For today, factor in current feels-like so we don't suggest t-shirts on a windy cold morning
    let effectiveMin = todayMin;
    if (isToday && data.current) {
        const curFeels = Math.round(data.current.apparent_temperature || data.current.temperature_2m);
        effectiveMin = Math.min(todayMin, curFeels);
    }

    const dayStart = dayIdx * 24;
    const dayEnd   = Math.min(dayStart + 24, hourly.precipitation_probability.length);
    const isRaining   = hourly.precipitation_probability.slice(dayStart, dayEnd).some(p => p > 40)
                     || [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code);
    const isHeavyStorm = [80,81,82,85,86,95,96,99].includes(code);

    let outLevel = 'level6';
    if (effectiveMin <= 0)       outLevel = 'level1';
    else if (effectiveMin <= 8)  outLevel = 'level2';
    else if (effectiveMin <= 15) outLevel = 'level3';
    else if (effectiveMin <= 20) outLevel = 'level4';
    else if (effectiveMin <= 25) outLevel = 'level5';
    if (isHeavyStorm && (outLevel === 'level5' || outLevel === 'level6')) outLevel = 'level3';

    const oData = t.outfit[outLevel];
    DOM.outfitHeadline.textContent = oData.head;

    let outfitText = oData.text
        .replace('{high}', formatTemp(todayMax))
        .replace('{low}', formatTemp(todayMin))
        .replace(/{unit}/g, currentUnit === 'f' ? '°F' : '°C');
        
    if (isRaining && outLevel !== 'level1' && outLevel !== 'level2') {
        outfitText += ' ' + (t.warnings.rain || '');
    }
    DOM.outfitAdvice.textContent = outfitText;

    // Clothing tags
    DOM.outfitTags.innerHTML = '';
    const tags = [];
    const cl   = t.clothes;

    if (effectiveMin <= 0) {
        tags.push({ icon: '🧥', label: cl.heavyCoat });
        tags.push({ icon: '🧣', label: cl.thermal });
        tags.push({ icon: '🧤', label: cl.gloves });
    } else if (effectiveMin <= 8) {
        tags.push({ icon: '🧥', label: cl.winterCoat });
        tags.push({ icon: '🧶', label: cl.sweater });
        tags.push({ icon: '🧤', label: cl.gloves });
    } else if (effectiveMin <= 15) {
        tags.push({ icon: '🧥', label: cl.lightJacket });
        tags.push({ icon: '🥼', label: cl.hoodie });
        if (todayMax >= 20) tags.push({ icon: '👕', label: cl.tShirt });
    } else if (effectiveMin <= 20) {
        tags.push({ icon: '👔', label: cl.longSleeve });
        tags.push({ icon: '👕', label: cl.tShirt });
    } else if (effectiveMin <= 25) {
        if (isHeavyStorm) {
            tags.push({ icon: '🥼', label: cl.hoodie });
            tags.push({ icon: '👕', label: cl.tShirt });
        } else {
            tags.push({ icon: '👕', label: cl.tShirt });
            tags.push({ icon: '🩳', label: cl.shorts });
        }
    } else {
        if (isHeavyStorm) {
            tags.push({ icon: '🥼', label: cl.hoodie });
            tags.push({ icon: '👕', label: cl.tShirt });
        } else {
            tags.push({ icon: '🎽', label: cl.sleeveless });
            tags.push({ icon: '🩳', label: cl.shorts });
        }
    }

    if (todayMax >= 20)  tags.push({ icon: '🕶️', label: cl.shades });
    if (isRaining)       tags.push({ icon: '☂️',  label: cl.umbrella });

    tags.forEach(tag => {
        const sp = document.createElement('div');
        sp.className = 'outfit-tag';
        sp.innerHTML = `<span class="tag-icon">${tag.icon}</span><span class="tag-label">${tag.label}</span>`;
        DOM.outfitTags.appendChild(sp);
    });
}

// --- Insights (outfit card sub-section) ---

function renderInsights(ctx) {
    const el = document.getElementById('outfit-insights');
    if (!el) return;
    el.innerHTML = '';

    const ins = translations[currentLang].ins;
    if (!ins) return;

    const rows  = [];
    const swing = ctx.max - ctx.min;

    // Temperature stability
    if (swing >= 15)     rows.push([ins.bigSwing[0],  ins.bigSwing[1].replace('{n}', swing)]);
    else if (swing >= 8) rows.push([ins.medSwing[0],  ins.medSwing[1].replace('{n}', swing)]);
    else                 rows.push(ins.stable);

    // Precipitation
    const isStorm     = [95,96,99,80,81,82].includes(ctx.code);
    const isHeavyRain = [65,67].includes(ctx.code);
    const isAnyRain   = [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(ctx.code);
    const isHeavySnow = [75,77,86].includes(ctx.code);
    const isAnySnow   = [71,73,75,77,85,86].includes(ctx.code);

    if (isStorm)          rows.push(ins.storm);
    else if (isHeavyRain) rows.push(ins.heavyRain);
    else if (isHeavySnow) rows.push(ins.heavySnow);
    else if (isAnySnow)   rows.push(ins.lightSnow);
    else if (isAnyRain)   rows.push(ins.lightRain);
    else if (ctx.precipNext2h >= 65) rows.push(ins.rainSoon);
    else if (ctx.precipNext2h >= 35) rows.push(ins.rainMaybe);
    else if (!ctx.hasUmbrella)       rows.push(ins.noPrecip);
    else                             rows.push(ins.umbreSkip);

    // Feels-like
    const feelDiff = ctx.feelsLike - ctx.temp;
    if (feelDiff <= -4) rows.push([ins.coldFeel[0], ins.coldFeel[1].replace('{feels}', ctx.feelsLike)]);
    else if (feelDiff >= 4) rows.push([ins.warmFeel[0], ins.warmFeel[1].replace('{feels}', ctx.feelsLike)]);

    // Wind
    if (ctx.wind >= 45)      rows.push([ins.strongWind[0], ins.strongWind[1].replace('{n}', Math.round(ctx.wind))]);
    else if (ctx.wind >= 25) rows.push([ins.breezy[0],     ins.breezy[1].replace('{n}',     Math.round(ctx.wind))]);

    // UV
    if (ctx.uv >= 8)      rows.push([ins.uvHigh[0], ins.uvHigh[1].replace('{n}', Math.round(ctx.uv))]);
    else if (ctx.uv >= 5) rows.push([ins.uvMed[0],  ins.uvMed[1].replace('{n}',  Math.round(ctx.uv))]);

    if (swing >= 10 && rows.length < 7)          rows.push(ins.layerTip);
    if (ctx.min <= ctx.temp - 8 && rows.length < 8) rows.push(ins.eveningDrop);
    if (ctx.min <= 0 && rows.length < 8)         rows.push(ins.coldToday);
    else if (!isAnyRain && !isAnySnow && ctx.max >= 22 && rows.length < 8) rows.push(ins.sunnyWarm);

    rows.slice(0, 8).forEach(([emoji, text]) => {
        const row = document.createElement('div');
        row.className = 'insight-row';
        row.innerHTML = `<span class="insight-emoji">${emoji}</span><span class="insight-text">${text}</span>`;
        el.appendChild(row);
    });
}

// --- Main widget (current stats display) ---

function updateMainWidget(hourIndex, data) {
    let temp, wcode, appTemp, hum, wind, uv, isDay;

    if (hourIndex === 0) {
        temp   = data.current.temperature_2m;
        wcode  = data.current.weather_code;
        appTemp = data.current.apparent_temperature;
        hum    = data.current.relative_humidity_2m;
        wind   = data.current.wind_speed_10m;
        uv     = data.current.uv_index;
        isDay  = data.current.is_day !== 0;
    } else {
        temp   = data.hourly.temperature_2m[hourIndex];
        wcode  = data.hourly.weather_code[hourIndex];
        appTemp = data.hourly.apparent_temperature[hourIndex];
        hum    = data.hourly.relative_humidity_2m[hourIndex];
        wind   = data.hourly.wind_speed_10m[hourIndex];
        uv     = data.hourly.uv_index ? data.hourly.uv_index[hourIndex] : 0;
        isDay  = data.hourly.is_day[hourIndex] !== 0;
    }

    animateTemp(DOM.temp, Math.round(temp));
    const wDetails = getWeatherDetails(wcode, isDay);
    DOM.icon.textContent      = wDetails.icon;
    DOM.condition.textContent = wDetails.desc;
    DOM.feels.textContent    = `${formatTemp(appTemp || 0)}°`;
    DOM.humidity.textContent = `${Math.round(hum || 0)}%`;
    DOM.wind.textContent     = `${Math.round(wind || 0)} km/h`;
    DOM.uv.textContent       = Math.round(uv || 0);

    // Update temp sign in hero
    const tempDegree = document.querySelector('.temp-degree');
    if (tempDegree) tempDegree.textContent = currentUnit === 'f' ? '°F' : '°';

    // Recompute warnings for the day that contains this hour
    if (data?.daily && data?.hourly) {
        const dayIdx = hourIndex > 0 ? Math.min(Math.floor(hourIndex / 24), data.daily.time.length - 1) : 0;
        computeAndRenderWarnings({
            daily: data.daily, hourly: data.hourly, current: data.current,
            dayIdx, isToday: dayIdx === 0, t: translations[currentLang]
        });
    }
}

// --- Hourly strip + chart ---

function renderHourlyAndChart(dayIdx, data, options = {}) {
    const fromUserSelection = options.fromUserSelection === true;
    const hourly = data.hourly;
    DOM.hourlyScroll.innerHTML = '';

    const dayStart  = dayIdx * 24;
    const isToday   = dayIdx === 0;
    const activeIdx = isToday ? currentHourlyIndex : Math.min(dayStart + 12, hourly.time.length - 1);

    const chartLabels = [];
    const chartData   = [];
    let displayCount  = 0;

    for (let i = dayStart; i < hourly.time.length && displayCount < 24; i++) {
        const dateObj = new Date(hourly.time[i]);
        const hourNum = dateObj.getHours();
        const temp    = Math.round(hourly.temperature_2m[i]);
        const icon    = getWeatherDetails(hourly.weather_code[i], hourly.is_day[i] !== 0).icon;

        chartLabels.push(`${hourNum}:00`);
        chartData.push(formatTemp(hourly.temperature_2m[i]));

        const item = document.createElement('div');
        item.className = `hourly-item ${i === activeIdx ? 'active' : ''}`;
        item.style.cursor = 'pointer';
        item.innerHTML = `
            <span class="hourly-time">${isToday && i === currentHourlyIndex ? 'Now' : hourNum + ':00'}</span>
            <span class="hourly-icon">${icon}</span>
            <span class="hourly-temp">${formatTemp(hourly.temperature_2m[i])}°</span>
        `;
        item.addEventListener('click', () => {
            document.querySelectorAll('.hourly-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            updateMainWidget(i, data);
        });

        DOM.hourlyScroll.appendChild(item);
        displayCount++;
    }

    // Small spacer at the end so last item isn't cut off
    const spacer = document.createElement('div');
    spacer.style.cssText = 'flex: 0 0 8px; min-width: 8px;';
    DOM.hourlyScroll.appendChild(spacer);

    // Chart
    if (chartInstance) chartInstance.destroy();
    const ctx = document.getElementById('tempChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                data: chartData,
                borderColor: '#c9a96e', backgroundColor: 'rgba(201, 169, 110, 0.1)',
                borderWidth: 3, pointRadius: 4, pointBackgroundColor: '#1a1814',
                pointBorderColor: '#c9a96e', pointBorderWidth: 2, fill: true, tension: 0.4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true, displayColors: false,
                    callbacks: {
                        label: ctx => ctx.parsed.y + '°',
                        title: () => ''
                    }
                }
            },
            scales: {
                x: { display: false },
                y: { display: false, min: Math.min(...chartData) - 5, max: Math.max(...chartData) + 5 }
            },
            layout: { padding: { top: 10, bottom: 10, left: 10, right: 10 } }
        }
    });

    setTimeout(() => {
        DOM.hourlyScroll.scrollLeft = 0;
        if (fromUserSelection) {
            const activeEl = DOM.hourlyScroll.querySelector('.hourly-item.active');
            if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, 50);
}

// --- Story card text ---

function renderStory(dayIdx, data) {
    const hourly  = data.hourly;
    const current = data.current;
    const t       = translations[currentLang];
    const isToday = dayIdx === 0;

    const storyStart  = isToday ? currentHourlyIndex : dayIdx * 24;
    const startDateStr = hourly.time[storyStart]?.substring(0, 10) || '';

    // Find next midnight as end of day
    const nextDay = new Date(startDateStr);
    nextDay.setDate(nextDay.getDate() + 1);
    const midnightStr = nextDay.toISOString().substring(0, 10) + 'T00:00';
    let endIdx = hourly.time.findIndex(s => s.startsWith(midnightStr));
    if (endIdx === -1 || endIdx <= storyStart) endIdx = Math.min(storyStart + 24, hourly.time.length - 1);

    let peakObj = { temp: -999, time: '' };
    let dropObj = { temp: 999,  time: '' };

    for (let i = storyStart; i <= endIdx; i++) {
        const temp = formatTemp(hourly.temperature_2m[i]);
        const time = formatTime(hourly.time[i]);
        if (temp >= peakObj.temp) { peakObj.temp = temp; peakObj.time = time; }
        if (temp <= dropObj.temp) { dropObj.temp = temp; dropObj.time = time; }
    }

    const isDay      = isToday ? current.is_day !== 0 : hourly.is_day[storyStart] !== 0;
    const wDetails   = getWeatherDetails(isToday ? current.weather_code : data.daily.weather_code[dayIdx], isDay);
    const displayTemp = isToday ? formatTemp(current.temperature_2m) : formatTemp(data.daily.temperature_2m_max[dayIdx]);
    const hoursLeft   = Math.max(0, endIdx - storyStart);

    DOM.story.innerHTML = t.story
        .replace('{current}', displayTemp)
        .replace('{cond}',    wDetails.desc.toLowerCase())
        .replace('{high}',    peakObj.temp)
        .replace('{highTime}', peakObj.time)
        .replace('{low}',     dropObj.temp)
        .replace('{lowTime}', dropObj.time)
        .replace(/{unit}/g,   currentUnit === 'f' ? '°F' : '°C')
        + (isToday ? midnightLabel(hoursLeft) : '');
}

// --- Weekly forecast ---

function renderWeeklyForecast(daily, t) {
    const container = document.getElementById('weekly-forecast');
    if (!container) return;
    container.innerHTML = '';

    const allLows  = daily.temperature_2m_min;
    const allHighs = daily.temperature_2m_max;
    const globalMin   = Math.min(...allLows);
    const globalMax   = Math.max(...allHighs);
    const globalRange = (globalMax - globalMin) || 1;
    const dayNames    = t.ui.days || ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const ui = t.ui;

    daily.time.forEach((dateStr, idx) => {
        if (idx >= 7) return;

        const date   = new Date(dateStr + 'T12:00:00');
        const isToday = idx === 0;
        const high   = formatTemp(allHighs[idx]);
        const low    = formatTemp(allLows[idx]);
        const code   = daily.weather_code[idx];
        const wDetail = getWeatherDetails(code, true);
        const precipPct = daily.precipitation_probability_max?.[idx] ?? null;
        const hasRain   = precipPct !== null && precipPct > 15;

        const barLeft  = ((low - globalMin) / globalRange) * 100;
        const barWidth = ((high - low) / globalRange) * 100;
        const srTime   = daily.sunrise?.[idx] ? formatTime(daily.sunrise[idx]) : '--:--';
        const ssTime   = daily.sunset?.[idx]  ? formatTime(daily.sunset[idx])  : '--:--';

        const wrap = document.createElement('div');
        wrap.className = 'forecast-row-wrap';

        const row = document.createElement('div');
        row.className = 'forecast-day';
        row.style.animationDelay = `${idx * 0.06}s`;

        const nameEl = document.createElement('div');
        nameEl.className = `forecast-day-name${isToday ? ' today' : ''}`;
        nameEl.textContent = isToday ? (ui.today || 'Today') : dayNames[date.getDay()];

        const iconEl = document.createElement('div');
        iconEl.className = 'forecast-day-icon';
        iconEl.textContent = wDetail.icon;

        const precipEl = document.createElement('div');
        precipEl.className = `forecast-day-precip${hasRain ? '' : ' hidden'}`;
        precipEl.textContent = hasRain ? `${precipPct}%` : '';

        const barWrap = document.createElement('div');
        barWrap.className = 'forecast-temp-bar-wrap';

        const lowEl = document.createElement('div');
        lowEl.className = 'forecast-day-low';
        lowEl.textContent = `${low}°`;

        const track = document.createElement('div');
        track.className = 'forecast-bar-track';
        const fill = document.createElement('div');
        fill.className = 'forecast-bar-fill';
        fill.style.left  = `${barLeft}%`;
        fill.style.width = `${Math.max(barWidth, 6)}%`;
        track.appendChild(fill);

        const highEl = document.createElement('div');
        highEl.className = 'forecast-day-high';
        highEl.textContent = `${high}°`;

        barWrap.appendChild(lowEl);
        barWrap.appendChild(track);
        barWrap.appendChild(highEl);

        const chevron = document.createElement('div');
        chevron.className = 'forecast-chevron';
        chevron.textContent = '▼';

        row.appendChild(nameEl);
        row.appendChild(iconEl);
        row.appendChild(precipEl);
        row.appendChild(barWrap);
        row.appendChild(chevron);

        // Expandable detail panel
        const detail = document.createElement('div');
        detail.className = 'forecast-detail';
        const inner = document.createElement('div');
        inner.className = 'forecast-detail-inner';

        const makeItem = (label, value, isIconValue = false) => {
            const item = document.createElement('div');
            item.className = 'forecast-detail-item';
            const lbl = document.createElement('div');
            lbl.className = 'forecast-detail-label';
            lbl.textContent = label;
            const val = document.createElement('div');
            val.className = isIconValue ? 'forecast-detail-icon' : 'forecast-detail-value';
            val.textContent = value;
            item.appendChild(lbl);
            item.appendChild(val);
            return item;
        };

        inner.appendChild(makeItem(ui.detailCondition || 'Condition', `${wDetail.icon}  ${wDetail.desc}`));
        inner.appendChild(makeItem(ui.detailHigh    || 'High',    `${high}°`));
        inner.appendChild(makeItem(ui.detailRain    || 'Rain',    hasRain ? `${precipPct}%` : '—'));
        inner.appendChild(makeItem(ui.detailLow     || 'Low',     `${low}°`));
        inner.appendChild(makeItem(ui.detailSunrise || 'Sunrise', `🌅 ${srTime}`));
        inner.appendChild(makeItem(ui.detailSunset  || 'Sunset',  `🌇 ${ssTime}`));
        detail.appendChild(inner);

        row.addEventListener('click', () => selectForecastDay(idx));

        wrap.appendChild(row);
        wrap.appendChild(detail);
        container.appendChild(wrap);
    });
}

// --- Main render ---

function renderUI(data) {
    const t       = translations[currentLang];
    const current = data.current;
    const daily   = data.daily;
    const hourly  = data.hourly;

    DOM.location.textContent = currentLocName;

    // Find which hourly index matches current time
    if (current.time) {
        const prefix = current.time.substring(0, 13);
        for (let i = 0; i < hourly.time.length; i++) {
            if (hourly.time[i].startsWith(prefix)) { currentHourlyIndex = i; break; }
        }
    }

    updateMainWidget(0, data);
    renderOutfit(0, data);

    renderInsights({
        temp:      formatTemp(current.temperature_2m),
        feelsLike: formatTemp(current.apparent_temperature || current.temperature_2m),
        min:       formatTemp(daily.temperature_2m_min[0]),
        max:       formatTemp(daily.temperature_2m_max[0]),
        code:      current.weather_code,
        wind:      current.wind_speed_10m,
        uv:        current.uv_index || 0,
        precipNext2h: hourly.precipitation_probability
            ? Math.max(...hourly.precipitation_probability.slice(currentHourlyIndex, currentHourlyIndex + 3))
            : 0,
        hasUmbrella: [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(current.weather_code)
            || hourly.precipitation_probability.slice(0, 12).some(p => p > 40)
    });

    renderStory(0, data);

    computeAndRenderWarnings({ daily, hourly, current, dayIdx: 0, isToday: true, t });

    renderHourlyAndChart(0, data, { fromUserSelection: false });

    DOM.sunrise.textContent = formatTime(daily.sunrise[0]);
    DOM.sunset.textContent  = formatTime(daily.sunset[0]);

    renderWeeklyForecast(daily, t);

    DOM.lastUpdated.textContent = t.ui.lastUpdated + formatTime(new Date().toISOString());

    // Wire up "back to today" badge (remove old listener first)
    const dayBadge = document.getElementById('day-badge');
    if (dayBadge) {
        dayBadge._handler && dayBadge.removeEventListener('click', dayBadge._handler);
        dayBadge._handler = () => selectForecastDay(0);
        dayBadge.addEventListener('click', dayBadge._handler);
    }
}

// --- Forecast day selection ---

function selectForecastDay(dayIdx) {
    if (!currentWeatherData) return;
    const data    = currentWeatherData;
    const daily   = data.daily;
    const hourly  = data.hourly;
    const t       = translations[currentLang];
    const isToday = dayIdx === 0;

    // Highlight selected row
    document.querySelectorAll('.forecast-day').forEach((r, i)    => r.classList.toggle('active', i === dayIdx));
    document.querySelectorAll('.forecast-chevron').forEach((c, i) => {
        c.style.transform = i === dayIdx ? 'rotate(180deg)' : '';
        c.style.color     = i === dayIdx ? 'var(--accent-gold)' : '';
    });

    // Show/hide "back to today" badge
    const topCard  = document.querySelector('.combined-top-card');
    const dayBadge = document.getElementById('day-badge');
    topCard && topCard.classList.toggle('day-selected', !isToday);
    if (dayBadge) {
        dayBadge.textContent = isToday ? '' : (t.ui.backToToday || '← Back to Today');
        dayBadge.classList.toggle('hidden', isToday);
    }

    // Scroll main card to top
    if (topCard) {
        const rect        = topCard.getBoundingClientRect();
        const currentScroll = window.pageYOffset || document.documentElement.scrollTop || 0;
        window.scrollTo({ top: Math.max(0, rect.top + currentScroll - 16), behavior: 'smooth' });
    }

    // Update main stats: today uses live current, other days use hourly noon
    if (isToday) {
        updateMainWidget(currentHourlyIndex, data);
    } else {
        const noonIdx  = Math.min(dayIdx * 24 + 12, hourly.time.length - 1);
        const isDay    = hourly.is_day ? hourly.is_day[noonIdx] !== 0 : true;
        const wDetails = getWeatherDetails(daily.weather_code[dayIdx], isDay);
        const todayMin = Math.round(daily.temperature_2m_min[dayIdx]);
        const todayMax = Math.round(daily.temperature_2m_max[dayIdx]);

        // Average of the day's 24h slice
        const slice    = hourly.temperature_2m.slice(dayIdx * 24, Math.min(dayIdx * 24 + 24, hourly.temperature_2m.length));
        const avgTemp  = slice.length > 0 ? Math.round(slice.reduce((a, b) => a + b, 0) / slice.length) : Math.round((todayMax + todayMin) / 2);

        animateTemp(DOM.temp, avgTemp);
        DOM.icon.textContent      = wDetails.icon;
        DOM.condition.textContent = wDetails.desc;
        DOM.feels.textContent    = `${formatTemp(hourly.apparent_temperature?.[noonIdx] ?? avgTemp)}°`;
        DOM.humidity.textContent = `${Math.round(hourly.relative_humidity_2m?.[noonIdx] ?? 0)}%`;
        DOM.wind.textContent     = `${Math.round(hourly.wind_speed_10m[noonIdx])} km/h`;
        DOM.uv.textContent       = Math.round(hourly.uv_index?.[noonIdx] || 0);
    }

    renderOutfit(dayIdx, data);

    // Insights for this day (using noon values for future days)
    const noonIdx  = Math.min(dayIdx * 24 + 12, hourly.time.length - 1);
    const dayStart = dayIdx * 24;
    const precipSlice = hourly.precipitation_probability?.slice(dayStart, Math.min(dayStart + 3, hourly.precipitation_probability.length)) || [];

    renderInsights({
        temp:      isToday ? formatTemp(data.current.temperature_2m) : formatTemp(hourly.temperature_2m[noonIdx]),
        feelsLike: formatTemp(hourly.apparent_temperature?.[noonIdx] ?? hourly.temperature_2m[noonIdx]),
        min:       formatTemp(daily.temperature_2m_min[dayIdx]),
        max:       formatTemp(daily.temperature_2m_max[dayIdx]),
        code:      daily.weather_code[dayIdx],
        wind:      hourly.wind_speed_10m[noonIdx],
        uv:        hourly.uv_index?.[noonIdx] || 0,
        precipNext2h: precipSlice.length ? Math.max(...precipSlice) : 0,
        hasUmbrella:  [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(daily.weather_code[dayIdx])
            || hourly.precipitation_probability?.slice(dayStart, dayStart + 24).some(p => p > 40)
    });

    renderStory(dayIdx, data);

    computeAndRenderWarnings({ daily, hourly, current: data.current, dayIdx, isToday, t });

    renderHourlyAndChart(dayIdx, data, { fromUserSelection: true });

    DOM.sunrise.textContent = daily.sunrise?.[dayIdx] ? formatTime(daily.sunrise[dayIdx]) : '--:--';
    DOM.sunset.textContent  = daily.sunset?.[dayIdx]  ? formatTime(daily.sunset[dayIdx])  : '--:--';
}

// --- Recent searches ---

function getRecentCities() {
    try { return JSON.parse(localStorage.getItem('dressed_recent') || '[]'); } catch (e) { return []; }
}

function saveRecentCity(name, lat, lon) {
    let recents = getRecentCities().filter(c => c.name !== name);
    recents.unshift({ name, lat, lon });
    localStorage.setItem('dressed_recent', JSON.stringify(recents.slice(0, 3)));
}

// --- Data fetching ---

async function searchCity(city) {
    showLoading();
    try {
        const res  = await fetch(`${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
        if (!res.ok) throw new Error("Geo API error");
        const data = await res.json();
        if (!data.results?.length) { showEnableLocation(); return; }
        const { latitude, longitude, name } = data.results[0];
        currentLocName = name;
        DOM.location.textContent = name;
        DOM.searchInput.value = '';
        saveRecentCity(name, latitude, longitude);
        await fetchData(latitude, longitude, name);
    } catch (err) { console.error(err); showEnableLocation(); }
}

async function fetchData(lat, lon, locationName) {
    try {
        const params = new URLSearchParams({
            latitude: lat, longitude: lon,
            current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index,is_day',
            hourly:  'temperature_2m,weather_code,wind_speed_10m,precipitation_probability,apparent_temperature,relative_humidity_2m,uv_index,is_day',
            daily:   'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max',
            timezone: 'auto', forecast_days: 8
        });

        const res = await fetch(`${BASE_URL}?${params.toString()}`);
        if (!res.ok) throw new Error("Weather API error");
        const data = await res.json();

        currentTimezoneId = data.timezone;
        updateClock();
        currentWeatherData = data;

        // Fade out if content is already visible
        if (DOM.contentState.style.display === 'flex') {
            DOM.contentState.classList.add('fading');
            await new Promise(r => setTimeout(r, 350));
        }

        renderUI(data);

        DOM.loadingState.style.display = 'none';
        DOM.errorState.style.display   = 'none';
        DOM.contentState.style.display = 'flex';
        DOM.contentState.classList.remove('fading');

        // Trigger entrance animations
        document.querySelectorAll('.js-anim').forEach(el => {
            el.classList.remove('animate-in');
            void el.offsetWidth;
            el.classList.add('animate-in');
        });
    } catch (err) { console.error(err); showEnableLocation(); }
}

function startApp() {
    if (navigator.geolocation) {
        showLoading();
        navigator.geolocation.getCurrentPosition(
            pos => {
                DOM.location.textContent = 'Current Location';
                fetchData(pos.coords.latitude, pos.coords.longitude, 'Current Location');
            },
            () => showEnableLocation()
        );
    } else {
        showEnableLocation();
    }
}

// --- Init ---

function init() {
    updateLangUI();

    // Init unit toggle UI
    document.querySelectorAll('.unit-pill').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.unit === currentUnit);
        pill.addEventListener('click', () => {
            if (pill.classList.contains('active')) return;
            currentUnit = pill.dataset.unit;
            localStorage.setItem('dressed_unit', currentUnit);
            document.querySelectorAll('.unit-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            if (currentWeatherData) renderUI(currentWeatherData);
        });
    });

    document.getElementById('app').style.opacity = 1;

    if (!localStorage.getItem('dressed_lang')) {
        openLangModal();
    } else {
        DOM.langModal.classList.remove('visible');
        startApp();
    }

    // Search on Enter
    DOM.searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter' && DOM.searchInput.value.trim()) {
            document.getElementById('search-suggestions').style.display = 'none';
            searchCity(DOM.searchInput.value.trim());
            DOM.searchInput.blur();
        }
    });

    // Autocomplete suggestions
    let searchTimeout;
    DOM.searchInput.addEventListener('input', e => {
        clearTimeout(searchTimeout);
        const val = e.target.value.trim();
        const suggContainer = document.getElementById('search-suggestions');
        if (val.length < 2) { suggContainer.style.display = 'none'; return; }

        searchTimeout = setTimeout(async () => {
            try {
                const langCode = currentLang === 'az' ? 'tr' : currentLang;
                const res  = await fetch(`${GEO_URL}?name=${encodeURIComponent(val)}&count=5&language=${langCode}&format=json`);
                const data = await res.json();
                suggContainer.innerHTML = '';

                if (data.results?.length) {
                    data.results.forEach(city => {
                        const el = document.createElement('div');
                        el.className = 'suggestion-item';
                        el.innerHTML = `<span class="sugg-name">${city.name}</span><span class="sugg-country">${city.admin1 ? city.admin1 + ', ' : ''}${city.country}</span>`;
                        el.addEventListener('click', () => {
                            suggContainer.style.display = 'none';
                            currentLocName = city.name;
                            DOM.location.textContent = city.name;
                            DOM.searchInput.value = '';
                            fetchData(city.latitude, city.longitude, city.name);
                        });
                        suggContainer.appendChild(el);
                    });
                    suggContainer.style.display = 'flex';
                } else {
                    suggContainer.style.display = 'none';
                }
            } catch (err) { console.error(err); }
        }, 300);
    });

    // Close suggestions on outside click
    document.addEventListener('click', e => {
        if (!e.target.closest('.search-container')) {
            const s = document.getElementById('search-suggestions');
            if (s) s.style.display = 'none';
        }
    });

    // GPS button
    DOM.geoBtn.addEventListener('click', () => {
        if (navigator.geolocation) {
            showLoading();
            navigator.geolocation.getCurrentPosition(
                pos => {
                    DOM.location.textContent = 'Current Location';
                    fetchData(pos.coords.latitude, pos.coords.longitude, 'Current Location');
                },
                () => alert("Location access denied.")
            );
        }
    });

    // Language modal
    DOM.btnLang.addEventListener('click', openLangModal);
    DOM.langModal.addEventListener('click', e => {
        if (e.target === DOM.langModal && localStorage.getItem('dressed_lang')) closeLangModal();
    });

    // Hourly scroll arrows
    document.getElementById('hourly-prev').addEventListener('click', () => {
        document.getElementById('hourly-scroll').scrollBy({ left: -252, behavior: 'smooth' });
    });
    document.getElementById('hourly-next').addEventListener('click', () => {
        document.getElementById('hourly-scroll').scrollBy({ left: 252, behavior: 'smooth' });
    });

    setInterval(updateClock, 1000);
    updateClock();
}

window.addEventListener('DOMContentLoaded', init);
