(() => {
  // Version the guard so an updated collector can be injected into an already
  // open Maps tab after the extension is reloaded.
  if (window.__MAPLEADS_CONTENT_V130__ === '1.14.0') return;
  window.__MAPLEADS_CONTENT_V130__ = '1.14.0';

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function waitUntilResumed() {
    while (pauseRequested && !stopRequested) await sleep(250);
  }
  let stopRequested = false;
  let pauseRequested = false;
  let scanRunning = false;
  let currentTask = null;
  let activeTaskResetEpoch = 0;

  const ICONS = /[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/gu;
  const CTA_EXACT = /^(?:order(?: online)?|reserve(?: a table)?|book(?: online)?|call now|call|directions|website|visit website|save|share|menu|more|learn more|get quote|request a quote|make appointment|appointments|check availability|view menu|view all|sponsored|ad)$/i;
  const AMENITIES = /^(?:dine[- ]in|no dine[- ]in|take[- ]?away|no take[- ]?away|takeout|no takeout|delivery|no delivery|no-contact delivery|curbside pickup|kerbside pickup|drive[- ]through|in-store shopping|onsite services|outdoor seating|offers dine-in|offers takeout|offers delivery|wheelchair accessible entrance)$/i;
  const HOURS_LINE = /^(?:open(?: now| 24 hours| all day)?\b|closed\b|closes? soon\b|closes? (?:at )?\d|opens? soon\b|opens? at\b|opens? \d|temporarily closed\b|permanently closed\b|hours may differ\b)/i;
  const RATING_LINE = /(?:^|\s)([0-5](?:[.,]\d)?)\s*(?:[★☆]{1,5}\s*)?\(\s*(?:\d[\d,]*|\d+(?:\.\d+)?\s*[KkMm])\s*\)/;
  const PRICE_LINE = /(?:\$\s?\d+(?:\s*[–-]\s*\$?\s?\d+|\+)?|\${1,4}|₹\s?[\d,]+(?:\s*[–-]\s*₹?\s?[\d,]+|\+)?|€\s?\d+(?:\s*[–-]\s*€?\s?\d+|\+)?|£\s?\d+(?:\s*[–-]\s*£?\s?\d+|\+)?)/;

  function cleanText(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(ICONS, ' ')
      .replace(/[\u200B-\u200F\uFEFF]/g, '')
      .replace(/[\t\r]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s*[·•|]\s*/g, ' · ')
      .trim()
      .replace(/^(?:·\s*)+|(?:\s*·)+$/g, '')
      .trim();
  }

  function textOf(el) {
    return (el?.innerText || el?.textContent || '')
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map(cleanText)
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  function splitParts(line) {
    return String(line || '').split(/\s*[·•|]\s*/).map(cleanText).filter(Boolean);
  }

  function isAmenityOrAction(value) {
    const text = cleanText(value).replace(/[.!…]+$/g, '').trim();
    return !text || CTA_EXACT.test(text) || AMENITIES.test(text);
  }

  function isRatingOrReviewLine(line) {
    const text = cleanText(line);
    return RATING_LINE.test(text) || /^\(?\s*\d[\d,]*\s*\)?\s*(?:reviews?)?$/i.test(text) || /\b\d[\d,]*\s+reviews?\b/i.test(text);
  }

  function isMetadataLine(line) {
    const text = cleanText(line);
    return !text || /^(?:sponsored|ad)$/i.test(text) || isAmenityOrAction(text) || HOURS_LINE.test(text) || isRatingOrReviewLine(text) || PRICE_LINE.test(text) && !/[A-Za-z]{3,}/.test(text);
  }

  function looksLikeAddress(part) {
    const text = cleanText(part);
    if (!text || text.length > 190 || PRICE_LINE.test(text) || isAmenityOrAction(text) || HOURS_LINE.test(text)) return false;
    const addressWord = /\b(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|highway|hwy\.?|parkway|pkwy|place|pl\.?|court|ct\.?|way|suite|ste\.?|unit|floor|fl\.?|building|bldg\.?|sector|nagar|marg|block|district|postcode|postal code|zip code|p\.o\.? box)\b/i.test(text);
    const localityWord = /\b(?:Mohali|Chandigarh|India|Australia|United States|United Kingdom|Canada|New York|California|Texas|Punjab)\b/i.test(text);
    return addressWord && /\d/.test(text) || localityWord && (/,/.test(text) || /\d/.test(text)) || /\b\d{1,6}\s+\w+(?:\s+\w+){0,5}\b/.test(text) && /\d/.test(text) && text.length < 100;
  }

  function looksLikeName(line) {
    const text = cleanText(line);
    if (!text || text.length < 2 || text.length > 130) return false;
    if (isMetadataLine(text) || isRatingOrReviewLine(text) || PRICE_LINE.test(text) || looksLikeAddress(text)) return false;
    if (/^[\W\d_]+$/u.test(text)) return false;
    if (/^(?:results? for|search results|google maps)$/i.test(text)) return false;
    return true;
  }

  function parseRating(rawText) {
    const text = cleanText(rawText).replace(/\n/g, ' · ');
    let match = text.match(/\b([0-5](?:[.,]\d)?)\s*(?:[★☆]{1,5}\s*)?\(\s*((?:\d{1,3}(?:,\d{3})+)|\d+(?:\.\d+)?\s*[KkMm]?)\s*\)/);
    if (!match) match = text.match(/\b([0-5](?:[.,]\d)?)\s*stars?\b[^\d]{0,24}([\d,]+)\s*reviews?\b/i);
    return {
      rating: match ? match[1].replace(',', '.') : '',
      reviews: match ? String(match[2]).replace(/\s/g, '') : ''
    };
  }

  function parsePrice(rawText) {
    const all = String(rawText || '').replace(/\u00a0/g, ' ');
    const matches = all.match(/(?:\$\s?\d+(?:\s*[–-]\s*\$?\s?\d+|\+)|\${1,4}|₹\s?[\d,]+(?:\s*[–-]\s*₹?\s?[\d,]+|\+)?|€\s?\d+(?:\s*[–-]\s*€?\s?\d+|\+)?|£\s?\d+(?:\s*[–-]\s*£?\s?\d+|\+)?)/g);
    return matches ? cleanText(matches[0]) : '';
  }

  function parseCardText(rawText, preferredName = '') {
    const lines = String(rawText || '')
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map(cleanText)
      .filter(Boolean);
    const joined = lines.join('\n');
    const { rating, reviews } = parseRating(joined);
    const priceRange = parsePrice(joined);

    let name = '';
    const pref = cleanText(preferredName);
    if (looksLikeName(pref)) name = pref;
    if (!name) name = lines.find(looksLikeName) || '';
    // Google Maps sometimes repeats the name below a sponsored/icon row.
    const nameNorm = name.toLocaleLowerCase();

    let category = '';
    let address = '';
    let hours = '';
    let description = '';
    const semanticLines = [];

    for (const line of lines) {
      if (!hours && HOURS_LINE.test(line)) hours = line;
      if (!isMetadataLine(line) && !isRatingOrReviewLine(line) && !PRICE_LINE.test(line) && line.toLocaleLowerCase() !== nameNorm) {
        semanticLines.push(line);
      }
    }

    // Extract category and address from the common "Category · address" row.
    for (const line of semanticLines) {
      const parts = splitParts(line).filter(part => !isAmenityOrAction(part) && !HOURS_LINE.test(part) && !PRICE_LINE.test(part));
      if (!parts.length) continue;
      const addrPart = parts.find(looksLikeAddress);
      if (addrPart && !address) {
        address = addrPart;
        const categoryPart = parts.find(part => part !== addrPart && !looksLikeAddress(part) && !/\d/.test(part) && part.length <= 85);
        if (categoryPart && !category) category = categoryPart;
        continue;
      }
      if (!category && parts.length >= 2) {
        const first = parts.find(part => !looksLikeAddress(part) && !/\d/.test(part) && part.length <= 85);
        if (first) category = first;
      }
    }

    // Fallback category only from concise, label-like lines, never CTA chips or descriptions.
    if (!category) {
      for (const line of semanticLines) {
        const parts = splitParts(line);
        const candidate = parts.find(part => part && !isAmenityOrAction(part) && !looksLikeAddress(part) && !/\d/.test(part) && part.length <= 38);
        if (candidate && candidate.split(/\s+/).length <= 4 && !/[.!?]$/.test(candidate) && !/\b(?:for|offering|featuring|serving|known for|spot for|place for|housemade|hangout|speciali[sz]es)\b/i.test(candidate)) {
          category = candidate;
          break;
        }
      }
    }

    const omitted = new Set([name.toLocaleLowerCase(), category.toLocaleLowerCase(), address.toLocaleLowerCase(), hours.toLocaleLowerCase()].filter(Boolean));
    for (const line of semanticLines) {
      if (omitted.has(line.toLocaleLowerCase())) continue;
      const usefulParts = splitParts(line).filter(part => !isAmenityOrAction(part) && !looksLikeAddress(part) && !PRICE_LINE.test(part));
      const candidate = usefulParts.join(' · ').trim();
      if (!candidate || candidate.toLocaleLowerCase() === category.toLocaleLowerCase()) continue;
      if (candidate.length >= 14 && candidate.length <= 220 && !HOURS_LINE.test(candidate) && !isRatingOrReviewLine(candidate)) {
        description = candidate;
        break;
      }
    }

    let keptNameLine = false;
    const cleanedLines = lines.filter(line => {
      if (/^(?:sponsored|ad)$/i.test(line)) return false;
      if (isAmenityOrAction(line)) return false;
      // Standalone amenity tokens can be newline-separated by Maps.
      if (splitParts(line).every(part => isAmenityOrAction(part))) return false;
      // Maps often repeats the business title after a sponsored or icon-only row.
      if (name && line.toLocaleLowerCase() === nameNorm) {
        if (keptNameLine) return false;
        keptNameLine = true;
      }
      return true;
    });

    return {
      name,
      category,
      rating,
      reviews,
      priceRange,
      address,
      hours,
      description,
      listingText: cleanedLines.join('\n').slice(0, 1600)
    };
  }

  function getFeed() {
    return document.querySelector('[role="feed"]') || document.querySelector('div[aria-label*="Results for"] [role="feed"]');
  }

  function placeKey(href) {
    try {
      const url = new URL(href, location.href);
      const internalId = url.href.match(/!1s([^!]+)/);
      if (internalId) return internalId[1];
      const path = url.pathname.match(/^\/maps\/place\/([^/]+)/i);
      return path ? decodeURIComponent(path[1]).toLocaleLowerCase() : url.href.split('?')[0];
    } catch { return href || ''; }
  }

  function getCard(anchor) {
    const preferred = anchor.closest('[role="article"]') || anchor.closest('.Nv2PK') || anchor.closest('.bfdHYd') || anchor.closest('[data-result-index]');
    if (preferred && textOf(preferred).length > 4) {
      const urls = Array.from(preferred.querySelectorAll('a[href*="/maps/place/"]')).map(a => placeKey(a.href));
      if (new Set(urls).size <= 1) return preferred;
    }
    let el = anchor.parentElement;
    for (let i = 0; el && i < 10; i++, el = el.parentElement) {
      const txt = textOf(el);
      const rect = el.getBoundingClientRect?.() || { width: 0, height: 0 };
      const urls = Array.from(el.querySelectorAll?.('a[href*="/maps/place/"]') || []).map(a => placeKey(a.href));
      if (rect.width >= 160 && rect.height >= 55 && txt.length >= 8 && txt.length <= 2200 && new Set(urls).size === 1) return el;
    }
    return anchor.parentElement || anchor;
  }

  function getListingAnchors(feed) {
    const anchors = Array.from(feed.querySelectorAll('a[href*="/maps/place/"]'));
    const seen = new Set();
    return anchors.filter(anchor => {
      const key = placeKey(anchor.href);
      if (!key || seen.has(key) || !anchor.getClientRects().length) return false;
      const card = getCard(anchor);
      if (!textOf(card)) return false;
      seen.add(key);
      return true;
    });
  }

  function parseListing(anchor) {
    const card = getCard(anchor);
    const rawText = textOf(card);
    // Prefer actual visible heading text; ignore icon-only aria labels and CTA labels.
    let preferredName = '';
    const titleSelectors = ['.qBF1Pd', '[class*="fontHeadlineSmall"]', '[role="heading"]', 'h3', '[aria-level="3"]'];
    for (const selector of titleSelectors) {
      const node = card.querySelector(selector);
      const value = cleanText(node?.innerText || node?.textContent || '');
      if (looksLikeName(value)) { preferredName = value; break; }
    }
    if (!preferredName) {
      const label = cleanText(anchor.getAttribute('aria-label') || '');
      if (looksLikeName(label) && !/^(?:image|photo|open|more)$/i.test(label)) preferredName = label;
    }
    const parsed = parseCardText(rawText, preferredName);
    if (!parsed.name || parsed.name.length < 2) return null;

    const phoneNode = Array.from(card.querySelectorAll('a[href^="tel:"], [data-item-id^="phone:tel:"], [aria-label*="Phone"], [aria-label*="phone"], [aria-label*="Call"], [aria-label*="call"]')).find(node => node.getClientRects().length);
    const phoneHref = phoneNode?.getAttribute('href') || '';
    const phoneDataItem = phoneNode?.getAttribute('data-item-id') || '';
    const phoneLabel = phoneNode?.getAttribute('aria-label') || '';
    const phone = (phoneHref.startsWith('tel:') ? phoneFromText(phoneHref.slice(4)) : '')
      || (phoneDataItem.startsWith('phone:tel:') ? phoneFromText(phoneDataItem.slice('phone:tel:'.length)) : '')
      || phoneFromText(phoneLabel)
      || phoneFromText(Array.from(rawText.split('\n')).find(line => /\b(?:phone|telephone|call)\b/i.test(line)) || '')
      || phoneFromCardText(rawText);
    const webLink = Array.from(card.querySelectorAll('a[href^="http"]')).find(a => {
      const href = a.href || '';
      const label = cleanText(`${a.getAttribute('aria-label') || ''} ${a.getAttribute('data-value') || ''} ${a.innerText || ''}`);
      return !/google\.[^/]+\/maps/i.test(href) && /\bwebsite\b/i.test(label) && !/order|reserve|delivery|booking/i.test(label);
    });
    return {
      ...parsed,
      parserVersion: 3,
      phone,
      website: webLink?.href || '',
      mapsUrl: anchor.href,
      collectedAt: new Date().toISOString()
    };
  }


  function phoneFromText(raw) {
    const value = cleanText(raw).replace(/^(?:phone|call|telephone|tel)\s*[:：]?\s*/i, '');
    const matches = value.match(/(?:\+?\d|\(\d{3}\))[\d\s().-]{5,}\d/g) || [];
    for (const candidate of matches) {
      const digits = candidate.replace(/\D/g, '');
      if (digits.length >= 7 && digits.length <= 15) return candidate.trim().replace(/^[\s,;，،'’]+(?=[+\d(])/, '').replace(/\s{2,}/g, ' ');
    }
    return '';
  }

  function phoneFromCardText(rawText) {
    const lines = String(rawText || '').split('\n').map(cleanText).filter(Boolean);
    for (const line of lines) {
      if (isRatingOrReviewLine(line)) continue;
      if (PRICE_LINE.test(line) && !/\b(?:phone|telephone|call|tel)\b/i.test(line)) continue;
      if (looksLikeAddress(line) && !/\b(?:phone|telephone|call|tel)\b/i.test(line)) continue;
      const candidate = phoneFromText(line);
      const digitCount = String(candidate || '').replace(/\D/g, '').length;
      if (candidate && digitCount >= 7 && digitCount <= 15) return candidate;
    }
    return '';
  }

  function extractPhoneFromProfile() {
    const selectors = [
      'a[href^="tel:"]',
      '[data-item-id^="phone:tel:"]',
      'button[aria-label*="Phone"]',
      'button[aria-label*="phone"]',
      'button[aria-label*="Call"]',
      '[data-tooltip*="phone"]'
    ];
    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        if (!node.getClientRects().length) continue;
        const href = node.getAttribute('href') || '';
        const dataItem = node.getAttribute('data-item-id') || '';
        const aria = node.getAttribute('aria-label') || '';
        const text = node.innerText || node.textContent || '';
        const direct = href.startsWith('tel:') ? href.slice(4) : dataItem.startsWith('phone:tel:') ? dataItem.slice('phone:tel:'.length) : '';
        const phone = phoneFromText(direct) || phoneFromText(aria) || phoneFromText(text);
        if (phone) return phone;
      }
    }
    // Some Maps layouts expose the phone as a detail-row label and a neighbouring value.
    for (const node of document.querySelectorAll('[data-item-id], .Io6YTe, button[aria-label]')) {
      if (!node.getClientRects().length) continue;
      const label = cleanText(`${node.getAttribute('aria-label') || ''} ${node.getAttribute('data-item-id') || ''} ${node.innerText || ''}`);
      if (!/\b(?:phone|telephone|call)\b/i.test(label)) continue;
      const phone = phoneFromText(label);
      if (phone) return phone;
    }
    return '';
  }

  function isPlaceDetailsUrl() {
    return /\/maps\/place\//i.test(location.pathname);
  }

  function isVisible(node) {
    return Boolean(node && node.getClientRects && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
  }

  function feedHasEndMarker(feed) {
    const text = cleanText(`${feed?.innerText || ''}\n${feed?.parentElement?.innerText || ''}`).toLocaleLowerCase();
    return /(?:you(?:'|’)ve reached the end of the list|you have reached the end of the list|end of the list|no more (?:places|results|businesses)|that(?:'|’)s all the results)/i.test(text);
  }

  function feedHasLoadingIndicator(feed) {
    if (!feed) return false;
    const selectors = '[aria-busy="true"], [role="progressbar"], [aria-label*="Loading"], [aria-label*="loading"], [class*="loading"]';
    return Array.from(feed.querySelectorAll(selectors)).some((node) => {
      if (!isVisible(node)) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }

  function feedAtBottom(feed) {
    return Boolean(feed && feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 12);
  }

  function feedSignature(feed) {
    if (!feed) return '';
    const anchors = getListingAnchors(feed);
    const keys = anchors.map((anchor) => placeKey(anchor.href)).filter(Boolean);
    return `${keys.length}|${keys[0] || ''}|${keys[keys.length - 1] || ''}|${feed.scrollHeight}|${cleanText(anchors[anchors.length - 1] ? textOf(getCard(anchors[anchors.length - 1])) : '').slice(0, 90)}`;
  }

  async function waitForFeedUntilAvailable() {
    let lastHeartbeat = 0;
    while (!stopRequested) {
      await waitUntilResumed();
      const feed = getFeed();
      if (feed) return feed;
      if (Date.now() - lastHeartbeat > 3500) {
        lastHeartbeat = Date.now();
        await updateStatus({ running: true, progress: 8, message: 'Waiting for Google Maps results to load…', phase: 'waiting' });
      }
      await sleep(900);
    }
    return null;
  }

  async function waitForFeedGrowth(initialFeed, initialSignature) {
    let feed = initialFeed;
    let noBusyMs = 0;
    let lastHeartbeat = 0;
    let lastSignature = initialSignature;
    let lastHeight = feed?.scrollHeight || 0;
    // There is deliberately no total scan timeout. At the list bottom, wait patiently
    // for new DOM records. A visible loading indicator resets the idle counter indefinitely.
    while (!stopRequested) {
      await waitUntilResumed();
      await sleep(1400);
      const nextFeed = getFeed();
      if (nextFeed) feed = nextFeed;
      if (!feed) {
        if (Date.now() - lastHeartbeat > 4000) {
          lastHeartbeat = Date.now();
          await updateStatus({ running: true, progress: 35, message: 'Waiting for the Maps results panel to return…', phase: 'waiting' });
        }
        continue;
      }
      if (feedHasEndMarker(feed)) return { feed, ended: true, reason: 'explicit end-of-list marker' };
      const signature = feedSignature(feed);
      const height = feed.scrollHeight;
      if (signature !== lastSignature || height !== lastHeight) return { feed, changed: true };
      const loading = feedHasLoadingIndicator(feed);
      if (loading) {
        noBusyMs = 0;
        if (Date.now() - lastHeartbeat > 4000) {
          lastHeartbeat = Date.now();
          await updateStatus({ running: true, progress: 35, message: 'Google Maps is still loading results… waiting without a hard timeout.', phase: 'waiting' });
        }
        continue;
      }
      if (!feedAtBottom(feed)) return { feed, changed: true };
      noBusyMs += 1400;
      if (Date.now() - lastHeartbeat > 5000) {
        lastHeartbeat = Date.now();
        await updateStatus({ running: true, progress: 42, message: `At the end of loaded results. Waiting for more listings… (${Math.floor(noBusyMs / 1000)}s idle)`, phase: 'waiting' });
      }
      // No global time limit. This is only a bottom-of-list fallback when there is no
      // loading signal and the list geometry/content has remained completely unchanged.
      if (noBusyMs >= 90000) return { feed, ended: true, reason: 'list remained idle at bottom with no loading indicator for 90 seconds' };
    }
    return { feed, stopped: true };
  }

  async function waitForProfilePhoneOrStable(initialHref) {
    let previousSignature = '';
    let stableCount = 0;
    let lastHeartbeat = 0;
    const started = Date.now();
    while (!stopRequested) {
      await waitUntilResumed();
      const phone = extractPhoneFromProfile();
      if (phone) return phone;
      const detailRoot = document.querySelector('[role="main"]') || document.body;
      const detailText = cleanText(detailRoot?.innerText || '').slice(0, 1200);
      const signature = `${location.href}|${detailText}`;
      const looksLikeProfile = isPlaceDetailsUrl() || location.href !== initialHref || Boolean(document.querySelector('[data-item-id^="phone:tel:"]'));
      const busy = Boolean(detailRoot?.querySelector('[aria-busy="true"], [role="progressbar"], [aria-label*="Loading"], [aria-label*="loading"]'));
      if (looksLikeProfile && !busy && signature === previousSignature) stableCount++;
      else stableCount = 0;
      previousSignature = signature;
      // If profile data has stopped changing for several checks, a missing phone is treated
      // as genuinely absent. Slow loading indicators cause an indefinite wait until resolved.
      if (looksLikeProfile && !busy && stableCount >= 6 && Date.now() - started >= 8000) return '';
      if (Date.now() - lastHeartbeat > 4000) {
        lastHeartbeat = Date.now();
        await updateStatus({ running: true, progress: 40, mode: 'phones', message: 'Waiting for the business profile to finish loading…', phase: 'waiting' });
      }
      await sleep(800);
    }
    return '';
  }

  async function returnToResults() {
    if (!getFeed() || isPlaceDetailsUrl()) {
      const buttons = Array.from(document.querySelectorAll('button'));
      const backButton = buttons.find((button) => {
        if (!isVisible(button)) return false;
        const label = cleanText(`${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''} ${button.getAttribute('data-tooltip') || ''}`);
        return /^(?:back|back to results|back to search results|return to results)$/i.test(label);
      });
      if (backButton) backButton.click();
      else history.back();
    }
    let lastHeartbeat = 0;
    // No fixed network timeout. The stop button remains available while the page loads.
    while (true) {
      await waitUntilResumed();
      const feed = getFeed();
      if (feed && !isPlaceDetailsUrl()) return true;
      if (stopRequested) return false;
      if (Date.now() - lastHeartbeat > 4000) {
        lastHeartbeat = Date.now();
        await updateStatus({ running: true, progress: 42, mode: 'phones', message: 'Waiting for Google Maps to return to the results list…', phase: 'waiting' });
      }
      await sleep(900);
    }
  }

  async function enrichPhones(limit, delay, requestedResetEpoch = null) {
    if (scanRunning) return;
    scanRunning = true;
    stopRequested = false;
    pauseRequested = false;
    const started = Date.now();
    let found = 0;
    let attempted = 0;
    let totalPending = 0;
    let originalScrollTop = 0;
    try {
      const currentEpoch = await readResetEpoch();
      if (Number.isInteger(requestedResetEpoch) && requestedResetEpoch !== currentEpoch) {
        stopRequested = true;
        return;
      }
      activeTaskResetEpoch = currentEpoch;
      let records = await getStoredRecords(activeTaskResetEpoch);
      const pending = records.filter((record) => !cleanText(record.phone) && !record.phoneLookupAttempted && record.mapsUrl);
      totalPending = pending.length;
      if (!totalPending) {
        await updateStatus({ running: false, progress: 100, startedAt: started, message: 'No unprocessed phone-number lookups remain in saved records.', collected: 0, total: records.length, mode: 'phones' });
        return;
      }
      let feed = await waitForFeedUntilAvailable();
      if (!feed) {
        await updateStatus({ running: false, progress: 0, startedAt: started, message: 'Phone lookup stopped before the results list loaded. Saved rows were kept.', total: records.length, mode: 'phones' });
        return;
      }
      originalScrollTop = feed.scrollTop;
      feed.scrollTo({ top: 0, behavior: 'auto' });
      await sleep(Math.max(650, delay));
      const pendingByKey = new Map(pending.map((record) => [placeKey(record.mapsUrl), record]).filter(([key]) => Boolean(key)));
      const processed = new Set();
      await updateStatus({ running: true, progress: 1, startedAt: started, message: `Phone lookup started · ${totalPending} saved listings pending…`, collected: 0, total: totalPending, mode: 'phones' });

      while (!stopRequested && (limit <= 0 || attempted < limit)) {
        await waitUntilResumed();
        feed = getFeed() || await waitForFeedUntilAvailable();
        if (!feed || stopRequested) break;
        const anchors = getListingAnchors(feed);
        const candidate = anchors.find((anchor) => {
          const key = placeKey(anchor.href);
          return key && pendingByKey.has(key) && !processed.has(key);
        });

        if (candidate) {
          const key = placeKey(candidate.href);
          const beforeHref = location.href;
          processed.add(key);
          candidate.scrollIntoView({ block: 'center', behavior: 'auto' });
          await sleep(180);
          candidate.click();
          const phone = await waitForProfilePhoneOrStable(beforeHref);
          if (stopRequested) break;
          records = await getStoredRecords();
          const index = records.findIndex((record) => placeKey(record.mapsUrl) === key);
          if (index >= 0) {
            records[index] = {
              ...records[index],
              phone: phone || records[index].phone || '',
              phoneLookupAttempted: true,
              phoneLookupStatus: phone ? 'found' : 'not shown on Maps profile',
              phoneCheckedAt: new Date().toISOString()
            };
            await persistRecords(records, activeTaskResetEpoch);
          }
          attempted++;
          if (phone) found++;
          await updateStatus({
            running: true,
            progress: totalPending ? Math.min(95, Math.round((attempted / totalPending) * 95)) : 95,
            startedAt: started,
            message: phone ? `Phone found · ${attempted} checked, ${found} found` : `Profile checked · ${attempted} checked, ${found} found`,
            collected: attempted, found, total: totalPending, mode: 'phones'
          });
          let restored = true;
          if (!stopRequested) restored = await returnToResults();
          if (stopRequested || !restored) break;
          await sleep(Math.max(350, delay / 2));
        } else {
          if (feedHasEndMarker(feed)) break;
          const atBottom = feedAtBottom(feed);
          if (!atBottom) {
            const before = feed.scrollTop;
            const increment = Math.max(420, feed.clientHeight * 0.75);
            const target = Math.min(feed.scrollHeight - feed.clientHeight, before + increment);
            feed.scrollTo({ top: Math.max(0, target), behavior: 'auto' });
            feed.dispatchEvent(new WheelEvent('wheel', { deltaY: increment, bubbles: true }));
            await sleep(Math.max(800, delay));
          } else {
            const baseline = feedSignature(feed);
            feed.scrollTo({ top: feed.scrollHeight, behavior: 'auto' });
            feed.dispatchEvent(new WheelEvent('wheel', { deltaY: Math.max(300, feed.clientHeight * 0.5), bubbles: true }));
            const result = await waitForFeedGrowth(feed, baseline);
            if (result.ended) break;
            if (result.feed) feed = result.feed;
          }
        }
      }
      const finalFeed = getFeed();
      if (finalFeed && !isPlaceDetailsUrl()) finalFeed.scrollTo({ top: originalScrollTop, behavior: 'auto' });
      const message = stopRequested
        ? `Phone lookup stopped. Checked ${attempted}; found ${found} phone numbers. Saved rows were kept.`
        : `Phone lookup finished. Checked ${attempted}; found ${found} phone numbers.`;
      await updateStatus({ running: false, progress: 100, startedAt: started, message, collected: attempted, found, total: totalPending, finishedAt: new Date().toISOString(), mode: 'phones' });
    } catch (error) {
      await updateStatus({ running: false, progress: 0, startedAt: started, message: `Phone lookup failed: ${error.message || error}`, collected: attempted, found, total: totalPending, error: true, mode: 'phones' });
    } finally {
      scanRunning = false;
    }
  }

  async function readResetEpoch() {
    const { mapLeadResetEpoch = 0 } = await chrome.storage.local.get('mapLeadResetEpoch');
    const epoch = Number(mapLeadResetEpoch || 0);
    return Number.isFinite(epoch) && epoch >= 0 ? epoch : 0;
  }

  async function getStoredRecords(expectedEpoch = activeTaskResetEpoch) {
    const data = await chrome.storage.local.get(['mapLeadRecords', 'mapLeadResetEpoch', 'mapLeadRecordsEpoch']);
    const resetEpoch = Number(data.mapLeadResetEpoch || 0);
    if (resetEpoch !== expectedEpoch) {
      stopRequested = true;
      return [];
    }
    const recordsEpoch = data.mapLeadRecordsEpoch == null ? 0 : Number(data.mapLeadRecordsEpoch);
    if (recordsEpoch !== resetEpoch) return [];
    return Array.isArray(data.mapLeadRecords) ? data.mapLeadRecords : [];
  }

  async function persistRecords(records, expectedEpoch = activeTaskResetEpoch) {
    const resetEpoch = await readResetEpoch();
    if (resetEpoch !== expectedEpoch) {
      stopRequested = true;
      return false;
    }
    // Write the generation marker with the data. If a reset wins a race with
    // this write, popup readers will reject this older generation's array.
    await chrome.storage.local.set({
      mapLeadRecords: records,
      mapLeadRecordsEpoch: expectedEpoch,
      mapLeadParserVersion: 3
    });
    return true;
  }

  async function updateStatus(status) {
    const resetEpoch = await readResetEpoch();
    if (resetEpoch !== activeTaskResetEpoch) {
      stopRequested = true;
      return false;
    }
    const previousData = await chrome.storage.local.get('mapLeadStatus');
    const previous = previousData.mapLeadStatus || {};
    const nextStatus = { ...previous, ...status, paused: status.running === false ? false : (status.paused === undefined ? Boolean(previous.paused && pauseRequested) : Boolean(status.paused)), updatedAt: Date.now() };
    await chrome.storage.local.set({ mapLeadStatus: nextStatus });
    // Close the narrow race where a reset lands after the epoch check but
    // before this status write completes. Never overwrite a newer task's status.
    if ((await readResetEpoch()) !== activeTaskResetEpoch) {
      stopRequested = true;
      const current = (await chrome.storage.local.get('mapLeadStatus')).mapLeadStatus || {};
      if (current.startedAt === nextStatus.startedAt && current.mode === nextStatus.mode) {
        await chrome.storage.local.set({ mapLeadStatus: {
          running: false, progress: 0, updatedAt: Date.now(),
          message: 'Saved data reset. Start a new scan whenever ready.', interrupted: false
        } });
      }
      return false;
    }
    return true;
  }

  async function migrateRecords(records, expectedEpoch = activeTaskResetEpoch) {
    let changed = false;
    const migrated = records.map((record) => {
      if (Number(record.parserVersion || 0) >= 3) return record;
      const parsed = record.listingText ? parseCardText(record.listingText, record.name || '') : {};
      const lineWithPhone = String(record.listingText || '').split('\n').find((line) => /\b(?:phone|telephone|tel|call)\b/i.test(line));
      const recoveredPhone = record.phone || phoneFromText(lineWithPhone || '') || phoneFromCardText(record.listingText || '');
      const next = {
        ...record,
        name: record.name || parsed.name || '',
        category: parsed.category || record.category || '',
        rating: parsed.rating || record.rating || '',
        reviews: parsed.reviews || record.reviews || '',
        priceRange: parsed.priceRange || record.priceRange || '',
        address: parsed.address || record.address || '',
        hours: parsed.hours || record.hours || '',
        description: parsed.description || record.description || '',
        phone: recoveredPhone,
        listingText: parsed.listingText || record.listingText || '',
        mapsUrl: record.mapsUrl || '',
        website: record.website || '',
        collectedAt: record.collectedAt || new Date().toISOString(),
        parserVersion: 3
      };
      changed = true;
      return next;
    });
    if (changed) await persistRecords(migrated, expectedEpoch);
    return migrated;
  }

  function stableRecordKey(record) {
    const rawUrl = String(record?.mapsUrl || '').trim();
    if (rawUrl) return placeKey(rawUrl);
    return `${cleanText(record?.name).toLocaleLowerCase()}|${cleanText(record?.address).toLocaleLowerCase()}`;
  }

  async function scan(limit, delay, requestedResetEpoch = null) {
    if (scanRunning) return;
    scanRunning = true;
    stopRequested = false;
    pauseRequested = false;
    let records = [];
    const started = Date.now();
    try {
      const currentEpoch = await readResetEpoch();
      if (Number.isInteger(requestedResetEpoch) && requestedResetEpoch !== currentEpoch) {
        stopRequested = true;
        return;
      }
      activeTaskResetEpoch = currentEpoch;
      records = await migrateRecords(await getStoredRecords(activeTaskResetEpoch), activeTaskResetEpoch);
      const seen = new Set(records.map(stableRecordKey).filter(Boolean));
      await updateStatus({ running: true, progress: 4, startedAt: started, mode: 'scan', message: 'Waiting for Google Maps results to load…', collected: 0, total: records.length, interrupted: false });
      let feed = await waitForFeedUntilAvailable();
      if (!feed || stopRequested) {
        await updateStatus({ running: false, progress: 0, startedAt: started, message: 'Scan stopped before the results list was ready. Saved rows were kept.', total: records.length, mode: 'scan' });
        return;
      }
      let newThisRun = 0;
      let lastHeartbeat = 0;

      while (!stopRequested && (limit <= 0 || newThisRun < limit)) {
        await waitUntilResumed();
        feed = getFeed() || await waitForFeedUntilAvailable();
        if (!feed || stopRequested) break;
        const anchors = getListingAnchors(feed);
        let addedThisCycle = 0;
        for (const anchor of anchors) {
          await waitUntilResumed();
          if (stopRequested || (limit > 0 && newThisRun >= limit)) break;
          const key = placeKey(anchor.href);
          if (!key || seen.has(key)) continue;
          const item = parseListing(anchor);
          if (!item?.name) continue;
          const record = {
            ...item,
            parserVersion: 3,
            phone: item.phone || phoneFromText(String(item.listingText || '').split('\n').find((line) => /\b(?:phone|telephone|tel|call)\b/i.test(line)) || '') || phoneFromCardText(item.listingText || ''),
            phoneLookupAttempted: false,
            phoneLookupStatus: item.phone ? 'found on listing card' : '',
            phoneCheckedAt: item.phone ? new Date().toISOString() : '',
            mapsUrl: anchor.href,
            collectedAt: new Date().toISOString()
          };
          seen.add(key);
          records.push(record);
          newThisRun++;
          addedThisCycle++;
        }
        // Persist after every DOM cycle so a popup close or later page issue never loses previous results.
        if (addedThisCycle) {
          try {
            await persistRecords(records, activeTaskResetEpoch);
          } catch (storageError) {
            throw new Error(`Couldn't save ${records.length} rows to Chrome storage: ${storageError.message || storageError}. Export or reset some saved data and retry.`);
          }
        }
        if (Date.now() - lastHeartbeat > 1000 || addedThisCycle) {
          lastHeartbeat = Date.now();
          const msg = addedThisCycle
            ? `Saved ${addedThisCycle} new listing${addedThisCycle === 1 ? '' : 's'} · ${records.length.toLocaleString()} total. Scrolling for more…`
            : `Collected ${newThisRun.toLocaleString()} new listings · ${records.length.toLocaleString()} saved total. Checking for more…`;
          await updateStatus({ running: true, progress: 42, startedAt: started, message: msg, collected: newThisRun, total: records.length, mode: 'scan' });
        }

        if (limit > 0 && newThisRun >= limit) break;
        if (feedHasEndMarker(feed)) break;

        if (!feedAtBottom(feed)) {
          const before = feed.scrollTop;
          const maxTop = Math.max(0, feed.scrollHeight - feed.clientHeight);
          const increment = Math.max(420, Math.floor(feed.clientHeight * 0.74));
          const target = Math.min(maxTop, before + increment);
          feed.scrollTo({ top: target, behavior: 'auto' });
          feed.dispatchEvent(new WheelEvent('wheel', { deltaY: increment, bubbles: true }));
          await sleep(Math.max(850, delay));
          const nextFeed = getFeed();
          if (nextFeed) feed = nextFeed;
          continue;
        }

        // At the currently loaded bottom, nudge Maps to request the next batch, then wait.
        // Loading indicators reset the idle timer; there is no total run timeout.
        const signature = feedSignature(feed);
        feed.scrollTo({ top: feed.scrollHeight, behavior: 'auto' });
        feed.dispatchEvent(new WheelEvent('wheel', { deltaY: Math.max(300, Math.floor(feed.clientHeight * 0.55)), bubbles: true }));
        const result = await waitForFeedGrowth(feed, signature);
        if (result.stopped) break;
        if (result.feed) feed = result.feed;
        if (result.ended) {
          // The final lazy-loaded batch can arrive at the same moment as the end marker.
          // Do one final pass before stopping so that batch isn't silently missed.
          const finalFeed = getFeed() || feed;
          let finalAdded = 0;
          for (const anchor of getListingAnchors(finalFeed)) {
            await waitUntilResumed();
            if (stopRequested || (limit > 0 && newThisRun >= limit)) break;
            const key = placeKey(anchor.href);
            if (!key || seen.has(key)) continue;
            const item = parseListing(anchor);
            if (!item?.name) continue;
            const record = {
              ...item,
              parserVersion: 3,
              phone: item.phone || phoneFromText(String(item.listingText || '').split('\n').find((line) => /\b(?:phone|telephone|tel|call)\b/i.test(line)) || '') || phoneFromCardText(item.listingText || ''),
              phoneLookupAttempted: false,
              phoneLookupStatus: item.phone ? 'found on listing card' : '',
              phoneCheckedAt: item.phone ? new Date().toISOString() : '',
              mapsUrl: anchor.href,
              collectedAt: new Date().toISOString()
            };
            seen.add(key);
            records.push(record);
            newThisRun++;
            finalAdded++;
          }
          if (finalAdded) await persistRecords(records, activeTaskResetEpoch);
          await updateStatus({ running: true, progress: 92, startedAt: started, message: `Reached the end of the loaded list. Saving ${records.length.toLocaleString()} records…`, collected: newThisRun, total: records.length, mode: 'scan' });
          break;
        }
      }

      // Flush final records even after a stop request.
      await persistRecords(records, activeTaskResetEpoch);
      const scanned = newThisRun;
      const finalMessage = stopRequested
        ? `Stopped by you. ${scanned.toLocaleString()} new listings collected; ${records.length.toLocaleString()} total saved. Start again to continue; existing rows are kept.`
        : limit > 0 && scanned >= limit
          ? `Reached your ${limit}-listing limit. ${records.length.toLocaleString()} total saved. Press Start / continue to collect more.`
          : `Reached the end of the results list. ${scanned.toLocaleString()} new listings collected; ${records.length.toLocaleString()} total saved.`;
      await updateStatus({ running: false, progress: 100, startedAt: started, message: finalMessage, collected: scanned, total: records.length, finishedAt: new Date().toISOString(), mode: 'scan', phase: stopRequested ? 'stopped' : 'done' });
    } catch (error) {
      await updateStatus({ running: false, progress: 0, startedAt: started, message: `Scan paused safely: ${error.message || error}. Your already-saved rows remain available.`, total: records.length, error: true, mode: 'scan' });
    } finally {
      scanRunning = false;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'MAPLEADS_V130_START_SCAN') {
      const limit = Number(message.limit) > 0 ? Math.max(1, Math.trunc(Number(message.limit))) : 0;
      const delay = Math.max(800, Math.min(5000, Number(message.delay) || 1100));
      if (scanRunning) { sendResponse({ ok: false, error: 'A scan is already running in this Maps tab.' }); return false; }
      const task = scan(limit, delay, Number.isInteger(message.resetEpoch) ? message.resetEpoch : null);
      const trackedTask = task.finally(() => { if (currentTask === trackedTask) currentTask = null; });
      currentTask = trackedTask;
      sendResponse({ ok: true, started: true, unlimited: limit === 0 });
      return false;
    }
    if (message?.type === 'MAPLEADS_V130_PAUSE_SCAN') {
      if (!scanRunning) { sendResponse({ ok: false, error: 'No active collection task can be paused.' }); return false; }
      pauseRequested = true;
      updateStatus({ running: true, paused: true, message: 'Paused by you. Saved records are safe; resume when ready.', phase: 'paused' }).catch(() => {});
      sendResponse({ ok: true, paused: true });
      return false;
    }
    if (message?.type === 'MAPLEADS_V130_RESUME_SCAN') {
      if (!scanRunning) { sendResponse({ ok: false, error: 'No active collection task can be resumed.' }); return false; }
      pauseRequested = false;
      updateStatus({ running: true, paused: false, message: 'Resuming collection at the next safe checkpoint…' }).catch(() => {});
      sendResponse({ ok: true, resumed: true });
      return false;
    }
    if (message?.type === 'MAPLEADS_V130_STOP_SCAN') {
      pauseRequested = false;
      stopRequested = true;
      sendResponse({ ok: true, stopping: true });
      return false;
    }
    if (message?.type === 'MAPLEADS_V130_ENRICH_PHONES') {
      const limit = Number(message.limit) > 0 ? Math.max(1, Math.trunc(Number(message.limit))) : 0;
      const delay = Math.max(800, Math.min(5000, Number(message.delay) || 1100));
      if (scanRunning) { sendResponse({ ok: false, error: 'A collection or phone lookup is already running.' }); return false; }
      const task = enrichPhones(limit, delay, Number.isInteger(message.resetEpoch) ? message.resetEpoch : null);
      const trackedTask = task.finally(() => { if (currentTask === trackedTask) currentTask = null; });
      currentTask = trackedTask;
      sendResponse({ ok: true, started: true, unlimited: limit === 0 });
      return false;
    }
    if (message?.type === 'MAPLEADS_V130_RESET_DATA') {
      // Popup invalidates the data generation before sending this best-effort
      // stop signal. Existing tasks cannot persist records from an older epoch.
      pauseRequested = false;
      stopRequested = true;
      const task = currentTask;
      (async () => {
        try {
          if (task) await task;
          if (!Number.isInteger(message.resetEpoch)) {
            // Backward compatibility for a popup from an older build.
            const nextEpoch = (await readResetEpoch()) + 1;
            await chrome.storage.local.set({
              mapLeadResetEpoch: nextEpoch,
              mapLeadResetPending: false,
              mapLeadResetPendingAt: 0,
              mapLeadRecordsEpoch: nextEpoch - 1,
              mapLeadRecords: [],
              mapLeadStatus: { running: false, progress: 0, updatedAt: Date.now(), message: 'Saved data reset. Start a new scan whenever ready.', interrupted: false },
              mapLeadParserVersion: 3
            });
          }
          sendResponse({ ok: true, stopped: true, cleared: true });
        } catch (error) {
          sendResponse({ ok: false, error: String(error?.message || error) });
        }
      })();
      return true;
    }
    if (message?.type === 'MAPLEADS_V130_STATUS') {
      sendResponse({ ok: true, running: scanRunning, stopRequested });
      return false;
    }
    return false;
  });
})();
