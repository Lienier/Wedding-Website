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
  mobilePanel.setAttribute("aria-hidden","true");
  menuBtn.setAttribute("aria-expanded","false");
}

menuBtn.addEventListener("click", () => {
  const isOpen = mobilePanel.classList.toggle("open");
  menuBtn.classList.toggle("active", isOpen);
  mobilePanel.setAttribute("aria-hidden", String(!isOpen));
  menuBtn.setAttribute("aria-expanded", String(isOpen));
});

mobilePanel.querySelectorAll("a").forEach(a => {
  a.addEventListener("click", closeMenu);
});

// HIDE/SHOW CIRCLE NAV ON SCROLL + TAP
let scrollTimer = null;
let isHidden = false;
let lastScrollY = window.scrollY;

function hideNav(){
  if(isHidden) return;
  isHidden = true;
  closeMenu();
  menuBtn.classList.add("nav-hidden");
}

function showNav(){
  if(!isHidden) return;
  isHidden = false;
  menuBtn.classList.remove("nav-hidden");
}

window.addEventListener("scroll", () => {
  const y = window.scrollY;
  // ignore iOS rubber-band overscroll (y < 0 or beyond page)
  if(y < 0 || y > document.body.scrollHeight - window.innerHeight + 1) return;
  if(Math.abs(y - lastScrollY) < 4) return; // ignore tiny jitter
  lastScrollY = y;
  hideNav();
  clearTimeout(scrollTimer);
}, { passive: true });

document.addEventListener("touchstart", () => {
  showNav();
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(hideNav, 3000);
}, { passive: true });

document.addEventListener("click", () => {
  showNav();
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(hideNav, 3000);
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

// GALLERY LIGHTBOX
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxClose = document.getElementById("lightboxClose");

document.querySelectorAll("#galleryGrid button").forEach(btn => {
  btn.addEventListener("click", () => {
    lightboxImage.src = btn.dataset.full || btn.querySelector("img").src;
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden","false");
    document.body.classList.add("no-scroll");
  });
});

function closeLightbox(){
  lightbox.classList.remove("open");
  lightbox.setAttribute("aria-hidden","true");
  document.body.classList.remove("no-scroll");
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
