import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, prepareCsrf } from "./api.js";

const categories = [
  ["roads", "Roads and transport"],
  ["water", "Water and sanitation"],
  ["waste", "Waste management"],
  ["lighting", "Street lighting"],
  ["safety", "Public safety"],
  ["other", "Other"],
];
const statuses = [
  ["pending", "Pending"],
  ["in_progress", "In progress"],
  ["resolved", "Resolved"],
];
const allowedStatusTransitions = {
  pending: ["in_progress"],
  in_progress: ["resolved"],
  resolved: [],
};

function displayDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function categoryLabel(value) {
  return categories.find(([key]) => key === value)?.[1] || value;
}

function StatusBadge({ status }) {
  const style = {
    pending: "bg-amber-50 text-amber-800 ring-amber-200",
    in_progress: "bg-sky-50 text-sky-800 ring-sky-200",
    resolved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  }[status] || "bg-slate-100 text-slate-700 ring-slate-200";
  const label = statuses.find(([key]) => key === status)?.[1] || status;
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${style}`}>{label}</span>;
}

function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-700 text-white shadow-sm" aria-hidden="true">
        <PortalIcon name="building" className="h-6 w-6" />
      </span>
      <div>
        <p className="font-bold leading-tight text-white">Public Service Portal</p>
        {!compact && <p className="mt-1 text-xs text-blue-100/70">Fast · Transparent · Citizen Focused</p>}
      </div>
    </div>
  );
}

function PortalIcon({ name, className = "h-5 w-5" }) {
  const icons = {
    building: <><path d="m3 9 9-6 9 6" /><path d="M4 10h16M5 10v9m4-9v9m6-9v9m4-9v9M3 20h18M2 22h20" /></>,
    document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8m-8 4h8" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11" /><path d="m9 12 2 2 4-4" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 5v2" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: <><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1-3 3.8M6.2 6.2C3.4 8.1 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
  };

  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

function AuthScreen({ onAuthenticated, initialMode = "login", onBack }) {
  const [mode, setMode] = useState(initialMode);
  const [values, setValues] = useState({ full_name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await prepareCsrf();
      const account = await api(`/auth/${mode === "login" ? "login" : "register"}/`, {
        method: "POST",
        body: values,
      });
      onAuthenticated(account);
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[54fr_46fr]">
      <section className="relative isolate flex min-h-[400px] flex-col justify-between overflow-hidden bg-[#003d38] p-6 text-white sm:min-h-[440px] sm:p-10 lg:min-h-screen lg:p-12 xl:p-14">
        <img src="/images/home-muranga-county-office.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-center" width="600" height="400" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#003d38]/90 via-[#003d38]/75 to-[#001d20]/95" />
        <div className="relative z-10 flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-white/25 bg-white/10 text-white"><PortalIcon name="building" className="h-7 w-7" /></span>
          <div>
            <p className="text-lg font-bold leading-tight sm:text-xl">Public Service Portal</p>
            <p className="mt-1 text-xs text-white/80 sm:text-sm">Fast • Transparent • Citizen Focused</p>
          </div>
          {onBack && <button type="button" className="ml-auto rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 lg:hidden" onClick={onBack}>Back home</button>}
        </div>

        <div className="relative z-10 mt-12 max-w-xl lg:my-auto lg:py-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200 sm:text-sm">WELCOME TO THE</p>
          <h1 className="max-w-xl text-4xl font-bold leading-[1.12] sm:text-5xl xl:text-[3.4rem]"><span className="block">Public Service</span><span className="block">Request System</span></h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-white/85 sm:text-base sm:leading-7">Access public services, submit service requests, and track their progress — all from one convenient platform.</p>
          <div className="mt-8 space-y-5 sm:mt-10 sm:space-y-6">
            {[
              { icon: "document", title: "Submit Requests", description: "Report issues and request public services from your community." },
              { icon: "search", title: "Track Progress", description: "Check the status of your requests in real time." },
              { icon: "shield", title: "Transparent & Accountable", description: "Building a better community through open and efficient service delivery." },
            ].map((feature) => (
              <div key={feature.title} className="flex items-center gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#087d4d] text-white shadow-sm shadow-emerald-950/30 sm:h-12 sm:w-12"><PortalIcon name={feature.icon} className="h-5 w-5 sm:h-6 sm:w-6" /></span>
                <div><h2 className="text-sm font-bold text-white sm:text-base">{feature.title}</h2><p className="mt-1 max-w-md text-xs leading-5 text-white/75 sm:text-sm sm:leading-6">{feature.description}</p></div>
              </div>
            ))}
          </div>
        </div>
        <span className="relative z-10 hidden text-xs text-white/60 lg:block">Public Service Portal · Kenya</span>
      </section>

      <section className="auth-form-panel relative flex min-h-[640px] items-center justify-center overflow-hidden bg-white px-6 py-10 sm:px-10 sm:py-14 lg:min-h-screen lg:px-10 xl:px-14">
        <svg className="auth-skyline" viewBox="0 0 900 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
          <path d="M0 128h900v22H0zM0 128h34v-21h18v21h14v-36h29v36h20V96h16v32h19v-17h21v17h17V76h33v52h18V93h24v35h17v-26h14v26h22V85h45v43h18V68h30v60h18V97h23v31h18V83h42v45h20v-23h24v23h24V73h34v55h17V91h19v37h18V101h17v27h24V78h38v50h17V96h27v32h24v-19h24v19h18V87h40v41h28v-27h20v27h25v-18h28v18h18v-36h38v36h25v-24h29v24h24v-16h20v16h23v-35h39v35h24v-21h31v21h18v-29h29v29h31v-19h21v19h26v-32h40v32h18v-20h30v20h18v-28h29v28h24v-17h24v17h25v-37h37v37H0z" fill="#edf5ef" />
          <path d="M58 128c0-18 10-30 20-30s20 12 20 30m-27-17h14m-7-13v30m621 0c0-19 11-32 22-32s22 13 22 32m-30-17h16m-8-15v32m65 0c0-15 8-25 17-25s17 10 17 25m-23-13h12m-6-12v25" fill="none" stroke="#dcebe0" strokeWidth="5" />
        </svg>

        <div className="relative z-10 w-full max-w-[490px]">
          {onBack && <button type="button" className="mb-6 hidden text-sm font-semibold text-slate-500 transition hover:text-emerald-800 lg:inline-flex" onClick={onBack}>← Back to home</button>}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-emerald-50 text-[#087d4d]"><PortalIcon name="building" className="h-7 w-7" /></span>
            <div className="mr-auto"><p className="text-lg font-bold leading-tight text-[#102b3a] sm:text-xl">Public Service Portal</p><p className="mt-1 text-sm text-[#607a91]">Secure access to public services</p></div>
            <a href="/#/admin" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-900 transition hover:border-emerald-700 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
              Admin
            </a>
          </div>

          <div className="mt-8 sm:mt-10">
            <h2 className="text-3xl font-bold leading-tight text-[#102b3a] sm:text-[2.1rem]">{mode === "login" ? "Welcome Back" : "Create Your Account"}</h2>
            <p className="mt-3 text-sm leading-6 text-[#607a91] sm:text-base">{mode === "login" ? "Log in to your account to submit requests and track their progress." : "Register to access public services and track your requests."}</p>
          </div>

          {error && <p className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm leading-6 text-rose-800" role="alert">{error}</p>}

          <form className="mt-7 space-y-5" onSubmit={submit} aria-busy={busy}>
            {mode === "register" && <div><label className="auth-label" htmlFor="auth-full-name">Full name</label><input id="auth-full-name" className="auth-input" autoComplete="name" required maxLength={150} value={values.full_name} onChange={(event) => setValues({ ...values, full_name: event.target.value })} /></div>}
            <div>
              <label className="auth-label" htmlFor="auth-email">Email Address</label>
              <div className="auth-input-wrap"><PortalIcon name="mail" className="auth-input-icon" /><input id="auth-email" className="auth-input" type="email" autoComplete="email" required placeholder="Enter your email address" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} /></div>
            </div>
            {mode === "register" && <div><label className="auth-label" htmlFor="auth-phone">Phone number</label><input id="auth-phone" className="auth-input" type="tel" autoComplete="tel" required value={values.phone} onChange={(event) => setValues({ ...values, phone: event.target.value })} /></div>}
            <div>
              <label className="auth-label" htmlFor="auth-password">Password</label>
              <div className="auth-input-wrap">
                <PortalIcon name="lock" className="auth-input-icon" />
                <input id="auth-password" className="auth-input auth-input--password" type={passwordVisible ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : undefined} placeholder="Enter your password" value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} />
                <button type="button" className="auth-password-toggle" aria-label={passwordVisible ? "Hide password" : "Show password"} aria-pressed={passwordVisible} onClick={() => setPasswordVisible((visible) => !visible)}><PortalIcon name={passwordVisible ? "eyeOff" : "eye"} className="h-5 w-5" /></button>
              </div>
              {mode === "register" && <p className="mt-2 text-xs text-slate-500">Use at least 8 characters.</p>}
            </div>

            {mode === "login" && <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
              <label className="inline-flex cursor-not-allowed items-center gap-2 text-slate-500" title="Session duration is managed by the service."><input type="checkbox" disabled className="h-4 w-4 rounded border-slate-300 accent-emerald-700" />Remember me</label>
              <button type="button" className="cursor-not-allowed font-semibold text-slate-400 underline decoration-dotted underline-offset-4" disabled title="Password recovery is not yet available.">Forgot password?</button>
            </div>}

            <button className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#087d4d] px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-[#06663f] disabled:cursor-wait disabled:opacity-70" type="submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
              {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : <PortalIcon name="arrow" className="h-5 w-5" />}
            </button>
            {busy && <p className="sr-only" role="status">{mode === "login" ? "Signing in" : "Creating your account"}</p>}
          </form>

          {mode === "login" && <div className="my-6 flex items-center gap-4 text-xs font-semibold text-slate-400" role="separator" aria-label="or"><span className="h-px flex-1 bg-slate-200" /><span>OR</span><span className="h-px flex-1 bg-slate-200" /></div>}
          <p className="text-center text-sm text-[#607a91]">{mode === "login" ? "Don't have an account? " : "Already have an account? "}<button className="font-bold text-[#087d4d] underline underline-offset-2 hover:text-emerald-900" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setPasswordVisible(false); }} type="button">{mode === "login" ? "Register here" : "Sign in"}</button></p>
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-emerald-100 bg-[#f0f8f2] px-4 py-3.5 text-sm leading-5 text-[#176b48]"><PortalIcon name="lock" className="mt-0.5 h-4 w-4 shrink-0" /><p>Your account and personal information are protected and secure.</p></div>
        </div>
      </section>
    </main>
  );
}

const publicServices = [
  { title: "Roads & Transport", description: "Report damaged roads, blocked drains, street lighting issues, and mobility barriers.", category: "roads transport infrastructure" },
  { title: "Water & Sanitation", description: "Request water supply support, leaking pipes, drainage concerns, and sanitation issues.", category: "water sanitation pipes drainage" },
  { title: "Waste Management", description: "Flag illegal dumping, missed collections, and litter hotspots in your area.", category: "waste cleanup litter dumping" },
  { title: "Public Safety", description: "Report safety hazards, public facility concerns, and community security issues.", category: "safety security hazards" },
  { title: "Street Lighting", description: "Request repairs for dark streets, broken lights, and unsafe public spaces.", category: "lighting street lights visibility" },
  { title: "Community Support", description: "Learn about service channels, local contacts, and relevant public assistance options.", category: "support guidance services" },
];

const featureCards = [
  { title: "Report a Concern", description: "Report a public service issue and provide the relevant location and details.", icon: "✦" },
  { title: "Track Your Request", description: "Follow your request status and see updates as your issue progresses.", icon: "▣" },
  { title: "Community Services", description: "Find information about available public services and support channels.", icon: "▤" },
  { title: "Transparent Service Delivery", description: "Stay informed about request progress and public service accountability.", icon: "✓" },
];

const communitySlides = [
  {
    label: "Roads and infrastructure",
    headline: "See an Issue? Help Us Make It Better.",
    description: "Report damaged roads and other public infrastructure concerns in your community.",
    action: "Report a Community Issue",
    authMode: "register",
    image: "/images/home-roads-thika.jpg",
    alt: "Thika Road between Nairobi and Thika, with a pedestrian footbridge and roadside development.",
  },
  {
    label: "Drainage and sanitation",
    headline: "Cleaner Neighbourhoods Start With Us.",
    description: "Help bring attention to drainage, waste management, and sanitation concerns.",
    action: "Submit a Service Request",
    authMode: "register",
    image: "/images/home-sanitation-dandora.jpg",
    alt: "Solid waste beside a road at the Dandora dumping site in Nairobi, Kenya.",
  },
  {
    label: "Water and public utilities",
    headline: "Every Community Deserves Reliable Services.",
    description: "Submit reports about public utilities and follow the progress of your request.",
    action: "Report a Service Problem",
    authMode: "register",
    image: "/images/home-water-kiambu.jpg",
    alt: "Household water storage tank in Gachie, Kiambu County, Kenya.",
  },
  {
    label: "Public facilities and service delivery",
    headline: "Better Public Services Begin With Your Voice.",
    description: "Raise community concerns and stay informed as authorized staff handle requests.",
    action: "Track Your Request",
    authMode: "login",
    image: "/images/home-facility-kibera.jpg",
    alt: "Signage for a community medical clinic in Kibera, Nairobi, Kenya.",
  },
];

function HeroCarousel({ onOpenAuth }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [failedImages, setFailedImages] = useState({});
  const nextIndex = (activeIndex + 1) % communitySlides.length;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (isPaused || prefersReducedMotion) return undefined;
    const intervalId = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % communitySlides.length);
    }, 5500);
    return () => window.clearInterval(intervalId);
  }, [isPaused, prefersReducedMotion]);

  useEffect(() => {
    const image = new window.Image();
    image.src = communitySlides[nextIndex].image;
  }, [nextIndex]);

  function moveSlide(direction) {
    setActiveIndex((index) => (index + direction + communitySlides.length) % communitySlides.length);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveSlide(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveSlide(1);
    }
  }

  return (
    <section
      className="hero-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Community services"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="hero-carousel__slides" aria-live="off">
        {communitySlides.map((slide, index) => (
          <div
            key={slide.label}
            className={`hero-carousel__slide ${index === activeIndex ? "hero-carousel__slide--active" : ""}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${communitySlides.length}: ${slide.label}`}
            aria-hidden={index !== activeIndex}
          >
            <div className="hero-carousel__fallback" />
            {!failedImages[index] ? (
              <img
                src={slide.image}
                alt={slide.alt}
                className="hero-carousel__image"
                width="1920"
                height={index === 2 ? "1280" : "1440"}
                loading={index === activeIndex || index === nextIndex ? "eager" : "lazy"}
                fetchPriority={index === activeIndex ? "high" : "auto"}
                onError={() => setFailedImages((images) => ({ ...images, [index]: true }))}
              />
            ) : (
              <p className="hero-carousel__image-fallback">Photo temporarily unavailable</p>
            )}
            <div className="hero-carousel__shade" />
          </div>
        ))}
      </div>

      <div className="hero-carousel__content">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          <div className="max-w-3xl">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-emerald-200 sm:text-sm">
              {communitySlides[activeIndex].label}
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
              {communitySlides[activeIndex].headline}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/90 sm:text-lg sm:leading-8">
              {communitySlides[activeIndex].description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-base"
                onClick={() => onOpenAuth(communitySlides[activeIndex].authMode)}
              >
                {communitySlides[activeIndex].action}
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/60 bg-slate-950/20 px-6 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-base"
                onClick={() => onOpenAuth("login")}
              >
                Track a Request
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="hero-carousel__controls" aria-label="Carousel controls">
        <button
          type="button"
          className="hero-carousel__arrow"
          aria-label="Previous slide"
          onClick={() => moveSlide(-1)}
        >
          <span aria-hidden="true">←</span>
        </button>
        <div className="hero-carousel__indicators" aria-label="Choose a slide">
          {communitySlides.map((slide, index) => (
            <button
              key={slide.label}
              type="button"
              className={`hero-carousel__indicator ${index === activeIndex ? "hero-carousel__indicator--active" : ""}`}
              aria-label={`Go to slide ${index + 1}: ${slide.label}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
        <button
          type="button"
          className="hero-carousel__arrow"
          aria-label="Next slide"
          onClick={() => moveSlide(1)}
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}

function LandingPage({ onOpenAuth, onOpenRegister }) {
  const [query, setQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const filteredServices = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return publicServices;
    return publicServices.filter((item) => `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(term));
  }, [query]);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#home" className="flex items-center gap-3" aria-label="Public Service Portal home">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-700 text-white shadow-sm" aria-hidden="true"><PortalIcon name="building" className="h-6 w-6" /></span>
            <div>
              <p className="text-lg font-bold text-ink">Public Service Portal</p>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#home" className="transition hover:text-emerald-700">Home</a>
            <a href="#services" className="transition hover:text-emerald-700">Services</a>
            <a href="#how-it-works" className="transition hover:text-emerald-700">How It Works</a>
            <button type="button" className="transition hover:text-emerald-700" onClick={() => onOpenAuth("login")}>Track Request</button>
            <a href="#contact" className="transition hover:text-emerald-700">Contact</a>
          </nav>

          <div className="flex items-center gap-3">
            <button type="button" className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:border-emerald-600 hover:text-emerald-700 sm:inline-flex" onClick={() => onOpenAuth("login")}>
              Login
            </button>
            <button type="button" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800" onClick={() => onOpenRegister ? onOpenRegister() : onOpenAuth("register")}>
              Register
            </button>
            <button type="button" className="inline-flex rounded-xl border border-slate-200 bg-white p-2 text-slate-700 md:hidden" aria-label="Toggle navigation menu" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}>
              <span className="text-xl">☰</span>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="border-t border-slate-200 bg-white px-5 py-4 md:hidden">
            <div className="flex flex-col gap-3 text-sm font-medium text-slate-700">
              <a href="#home" onClick={() => setMobileMenuOpen(false)} className="py-1">Home</a>
              <a href="#services" onClick={() => setMobileMenuOpen(false)} className="py-1">Services</a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="py-1">How It Works</a>
              <button type="button" onClick={() => { setMobileMenuOpen(false); onOpenAuth("login"); }} className="py-1 text-left">Track Request</button>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="py-1">Contact</a>
              <button type="button" className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left font-semibold text-ink" onClick={() => { setMobileMenuOpen(false); onOpenAuth("login"); }}>
                Login
              </button>
            </div>
          </nav>
        )}
      </header>

      <main id="home">
        <HeroCarousel onOpenAuth={onOpenAuth} />

        <section className="relative z-10 mx-auto -mt-14 max-w-6xl px-5 sm:px-8">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((card) => (
              <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-xl">
                <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-emerald-100 text-xl text-emerald-700">{card.icon}</div>
                <h3 className="text-xl font-bold text-slate-900">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
              </article>
            ))}
          </div>
        </section>

        <div id="services" className="-mt-24 block h-0" aria-hidden="true" />
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">Public services</p>
            <h2 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">Looking for a Public Service? Start Here.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">Find the right service or learn how to submit and track a request.</p>
          </div>

          <div className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="service-search">Search services</label>
            <input
              id="service-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search services, categories, or common issues..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-100"
            />
            <button type="button" className="rounded-xl bg-emerald-700 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-800" onClick={() => setQuery(query)}>
              Find a Service
            </button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredServices.length ? filteredServices.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-card">
                <div className="mb-4 inline-flex rounded-xl bg-emerald-100 p-3 text-lg text-emerald-700">✦</div>
                <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center md:col-span-2 xl:col-span-3">
                <p className="text-lg font-semibold text-slate-900">No matching services found.</p>
                <p className="mt-2 text-sm text-slate-500">Try searching for “water,” “roads,” “lighting,” or “safety.”</p>
              </div>
            )}
          </div>
        </section>

        <div id="track-request" className="-mt-24 block h-0" aria-hidden="true" />
        <section id="how-it-works" className="bg-white py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">How it works</p>
              <h2 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">A simple three-step process</h2>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[{ step: "01", title: "Submit", body: "Describe the issue and provide its location so the right team can review it." }, { step: "02", title: "Track", body: "Check the status of your submitted request and monitor progress over time." }, { step: "03", title: "Resolve", body: "Follow updates as authorized staff work to address the issue and close the case." }].map((item) => (
                <div key={item.step} className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">{item.step}</div>
                  <h3 className="text-xl font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="grid gap-8 rounded-3xl border border-emerald-100 bg-emerald-50 p-7 shadow-sm lg:grid-cols-[1.05fr_0.95fr] lg:p-10">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">Trust & accountability</p>
              <h2 className="mt-4 text-3xl font-bold text-slate-900">Accessible, transparent, and respectful public service.</h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                Our platform helps citizens report concerns clearly, track the progress of requests, and stay informed about how public service issues are being handled.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                "Accessible service channels for citizens.",
                "Clear tracking of request progress and updates.",
                "Secure handling of user information and account access.",
                "Transparent communication around service delivery.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
                  <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">✓</span>
                  <p className="text-sm font-medium leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="border-t border-slate-200 bg-slate-900 text-slate-200">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white" aria-hidden="true"><PortalIcon name="building" className="h-5 w-5" /></span>
              <p className="text-xl font-bold text-white">Public Service Portal</p>
            </div>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">A simple way for citizens to submit service requests, report local issues, and follow progress with clarity and confidence.</p>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Quick links</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li><a href="#home" className="hover:text-white">Home</a></li>
              <li><a href="#services" className="hover:text-white">Services</a></li>
              <li><button type="button" className="hover:text-white" onClick={() => onOpenAuth("login")}>Login</button></li>
              <li><button type="button" className="hover:text-white" onClick={() => onOpenAuth("register")}>Register</button></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Support</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li><button type="button" className="hover:text-white" onClick={() => onOpenAuth("login")}>Track request</button></li>
              <li><a href="#how-it-works" className="hover:text-white">How it works</a></li>
              <li><button type="button" className="hover:text-white" onClick={() => onOpenAuth("login")}>Privacy notice</button></li>
              <li><button type="button" className="hover:text-white" onClick={() => onOpenAuth("register")}>Terms</button></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p>© {new Date().getFullYear()} Public Service Portal</p>
            <p>Built to support transparent, accessible public services.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ label, value, color, detail }) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </article>
  );
}

function RequestForm({ onCancel, onCreated }) {
  const [values, setValues] = useState({ title: "", category: "roads", description: "", location: "" });
  const [evidence, setEvidence] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = new FormData();
    Object.entries(values).forEach(([key, value]) => body.append(key, value));
    if (evidence) body.append("evidence", evidence);
    try {
      await api("/requests/", { method: "POST", body });
      onCreated();
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-slate-100 bg-white p-6 shadow-card sm:p-8">
      <button className="mb-6 text-sm font-semibold text-slate-500 hover:text-teal" onClick={onCancel}>← Back to dashboard</button>
      <h2 className="text-2xl font-bold text-ink">Submit a service request</h2>
      <p className="mt-2 text-sm text-slate-500">Share enough detail to help the right team investigate.</p>
      {error && <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p>}
      <form onSubmit={submit} className="mt-7 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold sm:col-span-2">Request title<input className="field" required maxLength={160} placeholder="e.g. Streetlight not working" value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} /></label>
        <label className="text-sm font-semibold">Service category<select className="field" value={values.category} onChange={(event) => setValues({ ...values, category: event.target.value })}>{categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-sm font-semibold">Location<input className="field" required maxLength={255} placeholder="Street, area, or landmark" value={values.location} onChange={(event) => setValues({ ...values, location: event.target.value })} /></label>
        <label className="text-sm font-semibold sm:col-span-2">Describe the issue<textarea className="field min-h-36 resize-y" required maxLength={5000} placeholder="What happened? When did you notice it?" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} /></label>
        <label className="text-sm font-semibold sm:col-span-2">Evidence image <span className="font-normal text-slate-400">(optional, JPEG/PNG/WebP, up to 5 MB)</span><input className="field file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setEvidence(event.target.files?.[0] || null)} /></label>
        <div className="flex gap-3 sm:col-span-2"><button className="primary-button" disabled={busy}>{busy ? "Submitting…" : "Submit request"}</button><button className="quiet-button" type="button" onClick={onCancel}>Cancel</button></div>
      </form>
    </section>
  );
}

function AssistantWidget({ onSessionExpired }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([{ role: "assistant", text: "Hello! I can help you understand public services, report a local issue, or find out how to check a request." }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  useEffect(() => { if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages, open, busy]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft(""); setError(""); setMessages((current) => [...current, { role: "citizen", text }]); setBusy(true);
    try {
      const result = await api("/assistant/chat/", { method: "POST", body: { message: text } });
      setMessages((current) => [...current, ...result.messages.map((reply) => ({ role: "assistant", text: reply }))]);
    } catch (problem) {
      const message = problem.message || "The assistant is temporarily unavailable. Please try again.";
      if (problem.status === 401 || problem.status === 403) onSessionExpired();
      else setError(message);
    } finally { setBusy(false); }
  }

  return <div className="assistant-widget">
    {open && <section className="assistant-panel" role="dialog" aria-labelledby="assistant-title" aria-modal="false">
      <header className="assistant-header"><div><h2 id="assistant-title">Public Service Assistant</h2><p>How can we help today?</p></div><button type="button" className="assistant-close" onClick={() => setOpen(false)} aria-label="Close chat">×</button></header>
      <div className="assistant-messages" ref={listRef} role="log" aria-live="polite" aria-relevant="additions">
        {messages.map((message, index) => <p key={`${index}-${message.role}`} className={`assistant-bubble assistant-bubble--${message.role}`}>{message.text}</p>)}
        {busy && <p className="assistant-bubble assistant-bubble--assistant" role="status">Assistant is replying…</p>}
        {error && <p className="assistant-error" role="alert">{error}</p>}
      </div>
      <div className="assistant-compose"><textarea aria-label="Type your message" placeholder="Type your message..." rows="2" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} />
        <button type="button" className="assistant-send" disabled={!draft.trim() || busy} onClick={send}>Send</button></div>
    </section>}
    <button type="button" className="assistant-launch" aria-label={open ? "Close Public Service Assistant" : "Open Public Service Assistant"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? "×" : <span aria-hidden="true">✦</span>}</button>
  </div>;
}

function RequestTable({ requests, isStaff, onOpen, onFilter, filters, page, pageCount, onPageChange, totalCount, loading = false }) {
  return (
    <section id="request-queue" className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
        <div><h2 className="font-bold text-ink">{isStaff ? "Service request queue" : "Recent requests"}</h2><p className="mt-1 text-xs text-slate-400">{isStaff ? `${totalCount} requests · Search, filter, and review submissions.` : "Your submissions, all in one place."}</p></div>
        {isStaff && <div className="grid w-full gap-3 sm:grid-cols-2 xl:max-w-4xl xl:grid-cols-3">
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" aria-label="Search by reference, subject, description, or citizen" placeholder="Search requests" value={filters.search} onChange={(event) => onFilter({ ...filters, search: event.target.value })} />
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" aria-label="Filter by status" value={filters.status} onChange={(event) => onFilter({ ...filters, status: event.target.value })}><option value="">All statuses</option>{statuses.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" aria-label="Filter by category" value={filters.category} onChange={(event) => onFilter({ ...filters, category: event.target.value })}><option value="">All categories</option>{categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" aria-label="Filter by location" placeholder="Location" value={filters.location} onChange={(event) => onFilter({ ...filters, location: event.target.value })} />
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">From<input className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-800" type="date" aria-label="Submitted from date" value={filters.date_from} onChange={(event) => onFilter({ ...filters, date_from: event.target.value })} /></label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">To<input className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-800" type="date" aria-label="Submitted to date" value={filters.date_to} onChange={(event) => onFilter({ ...filters, date_to: event.target.value })} /></label>
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2 xl:col-span-1" aria-label="Sort requests" value={filters.ordering} onChange={(event) => onFilter({ ...filters, ordering: event.target.value })}><option value="-created_at">Newest first</option><option value="created_at">Oldest first</option><option value="-updated_at">Recently updated</option><option value="updated_at">Least recently updated</option><option value="status">Status A to Z</option></select>
        </div>}
      </div>
      {loading ? <div className="p-10 text-center text-sm text-slate-500" role="status">Loading service requests…</div> : requests.length ? <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3 font-semibold">Request</th>{isStaff && <th className="px-5 py-3 font-semibold">Citizen</th>}<th className="px-5 py-3 font-semibold">Submitted</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3" /></tr></thead>
          <tbody className="divide-y divide-slate-100">{requests.map((item) => <tr key={item.id} className="hover:bg-slate-50/70">
            <td className="px-5 py-4"><button className="text-left font-semibold text-ink hover:text-teal" onClick={() => onOpen(item)}>{item.title}</button><p className="mt-1 text-xs text-slate-400">{categoryLabel(item.category)} · {item.location}</p></td>
            {isStaff && <td className="px-5 py-4 text-slate-600">{item.owner_name}</td>}
            <td className="px-5 py-4 text-slate-500">{displayDate(item.created_at)}</td><td className="px-5 py-4"><StatusBadge status={item.status} /></td>
            <td className="px-5 py-4 text-right"><button className="font-semibold text-teal hover:underline" onClick={() => onOpen(item)}>Details</button></td>
          </tr>)}</tbody>
        </table>
      </div> : <div className="p-12 text-center"><p className="text-lg font-semibold text-ink">No requests found</p><p className="mt-2 text-sm text-slate-500">{isStaff ? "Try changing your search or filters." : "When you submit a request, it will appear here."}</p></div>}
      {isStaff && pageCount > 1 && <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
        <p className="text-xs text-slate-500">Page {page} of {pageCount}</p>
        <div className="flex gap-2">
          <button type="button" className="quiet-button px-3 py-2 text-xs" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
          <button type="button" className="quiet-button px-3 py-2 text-xs" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>Next</button>
        </div>
      </div>}
    </section>
  );
}

function RequestDetails({ request, isStaff, canManageRequests = false, onBack, onUpdated }) {
  const [status, setStatus] = useState(request.status);
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function updateStatus(event) {
    event.preventDefault();
    if (status === request.status && !note.trim()) return;
    if (status !== request.status && !window.confirm(`Change this request to "${statuses.find(([key]) => key === status)?.[1]}"?`)) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const updated = await api(`/requests/${request.id}/`, {
        method: "PATCH",
        body: { status, note: note.trim(), expected_updated_at: request.updated_at },
      });
      setNote("");
      setSuccess("Request update saved and visible to the citizen.");
      onUpdated(updated);
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  async function addInternalNote(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const updated = await api(`/requests/${request.id}/notes/`, { method: "POST", body: { note: internalNote.trim() } });
      setInternalNote("");
      setSuccess("Internal note saved. It is visible to staff only.");
      onUpdated(updated);
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="mx-auto max-w-4xl rounded-2xl border border-slate-100 bg-white p-6 shadow-card sm:p-8">
      <button className="mb-6 text-sm font-semibold text-slate-500 hover:text-teal" onClick={onBack}>← Back to requests</button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-teal">{categoryLabel(request.category)}</p><h2 className="mt-2 text-2xl font-bold text-ink">{request.title}</h2><p className="mt-2 text-sm text-slate-500">Ref {request.id} · {request.location} · Submitted {displayDate(request.created_at)}</p></div>
        <StatusBadge status={request.status} />
      </div>
      {isStaff && <p className="mt-5 text-sm text-slate-500">Submitted by <span className="font-semibold text-ink">{request.owner_name}</span> · {request.owner_email}</p>}
      <div className="mt-7 rounded-xl bg-slate-50 p-5"><h3 className="text-sm font-bold text-ink">Description</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{request.description}</p></div>
      {request.evidence && <a className="mt-5 inline-block font-semibold text-teal underline" href={request.evidence} target="_blank" rel="noreferrer">View attached evidence</a>}
      {canManageRequests && <>
        <form className="mt-7 rounded-xl border border-slate-200 p-5" onSubmit={updateStatus}>
          <h3 className="font-bold text-ink">Citizen-visible progress</h3>
          <p className="mt-1 text-sm text-slate-500">The requester can see this update and the new status.</p>
          {error && <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p>}
          {success && <p className="mt-3 text-sm text-emerald-800" role="status">{success}</p>}
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <label className="text-sm font-semibold">New status<select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.filter(([key]) => key === request.status || allowedStatusTransitions[request.status].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="text-sm font-semibold">Progress update <span className="font-normal text-slate-400">{status === "resolved" ? "(required to resolve)" : "(optional)"}</span><textarea className="field min-h-20 resize-y" maxLength={500} required={status === "resolved"} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Share a progress update with the citizen" /></label>
            <button className="primary-button" disabled={busy || (status === request.status && !note.trim())}>{busy ? "Saving…" : "Save update"}</button>
          </div>
        </form>

        <form className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-5" onSubmit={addInternalNote}>
          <h3 className="font-bold text-ink">Internal staff note</h3>
          <p className="mt-1 text-sm text-slate-600">Only authorized staff can see this note.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-semibold">Note<textarea className="field min-h-20 resize-y" maxLength={500} required value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Record a staff-only follow-up" /></label>
            <button className="quiet-button" type="submit" disabled={busy || !internalNote.trim()}>{busy ? "Saving…" : "Add internal note"}</button>
          </div>
        </form>
      </>}
      <section className="mt-8">
        <h3 className="font-bold text-ink">Progress history</h3>
        {request.status_updates?.length ? <ol className="mt-4 space-y-4 border-l-2 border-slate-100 pl-5">
          {request.status_updates.map((update, index) => <li key={`${update.created_at}-${index}`} className="relative"><span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-teal ring-4 ring-white" /><div className="flex flex-wrap items-center gap-3">{update.previous_status && <StatusBadge status={update.previous_status} />}<StatusBadge status={update.status} />{update.is_internal && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Staff only</span>}<span className="text-xs text-slate-400">{displayDate(update.created_at)} · {update.changed_by}</span></div>{update.note && <p className="mt-2 text-sm text-slate-500">{update.note}</p>}</li>)}
        </ol> : <p className="mt-3 text-sm text-slate-500">No progress updates yet.</p>}
      </section>
    </article>
  );
}

function CategoryStats({ items }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
    <h2 className="font-bold text-ink">Requests by category</h2>
    <div className="mt-5 space-y-4">{items.length ? items.map((item) => <div key={item.category}><div className="mb-2 flex justify-between text-xs"><span className="font-medium text-slate-600">{item.label}</span><span className="text-slate-400">{item.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal" style={{ width: `${Math.max(5, item.count / max * 100)}%` }} /></div></div>) : <p className="text-sm text-slate-400">Category statistics will appear as requests come in.</p>}</div>
  </section>;
}

function AnalyticsBars({ title, items, labelKey, color = "bg-emerald-700" }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      <h2 className="font-bold text-ink">{title}</h2>
      {items.length ? <ul className="mt-5 space-y-4">{items.map((item) => (
        <li key={item[labelKey]}>
          <div className="mb-1.5 flex justify-between gap-3 text-sm">
            <span className="text-slate-600">{item[labelKey]}</span>
            <span className="font-semibold tabular-nums text-slate-800">{item.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${item.count / max * 100}%` }} />
          </div>
        </li>
      ))}</ul> : <p className="mt-5 text-sm text-slate-500">No matching request data for this period.</p>}
    </section>
  );
}

function AdminDashboard({ dashboard, onOpenRequest, onNavigate, view = "overview", filters, onFilter }) {
  const totals = dashboard?.totals || {};
  const statusItems = dashboard?.statuses?.map((item) => ({ label: item.label, count: item.count })) || [];
  const categoryItems = dashboard?.categories?.map((item) => ({ label: item.label, count: item.count })) || [];
  const maxMonthly = Math.max(1, ...(dashboard?.monthly || []).map((item) => item.count));

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Service operations</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">{view === "analytics" ? "Analytics and reporting" : "Administrator overview"}</h1>
          <p className="mt-2 text-sm text-slate-500">Live request volumes and service-delivery progress.</p>
        </div>
        <div className="flex gap-3">
          <button type="button" className="quiet-button" onClick={() => onNavigate("/admin/requests")}>View request queue</button>
          <button type="button" className="primary-button" onClick={() => onNavigate("/admin/analytics")}>Analytics</button>
        </div>
      </div>

      {view === "analytics" && <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
        <label className="text-xs font-semibold text-slate-600">Submitted from<input className="field mt-1" type="date" value={filters.date_from} onChange={(event) => onFilter({ ...filters, date_from: event.target.value })} /></label>
        <label className="text-xs font-semibold text-slate-600">Submitted to<input className="field mt-1" type="date" value={filters.date_to} onChange={(event) => onFilter({ ...filters, date_to: event.target.value })} /></label>
        <label className="text-xs font-semibold text-slate-600">Service category<select className="field mt-1" value={filters.category} onChange={(event) => onFilter({ ...filters, category: event.target.value })}><option value="">All categories</option>{categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {(filters.date_from || filters.date_to) && <button type="button" className="quiet-button" onClick={() => onFilter({ ...filters, date_from: "", date_to: "" })}>Clear dates</button>}
      </div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total requests" value={totals.total ?? "—"} color="bg-emerald-800" detail="In the selected period" />
        <StatCard label="Pending" value={totals.pending ?? "—"} color="bg-amber-400" detail="Awaiting review" />
        <StatCard label="In progress" value={totals.in_progress ?? "—"} color="bg-sky-600" detail="Being handled" />
        <StatCard label="Resolved" value={totals.resolved ?? "—"} color="bg-emerald-500" detail="Marked resolved" />
        <StatCard label="Resolution rate" value={totals.resolution_rate == null ? "—" : `${totals.resolution_rate}%`} color="bg-teal" detail="Resolved / all requests" />
        <StatCard label="Average resolution" value={totals.average_resolution_hours == null ? "—" : `${totals.average_resolution_hours} h`} color="bg-indigo-500" detail="Resolved requests with history" />
        <StatCard label="Overdue pending" value={totals.pending_older_than_days ?? "—"} color="bg-rose-500" detail={`Pending over ${dashboard?.filters?.pending_age_days ?? 7} days`} />
        <StatCard label="Resolved in period" value={totals.resolved_within_period ?? "—"} color="bg-emerald-700" detail="Resolution events in date range" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AnalyticsBars title="Requests by category" items={categoryItems} labelKey="label" />
        <AnalyticsBars title="Requests by status" items={statusItems} labelKey="label" color="bg-sky-700" />
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-bold text-ink">Requests over time</h2><p className="mt-1 text-xs text-slate-500">Monthly submissions over the most recent six months.</p></div>
        </div>
        {dashboard?.monthly?.length ? <div className="mt-6 grid min-h-48 grid-cols-6 items-end gap-3 sm:gap-6" role="img" aria-label="Monthly request counts">
          {dashboard.monthly.map((item) => <div key={item.month} className="flex h-48 min-w-0 flex-col items-center justify-end gap-2">
            <span className="text-xs font-semibold tabular-nums text-slate-600">{item.count}</span>
            <div className="flex h-32 w-full items-end"><div className="w-full rounded-t-md bg-emerald-700" style={{ height: `${Math.max(5, item.count / maxMonthly * 100)}%` }} /></div>
            <span className="text-center text-[10px] leading-4 text-slate-500 sm:text-xs">{item.month}</span>
          </div>)}
        </div> : <p className="mt-5 text-sm text-slate-500">No submissions in the selected period.</p>}
      </section>

      {view === "overview" && <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div><h2 className="font-bold text-ink">Recent requests</h2><p className="mt-1 text-xs text-slate-500">Latest submissions; personal contact details are omitted.</p></div>
            <button type="button" className="text-sm font-semibold text-teal hover:underline" onClick={() => onNavigate("/admin/requests")}>Full queue</button>
          </div>
          {dashboard?.recent_requests?.length ? <div className="divide-y divide-slate-100">{dashboard.recent_requests.map((item) => <button key={item.id} type="button" className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50" onClick={() => onOpenRequest(item)}>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{item.title}</span><span className="mt-1 block truncate text-xs text-slate-500">{categoryLabel(item.category)} · {item.location}</span></span>
            <StatusBadge status={item.status} />
          </button>)}</div> : <div className="p-8 text-sm text-slate-500">No service requests have been submitted yet.</div>}
        </section>
        <AnalyticsBars title="Frequent locations" items={(dashboard?.locations || []).map((item) => ({ label: item.location, count: item.count }))} labelKey="label" color="bg-teal" />
      </div>}
      {view === "analytics" && <AnalyticsBars title="Frequent locations" items={(dashboard?.locations || []).map((item) => ({ label: item.location, count: item.count }))} labelKey="label" color="bg-teal" />}
    </div>
  );
}

export default function App() {
  const [account, setAccount] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [page, setPage] = useState(() => {
    const hash = window.location.hash;
    if (hash === "#/admin" || hash === "#/admin/") return "admin-overview";
    if (hash.startsWith("#/requests/")) return "detail";
    if (hash === "#/new") return "new";
    if (hash === "#/admin/requests") return "admin-requests";
    if (hash === "#/admin/analytics") return "admin-analytics";
    return "home";
  });
  const [selected, setSelected] = useState(null);
  const [requests, setRequests] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ search: "", status: "", category: "", location: "", date_from: "", date_to: "", ordering: "-created_at" });
  const [requestPage, setRequestPage] = useState(1);
  const [requestPageCount, setRequestPageCount] = useState(1);
  const [requestTotalCount, setRequestTotalCount] = useState(0);
  const isStaff = Boolean(account?.can_view_admin);
  const canManageRequests = Boolean(account?.can_manage_requests);

  const loadData = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => value && query.set(key, value));
      query.set("page", String(requestPage));
      query.set("page_size", "10");
      const listPath = `/requests/${query.size ? `?${query.toString()}` : ""}`;
      const dashboardQuery = new URLSearchParams();
      if (account.is_staff && filters.date_from) dashboardQuery.set("date_from", filters.date_from);
      if (account.is_staff && filters.date_to) dashboardQuery.set("date_to", filters.date_to);
      if (account.can_view_admin && filters.category) dashboardQuery.set("category", filters.category);
      const dashboardPath = account.can_view_admin
        ? `/analytics/admin-dashboard/${dashboardQuery.size ? `?${dashboardQuery.toString()}` : ""}`
        : "/analytics/dashboard/";
      const [requestData, dashboardData] = await Promise.all([
        api(listPath),
        api(dashboardPath),
      ]);
      setRequests(requestData.results || requestData);
      setRequestPageCount(requestData.count ? Math.max(1, Math.ceil(requestData.count / 10)) : 1);
      setRequestTotalCount(requestData.count ?? requestData.length ?? 0);
      setDashboard(dashboardData);
    } catch (problem) {
      setError(problem.message);
    } finally {
      setLoading(false);
    }
  }, [account, filters, requestPage]);

  useEffect(() => {
    api("/auth/me/")
      .then(setAccount)
      .catch(() => setAccount(null))
      .finally(() => setInitializing(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!account || page !== "detail" || selected) return;
    const requestId = window.location.hash.slice("#/requests/".length);
    if (!requestId) return;
    api(`/requests/${encodeURIComponent(requestId)}/`)
      .then(setSelected)
      .catch((problem) => setError(problem.message));
  }, [account, page, selected]);

  useEffect(() => {
    const updatePage = () => {
      const hash = window.location.hash;
      setPage(hash === "#/admin" || hash === "#/admin/" ? "admin-overview" : hash === "#/new" ? "new" : hash.startsWith("#/requests/") ? "detail" : hash === "#/admin/requests" ? "admin-requests" : hash === "#/admin/analytics" ? "admin-analytics" : "home");
      if (!hash.startsWith("#/requests/")) setSelected(null);
    };
    window.addEventListener("hashchange", updatePage);
    return () => window.removeEventListener("hashchange", updatePage);
  }, []);

  const recentRequests = useMemo(() => requests.slice(0, 6), [requests]);
  function updateFilters(nextFilters) {
    setFilters(nextFilters);
    setRequestPage(1);
  }
  function navigate(path) {
    window.location.hash = path;
    setPage(path === "/admin" || path === "/admin/" ? "admin-overview" : path === "/new" ? "new" : path.startsWith("/requests/") ? "detail" : path === "/admin/requests" ? "admin-requests" : path === "/admin/analytics" ? "admin-analytics" : "home");
    if (!path.startsWith("/requests/")) setSelected(null);
  }
  function openRequest(request) {
    setSelected(null);
    navigate(`/requests/${request.id}`);
  }
  async function refreshRequest(request) {
    setSelected(request);
    await loadData();
  }
  async function signOut() {
    try {
      await prepareCsrf();
      await api("/auth/logout/", { method: "POST", body: {} });
      setAccount(null);
      setSelected(null);
      window.location.hash = "";
    } catch (problem) {
      setError(problem.message);
    }
  }

  const [showLandingAuth, setShowLandingAuth] = useState(false);
  const [landingAuthMode, setLandingAuthMode] = useState("login");

  if (initializing) return <div className="grid min-h-screen place-items-center text-sm font-semibold text-slate-500">Loading your service desk…</div>;
  if (!account) {
    if (showLandingAuth || page.startsWith("admin-")) {
      return <AuthScreen onAuthenticated={setAccount} initialMode={page.startsWith("admin-") ? "login" : landingAuthMode} onBack={() => page.startsWith("admin-") ? navigate("/") : setShowLandingAuth(false)} />;
    }
    return <LandingPage onOpenAuth={(mode) => { setLandingAuthMode(mode); setShowLandingAuth(true); }} onOpenRegister={() => { setLandingAuthMode("register"); setShowLandingAuth(true); }} />;
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-emerald-950 text-white">
        <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <button onClick={() => navigate("/")} aria-label="Go to dashboard"><Brand /></button>
          <div className="flex items-center gap-3 sm:gap-5">
            <span className="hidden text-sm text-blue-100 sm:block">{account.full_name}</span>
            <button className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </header>
      <div className={`mx-auto max-w-[96rem] px-5 py-6 sm:px-8 sm:py-8 ${isStaff ? "lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8" : ""}`}>
        {isStaff && <aside className="mb-6 lg:mb-0">
          <p className="mb-3 hidden px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 lg:block">Administration</p>
          <nav aria-label="Admin navigation" className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-6 lg:flex-col lg:overflow-visible">
            {[
              ["admin-overview", "Overview", "/admin"],
              ["admin-requests", "Service requests", "/admin/requests"],
              ["admin-analytics", "Analytics", "/admin/analytics"],
            ].map(([key, label, path]) => {
              const active = page === key || (key === "admin-requests" && page === "detail");
              return <button key={key} type="button" aria-current={active ? "page" : undefined} className={`shrink-0 rounded-lg px-4 py-3 text-left text-sm font-semibold transition lg:w-full ${active ? "bg-emerald-800 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-900"}`} onClick={() => navigate(path)}>{label}</button>;
            })}
          </nav>
        </aside>}

        <main className="min-w-0">
          {error && <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert"><span>{error}</span><button className="font-bold" onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
          {loading && <p className="mb-4 text-sm text-slate-500" role="status">Refreshing request data…</p>}

          {isStaff ? (
              page === "detail" && selected ? <RequestDetails request={selected} isStaff canManageRequests={canManageRequests} onBack={() => navigate("/admin/requests")} onUpdated={refreshRequest} /> :
              page === "admin-requests" ? <div className="space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Service delivery</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Service requests</h1></div><p className="text-sm text-slate-500">Search, filter, and review the request queue.</p></div>
                <RequestTable requests={requests} isStaff onOpen={openRequest} onFilter={updateFilters} filters={filters} page={requestPage} pageCount={requestPageCount} onPageChange={setRequestPage} totalCount={requestTotalCount} loading={loading} />
              </div> : <AdminDashboard dashboard={dashboard} onOpenRequest={openRequest} onNavigate={navigate} view={page === "admin-analytics" ? "analytics" : "overview"} filters={filters} onFilter={updateFilters} />
          ) : page.startsWith("admin-") ? (
            <section className="mx-auto max-w-xl rounded-xl border border-amber-200 bg-white p-7 shadow-card sm:p-9" role="alert">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">Restricted area</p>
              <h1 className="mt-3 text-2xl font-bold text-ink">Administrator access required</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">This account does not have permission to view service operations. Sign in with an authorized staff account or return to your citizen portal.</p>
              <button type="button" className="primary-button mt-6" onClick={() => navigate("/")}>Return to citizen portal</button>
            </section>
          ) : (
            page === "new" ? <RequestForm onCancel={() => navigate("/")} onCreated={() => { navigate("/"); loadData(); }} /> :
              page === "detail" && selected ? <RequestDetails request={selected} isStaff={false} onBack={() => navigate("/")} onUpdated={refreshRequest} /> :
                <>
                  <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                    <div><p className="text-sm font-semibold text-teal">CITIZEN PORTAL</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Welcome, {account.full_name.split(" ")[0]}</h1><p className="mt-2 text-sm text-slate-500">Here’s an overview of your community service requests.</p></div>
                    <button className="primary-button" onClick={() => navigate("/new")}>＋ Submit a request</button>
                  </div>
                  <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Total requests" value={dashboard?.totals.total ?? "—"} color="bg-emerald-800" detail="Your submitted requests" />
                    <StatCard label="Pending" value={dashboard?.totals.pending ?? "—"} color="bg-amber-400" detail="Awaiting review" />
                    <StatCard label="In progress" value={dashboard?.totals.in_progress ?? "—"} color="bg-sky-500" detail="Being worked on" />
                    <StatCard label="Resolved" value={dashboard?.totals.resolved ?? "—"} color="bg-emerald-500" detail="Completed requests" />
                  </div>
                  <RequestTable requests={recentRequests} isStaff={false} onOpen={openRequest} onFilter={updateFilters} filters={filters} page={requestPage} pageCount={requestPageCount} onPageChange={setRequestPage} totalCount={requestTotalCount} loading={loading} />
                </>
          )}
        </main>
      </div>
      <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-400">Public Service Portal · Connecting citizens with local services</footer>
      <AssistantWidget onSessionExpired={() => { setAccount(null); setSelected(null); }} />
    </div>
  );
}
