(function (root) {
  'use strict';

  const COLUMNS = [
    ['Business Name', 'name'],
    ['Phone Number', 'phone'],
    ['Email address', 'email'],
    ['Website', 'website'],
    ['Category', 'category'],
    ['Rating', 'rating'],
    ['Review Count', 'reviews'],
    ['Price Range', 'priceRange'],
    ['Address', 'address'],
    ['Opening Hours', 'hours'],
    ['Description', 'description'],
    ['Google Maps URL', 'mapsUrl'],
    ['Phone Lookup Status', 'phoneLookupStatus'],
    ['Phone Checked At', 'phoneCheckedAt'],
    ['Collected At', 'collectedAt'],
    ['Lead Status', 'leadStatus'],
    ['Lead Tags', 'leadTags'],
    ['Lead Notes', 'leadNotes'],
    ['Lead Priority', 'leadPriority'],
    ['Follow-up Date', 'followUpDate']
  ];
  const FORMATS = {
    csv: { extension: 'csv', mime: 'text/csv;charset=utf-8;' },
    xlsx: { extension: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    json: { extension: 'json', mime: 'application/json;charset=utf-8;' },
    tsv: { extension: 'tsv', mime: 'text/tab-separated-values;charset=utf-8;' }
  };

  function normalizeSegment(value) {
    return String(value || '')
      .replace(/\+/g, ' ')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ', ')
      .trim()
      .replace(/^[,\s]+|[,\s]+$/g, '');
  }


  // Prefer standard ASCII spellings for location labels so city-database
  // variants such as “Ambāla” display consistently as “Ambala”.
  function removePlaceDiacritics(value) {
    return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  }

  function titleCaseSegment(value) {
    const text = normalizeSegment(value);
    const acronyms = new Map([
      ['usa', 'USA'], ['u.s.a.', 'U.S.A.'], ['us', 'US'], ['u.s.', 'U.S.'],
      ['uk', 'UK'], ['u.k.', 'U.K.'], ['uae', 'UAE'], ['nyc', 'NYC'],
      ['eu', 'EU'], ['seo', 'SEO'], ['ai', 'AI'], ['hvac', 'HVAC'],
      ['llc', 'LLC'], ['inc', 'Inc.'], ['ltd', 'Ltd.'], ['p.c.', 'P.C.']
    ]);
    return text.split(/(\s+)/).map((part, i, all) => {
      if (!part.trim()) return part;
      return part.split(/(,|-|\/)/).map((token) => {
        if (!token || /^(,|-|\/)$/ .test(token)) return token;
        const leading = token.match(/^\W*/)?.[0] || '';
        const trailing = token.match(/\W*$/)?.[0] || '';
        const core = token.slice(leading.length, token.length - trailing.length || undefined);
        if (!core) return token;
        const acronym = acronyms.get(core.toLowerCase());
        if (acronym) return leading + acronym + trailing;
        if (core.length > 1 && core === core.toLocaleUpperCase() && /[A-Z]/.test(core)) return token;
        // Keep mixed-case brand names intact; title-case ordinary lowercase words.
        if (/[A-Z]/.test(core.slice(1))) return token;
        const previousWord = all.slice(0, i).join('').trim().split(/\s+/).pop()?.toLowerCase();
        const isJoiner = /^(?:and|or|of|for|in|at|on|to|the|by|near|with)$/i.test(core) && previousWord;
        const cased = isJoiner ? core.toLowerCase() : core.charAt(0).toLocaleUpperCase() + core.slice(1).toLocaleLowerCase();
        return leading + cased + trailing;
      }).join('');
    }).join('');
  }

  function inferQueryFromUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      const match = url.pathname.match(/\/maps\/search\/([^/]+)/i);
      if (!match) return '';
      return decodeURIComponent(match[1]).replace(/[+_]/g, ' ').replace(/\s+/g, ' ').trim();
    } catch { return ''; }
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Canonical country names and common short forms used in filenames.
  // Ambiguous two-letter codes are intentionally excluded unless widely used as
  // standalone country short forms, so e.g. "CA" is not silently changed.
  function matchKey(value) {
    return normalizeSegment(value).toLocaleLowerCase()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[.]/g, ' ')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const COUNTRY_ENTRIES = [
    { canonical: 'USA', aliases: ['USA', 'U.S.A.', 'US', 'U.S.', 'United States', 'United States of America', 'America'] },
    { canonical: 'UK', aliases: ['UK', 'U.K.', 'United Kingdom', 'Great Britain', 'Britain', 'GB', 'GBR'] },
    { canonical: 'UAE', aliases: ['UAE', 'U.A.E.', 'United Arab Emirates'] },
    { canonical: 'Canada', aliases: ['Canada', 'CAN'] },
    { canonical: 'Australia', aliases: ['Australia', 'AUS', 'AU'] },
    { canonical: 'India', aliases: ['India', 'IND', 'IN'] },
    { canonical: 'New Zealand', aliases: ['New Zealand', 'NZ', 'NZL'] },
    { canonical: 'Singapore', aliases: ['Singapore', 'SG', 'SGP'] },
    { canonical: 'Germany', aliases: ['Germany', 'DE', 'DEU'] },
    { canonical: 'France', aliases: ['France', 'FR', 'FRA'] },
    { canonical: 'Japan', aliases: ['Japan', 'JP', 'JPN'] },
    { canonical: 'Ireland', aliases: ['Ireland', 'IE', 'IRL'] },
    { canonical: 'South Africa', aliases: ['South Africa', 'ZA', 'ZAF'] },
    { canonical: 'Pakistan', aliases: ['Pakistan', 'PK', 'PAK'] },
    { canonical: 'Philippines', aliases: ['Philippines', 'PH', 'PHL'] },
    { canonical: 'Malaysia', aliases: ['Malaysia', 'MY', 'MYS'] },
    { canonical: 'Indonesia', aliases: ['Indonesia', 'ID', 'IDN'] },
    { canonical: 'Thailand', aliases: ['Thailand', 'TH', 'THA'] },
    { canonical: 'Spain', aliases: ['Spain', 'ES', 'ESP'] },
    { canonical: 'Italy', aliases: ['Italy', 'IT', 'ITA'] },
    { canonical: 'Brazil', aliases: ['Brazil', 'BR', 'BRA'] },
    { canonical: 'Mexico', aliases: ['Mexico', 'MX', 'MEX'] },
    { canonical: 'Netherlands', aliases: ['Netherlands', 'The Netherlands', 'Holland', 'NL', 'NLD'] },
    { canonical: 'Switzerland', aliases: ['Switzerland', 'CH', 'CHE'] },
    { canonical: 'Saudi Arabia', aliases: ['Saudi Arabia', 'KSA'] },
    { canonical: 'Qatar', aliases: ['Qatar', 'QA', 'QAT'] },
    { canonical: 'Kuwait', aliases: ['Kuwait', 'KW', 'KWT'] },
    { canonical: 'Bahrain', aliases: ['Bahrain', 'BH', 'BHR'] },
    { canonical: 'Oman', aliases: ['Oman', 'OM', 'OMN'] },
    { canonical: 'Egypt', aliases: ['Egypt', 'EG', 'EGY'] },
    { canonical: 'Türkiye', aliases: ['Türkiye', 'Turkey', 'TR', 'TUR'] },
    { canonical: 'South Korea', aliases: ['South Korea', 'Republic of Korea', 'KR', 'KOR'] },
    { canonical: 'China', aliases: ['China', 'CN', 'CHN'] },
    { canonical: 'Hong Kong', aliases: ['Hong Kong', 'HK', 'HKG'] },
    ...(root.AtlasWorldCountryData || [])
  ];
  const COUNTRY_ALIAS_MAP = new Map();
  const COUNTRY_ALIAS_KEYS = [];
  const COUNTRY_ALIAS_KEY_SET = new Set();
  const COUNTRY_CANONICAL_BY_CODE = new Map();
  for (const country of (root.AtlasWorldCountryData || [])) {
    if (country.code) COUNTRY_CANONICAL_BY_CODE.set(String(country.code).toUpperCase(), country.canonical);
  }
  for (const country of COUNTRY_ENTRIES) {
    for (const alias of country.aliases) {
      const key = matchKey(alias);
      if (!COUNTRY_ALIAS_MAP.has(key)) COUNTRY_ALIAS_MAP.set(key, country.canonical);
      if (!COUNTRY_ALIAS_KEY_SET.has(key)) {
        COUNTRY_ALIAS_KEY_SET.add(key);
        COUNTRY_ALIAS_KEYS.push({ key, canonical: country.canonical });
      }
    }
  }
  COUNTRY_ALIAS_KEYS.sort((a, b) => b.key.split(' ').length - a.key.split(' ').length || b.key.length - a.key.length);

  // Curated city/region aliases provide fast offline coverage. The global city
  // list is loaded separately from a static public dataset and cached locally;
  // user search phrases are never sent to the dataset host.
  const PLACE_ENTRIES = [
    { city: 'New York', country: 'USA', aliases: ['New York', 'NewYork', 'New York City', 'NewYorkCity', 'NYC', 'New York NY', 'New York, NY', 'NYC NY'] },
    { city: 'Los Angeles', country: 'USA', aliases: ['Los Angeles', 'LA', 'L.A.'] },
    { city: 'San Francisco', country: 'USA', aliases: ['San Francisco', 'SF', 'SFO'] },
    { city: 'Chicago', country: 'USA', aliases: ['Chicago'] },
    { city: 'Houston', country: 'USA', aliases: ['Houston'] },
    { city: 'Miami', country: 'USA', aliases: ['Miami'] },
    { city: 'Dallas', country: 'USA', aliases: ['Dallas'] },
    { city: 'Austin', country: 'USA', aliases: ['Austin'] },
    { city: 'Seattle', country: 'USA', aliases: ['Seattle'] },
    { city: 'Boston', country: 'USA', aliases: ['Boston'] },
    { city: 'Denver', country: 'USA', aliases: ['Denver'] },
    { city: 'Atlanta', country: 'USA', aliases: ['Atlanta'] },
    { city: 'Philadelphia', country: 'USA', aliases: ['Philadelphia', 'Philly'] },
    { city: 'Phoenix', country: 'USA', aliases: ['Phoenix'] },
    { city: 'San Diego', country: 'USA', aliases: ['San Diego'] },
    { city: 'San Jose', country: 'USA', aliases: ['San Jose'] },
    { city: 'Portland', country: 'USA', aliases: ['Portland'] },
    { city: 'Las Vegas', country: 'USA', aliases: ['Las Vegas', 'Vegas'] },
    { city: 'Orlando', country: 'USA', aliases: ['Orlando'] },
    { city: 'Tampa', country: 'USA', aliases: ['Tampa'] },
    { city: 'Washington, DC', country: 'USA', aliases: ['Washington DC', 'Washington D C', 'Washington, D.C.', 'DC'] },
    { city: 'London', country: 'UK', aliases: ['London', 'LON'] },
    { city: 'Manchester', country: 'UK', aliases: ['Manchester'] },
    { city: 'Birmingham', country: 'UK', aliases: ['Birmingham'] },
    { city: 'Liverpool', country: 'UK', aliases: ['Liverpool'] },
    { city: 'Edinburgh', country: 'UK', aliases: ['Edinburgh'] },
    { city: 'Glasgow', country: 'UK', aliases: ['Glasgow'] },
    { city: 'Toronto', country: 'Canada', aliases: ['Toronto'] },
    { city: 'Vancouver', country: 'Canada', aliases: ['Vancouver'] },
    { city: 'Montreal', country: 'Canada', aliases: ['Montreal', 'Montréal'] },
    { city: 'Calgary', country: 'Canada', aliases: ['Calgary'] },
    { city: 'Ottawa', country: 'Canada', aliases: ['Ottawa'] },
    { city: 'Sydney', country: 'Australia', aliases: ['Sydney'] },
    { city: 'Melbourne', country: 'Australia', aliases: ['Melbourne'] },
    { city: 'Brisbane', country: 'Australia', aliases: ['Brisbane'] },
    { city: 'Perth', country: 'Australia', aliases: ['Perth'] },
    { city: 'Auckland', country: 'New Zealand', aliases: ['Auckland'] },
    { city: 'Dubai', country: 'UAE', aliases: ['Dubai'] },
    { city: 'Abu Dhabi', country: 'UAE', aliases: ['Abu Dhabi'] },
    { city: 'Delhi', country: 'India', aliases: ['Delhi', 'New Delhi'] },
    { city: 'Mumbai', country: 'India', aliases: ['Mumbai', 'Bombay'] },
    { city: 'Bengaluru', country: 'India', aliases: ['Bengaluru', 'Bangalore'] },
    { city: 'Chandigarh', country: 'India', aliases: ['Chandigarh'] },
    { city: 'Mohali', country: 'India', aliases: ['Mohali', 'Sahibzada Ajit Singh Nagar'] },
    { city: 'Pune', country: 'India', aliases: ['Pune'] },
    { city: 'Hyderabad', country: 'India', aliases: ['Hyderabad'] },
    { city: 'Chennai', country: 'India', aliases: ['Chennai', 'Madras'] },
    { city: 'Kolkata', country: 'India', aliases: ['Kolkata', 'Calcutta'] },
    { city: 'Singapore', country: 'Singapore', aliases: ['Singapore'] },
    { city: 'Berlin', country: 'Germany', aliases: ['Berlin'] },
    { city: 'Munich', country: 'Germany', aliases: ['Munich', 'München'] },
    { city: 'Paris', country: 'France', aliases: ['Paris'] },
    { city: 'Tokyo', country: 'Japan', aliases: ['Tokyo'] },
    { city: 'Amsterdam', country: 'Netherlands', aliases: ['Amsterdam'] },
    { city: 'Kuala Lumpur', country: 'Malaysia', aliases: ['Kuala Lumpur', 'KL'] },
    { city: 'Bangkok', country: 'Thailand', aliases: ['Bangkok'] },
    { city: 'Johannesburg', country: 'South Africa', aliases: ['Johannesburg'] },
    { city: 'Cape Town', country: 'South Africa', aliases: ['Cape Town'] }
  ];
  const PLACE_ALIAS_MAP = new Map();
  const PLACE_ALIAS_MAP_BY_COUNTRY = new Map();
  const WORLD_CITY_SOURCE = 'https://download.geonames.org/export/dump/cities500.zip';
  const WORLD_CITY_FALLBACK_SOURCE = 'https://raw.githubusercontent.com/joelacus/world-cities/main/world_cities.json';
  const WORLD_CITY_CACHE_KEY = 'atlasWorldCityIndexV2';
  const WORLD_CITY_CACHE_VERSION = 2;
  const WORLD_CITY_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
  let worldCityLoadPromise = null;
  let worldCityDataLoaded = false;
  let worldCityDataCount = 0;

  function addPlaceAlias(alias, place) {
    const key = matchKey(alias);
    if (!key) return false;
    const countryKey = matchKey(place.country || '');
    if (countryKey) {
      const compoundKey = `${key}|${countryKey}`;
      if (!PLACE_ALIAS_MAP_BY_COUNTRY.has(compoundKey)) PLACE_ALIAS_MAP_BY_COUNTRY.set(compoundKey, place);
    }
    if (PLACE_ALIAS_MAP.has(key)) return false;
    PLACE_ALIAS_MAP.set(key, place);
    return true;
  }

  for (const place of PLACE_ENTRIES) {
    for (const alias of place.aliases) addPlaceAlias(alias, place);
  }
  // Curated aliases stay first; the global database fills the remaining names.
  // The suffix parser does exact map lookups, so an extra sorted alias array is
  // unnecessary and would consume significant memory with 100k+ global places.

  function countryFromAlias(value) {
    return COUNTRY_ALIAS_MAP.get(matchKey(value)) || '';
  }

  function countryFromCode(code) {
    return COUNTRY_CANONICAL_BY_CODE.get(String(code || '').toUpperCase()) || countryFromAlias(code) || '';
  }

  function canonicalPlace(place, countryOverride = '') {
    const country = countryOverride || place.country;
    const city = removePlaceDiacritics(place.city);
    return matchKey(city) === matchKey(country) ? city : `${city}, ${country}`;
  }

  function matchingPlace(value, countryOverride = '') {
    const key = matchKey(value);
    if (!key) return null;
    if (countryOverride) {
      const country = countryFromAlias(countryOverride) || countryOverride;
      const scoped = PLACE_ALIAS_MAP_BY_COUNTRY.get(`${key}|${matchKey(country)}`);
      if (scoped) return scoped;
    }
    return PLACE_ALIAS_MAP.get(key) || null;
  }

  function registerWorldCityRows(rows) {
    if (!Array.isArray(rows)) return 0;
    let added = 0;
    for (const row of rows) {
      const isTuple = Array.isArray(row);
      const name = normalizeSegment(isTuple ? row[0] : row?.name);
      const asciiName = normalizeSegment(isTuple ? (row.length >= 3 ? row[1] : row[0]) : (row?.asciiname || row?.asciiName || row?.name));
      const countryCode = String(isTuple ? (row.length >= 3 ? row[2] : row[1]) : (row?.country || '')).trim().toUpperCase();
      if (!name || !countryCode) continue;
      const country = countryFromCode(countryCode);
      if (!country) continue;
      const place = { city: removePlaceDiacritics(asciiName || name), country, aliases: [name, asciiName].filter(Boolean), source: 'geonames' };
      let inserted = addPlaceAlias(name, place);
      if (asciiName && matchKey(asciiName) !== matchKey(name)) inserted = addPlaceAlias(asciiName, place) || inserted;
      if (inserted) added++;
    }
    worldCityDataCount = Math.max(worldCityDataCount, rows.length);
    worldCityDataLoaded = worldCityDataLoaded || rows.length > 0;
    return added;
  }

  async function unzipGeoNamesCities(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const u16 = (offset) => view.getUint16(offset, true);
    const u32 = (offset) => view.getUint32(offset, true);
    // ZIP End of Central Directory is in the final 65,557 bytes.
    let eocd = -1;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
      if (u32(offset) === 0x06054b50) { eocd = offset; break; }
    }
    if (eocd < 0) throw new Error('GeoNames ZIP has no valid end-of-directory record');
    const entryCount = u16(eocd + 10);
    let cursor = u32(eocd + 16);
    for (let i = 0; i < entryCount; i++) {
      if (u32(cursor) !== 0x02014b50) throw new Error('GeoNames ZIP directory is malformed');
      const method = u16(cursor + 10);
      const compressedSize = u32(cursor + 20);
      const fileNameLength = u16(cursor + 28);
      const extraLength = u16(cursor + 30);
      const commentLength = u16(cursor + 32);
      const localOffset = u32(cursor + 42);
      const fileName = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength));
      cursor += 46 + fileNameLength + extraLength + commentLength;
      if (!/(^|\/)cities500\.txt$/i.test(fileName)) continue;
      if (u32(localOffset) !== 0x04034b50) throw new Error('GeoNames ZIP payload header is malformed');
      const localNameLength = u16(localOffset + 26);
      const localExtraLength = u16(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
      if (method === 0) return new TextDecoder('utf-8').decode(compressed);
      if (method !== 8 || typeof root.DecompressionStream !== 'function') throw new Error('This browser cannot decompress the GeoNames ZIP format');
      const stream = new Blob([compressed]).stream().pipeThrough(new root.DecompressionStream('deflate-raw'));
      return await new Response(stream).text();
    }
    throw new Error('GeoNames ZIP does not contain cities500.txt');
  }

  function parseGeoNamesCities(text) {
    const entries = [];
    const seen = new Set();
    let start = 0;
    while (start < text.length) {
      let end = text.indexOf('\n', start);
      if (end < 0) end = text.length;
      let line = text.slice(start, end);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      start = end + 1;
      if (!line) continue;
      const fields = line.split('\t');
      // GeoNames main table: name(1), ASCII name(2), feature class(6), country(8).
      if (fields.length < 9 || fields[6] !== 'P') continue;
      const name = normalizeSegment(fields[1]);
      const asciiName = normalizeSegment(fields[2] || fields[1]);
      const countryCode = String(fields[8] || '').trim().toUpperCase();
      if (!name || !countryCode || !countryFromCode(countryCode)) continue;
      const key = `${matchKey(name)}|${matchKey(asciiName)}|${countryCode}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push([name, asciiName || name, countryCode]);
    }
    if (entries.length < 1000) throw new Error('GeoNames city dataset parsed incompletely');
    return entries;
  }

  async function loadWorldCityDatabase() {
    if (worldCityDataLoaded) return { ok: true, count: worldCityDataCount, cached: true };
    if (worldCityLoadPromise) return worldCityLoadPromise;
    worldCityLoadPromise = (async () => {
      let storage = null;
      let staleCache = null;
      try {
        storage = root.chrome?.storage?.local || null;
        if (storage) {
          const stored = await storage.get(WORLD_CITY_CACHE_KEY);
          const cache = stored?.[WORLD_CITY_CACHE_KEY];
          if (cache && cache.version === WORLD_CITY_CACHE_VERSION && Array.isArray(cache.entries) && cache.entries.length) {
            staleCache = cache;
            registerWorldCityRows(cache.entries);
            const fresh = Date.now() - Number(cache.fetchedAt || 0) < WORLD_CITY_CACHE_TTL;
            if (fresh) return { ok: true, count: cache.entries.length, cached: true, source: 'GeoNames' };
          }
        }
      } catch (error) {
        // Storage may be unavailable in a browser test; try the public feed anyway.
      }
      try {
        let entries;
        let source = 'GeoNames cities500';
        let primaryError = null;
        try {
          const response = await root.fetch(WORLD_CITY_SOURCE, { cache: 'no-cache' });
          if (!response.ok) throw new Error(`GeoNames returned HTTP ${response.status}`);
          entries = parseGeoNamesCities(await unzipGeoNamesCities(await response.arrayBuffer()));
        } catch (error) {
          primaryError = error;
          // Public JSON fallback if GeoNames is temporarily unavailable or ZIP
          // decompression is unsupported in the current Chromium environment.
          const response = await root.fetch(WORLD_CITY_FALLBACK_SOURCE, { cache: 'no-cache' });
          if (!response.ok) throw new Error(`City data source failed (${error?.message || error}); fallback HTTP ${response.status}`);
          const payload = await response.json();
          if (!Array.isArray(payload) || payload.length < 1000) throw new Error('Fallback worldwide city database response was incomplete');
          entries = [];
          const seen = new Set();
          for (const row of payload) {
            const name = normalizeSegment(row?.name);
            const asciiName = normalizeSegment(row?.asciiname || row?.asciiName || row?.name);
            const code = String(row?.country || '').trim().toUpperCase();
            if (!name || !code || !countryFromCode(code)) continue;
            const key = `${matchKey(name)}|${matchKey(asciiName)}|${code}`;
            if (seen.has(key)) continue;
            seen.add(key);
            entries.push([name, asciiName || name, code]);
          }
          if (entries.length < 1000) throw new Error('Fallback city database did not contain enough valid records');
          source = 'GeoNames-derived world-cities fallback';
        }
        registerWorldCityRows(entries);
        if (storage) {
          await storage.set({ [WORLD_CITY_CACHE_KEY]: { version: WORLD_CITY_CACHE_VERSION, fetchedAt: Date.now(), source, entries } });
        }
        return { ok: true, count: entries.length, cached: false, source };
      } catch (error) {
        if (staleCache?.entries?.length) {
          registerWorldCityRows(staleCache.entries);
          return { ok: true, count: staleCache.entries.length, cached: true, stale: true, source: staleCache.source || 'cached GeoNames', error: String(error?.message || error) };
        }
        return { ok: false, count: 0, cached: false, error: String(error?.message || error) };
      } finally {
        worldCityLoadPromise = null;
      }
    })();
    return worldCityLoadPromise;
  }

  function locationFromValue(value) {
    const raw = normalizeSegment(value);
    if (!raw) return '';
    const exactCountry = countryFromAlias(raw);
    if (exactCountry) return exactCountry;
    const exactPlace = matchingPlace(raw);
    if (exactPlace) return canonicalPlace(exactPlace);

    // Prefer comma-delimited country suffixes, e.g. "New York, US".
    const commaParts = raw.split(',').map(normalizeSegment).filter(Boolean);
    if (commaParts.length > 1) {
      const country = countryFromAlias(commaParts[commaParts.length - 1]);
      if (country) {
        const cityText = commaParts.slice(0, -1).join(', ');
        const place = matchingPlace(cityText, country);
        if (place) return canonicalPlace(place, country);
        return `${titleCaseSegment(removePlaceDiacritics(cityText))}, ${country}`;
      }
    }

    // Also accept "New York USA" without a comma before the country.
    const words = raw.split(/[\s,]+/).filter(Boolean);
    for (const item of COUNTRY_ALIAS_KEYS) {
      const aliasWords = item.key.split(' ');
      if (words.length <= aliasWords.length) continue;
      const tail = words.slice(-aliasWords.length).map(matchKey).join(' ');
      if (tail !== item.key) continue;
      const cityText = words.slice(0, -aliasWords.length).join(' ').replace(/[,\s]+$/g, '');
      if (!cityText) continue;
      const place = matchingPlace(cityText, item.canonical);
      if (place) return canonicalPlace(place, item.canonical);
      return `${titleCaseSegment(cityText)}, ${item.canonical}`;
    }
    return titleCaseSegment(removePlaceDiacritics(raw));
  }

  function findKnownLocationSuffix(query) {
    const raw = normalizeSegment(query);
    const tokens = raw.split(/[\s,]+/).map(matchKey).filter(Boolean);
    if (tokens.length < 2) return null;

    const findPlaceEndingAt = (prefixTokens) => {
      // Search short suffixes directly in the index instead of looping over
      // every known city. This stays responsive with 100k+ global records.
      for (let start = 0; start < prefixTokens.length; start++) {
        const cityKey = prefixTokens.slice(start).join(' ');
        const place = PLACE_ALIAS_MAP.get(cityKey);
        if (!place) continue;
        const businessTokens = prefixTokens.slice(0, start);
        while (businessTokens.length && /^(?:in|at|near|around|within)$/i.test(businessTokens[businessTokens.length - 1])) businessTokens.pop();
        const business = businessTokens.join(' ').trim();
        // Return the longest matched suffix even if the whole query is the
        // place name, rather than falling through to a shorter place that
        // happens to share its final word (e.g. New York vs York).
        return { business, place };
      }
      return null;
    };

    // First handle city + country / territory alias at the end, e.g. lawyers
    // New York USA or dentists London GB.
    for (const country of COUNTRY_ALIAS_KEYS) {
      const countryTokens = country.key.split(' ');
      if (tokens.length <= countryTokens.length) continue;
      if (tokens.slice(-countryTokens.length).join(' ') !== country.key) continue;
      const prefix = tokens.slice(0, -countryTokens.length);
      const match = findPlaceEndingAt(prefix);
      if (match) {
        return { business: match.business, location: canonicalPlace(match.place, country.canonical) };
      }
    }

    // Match any city name at the end even when users omit the connector: "lawyers new york".
    const match = findPlaceEndingAt(tokens);
    if (match) return { business: match.business, location: canonicalPlace(match.place) };
    return null;
  }

  function splitEmbeddedLocation(query) {
    const q = normalizeSegment(query);
    // Prefer an explicit natural-language location connector, taking the last
    // connector so service names such as "24 hour lawyers" stay intact.
    const connector = /\s+(?:in|at|near|around|within)\s+/ig;
    let match;
    let last = null;
    while ((match = connector.exec(q)) !== null) last = { index: match.index, length: match[0].length };
    if (last) {
      const business = normalizeSegment(q.slice(0, last.index));
      const rawLocation = normalizeSegment(q.slice(last.index + last.length));
      if (business && rawLocation) return { business, location: locationFromValue(rawLocation) };
    }

    const commaParts = q.split(',').map(normalizeSegment).filter(Boolean);
    if (commaParts.length >= 3) {
      return { business: commaParts[0], location: locationFromValue(commaParts.slice(1).join(', ')) };
    }

    const suffix = findKnownLocationSuffix(q);
    if (suffix) return suffix;

    if (commaParts.length === 2) {
      const place = locationFromValue(commaParts[1]);
      if (place && place !== titleCaseSegment(commaParts[1])) {
        return { business: commaParts[0], location: place };
      }
    }
    return { business: q, location: '' };
  }

  function normalizeFilenameParts(query, location) {
    let q = normalizeSegment(query);
    let loc = normalizeSegment(location);
    const parsed = splitEmbeddedLocation(q);
    if (!loc && parsed.location) {
      q = parsed.business;
      loc = parsed.location;
    } else if (loc && parsed.location) {
      const normalizeForCompare = (value) => matchKey(locationFromValue(value));
      const embedded = normalizeForCompare(parsed.location);
      const explicit = normalizeForCompare(loc);
      const embeddedCity = normalizeForCompare(parsed.location.split(',')[0]);
      const explicitCity = normalizeForCompare(loc.split(',')[0]);
      if (embedded === explicit || embeddedCity === explicitCity) {
        q = parsed.business;
        // Prefer the richer recognized location label (including country).
        loc = locationFromValue(parsed.location).length >= locationFromValue(loc).length
          ? locationFromValue(parsed.location)
          : locationFromValue(loc);
      }
    }

    if (loc) loc = locationFromValue(loc);
    q = normalizeSegment(q)
      .replace(/\s+(?:in|at|near|around|within|for)$/i, '')
      .replace(/[ ,\s]+$/g, '')
      .trim();
    loc = normalizeSegment(loc).replace(/^[,\s]+|[,\s]+$/g, '');
    if (q && loc && matchKey(q) === matchKey(loc)) q = '';
    return { query: q, location: loc };
  }

  function makeFilename(query, location, format, fallbackUrl) {
    const parts = normalizeFilenameParts(query, location);
    const q = titleCaseSegment(parts.query);
    const loc = titleCaseSegment(parts.location);
    const segments = [];
    if (q) segments.push(q);
    if (loc && loc.toLocaleLowerCase() !== q.toLocaleLowerCase()) segments.push(loc);
    if (!segments.length) {
      const inferredParts = splitEmbeddedLocation(inferQueryFromUrl(fallbackUrl));
      const inferredBusiness = titleCaseSegment(inferredParts.business);
      const inferredLocation = titleCaseSegment(inferredParts.location);
      if (inferredBusiness) segments.push(inferredBusiness);
      if (inferredLocation && inferredLocation.toLocaleLowerCase() !== inferredBusiness.toLocaleLowerCase()) segments.push(inferredLocation);
    }
    let base = segments.join(', ') || 'Atlas Export';
    base = base
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/[. ]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (base.length > 140) base = base.slice(0, 140).replace(/[ ,.-]+$/g, '');
    const ext = (FORMATS[format] || FORMATS.csv).extension;
    return `${base}.${ext}`;
  }

  function cleanCell(value) {
    return String(value ?? '')
      .replace(/\r\n?/g, ' ')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function resolveColumns(selectedKeys) {
    if (!Array.isArray(selectedKeys)) return COLUMNS;
    const requested = new Set(selectedKeys.map(String));
    const selected = COLUMNS.filter(([, key]) => requested.has(key));
    return selected.length ? selected : COLUMNS;
  }

  function cleanPhoneCell(value) {
    // Phone numbers are already extracted as phone-shaped strings. Remove only accidental
    // leading separator/prefix characters; never reformat the number itself.
    return cleanCell(value).replace(/^[\s,;，،'’]+(?=[+\d(])/, '');
  }

  function normalizeRecords(records, selectedKeys) {
    const source = Array.isArray(records) ? records : [];
    const columns = resolveColumns(selectedKeys);
    return source.map((record) => {
      const output = {};
      for (const [, key] of columns) {
        output[key] = key === 'phone' ? cleanPhoneCell(record?.[key]) : cleanCell(record?.[key]);
      }
      return output;
    });
  }

  function safeSpreadsheetText(value) {
    const text = cleanCell(value);
    return /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  }

  function makeDelimited(records, delimiter, selectedKeys) {
    const columns = resolveColumns(selectedKeys);
    const rows = [columns.map(([label]) => label)];
    for (const record of normalizeRecords(records, selectedKeys)) {
      rows.push(columns.map(([, key]) => key === 'phone' ? cleanPhoneCell(record[key]) : safeSpreadsheetText(record[key])));
    }
    return rows.map((row) => row.map((value) => {
      const text = String(value ?? '');
      if (delimiter === '\t') return text.replace(/\t/g, ' ').replace(/\n/g, ' ');
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(delimiter)).join('\r\n');
  }

  function xmlEscape(value) {
    return String(value ?? '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function columnName(n) {
    let name = '';
    while (n > 0) {
      const r = (n - 1) % 26;
      name = String.fromCharCode(65 + r) + name;
      n = Math.floor((n - 1) / 26);
    }
    return name;
  }

  function createSheetXml(records, selectedKeys) {
    const columns = resolveColumns(selectedKeys);
    const normalized = normalizeRecords(records, selectedKeys);
    const allRows = [columns.map(([label]) => label), ...normalized.map((record) => columns.map(([, key]) => record[key]))];
    const rowsXml = allRows.map((values, rowIndex) => {
      const rowNum = rowIndex + 1;
      const cells = values.map((value, colIndex) => {
        const ref = `${columnName(colIndex + 1)}${rowNum}`;
        const style = rowIndex === 0 ? ' s="1"' : ' s="2"';
        return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
      }).join('');
      return `<row r="${rowNum}"${rowIndex === 0 ? ' ht="24" customHeight="1"' : ''}>${cells}</row>`;
    }).join('');
    // Auto-size every exported Excel column from its header and longest cell value.
    // Excel width units are based on the default font's character width, so estimate
    // full-width scripts and emoji as two units and ignore combining marks. Long
    // descriptions and URLs wrap in-cell and are capped to keep the sheet usable.
    const MIN_WIDTH = 10;
    const MAX_WIDTH = 52;
    const estimateExcelLineWidth = (line) => {
      let width = 0;
      for (const char of String(line ?? '')) {
        const cp = char.codePointAt(0);
        // Combining diacritics add no independent visual width.
        if ((cp >= 0x0300 && cp <= 0x036F) || (cp >= 0x1AB0 && cp <= 0x1AFF) ||
            (cp >= 0x1DC0 && cp <= 0x1DFF) || (cp >= 0x20D0 && cp <= 0x20FF) ||
            (cp >= 0xFE20 && cp <= 0xFE2F) || (cp >= 0xFE00 && cp <= 0xFE0F)) continue;
        const isWide =
          (cp >= 0x1100 && cp <= 0x11FF) ||
          (cp >= 0x2E80 && cp <= 0xA4CF) ||
          (cp >= 0xAC00 && cp <= 0xD7AF) ||
          (cp >= 0xF900 && cp <= 0xFAFF) ||
          (cp >= 0xFE10 && cp <= 0xFE6F) ||
          (cp >= 0xFF00 && cp <= 0xFF60) ||
          (cp >= 0xFFE0 && cp <= 0xFFE6) ||
          (cp >= 0x1F000 && cp <= 0x1FAFF) ||
          (cp >= 0x20000 && cp <= 0x3FFFD);
        width += isWide ? 2 : 1;
      }
      return width;
    };
    const estimateExcelTextWidth = (value) => {
      const lines = String(value ?? '').split(/\r\n|\r|\n/);
      return Math.max(0, ...lines.map(estimateExcelLineWidth));
    };
    const widthForColumn = (columnIndex, key, label) => {
      let longest = estimateExcelTextWidth(label);
      for (let rowIndex = 1; rowIndex < allRows.length; rowIndex++) {
        longest = Math.max(longest, estimateExcelTextWidth(allRows[rowIndex][columnIndex]));
      }
      // Give every column breathing room; rating/review counts get a little extra.
      const padding = key === 'rating' || key === 'reviews' ? 3 : 2;
      return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.ceil(longest + padding)));
    };
    const cols = columns.map(([, key], i) => `<col min="${i + 1}" max="${i + 1}" width="${widthForColumn(i, key, columns[i][0])}" customWidth="1"/>`).join('');
    const lastColumn = columnName(Math.max(1, columns.length));
    const lastRow = allRows.length;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<dimension ref="A1:${lastColumn}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
      `<sheetFormatPr defaultRowHeight="18"/><cols>${cols}</cols><sheetData>${rowsXml}</sheetData>` +
      `<autoFilter ref="A1:${lastColumn}${lastRow}"/>` +
      `<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>` +
      `</worksheet>`;
  }

  const encoder = new TextEncoder();
  function crc32(bytes) {
    let crc = -1;
    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
    return (crc ^ -1) >>> 0;
  }
  function u16(value) { return [value & 255, (value >>> 8) & 255]; }
  function u32(value) { return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]; }
  function joinBytes(parts) {
    const size = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { result.set(part, offset); offset += part.length; }
    return result;
  }

  function zipStore(files) {
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;
    const dosTime = 0;
    const dosDate = 0x21; // 1980-01-01, valid DOS ZIP date.
    for (const file of files) {
      const nameBytes = encoder.encode(file.name);
      const dataBytes = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
      const crc = crc32(dataBytes);
      const localHeader = new Uint8Array([
        ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate),
        ...u32(crc), ...u32(dataBytes.length), ...u32(dataBytes.length), ...u16(nameBytes.length), ...u16(0)
      ]);
      localParts.push(localHeader, nameBytes, dataBytes);
      const centralHeader = new Uint8Array([
        ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate),
        ...u32(crc), ...u32(dataBytes.length), ...u32(dataBytes.length), ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0),
        ...u16(0), ...u32(0), ...u32(localOffset)
      ]);
      centralParts.push(centralHeader, nameBytes);
      localOffset += localHeader.length + nameBytes.length + dataBytes.length;
    }
    const centralDirectory = joinBytes(centralParts);
    const centralOffset = localOffset;
    const end = new Uint8Array([
      ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
      ...u32(centralDirectory.length), ...u32(centralOffset), ...u16(0)
    ]);
    return joinBytes([...localParts, centralDirectory, end]);
  }

  function makeXlsx(records, selectedKeys) {
    const files = [
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Atlas Leads" sheetId="1" r:id="rId1"/></sheets></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/><family val="2"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF176B49"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
      { name: 'xl/worksheets/sheet1.xml', data: createSheetXml(records, selectedKeys) }
    ];
    return zipStore(files);
  }

  function buildBlob(records, format, selectedKeys) {
    const selected = FORMATS[format] ? format : 'csv';
    const spec = FORMATS[selected];
    let content;
    if (selected === 'csv') content = '\uFEFF' + makeDelimited(records, ',', selectedKeys);
    else if (selected === 'tsv') content = '\uFEFF' + makeDelimited(records, '\t', selectedKeys);
    else if (selected === 'json') content = JSON.stringify(normalizeRecords(records, selectedKeys), null, 2);
    else content = makeXlsx(records, selectedKeys);
    return { blob: new Blob([content], { type: spec.mime }), extension: spec.extension, mime: spec.mime };
  }

  const api = { columns: COLUMNS, formats: FORMATS, makeFilename, normalizeFilenameParts, normalizeRecords, resolveColumns, makeDelimited, makeXlsx, buildBlob, loadWorldCityDatabase, registerWorldCityRows };
  root.AtlasExport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
