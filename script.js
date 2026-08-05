// Scroll-reveal animation with staggered entrance for card grids
const revealEls = document.querySelectorAll('.reveal');

document.querySelectorAll('.advantages__grid, .catalog__grid, .reviews__grid').forEach((grid) => {
  Array.from(grid.children).forEach((card, i) => {
    card.style.transitionDelay = `${i * 40}ms`;
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

revealEls.forEach((el) => {
  const rect = el.getBoundingClientRect();
  const isAboveFold = rect.top < window.innerHeight && rect.bottom > 0;
  if (isAboveFold) {
    // Already in the initial viewport — skip the fade/slide-up transition
    // instead of animating it in. Measured on mobile: the first advantage
    // card sat "is-visible" with an 0.8s transition running, which alone
    // accounted for ~1s of LCP render-delay for zero visual benefit (nothing
    // to "reveal" — the user hasn't scrolled yet).
    el.style.transition = 'none';
    el.classList.add('is-visible');
  } else {
    observer.observe(el);
  }
});

// Lazy-load below-the-fold card/section photos (catalog cards, 2nd/3rd
// advantage card, contacts background) — these don't need to compete with
// the hero and the first (LCP) advantage photo for bandwidth on first paint.
const lazyBgEls = document.querySelectorAll('.lazy-bg[data-bg]');
const lazyBgObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    el.style.backgroundImage = el.dataset.bg;
    el.classList.add('is-loaded');
    lazyBgObserver.unobserve(el);
  });
}, { rootMargin: '400px' });
lazyBgEls.forEach((el) => lazyBgObserver.observe(el));

const contactsSection = document.getElementById('contacts');
if (contactsSection) {
  const contactsBgObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      contactsSection.classList.add('bg-loaded');
      contactsBgObserver.unobserve(contactsSection);
    });
  }, { rootMargin: '400px' });
  contactsBgObserver.observe(contactsSection);
}

// Solid header background after scrolling past the hero overlay
const header = document.getElementById('header');
const setHeaderState = () => header.classList.toggle('header--scrolled', window.scrollY > 40);
setHeaderState();
window.addEventListener('scroll', setHeaderState, { passive: true });

// Mobile burger menu
const burger = document.getElementById('burger');
const mobileNav = document.getElementById('mobileNav');

burger.addEventListener('click', () => {
  const isOpen = mobileNav.classList.toggle('open');
  burger.setAttribute('aria-expanded', String(isOpen));
});

mobileNav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    mobileNav.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  });
});

// Dock-style magnification for header nav: items scale up near the cursor
const dockNav = document.getElementById('headerNav');
if (dockNav && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const dockItems = Array.from(dockNav.querySelectorAll('a'));
  const maxScale = 1.18;
  const influence = 90; // px, radius of magnification effect

  dockNav.addEventListener('mousemove', (e) => {
    dockItems.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const distance = Math.abs(e.clientX - center);
      const scale = distance < influence
        ? 1 + (maxScale - 1) * (1 - distance / influence)
        : 1;
      item.style.transform = `scale(${scale})`;
    });
  });

  dockNav.addEventListener('mouseleave', () => {
    dockItems.forEach((item) => { item.style.transform = 'scale(1)'; });
  });
}

// Glowing cursor-tracking border on advantage cards
const glowCards = Array.from(document.querySelectorAll('.advantage-card'));
if (glowCards.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const proximity = 60; // px beyond the card edge that still lights up the glow

  glowCards.forEach((card) => {
    const glow = document.createElement('div');
    glow.className = 'advantage-card__glow';
    glow.setAttribute('aria-hidden', 'true');
    card.prepend(glow);
  });

  let ticking = false;
  const updateGlow = (mouseX, mouseY) => {
    glowCards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const isNear =
        mouseX > rect.left - proximity &&
        mouseX < rect.right + proximity &&
        mouseY > rect.top - proximity &&
        mouseY < rect.bottom + proximity;

      card.classList.toggle('glow-active', isNear);
      if (!isNear) return;

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const angle = (Math.atan2(mouseY - cy, mouseX - cx) * 180) / Math.PI + 90;
      card.style.setProperty('--glow-angle', angle);
    });
  };

  document.addEventListener('pointermove', (e) => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateGlow(e.clientX, e.clientY);
      ticking = false;
    });
  }, { passive: true });
}

// Catalog cards expand to a centered overlay on hover (desktop) / tap (touch)
const catalogGrid = document.getElementById('catalogGrid');
if (catalogGrid) {
  const hasHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const backdrop = document.createElement('div');
  backdrop.className = 'catalog-expand-backdrop';
  document.body.appendChild(backdrop);

  let activeOverlay = null;
  let activeSource = null;
  let activeSourceRect = null;

  const closeActive = () => {
    if (!activeOverlay) return;
    const overlay = activeOverlay;
    const source = activeSource;
    activeOverlay = null;
    activeSource = null;
    activeSourceRect = null;
    document.removeEventListener('mousemove', checkHoverZone);

    overlay.classList.remove('is-open');
    overlay.style.opacity = '0';
    overlay.style.transform = 'scale(0.85)';
    backdrop.classList.remove('is-open');
    source.classList.remove('is-source-active');
    source.setAttribute('aria-expanded', 'false');

    window.setTimeout(() => overlay.remove(), reduceMotion ? 0 : 450);
  };

  // While open, the overlay flies from the card's grid slot to the screen
  // center — a stationary cursor is no longer "over" either the overlay or
  // the (now hidden) card once it moves, which used to fire a spurious
  // mouseleave and immediately reopen. Track real cursor position against
  // both zones instead, with a small margin so it doesn't feel twitchy.
  const margin = 24;
  const pointInRect = (x, y, rect) =>
    x > rect.left - margin && x < rect.right + margin &&
    y > rect.top - margin && y < rect.bottom + margin;

  let hoverCheckTicking = false;
  const checkHoverZone = (e) => {
    if (hoverCheckTicking || !activeOverlay) return;
    hoverCheckTicking = true;
    requestAnimationFrame(() => {
      hoverCheckTicking = false;
      if (!activeOverlay) return;
      const overlayRect = activeOverlay.getBoundingClientRect();
      const inSource = activeSourceRect && pointInRect(e.clientX, e.clientY, activeSourceRect);
      const inOverlay = pointInRect(e.clientX, e.clientY, overlayRect);
      if (!inSource && !inOverlay) closeActive();
    });
  };

  const openCard = (cardEl) => {
    if (activeSource === cardEl || activeOverlay) return;

    const rectStart = cardEl.getBoundingClientRect();
    const mediaEl = cardEl.querySelector('.catalog-card__media');
    const title = cardEl.querySelector('h3').textContent;
    const fullText = cardEl.querySelector('.catalog-card__full').textContent;

    const overlay = document.createElement('div');
    overlay.className = 'catalog-expand-card';
    overlay.innerHTML =
      '<button class="catalog-expand-card__close" aria-label="Закрыть">&#10005;</button>' +
      '<div class="catalog-expand-card__media"></div>' +
      '<div class="catalog-expand-card__body"><h3></h3><p></p></div>';
    // Fall back to data-bg in case the lazy-load observer hasn't fired yet
    // (e.g. a very fast programmatic scroll straight to the card).
    overlay.querySelector('.catalog-expand-card__media').style.backgroundImage =
      mediaEl.style.backgroundImage || mediaEl.dataset.bg || '';
    overlay.querySelector('h3').textContent = title;
    overlay.querySelector('p').textContent = fullText;

    overlay.style.transition = 'none';
    overlay.style.top = `${rectStart.top}px`;
    overlay.style.left = `${rectStart.left}px`;
    overlay.style.width = `${rectStart.width}px`;
    overlay.style.height = `${rectStart.height}px`;
    overlay.style.borderRadius = getComputedStyle(cardEl).borderRadius;
    document.body.appendChild(overlay);

    // Pre-measure the expanded height at target width, then revert (same
    // synchronous frame, so no visual flash) before animating to it.
    const targetWidth = Math.min(560, window.innerWidth * 0.92);
    overlay.style.width = `${targetWidth}px`;
    overlay.style.height = 'auto';
    overlay.classList.add('is-open');
    const naturalHeight = overlay.getBoundingClientRect().height;
    const finalHeight = Math.min(naturalHeight, window.innerHeight * 0.82);
    overlay.style.overflowY = naturalHeight > finalHeight ? 'auto' : '';
    overlay.classList.remove('is-open');
    overlay.style.width = `${rectStart.width}px`;
    overlay.style.height = `${rectStart.height}px`;

    const targetLeft = (window.innerWidth - targetWidth) / 2;
    const targetTop = Math.max(16, (window.innerHeight - finalHeight) / 2);

    backdrop.classList.add('is-open');
    cardEl.classList.add('is-source-active');
    cardEl.setAttribute('aria-expanded', 'true');
    activeOverlay = overlay;
    activeSource = cardEl;
    activeSourceRect = rectStart;
    if (hasHover && !reduceMotion) {
      document.addEventListener('mousemove', checkHoverZone);
    }

    requestAnimationFrame(() => {
      overlay.style.transition = '';
      overlay.style.top = `${targetTop}px`;
      overlay.style.left = `${targetLeft}px`;
      overlay.style.width = `${targetWidth}px`;
      overlay.style.height = `${finalHeight}px`;
      overlay.style.borderRadius = '32px';
      overlay.classList.add('is-open');
    });

    overlay.querySelector('.catalog-expand-card__close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeActive();
    });
  };

  backdrop.addEventListener('click', closeActive);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeActive();
  });

  catalogGrid.querySelectorAll('.catalog-card').forEach((card) => {
    card.addEventListener('click', () => openCard(card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openCard(card);
      }
    });
    if (hasHover) {
      card.addEventListener('mouseenter', () => openCard(card));
    }
  });
}

// Contacts map (Yandex Maps JS API) — drops a pin at the shop's coordinates.
// Without an API key (developer.tech.yandex.ru) this stays inactive and the
// decorative pin placeholder shows instead, so the page never breaks.
//
// Coordinates are hardcoded (not geocoded at runtime) because Yandex JS API
// 2.1's geocode() uses a JSONP request that Chrome's Opaque Response
// Blocking (ORB) rejects — net::ERR_BLOCKED_BY_ORB — regardless of key/
// referer setup. OSM Nominatim's address match landed on the neighboring
// building (54В) instead of the shop's actual building (54) — these were
// hand-tuned against Yandex's own "В наш дом" business pin on their map.
const YANDEX_MAPS_API_KEY = 'ed2991cb-a0a1-45a8-a39c-59338261e975';
const SHOP_COORDS = [51.708914, 94.458418];
const mapContainer = document.getElementById('yandexMap');
if (mapContainer && YANDEX_MAPS_API_KEY) {
  // Loaded lazily (only once the contacts section nears the viewport) so
  // Yandex's third-party cookies/requests don't hit every single page view —
  // most visitors never scroll this far.
  let mapLoadStarted = false;
  const loadYandexMap = () => {
    if (mapLoadStarted) return;
    mapLoadStarted = true;
    const mapScript = document.createElement('script');
    mapScript.src = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_MAPS_API_KEY}&lang=ru_RU`;
    mapScript.onload = () => {
      window.ymaps.ready(() => {
        const map = new window.ymaps.Map('yandexMap', {
          center: SHOP_COORDS,
          zoom: 16,
          controls: ['zoomControl'],
        });
        map.behaviors.disable('scrollZoom');
        const placemark = new window.ymaps.Placemark(SHOP_COORDS, {
          hintContent: 'В наш дом',
          balloonContent: 'г. Кызыл, ул. Оюна Курседи, 54',
        }, { preset: 'islands#redDotIcon' });
        map.geoObjects.add(placemark);
        mapContainer.closest('.contacts__map').classList.add('is-ready');
      });
    };
    document.head.appendChild(mapScript);
  };

  const mapLoadObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      loadYandexMap();
      mapLoadObserver.disconnect();
    }
  }, { rootMargin: '400px' });
  mapLoadObserver.observe(mapContainer);
}

// Google Sheets webhook for quiz leads (name, phone, answers) — a Google Apps
// Script Web App deployed from the store's own Google account (sheet "Заявки
// с квиза"), since GitHub Pages has no backend. Redeploy notes live in the
// Apps Script project itself if this ever needs to be recreated.
const GOOGLE_SHEETS_QUIZ_WEBHOOK = 'https://script.google.com/macros/s/AKfycbyUXmwrpc8So3GobywnlGBb_ii-3j6qnuTco3t_Ta8xlVgu8Y13bHrrAwJNF9hCBtXXdQ/exec';

// "Подобрать материалы" quiz (hero + repeated in the closing CTA section) —
// a short guided flow (room → materials → timing → needs-calc → contact)
// that logs the lead to Google Sheets (see webhook above), then opens
// Telegram with the message pre-filled, since there's no backend on a
// static site.
const quizOpenBtns = document.querySelectorAll('.js-open-quiz');
if (quizOpenBtns.length) {
  const backdrop = document.getElementById('quizBackdrop');
  const modal = document.getElementById('quizModal');
  const closeBtn = document.getElementById('quizCloseBtn');
  const form = document.getElementById('quizForm');
  const steps = Array.from(form.querySelectorAll('.quiz-step'));
  const progressDots = Array.from(modal.querySelectorAll('.quiz-progress__step'));
  const noteEl = document.getElementById('quizNote');

  const ROOM_LABELS = {
    kitchen: 'кухня',
    bathroom: 'ванная',
    bedroom: 'спальня, гостиная',
    hallway: 'прихожая',
    whole: 'весь дом / несколько помещений',
  };
  const MATERIAL_LABELS = {
    doors: 'двери',
    floor: 'напольные покрытия',
    tile: 'плитка',
    wallpaper: 'обои',
    panels: 'панели МДФ/ПВХ',
    paint: 'краска',
    glue: 'клеи, герметики',
    curtains: 'гардины',
  };
  const TIMING_LABELS = {
    now: 'уже начал(а), материалы нужны сейчас',
    soon: 'в ближайшие 2 недели',
    month: 'в течение месяца',
    later: 'пока присматриваюсь',
  };
  const NEEDCALC_LABELS = {
    help: 'да, нужна помощь с расчётом',
    known: 'уже знаю точные размеры',
    unsure: 'пока не думал(а) — подскажите на месте',
  };
  // Radio group each step's "Далее" gates on — checkboxes (materials) aren't required.
  const STEP_REQUIRED_GROUP = { 1: 'room', 3: 'timing', 4: 'needcalc' };

  let currentStep = 1;

  const buildSummary = () => {
    const room = form.querySelector('input[name="room"]:checked');
    const materials = form.querySelectorAll('input[name="materials"]:checked');
    const timing = form.querySelector('input[name="timing"]:checked');
    const needCalc = form.querySelector('input[name="needcalc"]:checked');
    const roomText = room ? ROOM_LABELS[room.value] : '—';
    const materialsText = materials.length
      ? Array.from(materials).map((el) => MATERIAL_LABELS[el.value]).join(', ')
      : '—';
    const timingText = timing ? TIMING_LABELS[timing.value] : '—';
    const needCalcText = needCalc ? NEEDCALC_LABELS[needCalc.value] : '—';
    return {
      roomText, materialsText, timingText, needCalcText,
      display: `Помещение: ${roomText}. Материалы: ${materialsText}. Когда: ${timingText}. Расчёт количества: ${needCalcText}.`,
    };
  };

  const showStep = (n) => {
    currentStep = n;
    steps.forEach((step) => { step.hidden = Number(step.dataset.step) !== n; });
    progressDots.forEach((dot) => {
      const i = Number(dot.dataset.progress);
      dot.classList.toggle('is-active', i === n);
      dot.classList.toggle('is-done', i < n);
    });
  };

  // Quiz tile photos (room/materials/timing/needcalc — 20 images total,
  // including 8 reused from the catalog) load only once, the first time the
  // quiz is actually opened. Since the modal is `hidden` from page load,
  // scroll-position-based lazy loading doesn't apply here — without this,
  // the browser fetches all 20 backgrounds unconditionally on every visit,
  // even for the majority who never open the quiz.
  let quizPhotosLoaded = false;
  const loadQuizPhotos = () => {
    if (quizPhotosLoaded) return;
    quizPhotosLoaded = true;
    modal.querySelectorAll('.lazy-quiz-bg[data-bg]').forEach((el) => {
      el.style.backgroundImage = el.dataset.bg;
      el.classList.add('is-loaded');
    });
  };

  const openQuiz = () => {
    loadQuizPhotos();
    showStep(1);
    form.reset();
    noteEl.textContent = '';
    noteEl.classList.remove('is-error', 'is-success');
    backdrop.hidden = false;
    modal.hidden = false;
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      modal.classList.add('is-open');
    });
  };

  const closeQuiz = () => {
    backdrop.classList.remove('is-open');
    modal.classList.remove('is-open');
    window.setTimeout(() => { backdrop.hidden = true; modal.hidden = true; }, 300);
  };

  quizOpenBtns.forEach((btn) => btn.addEventListener('click', openQuiz));
  closeBtn.addEventListener('click', closeQuiz);
  backdrop.addEventListener('click', closeQuiz);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeQuiz();
  });

  form.querySelectorAll('.quiz-next').forEach((btn) => {
    btn.addEventListener('click', () => {
      const requiredGroup = STEP_REQUIRED_GROUP[currentStep];
      if (requiredGroup && !form.querySelector(`input[name="${requiredGroup}"]:checked`)) {
        return;
      }
      showStep(Number(btn.dataset.goto));
    });
  });
  form.querySelectorAll('.quiz-back').forEach((btn) => {
    btn.addEventListener('click', () => showStep(Number(btn.dataset.goto)));
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('quizName').value.trim();
    const phone = document.getElementById('quizPhone').value.trim();
    const digits = phone.replace(/\D/g, '');

    noteEl.classList.remove('is-error', 'is-success');
    if (!name || digits.length < 10) {
      noteEl.textContent = 'Укажите имя и телефон полностью.';
      noteEl.classList.add('is-error');
      return;
    }

    const { roomText, materialsText, timingText, needCalcText } = buildSummary();

    if (GOOGLE_SHEETS_QUIZ_WEBHOOK) {
      // Fire-and-forget: Apps Script Web Apps don't send CORS headers back,
      // so the response is opaque under no-cors — that's fine, we don't
      // need to read it, only to make sure the row lands in the sheet.
      fetch(GOOGLE_SHEETS_QUIZ_WEBHOOK, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          name, phone,
          room: roomText, materials: materialsText, timing: timingText, needCalc: needCalcText,
        }),
      }).catch(() => {});
    }

    noteEl.textContent = 'Спасибо! Заявка отправлена, мы свяжемся с вами и учтём скидку 3% по квизу.';
    noteEl.classList.add('is-success');
    if (typeof ym === 'function') ym(111045788, 'reachGoal', 'quiz_complete');
    window.setTimeout(closeQuiz, 1500);
  });
}

// Yandex.Metrika goal: клик по любой ссылке "Позвонить" (tel:) — хедер, hero,
// закрывающий CTA, футер, плавающая кнопка MAX.
document.querySelectorAll('a[href^="tel:"]').forEach((link) => {
  link.addEventListener('click', () => {
    if (typeof ym === 'function') ym(111045788, 'reachGoal', 'call_click');
  });
});

// Promo banner carousel — auto-advances and supports arrow/dot clicks plus
// touch swipe. Degrades to a plain static banner when there's only one
// slide (no dots/arrows/autoplay — see .promo-carousel--multi in CSS), so
// adding future campaign banners later is just pushing more
// .promo-carousel__slide markup into the track, no JS changes needed.
(function initPromoCarousel() {
  const root = document.getElementById('promoCarousel');
  if (!root) return;
  const track = root.querySelector('.promo-carousel__track');
  const slides = Array.from(track.children);
  if (slides.length < 2) return;

  root.classList.add('promo-carousel--multi');

  const dotsEl = root.querySelector('.promo-carousel__dots');
  const prevBtn = root.querySelector('.promo-carousel__arrow--prev');
  const nextBtn = root.querySelector('.promo-carousel__arrow--next');
  const dots = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'promo-carousel__dot';
    dot.setAttribute('aria-label', `Баннер ${i + 1} из ${slides.length}`);
    dot.addEventListener('click', () => goTo(i, true));
    dotsEl.appendChild(dot);
    return dot;
  });

  let index = 0;
  let autoplayTimer = null;

  function render() {
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
  }

  function goTo(i, userInitiated) {
    index = (i + slides.length) % slides.length;
    render();
    if (userInitiated) restartAutoplay();
  }

  function next() { goTo(index + 1); }
  function prev() { goTo(index - 1, true); }

  function startAutoplay() {
    autoplayTimer = window.setInterval(next, 5000);
  }
  function stopAutoplay() {
    if (autoplayTimer) window.clearInterval(autoplayTimer);
  }
  function restartAutoplay() {
    stopAutoplay();
    startAutoplay();
  }

  nextBtn.addEventListener('click', () => goTo(index + 1, true));
  prevBtn.addEventListener('click', prev);
  root.addEventListener('mouseenter', stopAutoplay);
  root.addEventListener('mouseleave', startAutoplay);
  root.addEventListener('focusin', stopAutoplay);
  root.addEventListener('focusout', startAutoplay);

  // Touch/pointer swipe — drag the track, snap to nearest slide on release.
  let dragStartX = null;
  let dragDeltaX = 0;
  track.addEventListener('pointerdown', (e) => {
    dragStartX = e.clientX;
    track.style.transition = 'none';
    stopAutoplay();
  });
  track.addEventListener('pointermove', (e) => {
    if (dragStartX === null) return;
    dragDeltaX = e.clientX - dragStartX;
    track.style.transform = `translateX(calc(-${index * 100}% + ${dragDeltaX}px))`;
  });
  function endDrag() {
    if (dragStartX === null) return;
    track.style.transition = '';
    const threshold = root.clientWidth * 0.15;
    if (dragDeltaX > threshold) goTo(index - 1);
    else if (dragDeltaX < -threshold) goTo(index + 1);
    else render();
    dragStartX = null;
    dragDeltaX = 0;
    startAutoplay();
  }
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('pointerleave', () => { if (dragStartX !== null) endDrag(); });

  render();
  startAutoplay();
})();
