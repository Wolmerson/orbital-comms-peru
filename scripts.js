// ===== MENU TOGGLE =====
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('show');
  navToggle.classList.toggle('open'); // para animación de hamburguesa
});

// ===== STICKY HEADER =====
const header = document.querySelector('header');
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) header.classList.add('sticky');
  else header.classList.remove('sticky');
});

// ===== BACK TO TOP =====
const backToTop = document.getElementById('backToTop');
window.addEventListener('scroll', () => {
  backToTop.style.display = window.scrollY > 300 ? 'block' : 'none';
});
backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===== CAROUSEL CON FLECHAS Y AUTOSCROLL =====
const carousel = document.querySelector('.carousel');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');

let slideWidth = 360; // ancho aproximado de slide + gap
let autoScroll = true; // activamos autoscroll
let scrollInterval;

function scrollNext() {
  if(carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth) {
    carousel.scrollTo({ left: 0, behavior: 'smooth' });
  } else {
    carousel.scrollBy({ left: slideWidth, behavior: 'smooth' });
  }
}

if(prevBtn && nextBtn && carousel) {
  nextBtn.addEventListener('click', () => { scrollNext(); resetAutoScroll(); });
  prevBtn.addEventListener('click', () => {
    if(carousel.scrollLeft <= 0) carousel.scrollTo({ left: carousel.scrollWidth, behavior: 'smooth' });
    else carousel.scrollBy({ left: -slideWidth, behavior: 'smooth' });
    resetAutoScroll();
  });
}

// Autoscroll cada 5 segundos
function startAutoScroll() {
  scrollInterval = setInterval(scrollNext, 2000);
}
function resetAutoScroll() {
  if(autoScroll) {
    clearInterval(scrollInterval);
    startAutoScroll();
  }
}
if(autoScroll) startAutoScroll();

// ===== SCROLL REVEAL =====
const revealElements = document.querySelectorAll('.card, .slide, .story-block');
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.2 });

revealElements.forEach(el => observer.observe(el));
