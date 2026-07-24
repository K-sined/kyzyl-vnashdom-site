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
