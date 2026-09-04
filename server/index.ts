import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerAdminRoutes } from "./admin-routes";
import * as fs from "fs";
import * as path from "path";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d: string) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    const origin = req.header("origin");

    if (origin && origins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      );
      res.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupPhotoStorage(app: express.Application) {
  const uploadRoot = path.resolve(process.env.PHOTO_STORAGE_DIR || path.resolve(process.cwd(), "uploads"));
  app.use("/uploads", express.static(uploadRoot, { index: false, maxAge: "1d" }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function configureProductionLanding(app: express.Application) {
  app.get("/", (_req: Request, res: Response) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>The GTW – Peer-to-Peer Parcel Delivery</title>
  <meta name="description" content="Send parcels with travelers going your way. Earn money carrying parcels on your existing routes. The GTW connects senders and carriers across any route." />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --navy: #0f172a;
      --navy-card: #1e293b;
      --navy-light: #334155;
      --slate: #94a3b8;
      --slate-light: #cbd5e1;
      --orange: #F97316;
      --orange-dark: #EA580C;
      --green: #22c55e;
      --white: #f8fafc;
    }
    html { scroll-behavior: smooth; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--navy);
      color: var(--white);
      line-height: 1.6;
      overflow-x: hidden;
    }

    /* ---- NAV ---- */
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 40px;
      background: rgba(15,23,42,0);
      backdrop-filter: blur(0px);
      border-bottom: 1px solid transparent;
      transition: background 0.3s, backdrop-filter 0.3s, border-color 0.3s;
    }
    nav.scrolled {
      background: rgba(15,23,42,0.92);
      backdrop-filter: blur(14px);
      border-color: rgba(255,255,255,0.07);
    }
    .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
    .nav-logo-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: var(--orange); display: flex; align-items: center; justify-content: center;
    }
    .nav-logo-icon svg { width: 20px; height: 20px; fill: white; }
    .nav-logo-text { font-size: 17px; font-weight: 700; color: var(--white); }
    .nav-links { display: flex; gap: 32px; align-items: center; }
    .nav-links a { font-size: 14px; color: var(--slate); text-decoration: none; font-weight: 500; transition: color 0.2s; }
    .nav-links a:hover { color: var(--white); }
    .nav-right { display: flex; gap: 12px; align-items: center; }
    .nav-signin {
      font-size: 14px; font-weight: 600; color: var(--slate-light);
      text-decoration: none; padding: 8px 16px; border-radius: 8px;
      transition: color 0.2s;
    }
    .nav-signin:hover { color: var(--white); }
    .nav-cta {
      display: inline-block; background: var(--orange); color: #fff;
      text-decoration: none; border-radius: 8px; padding: 10px 22px;
      font-weight: 600; font-size: 14px; transition: background 0.2s;
    }
    .nav-cta:hover { background: var(--orange-dark); }
    @media (max-width: 768px) {
      nav { padding: 16px 20px; }
      .nav-links { display: none; }
    }

    /* ---- HERO ---- */
    .hero {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      text-align: center;
      padding: 120px 24px 80px;
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute; inset: 0;
      background:
        radial-gradient(ellipse 90% 65% at 50% -10%, rgba(249,115,22,0.16) 0%, transparent 65%),
        radial-gradient(ellipse 60% 40% at 80% 80%, rgba(99,102,241,0.07) 0%, transparent 60%);
    }
    .hero-grid {
      position: absolute; inset: 0;
      background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 60px 60px;
      mask-image: radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 80%);
    }
    .hero-inner { max-width: 700px; position: relative; z-index: 1; }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 7px;
      background: rgba(34,197,94,0.1); color: var(--green);
      border: 1px solid rgba(34,197,94,0.25); border-radius: 999px;
      font-size: 12px; font-weight: 600; padding: 5px 16px;
      letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 32px;
    }
    .hero-badge-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); animation: blink 2s infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .hero h1 {
      font-size: clamp(2.6rem, 7vw, 4.4rem);
      font-weight: 800; line-height: 1.1;
      letter-spacing: -0.03em; margin-bottom: 22px;
    }
    .hero h1 .accent { color: var(--orange); }
    .hero-sub {
      font-size: 1.15rem; color: var(--slate); max-width: 540px;
      margin: 0 auto 44px; line-height: 1.8;
    }
    .hero-btns { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 8px;
      background: var(--orange); color: #fff; text-decoration: none;
      border-radius: 12px; padding: 16px 32px; font-weight: 700; font-size: 15px;
      transition: all 0.2s; box-shadow: 0 8px 24px rgba(249,115,22,0.35);
    }
    .btn-primary:hover { background: var(--orange-dark); transform: translateY(-2px); box-shadow: 0 14px 32px rgba(249,115,22,0.45); }
    .btn-ghost {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,0.05); color: var(--slate-light); text-decoration: none;
      border: 1.5px solid rgba(255,255,255,0.12); border-radius: 12px;
      padding: 16px 32px; font-weight: 600; font-size: 15px; transition: all 0.2s;
    }
    .btn-ghost:hover { border-color: rgba(255,255,255,0.3); color: var(--white); background: rgba(255,255,255,0.08); }

    /* stats */
    .hero-stats {
      display: flex; gap: 0; justify-content: center; flex-wrap: wrap;
      margin-top: 64px; padding-top: 48px; border-top: 1px solid rgba(255,255,255,0.08);
    }
    .stat-item {
      text-align: center; padding: 0 32px;
      border-right: 1px solid rgba(255,255,255,0.08);
    }
    .stat-item:last-child { border-right: none; }
    .stat-num { font-size: 2rem; font-weight: 800; color: var(--white); line-height: 1; }
    .stat-label { font-size: 13px; color: var(--slate); margin-top: 5px; }
    @media (max-width: 600px) {
      .stat-item { padding: 12px 20px; border-right: none; }
    }

    /* ---- TRUST BAR ---- */
    .trust-bar {
      padding: 24px;
      border-top: 1px solid rgba(255,255,255,0.05);
      border-bottom: 1px solid rgba(255,255,255,0.05);
      background: rgba(30,41,59,0.35);
    }
    .trust-bar-inner {
      max-width: 900px; margin: 0 auto;
      display: flex; align-items: center; justify-content: center;
      gap: 40px; flex-wrap: wrap;
    }
    .trust-item {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; color: var(--slate); font-weight: 500;
    }
    .trust-item span { font-size: 16px; }

    /* ---- SECTION COMMON ---- */
    section { padding: 96px 24px; }
    .section-inner { max-width: 1100px; margin: 0 auto; }
    .section-tag {
      display: inline-block; background: rgba(249,115,22,0.12); color: var(--orange);
      border-radius: 999px; font-size: 12px; font-weight: 700;
      padding: 4px 14px; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 16px;
    }
    .section-title { font-size: clamp(1.9rem, 4vw, 2.8rem); font-weight: 800; letter-spacing: -0.025em; margin-bottom: 14px; line-height: 1.2; }
    .section-sub { font-size: 1.05rem; color: var(--slate); max-width: 520px; line-height: 1.75; }

    /* ---- HOW IT WORKS ---- */
    .how { background: rgba(20,30,48,0.6); }
    .how-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 2px; margin-top: 56px; background: rgba(255,255,255,0.05); border-radius: 20px; overflow: hidden; }
    .how-step {
      background: var(--navy-card); padding: 36px 32px;
      position: relative; transition: background 0.2s;
    }
    .how-step:hover { background: #243044; }
    .step-num {
      width: 42px; height: 42px; border-radius: 12px;
      background: rgba(249,115,22,0.15); border: 1px solid rgba(249,115,22,0.3);
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; font-weight: 800; color: var(--orange); margin-bottom: 20px;
    }
    .how-step h3 { font-size: 1.05rem; font-weight: 700; margin-bottom: 10px; }
    .how-step p { font-size: 0.92rem; color: var(--slate); line-height: 1.7; }

    /* ---- FEATURES ---- */
    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 56px; }
    .feature-card {
      background: var(--navy-card); border-radius: 16px; padding: 28px 28px 32px;
      border: 1px solid rgba(255,255,255,0.06); transition: border-color 0.25s, transform 0.25s, box-shadow 0.25s;
    }
    .feature-card:hover { border-color: rgba(249,115,22,0.35); transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.3); }
    .feature-icon {
      width: 50px; height: 50px; border-radius: 13px;
      background: rgba(249,115,22,0.12); display: flex; align-items: center; justify-content: center;
      margin-bottom: 18px; font-size: 23px;
    }
    .feature-card h3 { font-size: 1.02rem; font-weight: 700; margin-bottom: 8px; }
    .feature-card p { font-size: 0.91rem; color: var(--slate); line-height: 1.7; }

    /* ---- ROLES ---- */
    .roles-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 56px; }
    @media (max-width: 640px) { .roles-grid { grid-template-columns: 1fr; } }
    .role-card {
      border-radius: 20px; padding: 40px 36px; border: 1px solid rgba(255,255,255,0.08);
      position: relative; overflow: hidden; transition: transform 0.25s;
    }
    .role-card:hover { transform: translateY(-3px); }
    .role-card.sender { background: linear-gradient(140deg, rgba(249,115,22,0.14) 0%, rgba(249,115,22,0.03) 100%); }
    .role-card.carrier { background: linear-gradient(140deg, rgba(99,102,241,0.14) 0%, rgba(99,102,241,0.03) 100%); }
    .role-emoji { font-size: 2.6rem; margin-bottom: 16px; }
    .role-card h3 { font-size: 1.35rem; font-weight: 800; margin-bottom: 10px; }
    .role-card p { font-size: 0.95rem; color: var(--slate); line-height: 1.75; margin-bottom: 24px; }
    .role-list { list-style: none; display: flex; flex-direction: column; gap: 9px; margin-bottom: 30px; }
    .role-list li { font-size: 0.9rem; color: var(--slate-light); display: flex; align-items: flex-start; gap: 9px; }
    .role-list li::before { content: '✓'; color: var(--orange); font-weight: 800; flex-shrink: 0; margin-top: 1px; }
    .role-btn {
      display: inline-block; text-decoration: none; border-radius: 10px;
      padding: 12px 24px; font-weight: 700; font-size: 14px; transition: all 0.2s;
    }
    .role-btn.orange { background: var(--orange); color: #fff; box-shadow: 0 4px 14px rgba(249,115,22,0.3); }
    .role-btn.orange:hover { background: var(--orange-dark); transform: translateY(-1px); }
    .role-btn.indigo { background: rgba(99,102,241,0.2); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.3); }
    .role-btn.indigo:hover { background: rgba(99,102,241,0.35); }

    /* ---- TESTIMONIALS ---- */
    .testimonials { background: rgba(20,30,48,0.5); }
    .testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 56px; }
    .tcard {
      background: var(--navy-card); border-radius: 16px; padding: 28px;
      border: 1px solid rgba(255,255,255,0.06);
      display: flex; flex-direction: column; gap: 16px;
    }
    .tcard-stars { color: #FBBF24; font-size: 14px; letter-spacing: 2px; }
    .tcard-quote { font-size: 0.96rem; color: var(--slate-light); line-height: 1.75; font-style: italic; }
    .tcard-author { display: flex; align-items: center; gap: 12px; margin-top: auto; }
    .tcard-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; font-weight: 700; color: #fff; flex-shrink: 0;
    }
    .tcard-name { font-size: 14px; font-weight: 700; }
    .tcard-role { font-size: 12px; color: var(--slate); margin-top: 2px; }

    /* ---- CTA BANNER ---- */
    .cta-section { padding-top: 0; padding-bottom: 96px; }
    .cta-banner {
      background: linear-gradient(140deg, rgba(249,115,22,0.18) 0%, rgba(99,102,241,0.1) 100%);
      border: 1px solid rgba(249,115,22,0.22); border-radius: 24px;
      padding: 72px 56px; text-align: center;
      position: relative; overflow: hidden;
    }
    .cta-banner::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(ellipse 60% 80% at 50% 100%, rgba(249,115,22,0.12) 0%, transparent 70%);
    }
    .cta-banner > * { position: relative; z-index: 1; }
    .cta-banner h2 { font-size: clamp(2rem, 5vw, 3rem); font-weight: 800; margin-bottom: 14px; letter-spacing: -0.02em; }
    .cta-banner p { color: var(--slate); font-size: 1.08rem; margin-bottom: 40px; max-width: 460px; margin-left: auto; margin-right: auto; line-height: 1.75; }
    @media (max-width: 600px) { .cta-banner { padding: 48px 24px; } }

    /* ---- FOOTER ---- */
    footer { border-top: 1px solid rgba(255,255,255,0.07); padding: 48px 24px; }
    .footer-inner { max-width: 1100px; margin: 0 auto; display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 32px; }
    .footer-brand { display: flex; flex-direction: column; gap: 10px; }
    .footer-logo { display: flex; align-items: center; gap: 9px; font-size: 16px; font-weight: 700; color: var(--white); text-decoration: none; }
    .footer-logo-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); }
    .footer-tagline { font-size: 13px; color: var(--slate); max-width: 220px; line-height: 1.6; }
    .footer-col h4 { font-size: 12px; font-weight: 700; color: var(--slate); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 14px; }
    .footer-col-links { display: flex; flex-direction: column; gap: 10px; }
    .footer-col-links a { font-size: 14px; color: var(--slate); text-decoration: none; transition: color 0.2s; }
    .footer-col-links a:hover { color: var(--white); }
    .footer-bottom { max-width: 1100px; margin: 32px auto 0; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
    .footer-copy { font-size: 12px; color: #475569; }
    .api-status { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--slate); }
    .api-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); animation: blink 2s infinite; }

    /* ---- SCROLL ANIMATION ---- */
    .reveal {
      opacity: 0;
      transform: translateY(28px);
      transition: opacity 0.6s ease, transform 0.6s ease;
    }
    .reveal.visible {
      opacity: 1;
      transform: translateY(0);
    }
    .reveal-delay-1 { transition-delay: 0.1s; }
    .reveal-delay-2 { transition-delay: 0.2s; }
    .reveal-delay-3 { transition-delay: 0.3s; }
    .reveal-delay-4 { transition-delay: 0.4s; }
    .reveal-delay-5 { transition-delay: 0.5s; }
  </style>
</head>
<body>

  <!-- NAV -->
  <nav id="navbar">
    <a href="/" class="nav-logo">
      <div class="nav-logo-icon">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zm-.5 1.5 1.96 2.5H17V9.5h2.5zM6 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm13.5-1c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1z"/></svg>
      </div>
      <span class="nav-logo-text">The GTW</span>
    </a>
    <div class="nav-links">
      <a href="#how">How it works</a>
      <a href="#features">Features</a>
      <a href="#for-you">For you</a>
    </div>
    <div class="nav-right">
      <a href="/app" class="nav-signin">Sign in</a>
      <a href="/app" class="nav-cta">Get Started</a>
    </div>
  </nav>

  <!-- HERO -->
  <section class="hero">
    <div class="hero-grid"></div>
    <div class="hero-inner">
      <div class="hero-badge"><span class="hero-badge-dot"></span> Now Live &mdash; Join the network</div>
      <h1>Send Parcels.<br><span class="accent">Earn on Every Trip.</span></h1>
      <p class="hero-sub">The GTW connects people who need to send parcels with travelers already going their way. No couriers, no middlemen — just a smarter, faster, peer-to-peer network.</p>
      <div class="hero-btns">
        <a href="/app" class="btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3L4 14h7v7l9-11h-7z"/></svg>
          Get Started Free
        </a>
        <a href="/dashboard" class="btn-ghost">
          Provider Dashboard
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
        </a>
      </div>
      <div class="hero-stats">
        <div class="stat-item">
          <div class="stat-num" data-count="4800" data-suffix="+">0</div>
          <div class="stat-label">Deliveries Made</div>
        </div>
        <div class="stat-item">
          <div class="stat-num" data-count="98" data-suffix="%">0</div>
          <div class="stat-label">On-Time Rate</div>
        </div>
        <div class="stat-item">
          <div class="stat-num" data-count="1200" data-suffix="+">0</div>
          <div class="stat-label">Active Carriers</div>
        </div>
        <div class="stat-item">
          <div class="stat-num" data-count="4" data-suffix=".9★">0</div>
          <div class="stat-label">Average Rating</div>
        </div>
      </div>
    </div>
  </section>

  <!-- TRUST BAR -->
  <div class="trust-bar">
    <div class="trust-bar-inner">
      <div class="trust-item"><span>🔒</span> End-to-end secure payments</div>
      <div class="trust-item"><span>✅</span> ID-verified carriers</div>
      <div class="trust-item"><span>📍</span> Real-time GPS tracking</div>
      <div class="trust-item"><span>💬</span> 24/7 in-app support</div>
      <div class="trust-item"><span>🛡️</span> Parcel insurance available</div>
    </div>
  </div>

  <!-- HOW IT WORKS -->
  <section class="how" id="how">
    <div class="section-inner">
      <div class="section-tag reveal">How it works</div>
      <h2 class="section-title reveal reveal-delay-1">Simple from start to finish</h2>
      <p class="section-sub reveal reveal-delay-2">Whether you're sending a package or picking up extra income on your commute, The GTW makes it effortless.</p>
      <div class="how-grid">
        <div class="how-step reveal reveal-delay-1">
          <div class="step-num">1</div>
          <h3>Post Your Parcel or Route</h3>
          <p>Senders list what they need delivered and where. Carriers post their upcoming trips and available capacity.</p>
        </div>
        <div class="how-step reveal reveal-delay-2">
          <div class="step-num">2</div>
          <h3>Get Matched Instantly</h3>
          <p>Our platform surfaces the best matches between senders and carriers traveling the same route — no waiting around.</p>
        </div>
        <div class="how-step reveal reveal-delay-3">
          <div class="step-num">3</div>
          <h3>Track &amp; Deliver</h3>
          <p>Senders get real-time updates. Carriers handle pickup and drop-off. Everyone is kept in the loop the whole way.</p>
        </div>
        <div class="how-step reveal reveal-delay-4">
          <div class="step-num">4</div>
          <h3>Rate &amp; Get Paid</h3>
          <p>Payments are released on confirmed delivery. Carriers earn on every trip. Senders rate their experience.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- FEATURES -->
  <section id="features">
    <div class="section-inner">
      <div class="section-tag reveal">Features</div>
      <h2 class="section-title reveal reveal-delay-1">Everything you need, nothing you don't</h2>
      <p class="section-sub reveal reveal-delay-2">Built for reliability and trust — from the first message to the final delivery.</p>
      <div class="features-grid">
        <div class="feature-card reveal reveal-delay-1">
          <div class="feature-icon">📍</div>
          <h3>Live Route Matching</h3>
          <p>Parcels and carriers are matched by route overlap in real time, so you always find the fastest option available.</p>
        </div>
        <div class="feature-card reveal reveal-delay-2">
          <div class="feature-icon">🔒</div>
          <h3>Verified Carriers</h3>
          <p>Every carrier goes through an identity verification process. Trust is built into the platform from day one.</p>
        </div>
        <div class="feature-card reveal reveal-delay-3">
          <div class="feature-icon">💬</div>
          <h3>In-App Messaging</h3>
          <p>Senders and carriers communicate directly through the app — no need to share personal contact details.</p>
        </div>
        <div class="feature-card reveal reveal-delay-1">
          <div class="feature-icon">💳</div>
          <h3>Secure Payments</h3>
          <p>Funds are held safely and only released once delivery is confirmed. No cash, no hassle, no risk.</p>
        </div>
        <div class="feature-card reveal reveal-delay-2">
          <div class="feature-icon">⭐</div>
          <h3>Reviews &amp; Ratings</h3>
          <p>A two-way rating system keeps the community accountable and helps you choose the best partners every time.</p>
        </div>
        <div class="feature-card reveal reveal-delay-3">
          <div class="feature-icon">🌍</div>
          <h3>Any Route, Any Distance</h3>
          <p>Local neighborhood deliveries or cross-country hauls — The GTW works across any distance and any route.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- FOR SENDERS & CARRIERS -->
  <section id="for-you" style="padding-top: 0;">
    <div class="section-inner">
      <div class="section-tag reveal">Who it's for</div>
      <h2 class="section-title reveal reveal-delay-1">Two sides of the same network</h2>
      <p class="section-sub reveal reveal-delay-2">The GTW works for anyone who needs something moved — and anyone willing to move it.</p>
      <div class="roles-grid">
        <div class="role-card sender reveal reveal-delay-1">
          <div class="role-emoji">📦</div>
          <h3>For Senders</h3>
          <p>Need to get a package somewhere? Let a trusted traveler carry it along their existing route — faster and cheaper than traditional shipping.</p>
          <ul class="role-list">
            <li>Post any size parcel in under 2 minutes</li>
            <li>Compare carriers by price, rating, and ETA</li>
            <li>Real-time delivery tracking</li>
            <li>Secure payment — only pay on delivery</li>
          </ul>
          <a href="/app" class="role-btn orange">Send a Parcel &rarr;</a>
        </div>
        <div class="role-card carrier reveal reveal-delay-2">
          <div class="role-emoji">🚗</div>
          <h3>For Carriers</h3>
          <p>Already making a trip? Pick up a parcel along the way and earn extra income without changing your plans.</p>
          <ul class="role-list">
            <li>Set your own route and availability</li>
            <li>Accept parcels that fit your schedule</li>
            <li>Earn on every delivery you complete</li>
            <li>Build your reputation with reviews</li>
          </ul>
          <a href="/app" class="role-btn indigo">Start Carrying &rarr;</a>
        </div>
      </div>
    </div>
  </section>

  <!-- TESTIMONIALS -->
  <section class="testimonials">
    <div class="section-inner">
      <div class="section-tag reveal">Testimonials</div>
      <h2 class="section-title reveal reveal-delay-1">Loved by senders &amp; carriers</h2>
      <p class="section-sub reveal reveal-delay-2">Real people, real deliveries, real results.</p>
      <div class="testimonials-grid">
        <div class="tcard reveal reveal-delay-1">
          <div class="tcard-stars">★★★★★</div>
          <p class="tcard-quote">"I needed to send a gift to my sister in another city and The GTW matched me with a carrier within the hour. It arrived the same day — cheaper than any courier I've used."</p>
          <div class="tcard-author">
            <div class="tcard-avatar" style="background: linear-gradient(135deg,#F97316,#EA580C);">A</div>
            <div>
              <div class="tcard-name">Amara K.</div>
              <div class="tcard-role">Sender &mdash; Lagos</div>
            </div>
          </div>
        </div>
        <div class="tcard reveal reveal-delay-2">
          <div class="tcard-stars">★★★★★</div>
          <p class="tcard-quote">"I drive the same route to work every day. Now I pick up a parcel or two on the way and earn an extra few thousand naira a week. It's genuinely passive income."</p>
          <div class="tcard-author">
            <div class="tcard-avatar" style="background: linear-gradient(135deg,#6366f1,#4f46e5);">D</div>
            <div>
              <div class="tcard-name">David O.</div>
              <div class="tcard-role">Carrier &mdash; Abuja</div>
            </div>
          </div>
        </div>
        <div class="tcard reveal reveal-delay-3">
          <div class="tcard-stars">★★★★★</div>
          <p class="tcard-quote">"The tracking feature is brilliant. I could follow my parcel the entire way and the carrier kept me updated. This is the future of local delivery, no question."</p>
          <div class="tcard-author">
            <div class="tcard-avatar" style="background: linear-gradient(135deg,#22c55e,#16a34a);">F</div>
            <div>
              <div class="tcard-name">Fatima B.</div>
              <div class="tcard-role">Sender &mdash; Kano</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA BANNER -->
  <section class="cta-section">
    <div class="section-inner">
      <div class="cta-banner reveal">
        <h2>Ready to join the network?</h2>
        <p>Sign up in minutes and start sending or carrying parcels across any route today. It's free to get started.</p>
        <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">
          <a href="/app" class="btn-primary">Create Free Account</a>
          <a href="/dashboard" class="btn-ghost">Provider Dashboard</a>
        </div>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer>
    <div class="footer-inner">
      <div class="footer-brand">
        <a href="/" class="footer-logo">
          <span class="footer-logo-dot"></span>
          The GTW
        </a>
        <p class="footer-tagline">Peer-to-peer parcel delivery across any route, powered by community.</p>
      </div>
      <div class="footer-col">
        <h4>Platform</h4>
        <div class="footer-col-links">
          <a href="/app">Web App</a>
          <a href="/dashboard">Provider Dashboard</a>
          <a href="/app">Sign Up</a>
          <a href="/app">Sign In</a>
        </div>
      </div>
      <div class="footer-col">
        <h4>Resources</h4>
        <div class="footer-col-links">
          <a href="#how">How it Works</a>
          <a href="#features">Features</a>
          <a href="#for-you">For Carriers</a>
          <a href="/api/health">API Status</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <p class="footer-copy">&copy; 2024 The GTW &mdash; ParcelPeer. All rights reserved.</p>
      <div class="api-status"><span class="api-dot"></span> All systems operational</div>
    </div>
  </footer>

  <script>
    // Nav scroll effect
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });

    // Scroll reveal
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
    }, { threshold: 0.12 });
    reveals.forEach(el => observer.observe(el));

    // Animated counters
    function animateCount(el) {
      const target = parseInt(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const duration = 1800;
      const step = target / (duration / 16);
      let current = 0;
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = (current >= target ? target : Math.floor(current)).toLocaleString() + suffix;
        if (current >= target) clearInterval(timer);
      }, 16);
    }
    const statEls = document.querySelectorAll('[data-count]');
    const statObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { animateCount(e.target); statObserver.unobserve(e.target); } });
    }, { threshold: 0.5 });
    statEls.forEach(el => statObserver.observe(el));
  </script>

</body>
</html>`);
  });
  log("✓ Landing page served at /");
}

function configureWebApp(app: express.Application) {
  const webDir = path.resolve(process.cwd(), "static", "web");
  app.use("/app", express.static(webDir, { index: "index.html" }));
  app.use(/^\/app(\/.*)?$/, (_req: Request, res: Response) => {
    res.sendFile(path.join(webDir, "index.html"));
  });
  log("✓ Web app served at /app");
}

function configureDashboard(app: express.Application) {
  const dashboardDir = path.resolve(process.cwd(), "static", "dashboard");
  // Serve static assets (app.js, etc.)
  app.use("/dashboard", express.static(dashboardDir));
  // All /dashboard/* sub-paths fall back to index.html (SPA)
  app.get(/^\/dashboard(\/.*)?$/, (_req: Request, res: Response) => {
    res.sendFile(path.join(dashboardDir, "index.html"));
  });
  log("✓ Provider dashboard served at /dashboard");
}

function configureViteDev(app: express.Application) {
  log("Proxying web requests to Vite dev server on port 3000");

  // Redirect root to /app/ so the Replit preview pane lands on the web app
  app.get("/", (_req: Request, res: Response) => res.redirect("/app/"));

  app.use(
    createProxyMiddleware({
      target: "http://localhost:3000",
      changeOrigin: true,
      ws: true,
      pathFilter: (path: string) => !path.startsWith("/api"),
      on: {
        error: (_err: Error, _req: Request, res: Response) => {
          (res as Response).status(502).send(
            "<html><body style='font-family:sans-serif;padding:40px'>" +
            "<h2>Web dev server starting...</h2>" +
            "<p>Vite is warming up. Please refresh in a moment.</p>" +
            "<script>setTimeout(()=>location.reload(),3000)</script>" +
            "</body></html>"
          );
        },
      },
    })
  );

  log("✓ Web app proxied at / (API requests pass through to Node.js)");
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    res.status(status).json({ message });

    throw err;
  });
}

export async function createServerInstance() {
  setupCors(app);
  setupBodyParsing(app);
  setupPhotoStorage(app);
  setupRequestLogging(app);

  if (process.env.NODE_ENV === "production") {
    configureProductionLanding(app);
    configureWebApp(app);
    configureDashboard(app);
  } else {
    configureViteDev(app);
  }

  const server = await registerRoutes(app);
  registerAdminRoutes(app);

  setupErrorHandler(app);

  return server;
}

// Start server automatically unless we're in a test environment
if (process.env.NODE_ENV !== "test") {
  (async () => {
    try {
      const server = await createServerInstance();

      const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
      const listenOptions: any = { port, host: "0.0.0.0" };
      // `reusePort` is not supported on some platforms (e.g., Windows), so set it conditionally
      if (process.platform !== "win32") {
        listenOptions.reusePort = true;
      }

      server.listen(listenOptions, () => {
        log(`express server serving on port ${port}`);
      });
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  })();
}
