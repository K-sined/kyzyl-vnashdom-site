// Scroll-reveal animation with staggered entrance for card grids
const revealEls = document.querySelectorAll('.reveal');

document.querySelectorAll('.advantages__grid, .catalog__grid').forEach((grid) => {
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

revealEls.forEach((el) => observer.observe(el));

// Solid header background after scrolling past the hero overlay
const header = document.getElementById('header');
const setHeaderState = () => header.classList.toggle('header--scrolled', window.scrollY > 40);
setHeaderState();
window.addEventListener('scroll', setHeaderState, { passive: true });

// Mobile burger menu
const burger = document.getElementById('burger');
const mobileNav = document.getElementById('mobileNav');

burger.addEventListener('click', () => {
  mobileNav.classList.toggle('open');
});

mobileNav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => mobileNav.classList.remove('open'));
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
    overlay.querySelector('.catalog-expand-card__media').style.backgroundImage = mediaEl.style.backgroundImage;
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

// Contacts map (Yandex Maps JS API) — geocodes the shop address and drops a
// pin. Without an API key (developer.tech.yandex.ru) this stays inactive and
// the decorative pin placeholder shows instead, so the page never breaks.
const YANDEX_MAPS_API_KEY = '';
const mapContainer = document.getElementById('yandexMap');
if (mapContainer && YANDEX_MAPS_API_KEY) {
  const mapScript = document.createElement('script');
  mapScript.src = `https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_MAPS_API_KEY}&lang=ru_RU`;
  mapScript.onload = () => {
    window.ymaps.ready(() => {
      window.ymaps.geocode('Кызыл, улица Оюна Курседи, 54').then((res) => {
        const coords = res.geoObjects.get(0).geometry.getCoordinates();
        const map = new window.ymaps.Map('yandexMap', {
          center: coords,
          zoom: 16,
          controls: ['zoomControl'],
        });
        map.behaviors.disable('scrollZoom');
        const placemark = new window.ymaps.Placemark(coords, {
          hintContent: 'В наш дом',
          balloonContent: 'г. Кызыл, ул. Оюна Курседи, 54',
        }, { preset: 'islands#redDotIcon' });
        map.geoObjects.add(placemark);
        mapContainer.closest('.contacts__map').classList.add('is-ready');
      });
    });
  };
  document.head.appendChild(mapScript);
}
