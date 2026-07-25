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
