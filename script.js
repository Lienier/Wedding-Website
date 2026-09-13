// ---------------------------------------------------------
// EASY SETTINGS
// ---------------------------------------------------------
const WEDDING_DATE = new Date("2026-10-17T16:00:00+08:00");

// OPEN INVITATION
const gate = document.getElementById("gate");
const openInvitation = document.getElementById("openInvitation");

openInvitation.addEventListener("click", () => {
  gate.classList.add("is-open");
  document.body.classList.remove("no-scroll");
  setTimeout(() => gate.remove(), 900);
});

// NAV SCROLL STATE
const nav = document.getElementById("nav");
window.addEventListener("scroll", () => {
  nav.classList.toggle("compact", window.scrollY > 60);
}, { passive:true });

// MOBILE MENU
const menuBtn = document.getElementById("menuBtn");
const mobilePanel = document.getElementById("mobilePanel");

// Keep the complete Wall of Wishes page embedded in the single invitation page
// without creating a nested scrollbar.
const wishesFrame = document.getElementById("wishesFrame");
if(wishesFrame){
  const resizeWishesFrame = () => {
    try {
      wishesFrame.style.height = wishesFrame.contentDocument.documentElement.scrollHeight + "px";
    } catch(e) {
      wishesFrame.style.height = "2200px";
    }
  };
  wishesFrame.addEventListener("load", resizeWishesFrame);
  window.addEventListener("resize", resizeWishesFrame, {passive:true});
}

function closeMenu(){
  menuBtn.classList.remove("active");
  mobilePanel.classList.remove("open");
  menuBtn.setAttribute("aria-expanded","false");
  menuBtn.setAttribute("aria-label", "Open menu");
  mobilePanel.setAttribute("aria-hidden", "true");
  mobilePanel.inert = true;
}

menuBtn.addEventListener("click", () => {
  const isOpen = mobilePanel.classList.toggle("open");
  menuBtn.classList.toggle("active", isOpen);
  menuBtn.setAttribute("aria-expanded", String(isOpen));
  menuBtn.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  mobilePanel.setAttribute("aria-hidden", String(!isOpen));
  mobilePanel.inert = !isOpen;
});
closeMenu();
document.addEventListener("click", e => {
  if (!mobilePanel.contains(e.target) && !menuBtn.contains(e.target)) closeMenu();
});
window.addEventListener("resize", () => { if (window.innerWidth > 980) closeMenu(); });

mobilePanel.querySelectorAll("a").forEach(a => {
  a.addEventListener("click", closeMenu);
});

// COUNTDOWN
const daysEl = document.getElementById("days");
const hoursEl = document.getElementById("hours");
const minutesEl = document.getElementById("minutes");
const secondsEl = document.getElementById("seconds");

function updateCountdown(){
  const now = new Date();
  let diff = WEDDING_DATE - now;

  if(diff <= 0){
    daysEl.textContent = "000";
    hoursEl.textContent = "00";
    minutesEl.textContent = "00";
    secondsEl.textContent = "00";
    return;
  }

  const days = Math.floor(diff / 86400000);
  diff %= 86400000;
  const hours = Math.floor(diff / 3600000);
  diff %= 3600000;
  const minutes = Math.floor(diff / 60000);
  diff %= 60000;
  const seconds = Math.floor(diff / 1000);

  daysEl.textContent = String(days).padStart(3,"0");
  hoursEl.textContent = String(hours).padStart(2,"0");
  minutesEl.textContent = String(minutes).padStart(2,"0");
  secondsEl.textContent = String(seconds).padStart(2,"0");
}

updateCountdown();
setInterval(updateCountdown, 1000);

// SCROLL REVEALS
const revealEls = document.querySelectorAll(".reveal");

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add("in");
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold:.12,
  rootMargin:"0px 0px -5% 0px"
});

revealEls.forEach(el => revealObserver.observe(el));

// FAQ
document.querySelectorAll(".faq-item").forEach(item => {
  const q = item.querySelector(".faq-q");
  const a = item.querySelector(".faq-a");

  q.addEventListener("click", () => {
    const open = item.classList.toggle("open");
    a.style.maxHeight = open ? a.scrollHeight + "px" : "0px";
  });
});

// PRENUPTIAL DEPTH CAROUSEL + LIGHTBOX
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxClose = document.getElementById("lightboxClose");
const galleryGrid = document.getElementById("galleryGrid");
const carouselWrap = document.getElementById("prenuptialCarousel");
const carouselDots = document.getElementById("prenuptialDots");
const carouselPrev = carouselWrap?.querySelector(".depth-arrow-prev");
const carouselNext = carouselWrap?.querySelector(".depth-arrow-next");
const galleryCards = [...document.querySelectorAll("#galleryGrid button")];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let activeGalleryIndex = 0;
let galleryPosition = 0;
let galleryFrame = 0;
let galleryTimer = null;
let drag = null;
let suppressClick = false;
let galleryVisible = false;
let galleryHovered = false;
const wrapIndex = value => ((value % galleryCards.length) + galleryCards.length) % galleryCards.length;

function openGalleryImage(btn){
  stopGalleryAutoplay();
  lightboxImage.src = btn.dataset.full || btn.querySelector("img").src;
  lightboxImage.alt = btn.querySelector("img").alt;
  lightbox.classList.add("open");
  lightbox.setAttribute("aria-hidden","false");
  document.body.classList.add("no-scroll");
}

// Animate a continuous position along the reference's one-sided depth rail.
function layoutGallery(){
  const scale = Math.min(1, carouselWrap.clientWidth / 580);
  galleryCards.forEach((card, index) => {
    let d = wrapIndex(index - galleryPosition);
    if(d > galleryCards.length / 2) d -= galleryCards.length;
    const back = Math.max(0, d);
    const opacity = d < 0 ? Math.max(0, 1 + d) : Math.min(1, Math.max(0, 4.5 - d));
    card.style.transform = `translate(-50%, -50%) scale(${scale}) translateX(${90*d}px) translateZ(${-220*d}px) rotateY(${22*Math.min(1,back)}deg)`;
    card.style.opacity = opacity;
    card.style.filter = `brightness(${Math.max(.2,1-back*.2)}) blur(${Math.min(6,back*1.5)}px)`;
    card.style.zIndex = String(Math.round(2000-d*20));
    card.style.pointerEvents = opacity > .1 ? "auto" : "none";
    card.style.setProperty("--shade", Math.min(.65,back*.2));
    card.classList.toggle("is-active", index === activeGalleryIndex);
    card.tabIndex = index === activeGalleryIndex ? 0 : -1;
    card.setAttribute("aria-hidden", String(index !== activeGalleryIndex));
  });
}

function setGalleryIndex(index){
  cancelAnimationFrame(galleryFrame);
  activeGalleryIndex = wrapIndex(index);
  let delta = wrapIndex(activeGalleryIndex - galleryPosition);
  if(delta > galleryCards.length/2) delta -= galleryCards.length;
  const start = galleryPosition;
  const started = performance.now();
  carouselDots.querySelectorAll("button").forEach((dot, i) => {
    dot.classList.toggle("is-active", i === activeGalleryIndex);
    dot.setAttribute("aria-current", String(i === activeGalleryIndex));
  });
  const animate = now => {
    const t = reduceMotion ? 1 : Math.min(1,(now-started)/700);
    galleryPosition = start + delta*(1-Math.pow(1-t,4));
    layoutGallery();
    if(t < 1) galleryFrame = requestAnimationFrame(animate);
    else galleryPosition = wrapIndex(galleryPosition);
  };
  galleryFrame = requestAnimationFrame(animate);
  startGalleryAutoplay();
}
function moveGallery(step){ setGalleryIndex(activeGalleryIndex + step); }
function stopGalleryAutoplay(){ clearTimeout(galleryTimer); }
function startGalleryAutoplay(){
  stopGalleryAutoplay();
  if(reduceMotion || !galleryVisible || galleryHovered || drag || document.hidden ||
    carouselWrap.contains(document.activeElement) || lightbox.classList.contains("open")) return;
  galleryTimer = setTimeout(() => moveGallery(1), 4000);
}

if(galleryGrid && carouselWrap){
  carouselDots.setAttribute("role", "group");
  galleryCards.forEach((btn,index) => {
    btn.querySelector("img").draggable = false;
    const dot = document.createElement("button");
    dot.className = "depth-dot";
    dot.type = "button";
    dot.setAttribute("aria-label", `Go to prenuptial photo ${index+1}`);
    dot.addEventListener("click", () => setGalleryIndex(index));
    carouselDots.appendChild(dot);
    btn.addEventListener("click", () => {
      if(suppressClick) return;
      if(index === activeGalleryIndex) openGalleryImage(btn);
      else setGalleryIndex(index);
    });
  });
  carouselPrev.addEventListener("click", () => moveGallery(-1));
  carouselNext.addEventListener("click", () => moveGallery(1));
  carouselWrap.addEventListener("keydown", e => {
    if(e.key === "ArrowLeft" || e.key === "ArrowRight"){
      e.preventDefault();
      moveGallery(e.key === "ArrowRight" ? 1 : -1);
    }
  });
  galleryGrid.addEventListener("dragstart", e => e.preventDefault());
  galleryGrid.addEventListener("pointerdown", e => {
    if(!e.isPrimary || e.button !== 0) return;
    cancelAnimationFrame(galleryFrame);
    stopGalleryAutoplay();
    suppressClick = false;
    drag = {id:e.pointerId,x:e.clientX,y:e.clientY,pos:galleryPosition,moved:false};
  });
  galleryGrid.addEventListener("pointermove", e => {
    if(!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX-drag.x;
    if(!drag.moved && Math.abs(e.clientY-drag.y) > Math.abs(dx)+8){ drag=null; startGalleryAutoplay(); return; }
    if(!drag.moved && Math.abs(dx)>8){
      drag.moved=true;
      suppressClick=true;
      galleryGrid.setPointerCapture(e.pointerId);
    }
    if(drag.moved){
      galleryPosition=drag.pos-dx/Math.max(100,Math.min(190,carouselWrap.clientWidth*.4));
      layoutGallery();
    }
  });
  const endDrag = e => {
    if(!drag || e.pointerId !== drag.id) return;
    const moved=drag.moved;
    drag=null;
    if(galleryGrid.hasPointerCapture(e.pointerId)) galleryGrid.releasePointerCapture(e.pointerId);
    if(moved) setGalleryIndex(Math.round(galleryPosition));
    startGalleryAutoplay();
    setTimeout(() => { suppressClick=false; },0);
  };
  window.addEventListener("pointerup",endDrag);
  galleryGrid.addEventListener("pointercancel",endDrag);
  carouselWrap.addEventListener("mouseenter", () => { galleryHovered=true; stopGalleryAutoplay(); });
  carouselWrap.addEventListener("mouseleave", () => { galleryHovered=false; startGalleryAutoplay(); });
  carouselWrap.addEventListener("focusin",stopGalleryAutoplay);
  carouselWrap.addEventListener("focusout", () => setTimeout(startGalleryAutoplay,0));
  document.addEventListener("visibilitychange",startGalleryAutoplay);
  new ResizeObserver(layoutGallery).observe(carouselWrap);
  new IntersectionObserver(entries => {
    galleryVisible=entries[0].isIntersecting;
    startGalleryAutoplay();
  },{threshold:.25}).observe(carouselWrap);
  setGalleryIndex(0);
}

function closeLightbox(){
  lightbox.classList.remove("open");
  lightbox.setAttribute("aria-hidden","true");
  document.body.classList.remove("no-scroll");
  startGalleryAutoplay();
}

lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", e => {
  if(e.target === lightbox) closeLightbox();
});

document.addEventListener("keydown", e => {
  if(e.key === "Escape"){
    closeLightbox();
    closeMenu();
  }
});

// RSVP → Supabase, with localStorage fallback until Supabase is configured.
const rsvpForm = document.getElementById("rsvpForm");
const formStatus = document.getElementById("formStatus");

 rsvpForm.addEventListener("submit", async e => {
  e.preventDefault();

  const data = Object.fromEntries(new FormData(rsvpForm).entries());
  const client = window.getSupabaseClient?.();

  formStatus.textContent = "Sending your RSVP…";

  if(client){
    const { error } = await client.from("rsvps").insert({
      full_name: data.fullName,
      contact: data.contact,
      attendance: data.attendance,
      guests: Number(data.guests),
      message: data.message || ""
    });
    if(error){
      formStatus.textContent = "We couldn’t send that just yet. Please try again.";
      return;
    }
  }else{
    localStorage.setItem("wedding_rsvp_demo", JSON.stringify(data));
  }

  formStatus.textContent = client
    ? "Thank you — your RSVP has been received."
    : "Thank you — your RSVP has been recorded on this device.";
  rsvpForm.reset();
});
