import { useState, useMemo, useEffect, useRef } from "react";
import { GoogleGenAI } from "@google/genai";
import { Sparkles, Loader2, User, Layout, Image as ImageIcon, Trash2, Camera, UserPlus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const MONTHS_S = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTHS_L = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const TIME_SLOTS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];
const ROUNDS = ["Fase Regular","Cuartos de Final","Semifinal","Tercer Lugar","Final"];

function getUpcomingSundays(n = 12) {
  const result = [];
  const today = new Date();
  const d = new Date(today);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? 7 : 7 - dow));
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) { result.push(new Date(d)); d.setDate(d.getDate() + 7); }
  return result;
}

function isoDate(d) { return d.toISOString().split("T")[0]; }
function formatDateES(date) {
  return `Domingo ${date.getDate()} de ${MONTHS_L[date.getMonth()]} ${date.getFullYear()}`;
}

const LS_KEY = "bk_torneo_v1";
const LS_LOGOS = "bk_torneo_logos_v1";
const LS_PLAYER_PHOTOS = "bk_torneo_player_photos_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    // Migration: ensure all teams have a players array
    if (state.teams) {
      state.teams = state.teams.map(t => ({
        ...t, 
        players: (t.players || []).map(p => ({
          ...p,
          isStarter: p.isStarter !== undefined ? p.isStarter : true,
          x: p.x || 50,
          y: p.y || 50
        })),
        pf: t.pf || 0,
        pa: t.pa || 0,
        wins: t.wins || 0,
        losses: t.losses || 0
      }));
    }
    return state;
  } catch { return null; }
}
function saveState(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
}
function loadLogos() {
  try { const raw = localStorage.getItem(LS_LOGOS); if (!raw) return {}; return JSON.parse(raw); } catch { return {}; }
}
function saveLogo(teamId, base64) {
  try {
    const logos = loadLogos();
    logos[teamId] = base64;
    localStorage.setItem(LS_LOGOS, JSON.stringify(logos));
  } catch { alert("No se pudo guardar el logo. Intenta con una imagen mas pequena."); }
}
function removeLogo(teamId) {
  try {
    const logos = loadLogos();
    delete logos[teamId];
    localStorage.setItem(LS_LOGOS, JSON.stringify(logos));
  } catch {}
}

function loadPlayerPhotos() {
  try { const raw = localStorage.getItem(LS_PLAYER_PHOTOS); if (!raw) return {}; return JSON.parse(raw); } catch { return {}; }
}
function savePlayerPhoto(playerId, base64) {
  try {
    const photos = loadPlayerPhotos();
    photos[playerId] = base64;
    localStorage.setItem(LS_PLAYER_PHOTOS, JSON.stringify(photos));
  } catch { alert("Imagen muy pesada. Intenta con una más pequeña."); }
}
function removePlayerPhoto(playerId) {
  try {
    const photos = loadPlayerPhotos();
    delete photos[playerId];
    localStorage.setItem(LS_PLAYER_PHOTOS, JSON.stringify(photos));
  } catch {}
}

const INIT_TEAMS = [
  { id: 1, name: "Sello Oro",           category: "Masculino", wins: 0, losses: 0, pf: 0, pa: 0, players: [] },
  { id: 2, name: "Llamas Negras",        category: "Masculino", wins: 0, losses: 0, pf: 0, pa: 0, players: [] },
  { id: 3, name: "Los Esclavos",         category: "Masculino", wins: 0, losses: 0, pf: 0, pa: 0, players: [] },
  { id: 4, name: "Los Esclavos Jr.",     category: "Masculino", wins: 0, losses: 0, pf: 0, pa: 0, players: [] },
  { id: 5, name: "Super Stars",          category: "Femenino",  wins: 0, losses: 0, pf: 0, pa: 0, players: [] },
  { id: 6, name: "Magisterio Femenino",  category: "Femenino",  wins: 0, losses: 0, pf: 0, pa: 0, players: [] },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Barlow:wght@400;500;600&family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;1,600&display=swap');
:root {
  --bg: #020617;
  --bg2: #0f172a;
  --bg3: #1e293b;
  --card: #0f172a;
  --border: #1e293b;
  --orange: #ea580c;
  --gold: #f59e0b;
  --green: #10b981;
  --red: #ef4444;
  --blue: #3b82f6;
  --text: #f8fafc;
  --muted: #64748b;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
.bk { font-family: 'Barlow', sans-serif; background: var(--bg); min-height: 100vh; color: var(--text); padding-bottom: 40px; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 16px; }
.hdr { padding: 24px 0 0; position: relative; }
.hdr-inner { background: var(--bg2); border: 1px solid var(--border); border-radius: 24px; padding: 16px 20px; display: flex; flex-direction: column; gap: 16px; }
.hdr-top { display: flex; justify-content: space-between; align-items: center; }
.hdr-title { font-family: 'Oswald', sans-serif; font-size: 24px; font-weight: 700; color: var(--text); letter-spacing: 1px; text-transform: uppercase; line-height: 1; }
.hdr-sub { font-size: 10px; color: var(--orange); letter-spacing: 3px; text-transform: uppercase; font-weight: 600; margin-top: 4px; }
.hdr-venue { font-size: 12px; color: var(--muted); margin-top: 4px; }
.tabs { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; padding: 4px; background: var(--bg); border-radius: 14px; border: 1px solid var(--border); }
.tabs::-webkit-scrollbar { display: none; }
.tab { font-family: 'Oswald', sans-serif; font-size: 12px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); padding: 8px 16px; cursor: pointer; border-radius: 10px; white-space: nowrap; transition: .2s all; }
.tab:hover { color: var(--text); background: rgba(255,255,255,0.05); }
.tab.on { color: #fff; background: var(--orange); box-shadow: 0 10px 15px -3px rgba(234,88,12,0.2); }
.body { padding: 24px 0; display: grid; grid-template-columns: 1fr; gap: 20px; }
@media (min-width: 1024px) {
  .body-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 20px; }
  .span-8 { grid-column: span 8; }
  .span-4 { grid-column: span 4; }
}
.card { background: var(--card); border: 1px solid var(--border); border-radius: 24px; padding: 24px; position: relative; overflow: hidden; }
.card-ttl { font-family: 'Oswald', sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
.divider { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
.tbl { width: 100%; border-collapse: collapse; font-size: 14px; }
.tbl th { font-family: 'Oswald', sans-serif; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); padding: 12px 8px; text-align: center; border-bottom: 1px solid var(--border); }
.tbl th:nth-child(2) { text-align: left; }
.tbl td { padding: 14px 8px; text-align: center; border-bottom: 1px solid rgba(255,255,255,.03); }
.tbl td:nth-child(2) { text-align: left; }
.tbl tr:last-child td { border-bottom: none; }
.rank { font-family: 'Oswald', sans-serif; font-size: 16px; font-weight: 700; }
.r1 { color: var(--gold) } .r2 { color: #94a3b8 } .r3 { color: #b45309 }
.tnm { font-weight: 600; font-size: 14px; }
.pts { font-family: 'Oswald', sans-serif; font-size: 18px; font-weight: 700; color: var(--text); }
.filters { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.pill { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; padding: 6px 16px; border-radius: 99px; cursor: pointer; border: 1px solid var(--border); color: var(--muted); background: var(--bg2); transition: .2s all; }
.pill.on, .pill:hover { background: var(--orange); border-color: var(--orange); color: #fff; }
.cat { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: .8px; padding: 2px 8px; border-radius: 99px; text-transform: uppercase; margin-left: 5px; }
.cat-m { background: rgba(59,130,246,.1); color: var(--blue); border: 1px solid rgba(59,130,246,.2); }
.cat-f { background: rgba(234,88,12,.1); color: var(--orange); border: 1px solid rgba(234,88,12,.2); }
.rnd { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: .8px; padding: 3px 10px; border-radius: 99px; text-transform: uppercase; background: var(--bg3); color: var(--muted); }
.rnd-fin { background: rgba(245,158,11,.1); color: var(--gold); border: 1px solid rgba(245,158,11,.2); }
.suns { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 20px; scrollbar-width: none; }
.suns::-webkit-scrollbar { display: none; }
.sun { flex-shrink: 0; background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 12px 14px; cursor: pointer; text-align: center; transition: .2s all; min-width: 70px; }
.sun.on { background: var(--orange); border-color: var(--orange); box-shadow: 0 10px 15px -3px rgba(234,88,12,0.2); }
.sun .d { font-family: 'Oswald', sans-serif; font-size: 22px; font-weight: 700; line-height: 1; }
.sun .m { font-size: 10px; text-transform: uppercase; color: var(--muted); margin-top: 4px; font-weight: 600; }
.sun.on .m { color: rgba(255,255,255,.8); }
.sun .gc { font-size: 9px; background: var(--bg3); padding: 2px 6px; border-radius: 99px; margin-top: 6px; color: var(--muted); font-weight: 700; }
.sun.on .gc { background: rgba(0,0,0,.2); color: #fff; }
.game { background: var(--bg); border: 1px solid var(--border); border-radius: 20px; padding: 20px; margin-bottom: 12px; transition: .2s; }
.game:hover { border-color: var(--muted); }
.game.done { border-color: rgba(16,185,129,.2); }
.gm-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px; flex-wrap: wrap; }
.gm-time { font-family: 'Oswald', sans-serif; font-size: 14px; font-weight: 600; color: var(--orange); }
.matchup { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.team-s { flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.team-nm { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 700; line-height: 1.2; text-transform: uppercase; letter-spacing: 0.5px; }
.sc-area { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; min-width: 80px; }
.sc-vals { display: flex; align-items: center; gap: 10px; }
.sc { font-family: 'Oswald', sans-serif; font-size: 32px; font-weight: 700; min-width: 40px; text-align: center; line-height: 1; }
.sc-w { color: var(--text) } .sc-l { color: var(--muted) } .vs { font-family: 'Oswald', sans-serif; font-size: 14px; font-weight: 600; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; }
.lbl { font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; display: block; }
.inp { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; color: var(--text); font-family: 'Barlow', sans-serif; font-size: 14px; width: 100%; outline: none; transition: .2s; }
.inp:focus { border-color: var(--orange); background: var(--bg2); }
.sel { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; color: var(--text); font-family: 'Barlow', sans-serif; font-size: 14px; width: 100%; -webkit-appearance: none; outline: none; cursor: pointer; }
.sel:focus { border-color: var(--orange); }
.fr { margin-bottom: 16px; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.btn { font-family: 'Oswald', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; padding: 12px 24px; border-radius: 12px; cursor: pointer; border: none; transition: .2s all; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
.btn-p { background: var(--orange); color: #fff; }
.btn-p:hover { background: #c2410c; transform: translateY(-1px); box-shadow: 0 10px 15px -3px rgba(234,88,12,0.3); }
.btn-g { background: var(--green); color: #020617; }
.btn-g:hover { filter: brightness(1.1); transform: translateY(-1px); }
.btn-d { background: rgba(239,68,68,.1); color: var(--red); border: 1px solid rgba(239,68,68,.2); padding: 6px 12px; font-size: 11px; }
.btn-s { background: var(--bg3); color: var(--text); border: 1px solid var(--border); }
.btn-full { width: 100%; margin-top: 8px; }
.btn-reset { background: rgba(239,68,68,.05); color: var(--red); border: 1px solid rgba(239,68,68,.1); font-size: 11px; padding: 10px 16px; width: 100%; margin-top: 20px; border-radius: 12px; }
.btn-reset:hover { background: rgba(239,68,68,.1); }
.sc-inp { font-family: 'Oswald', sans-serif; font-size: 48px; font-weight: 700; text-align: center; background: var(--bg); border: 2px solid var(--border); border-radius: 16px; color: var(--text); width: 100px; padding: 12px; }
.sc-inp:focus { border-color: var(--orange); outline: none; background: var(--bg2); }
.t-sel { background: transparent; border: none; border-bottom: 1px dashed var(--orange); color: var(--orange); font-family: 'Oswald', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; padding: 2px 4px; }

/* LOGO styles */
.team-logo { width: 40px; height: 40px; border-radius: 12px; object-fit: cover; border: 1px solid var(--border); flex-shrink: 0; background: var(--bg); }
.team-logo-sm { width: 28px; height: 28px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border); vertical-align: middle; background: var(--bg); }
.team-logo-md { width: 64px; height: 64px; border-radius: 16px; object-fit: cover; border: 2px solid var(--border); margin-bottom: 8px; background: var(--bg); }
.team-logo-lg { width: 80px; height: 80px; border-radius: 20px; object-fit: cover; border: 2px solid var(--gold); margin-bottom: 12px; background: var(--bg); }
.logo-placeholder { width: 40px; height: 40px; border-radius: 12px; background: var(--bg); border: 1px dashed var(--border); display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--muted); flex-shrink: 0; }
.logo-upload-btn { background: rgba(59,130,246,.1); color: var(--blue); border: 1px solid rgba(59,130,246,.3); font-family: 'Oswald', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 1px; padding: 6px 12px; border-radius: 8px; cursor: pointer; text-transform: uppercase; }
.logo-upload-btn:hover { background: rgba(59,130,246,.2); }
.logo-remove-btn { background: transparent; color: var(--muted); border: none; font-size: 11px; cursor: pointer; padding: 4px; }
.logo-remove-btn:hover { color: var(--red); }

/* poster - kept consistent but refined */
.poster-wrap { position: relative; }
.btn-print { background: var(--gold); color: #000; font-family: 'Oswald', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; padding: 14px 0; border-radius: 16px; cursor: pointer; border: none; width: 100%; margin-bottom: 16px; transition: .2s; box-shadow: 0 10px 15px -3px rgba(245,158,11,0.2); }
.btn-print:hover { filter: brightness(1.1); transform: translateY(-1px); }
.poster { background: #020617; border: 4px solid #1e293b; border-radius: 32px; overflow: hidden; font-family: 'Oswald', sans-serif; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
.poster-hdr { background: linear-gradient(160deg,#0f172a 0%,#020617 100%); padding: 24px 20px 20px; text-align: center; position: relative; border-bottom: 1px solid rgba(255,255,255,0.05); }
.poster-city { display: inline-block; background: var(--orange); color: #fff; font-size: 12px; font-weight: 800; letter-spacing: 4px; text-transform: uppercase; padding: 6px 20px; border-radius: 6px; margin-bottom: 12px; }
.poster-title { font-size: 40px; font-weight: 800; color: #fff; line-height: 1; font-style: italic; text-transform: uppercase; letter-spacing: -1px; }
.poster-dates { display: flex; justify-content: space-between; padding: 12px 20px; font-size: 14px; font-weight: 700; letter-spacing: 3px; color: var(--muted); text-transform: uppercase; margin-top: 15px; background: rgba(255,255,255,0.02); }
.poster-game { display: flex; align-items: center; margin: 0 16px 12px; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); }
.poster-team-blk { flex: 1; background: #1e293b; display: flex; align-items: center; gap: 10px; padding: 10px 14px; min-width: 0; }
.poster-team-blk.right { background: #0f172a; flex-direction: row-reverse; text-align: right; }
.poster-logo-box { width: 52px; height: 52px; border-radius: 12px; overflow: hidden; background: rgba(0,0,0,0.3); flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.poster-logo-box img { width: 100%; height: 100%; object-fit: cover; }
.poster-logo-init { font-size: 22px; font-weight: 700; color: rgba(255,255,255,0.5); }
.poster-tnm { font-size: 15px; font-weight: 700; text-transform: uppercase; color: #fff; line-height: 1.2; flex: 1; min-width: 0; overflow: hidden; letter-spacing: 0.5px; }
.poster-vs-blk { background: var(--orange); padding: 0 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; min-height: 72px; }
.poster-vs-txt { font-size: 16px; font-weight: 800; color: #fff; letter-spacing: 1px; font-style: italic; }
.poster-score-blk { background: #fff; width: 70px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: #000; font-family: 'Oswald', sans-serif; flex-shrink: 0; min-height: 72px; }
.poster-score-blk.done { background: #dcfce7; color: #166534; }
.poster-time-row { padding: 10px 16px 6px; display: flex; gap: 10px; align-items: center; }
.poster-time-badge { background: var(--bg3); border: 1px solid var(--border); border-radius: 20px; padding: 4px 12px; font-size: 11px; color: var(--text); letter-spacing: 1px; font-weight: 600; }
.poster-ft { background: var(--bg2); padding: 16px; text-align: center; font-size: 18px; font-weight: 700; color: #fff; font-style: italic; letter-spacing: 2px; border-top: 1px solid rgba(255,255,255,0.05); text-transform: uppercase; }

@media print {
  @page { margin: 6mm; size: letter portrait; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  .bk { background: #fff !important; padding: 0 !important; }
  .hdr, .tabs, .filters, .suns, .btn-print, .notice, .warn { display: none !important; }
  .body { padding: 0 !important; }
  .poster-wrap { display: block !important; }
  .poster { border-radius: 12px !important; border: 3px solid #000 !important; width: 100% !important; page-break-inside: avoid; box-shadow: none !important; }
  .poster-hdr { background: #f0f0f0 !important; border-bottom: 2px solid #000 !important; }
  .poster-city { background: #000 !important; color: #fff !important; }
  .poster-title { color: #000 !important; }
  .poster-team-blk { background: #eee !important; border: 1px solid #000 !important; }
  .poster-team-blk.right { background: #fff !important; }
  .poster-vs-blk { background: #000 !important; }
  .poster-score-blk { border: 1px solid #000 !important; background: #fff !important; }
  .poster-score-blk.done { background: #f0fff0 !important; }
  .poster-ft { background: #000 !important; color: #fff !important; }
  .poster-time-badge { background: #fff !important; border: 1px solid #000 !important; color: #000 !important; }
  .poster-logo-box { background: #ddd !important; }
  .poster-dates { color: #333 !important; border-top: 1px solid #000 !important; background: none !important; }
}

.empty { text-align: center; padding: 60px 24px; color: var(--muted); }
.empty-i { font-size: 48px; margin-bottom: 12px; opacity: 0.3; }
.empty-t { font-size: 14px; font-weight: 500; }
.notice { background: rgba(245,158,11,.05); border: 1px solid rgba(245,158,11,.1); border-radius: 12px; padding: 12px 16px; font-size: 12px; color: var(--gold); margin-top: 12px; text-align: center; font-weight: 500; }
.warn { background: rgba(234,88,12,.05); border: 1px solid rgba(234,88,12,.1); border-radius: 12px; padding: 12px 16px; font-size: 12px; color: var(--orange); text-align: center; font-weight: 600; }
.save-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--green); margin-left: 12px; vertical-align: middle; animation: pulse 2s ease-in-out infinite; box-shadow: 0 0 10px var(--green); }
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .4; transform: scale(0.8); } }

/* AI section styles */
.ai-badge {
  background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
  color: white;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.ai-response {
  margin-top: 24px;
  padding: 24px;
  background: rgba(255,255,255,0.02);
  border-radius: 20px;
  border: 1px solid var(--border);
  font-size: 15px;
  line-height: 1.7;
  white-space: pre-wrap;
  color: #cbd5e1;
}

/* Court Styles */
.court-container {
  perspective: 1200px;
  padding: 20px 0 60px;
  display: flex;
  justify-content: center;
}
.court {
  width: 100%;
  max-width: 600px;
  aspect-ratio: 1 / 1.2;
  background: #78350f; /* Wood base */
  background-image: 
    repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 40px),
    linear-gradient(to bottom, rgba(0,0,0,0.2), transparent);
  border: 4px solid #451a03;
  border-radius: 4px;
  position: relative;
  overflow: visible;
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-style: preserve-3d;
}

.court.view-3d {
  transform: rotateX(40deg) rotateZ(0deg);
  box-shadow: 
    0 20px 50px rgba(0,0,0,0.5),
    0 0 0 10px #451a03;
}

.court-line { position: absolute; border: 2px solid rgba(255,255,255,0.5); pointer-events: none; }
.court-mid { width: 100%; top: 0; left: 0; border-top: 2px solid rgba(255,255,255,0.5); }
.court-circle { width: 30%; aspect-ratio: 1; border-radius: 50%; top: 0%; left: 50%; transform: translate(-50%, -50%); }
.court-paint { width: 40%; height: 35%; bottom: 0; left: 50%; transform: translateX(-50%); border: 2px solid rgba(255,255,255,0.5); background: rgba(234,88,12,0.1); }
.court-3pt { width: 90%; height: 60%; bottom: -10%; left: 50%; transform: translateX(-50%); border: 2px solid rgba(255,255,255,0.5); border-radius: 50% / 40%; }
.court-rim { width: 10%; aspect-ratio: 1; border: 2px solid #ef4444; border-radius: 50%; bottom: 8%; left: 50%; transform: translateX(-50%); position: absolute; }

.player-bubble {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 70px;
  cursor: grab;
  z-index: 10;
  transform-style: preserve-3d;
}

.view-3d .player-bubble {
  transform: translateZ(20px) rotateX(-40deg); /* Counter-rotate to stay upright */
}
.player-photo-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--bg3);
  border: 2px solid var(--orange);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}
.player-photo-circle img { width: 100%; height: 100%; object-fit: cover; }
.player-info-card {
  background: rgba(0,0,0,0.8);
  padding: 2px 6px;
  border-radius: 4px;
  text-align: center;
  min-width: 60px;
}
.player-num-badge {
  font-family: 'Oswald', sans-serif;
  font-size: 10px;
  font-weight: 700;
  color: var(--gold);
}
.player-name-lbl {
  font-size: 9px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

/* ID Cards Styles */
.id-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}
.id-card {
  width: 320px;
  height: 190px;
  background: #fff;
  color: #000;
  border-radius: 12px;
  display: flex;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  border: 1px solid #ddd;
  position: relative;
}
.id-card-side {
  width: 12px;
  background: var(--orange);
}
.id-card-main {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
}
.id-card-hdr {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
  border-bottom: 1px solid #eee;
  padding-bottom: 6px;
}
.id-tourney-name {
  font-family: 'Oswald', sans-serif;
  font-size: 10px;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.id-card-body {
  display: flex;
  gap: 12px;
  flex: 1;
}
.id-photo-frame {
  width: 75px;
  height: 95px;
  background: #f1f5f9;
  border: 1px solid #eee;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}
.id-photo-frame img { width: 100%; height: 100%; object-fit: cover; }
.id-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.id-player-name {
  font-family: 'Oswald', sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.2;
  margin-bottom: 2px;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.id-player-num {
  font-family: 'Oswald', sans-serif;
  font-size: 20px;
  font-weight: 800;
  color: var(--orange);
}
.id-meta-row {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.id-team-name {
  font-size: 10px;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Roster Poster Grid */
.roster-poster {
  background: linear-gradient(135deg, #020617 0%, #0f172a 100%);
  padding: 40px;
  border-radius: 32px;
  border: 4px solid var(--orange);
}
.roster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 20px;
  margin-top: 30px;
}
.roster-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 16px;
  text-align: center;
}
.roster-photo {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #1e293b;
  margin: 0 auto 12px;
  overflow: hidden;
  border: 2px solid var(--orange);
}
.roster-photo img { width: 100%; height: 100%; object-fit: cover; }
.roster-photo:hover .photo-overlay { opacity: 1 !important; }
.bench-slot:hover { background: rgba(255,255,255,0.05); border-color: var(--orange) !important; }
.roster-name { font-family: 'Oswald', sans-serif; font-size: 16px; font-weight: 700; color: #fff; text-transform: uppercase; }
.roster-num { font-size: 14px; font-weight: 800; color: var(--gold); margin-top: 2px; }

@media print {
  .id-cards-grid { 
    display: grid !important; 
    grid-template-columns: 1fr 1fr !important;
    gap: 10px !important;
  }
  .id-card { 
    break-inside: avoid; 
    box-shadow: none !important; 
    border: 1px solid #000 !important;
    page-break-inside: avoid;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .roster-poster { border: 2px solid #000 !important; background: #fff !important; }
  .roster-card { border: 1px solid #000 !important; }
  .roster-name { color: #000 !important; }
}
`;

export default function App() {
  const saved = loadState();
  const [tab,setTab] = useState("standings");
  const [teams,setTeams] = useState(saved?.teams ?? INIT_TEAMS);
  const [games,setGames] = useState(saved?.games ?? []);
  const [venue,setVenue] = useState(saved?.venue ?? "Salon Seno Zulema");
  const [tourney,setTourney] = useState(saved?.tourney ?? "TORNEO RELAMPAGO 2025");
  const [logos,setLogos] = useState(loadLogos);
  const [playerPhotos,setPlayerPhotos] = useState(loadPlayerPhotos);
  const [selDate,setSelDate] = useState(isoDate(new Date()));
  const [catFilter,setCatFilter] = useState("Todos");
  const [newGame,setNewGame] = useState({team1:"",team2:"",date:isoDate(new Date()),time:"10:00",category:"Masculino",round:"Fase Regular"});
  const [selGameId,setSelGameId] = useState(null);
  const [scores,setScores] = useState({s1:"",s2:""});
  const [newTeam,setNewTeam] = useState({name:"",category:"Masculino"});
  const [newPlayer,setNewPlayer] = useState({name:"",number:"",position:"Escolta",isStarter:true});
  const [selTeamIdForPlantilla,setSelTeamIdForPlantilla] = useState(null);
  const [selTeamIdForFormation,setSelTeamIdForFormation] = useState(null);
  const [selTeamIdForCards,setSelTeamIdForCards] = useState(null);
  const [is3DView, setIs3DView] = useState(true);
  const fileInputRef = useRef(null);
  const playerFileInputRef = useRef(null);
  const [uploadingFor,setUploadingFor] = useState(null);
  const [uploadingForPlayer,setUploadingForPlayer] = useState(null);

  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => { saveState({teams,games,venue,tourney}); }, [teams,games,venue,tourney]);

  // Unique dates from games
  const gameDates = useMemo(() => {
    const dates = [...new Set(games.map(g => g.date))].sort();
    const today = isoDate(new Date());
    if (dates.length === 0) return [today];
    return dates;
  }, [games]);

  const gamesOn = (date) => games.filter(g=>g.date===date).sort((a,b)=>a.time.localeCompare(b.time));

  useEffect(() => {
    // If current selected date has no games, default to the first date with games if available
    if (games.length > 0 && gamesOn(selDate).length === 0) {
      setSelDate(gameDates[0]);
    }
  }, [games]);

  const standings = useMemo(() =>
    teams.map(t=>({...t,played:t.wins+t.losses,diff:t.pf-t.pa,pts:t.wins*2+t.losses*1}))
         .sort((a,b)=>b.pts-a.pts||b.diff-a.diff),[teams]);

  const pending = games.filter(g=>!g.completed);
  const completed = games.filter(g=>g.completed);
  const getTeam = id => teams.find(t=>t.id===id);
  const filtered = catFilter==="Todos" ? standings : standings.filter(t=>t.category===catFilter);

  // Logo helpers
  const getLogo = (teamId) => logos[teamId] || null;

  const handleLogoClick = (teamId) => {
    setUploadingFor(teamId);
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file || !uploadingFor) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      saveLogo(uploadingFor, base64);
      setLogos(prev => ({...prev, [uploadingFor]: base64}));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setUploadingFor(null);
  };

  const handleLogoRemove = (teamId) => {
    removeLogo(teamId);
    setLogos(prev => { const n={...prev}; delete n[teamId]; return n; });
  };

  const addGame = () => {
    if(!newGame.team1||!newGame.team2||newGame.team1===newGame.team2) return;
    setGames(p=>[...p,{id:Date.now(),date:newGame.date,time:newGame.time,team1:+newGame.team1,team2:+newGame.team2,category:newGame.category,round:newGame.round,score1:null,score2:null,completed:false}]);
    setNewGame({team1:"",team2:"",date:newGame.date,time:"10:00",category:"Masculino",round:"Fase Regular"});
  };

  const recordScore = () => {
    const s1=parseInt(scores.s1),s2=parseInt(scores.s2);
    if(isNaN(s1)||isNaN(s2)||!selGameId) return;
    const g=games.find(x=>x.id===selGameId);
    if(!g || g.completed) return;
    setGames(p=>p.map(x=>x.id===selGameId?{...x,score1:s1,score2:s2,completed:true}:x));
    setTeams(p=>p.map(t=>{
      if(t.id===g.team1){const w=s1>s2;return{...t,wins:t.wins+(w?1:0),losses:t.losses+(w?0:1),pf:t.pf+s1,pa:t.pa+s2};}
      if(t.id===g.team2){const w=s2>s1;return{...t,wins:t.wins+(w?1:0),losses:t.losses+(w?0:1),pf:t.pf+s2,pa:t.pa+s1};}
      return t;
    }));
    setSelGameId(null);setScores({s1:"",s2:""});
  };

  const removeGame = id => setGames(p=>p.filter(g=>g.id!==id));
  const addTeam = () => {
    if(!newTeam.name.trim()) return;
    setTeams(p=>[...p,{id:Date.now(),name:newTeam.name.trim(),category:newTeam.category,wins:0,losses:0,pf:0,pa:0,players:[]}]);
    setNewTeam({name:"",category:"Masculino"});
  };
  const removeTeam = id => {
    handleLogoRemove(id);
    const team = teams.find(t=>t.id===id);
    if(team) team.players.forEach(p=>removePlayerPhoto(p.id));
    setTeams(p=>p.filter(t=>t.id!==id));
  };

  const addPlayer = (teamId) => {
    if(!newPlayer.name.trim() || !newPlayer.number) return;
    setTeams(p=>p.map(t=>t.id===teamId ? {...t, players:[...(t.players || []), {id:Date.now(), name:newPlayer.name, number:newPlayer.number, position:newPlayer.position, x:50, y:50, isStarter: newPlayer.isStarter}]} : t));
    setNewPlayer({name:"",number:"",position:"Escolta",isStarter:true});
  };
  const togglePlayerStatus = (teamId, playerId) => {
    setTeams(p=>p.map(t=>t.id===teamId ? {...t, players:(t.players || []).map(pl=>pl.id===playerId ? {...pl, isStarter: !pl.isStarter} : pl)} : t));
  };
  const removePlayer = (teamId, playerId) => {
    removePlayerPhoto(playerId);
    setTeams(p=>p.map(t=>t.id===teamId ? {...t, players:(t.players || []).filter(pl=>pl.id!==playerId)} : t));
  };
  const setPlayerPos = (teamId, playerId, x, y) => {
    setTeams(p=>p.map(t=>t.id===teamId ? {...t, players:(t.players || []).map(pl=>pl.id===playerId ? {...pl, x: Number(Math.max(5, Math.min(95, x)).toFixed(2)), y: Number(Math.max(5, Math.min(95, y)).toFixed(2))} : pl)} : t));
  };

  const autoFormation = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const starters = (team.players || []).filter(p => p.isStarter);
    // Standard 2-1-2 basketball positions (roughly) based on bottom rim
    const pos = [
      {x: 50, y: 85}, // PG
      {x: 25, y: 65}, // SG
      {x: 75, y: 65}, // SF
      {x: 30, y: 35}, // PF
      {x: 70, y: 35}, // C
      {x: 50, y: 20}, // Extra
    ];
    setTeams(p => p.map(t => t.id === teamId ? {
      ...t, 
      players: (t.players || []).map((pl, idx) => {
        if (!pl.isStarter) return pl;
        // Find starter index to assign position
        const sIdx = starters.findIndex(s => s.id === pl.id);
        const coords = pos[sIdx] || {x: 50, y: 50};
        return {...pl, x: coords.x, y: coords.y};
      })
    } : t));
  };

  const handlePlayerPhotoClick = (playerId) => {
    setUploadingForPlayer(playerId);
    playerFileInputRef.current.click();
  };
  const handlePlayerFileChange = (e) => {
    const file = e.target.files[0];
    if (!file || !uploadingForPlayer) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      savePlayerPhoto(uploadingForPlayer, base64);
      setPlayerPhotos(prev => ({...prev, [uploadingForPlayer]: base64}));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setUploadingForPlayer(null);
  };
  const updateTime = (id,t) => setGames(p=>p.map(g=>g.id===id?{...g,time:t}:g));
  const resetAll = () => {
    if(!window.confirm("Reiniciar TODO el torneo?")) return;
    setTeams(INIT_TEAMS);setGames([]);setVenue("Salon Seno Zulema");setTourney("TORNEO RELAMPAGO 2025");
    setLogos({});
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_LOGOS);
  };

  const getAiAnalysis = async () => {
    if (!process.env.GEMINI_API_KEY) {
      alert("Configura tu GEMINI_API_KEY en los secretos para usar esta función.");
      return;
    }
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const contextStandings = standings.map(t => `${t.name} (${t.category}): ${t.pts} pts, ${t.wins}G-${t.losses}P`).join("\n");
      const contextGames = gamesOn(selDate).map(g => {
         const t1 = getTeam(g.team1);
         const t2 = getTeam(g.team2);
         return `${g.time} - ${t1?.name} vs ${t2?.name} (${g.category} - ${g.round})`;
      }).join("\n");

      const prompt = `Analiza el estado actual de este torneo de baloncesto en español:
      
TABLA DE POSICIONES:
${contextStandings}

PARTIDOS PRÓXIMA FECHA (${formatDateES(new Date(selDate + "T12:00:00"))}):
${contextGames}

Genera un resumen breve y profesional (en español) que incluya:
1. Quiénes lideran el torneo.
2. Cuáles son los partidos más interesantes de la próxima fecha.
3. El tono debe ser como de un comentarista deportivo profesional y motivador.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiAnalysis(response.text);
    } catch (error) {
      console.error("Gemini Error:", error);
      alert("Error al generar el análisis.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const TABS=[
    {id:"standings",label:"Tabla"},
    {id:"schedule",label:"Calendario"},
    {id:"scores",label:"Marcador"},
    {id:"formation",label:"Formación"},
    {id:"roster",label:"Plantilla"},
    {id:"cards",label:"Carnets"},
    {id:"poster",label:"Poster"},
    {id:"ai",label:"Análisis IA"},
    {id:"teams",label:"Equipos"}
  ];

  const TeamLogo = ({teamId, size="sm"}) => {
    const src = getLogo(teamId);
    const cls = size==="lg" ? "team-logo-lg" : size==="md" ? "team-logo-md" : "team-logo-sm";
    if (src) return <img src={src} className={cls} alt="" />;
    return <div className={cls} style={{display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg3)",fontSize:size==="lg"?"32px":"12px",fontWeight:800,color:"var(--muted)"}}>{getTeam(teamId)?.name[0]}</div>;
  };

  const PlayerPhoto = ({playerId, size="sm"}) => {
    const src = playerPhotos[playerId];
    const style = size === "lg" ? {width:80,height:80} : {width:48,height:48};
    return (
      <div className="player-photo-circle" style={style}>
        {src ? <img src={src} alt="" /> : <User size={24} className="text-muted" />}
      </div>
    );
  };

  return (
    <div className="bk">
      <style>{CSS}</style>
      <input ref={fileInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFileChange} />
      <input ref={playerFileInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handlePlayerFileChange} />

      <div className="container">
        <header className="hdr">
          <div className="hdr-inner">
            <div className="hdr-top">
              <div>
                <div className="hdr-title">{tourney}<span className="save-dot" title="Guardado automático"></span></div>
                <div className="hdr-sub">Control de Torneo</div>
                <div className="hdr-venue">{venue}</div>
              </div>
              <div className="ai-badge">AI Powered</div>
            </div>
            <div className="tabs">{TABS.map(t=><div key={t.id} className={`tab ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}>{t.label}</div>)}</div>
          </div>
        </header>

        <main className="body">

        {/* TABLA */}
        {tab==="standings" && (
          <div className="body-grid">
            <div className="span-8">
              <div className="filters">{["Todos","Masculino","Femenino"].map(c=><div key={c} className={`pill ${catFilter===c?"on":""}`} onClick={()=>setCatFilter(c)}>{c}</div>)}</div>
              <div className="card">
                <div className="card-ttl">Tabla de Posiciones</div>
                {filtered.length===0
                  ? <div className="empty"><div className="empty-t">Sin equipos</div></div>
                  : <table className="tbl"><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>P</th><th>+/-</th><th>PTS</th></tr></thead>
                    <tbody>{filtered.map((t,i)=><tr key={t.id}>
                      <td><span className={`rank ${i===0?"r1":i===1?"r2":i===2?"r3":""}`}>{i+1}</span></td>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                          <TeamLogo teamId={t.id} size="sm" />
                          <div>
                            <span className="tnm">{t.name}</span>
                            <span className={`cat ${t.category==="Masculino"?"cat-m":"cat-f"}`}>{t.category==="Masculino"?"M":"F"}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{color:"var(--muted)"}}>{t.played}</td>
                      <td style={{color:"var(--green)",fontWeight:600}}>{t.wins}</td>
                      <td style={{color:"var(--red)",fontWeight:600}}>{t.losses}</td>
                      <td style={{color:t.diff>=0?"var(--green)":"var(--red)"}}>{t.diff>0?"+":""}{t.diff}</td>
                      <td><div className="pts">{t.pts}</div></td>
                    </tr>)}</tbody></table>}
              </div>
            </div>
            <div className="span-4">
              {completed.length>0 && <div className="card">
                <div className="card-ttl">Resultados</div>
                <div style={{display:"flex", flexDirection:"column", gap:"12px"}}>
                  {completed.slice(-4).reverse().map(g=>{
                    const t1=getTeam(g.team1),t2=getTeam(g.team2);
                    if(!t1||!t2)return null;
                    return (
                      <div key={g.id} className="game done" style={{margin:0, padding:"12px"}}>
                        <div className="gm-meta">
                          <span className="gm-time">{g.time}</span>
                          <span className="rnd">{g.round}</span>
                        </div>
                        <div className="matchup" style={{justifyContent:"space-between"}}>
                          <div className="team-s" style={{fontSize:"13px"}}>
                            <TeamLogo teamId={t1.id} size="sm"/>
                            <div style={{color:g.score1>g.score2?"var(--text)":"var(--muted)", fontWeight:700}}>{t1.name}</div>
                          </div>
                          <div className="sc-vals">
                            <span style={{fontSize:"18px", fontWeight:800}}>{g.score1}</span>
                            <span style={{color:"var(--muted)"}}>:</span>
                            <span style={{fontSize:"18px", fontWeight:800}}>{g.score2}</span>
                          </div>
                          <div className="team-s" style={{fontSize:"13px"}}>
                            <TeamLogo teamId={t2.id} size="sm"/>
                            <div style={{color:g.score2>g.score1?"var(--text)":"var(--muted)", fontWeight:700}}>{t2.name}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>}
            </div>
          </div>
        )}

        {/* CALENDARIO */}
        {tab==="schedule" && <>
          <div className="card">
            <div className="card-ttl">Jornadas Programadas</div>
            <div className="suns">
              {gameDates.map((d)=>{
                const dt = new Date(d + "T12:00:00");
                const count = gamesOn(d).length;
                return <div key={d} className={`sun ${selDate===d?"on":""}`} onClick={()=>setSelDate(d)}>
                  <div className="d">{dt.getDate()}</div>
                  <div className="m">{MONTHS_S[dt.getMonth()]}</div>
                  <div className="gc">{count} part.</div>
                </div>;
              })}
            </div>
            <div className="fr"><label className="lbl">Lugar / Cancha</label><input className="inp" value={venue} onChange={e=>setVenue(e.target.value)} placeholder="Ej: Cancha Central" /></div>
            <hr className="divider" />
            
            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:"13px",fontWeight:600,letterSpacing:"2px",textTransform:"uppercase",color:"var(--gold)",marginBottom:"16px"}}>Programar Partido</div>
            
            <div className="fr">
              <label className="lbl">Fecha</label>
              <input type="date" className="inp" value={newGame.date} onChange={e=>setNewGame({...newGame,date:e.target.value})} />
            </div>

            <div className="g2">
              <div className="fr">
                <label className="lbl">Equipo 1</label>
                <select className="sel" value={newGame.team1} onChange={e=>setNewGame({...newGame,team1:e.target.value})}>
                  <option value="">Seleccionar...</option>
                  {teams.map(t=><option key={t.id} value={t.id}>{t.name} ({t.category[0]})</option>)}
                </select>
              </div>
              <div className="fr">
                <label className="lbl">Equipo 2</label>
                <select className="sel" value={newGame.team2} onChange={e=>setNewGame({...newGame,team2:e.target.value})}>
                  <option value="">Seleccionar...</option>
                  {teams.map(t=><option key={t.id} value={t.id}>{t.name} ({t.category[0]})</option>)}
                </select>
              </div>
            </div>

            <div className="g2">
              <div className="fr">
                <label className="lbl">Horario</label>
                <select className="sel" value={newGame.time} onChange={e=>setNewGame({...newGame,time:e.target.value})}>
                  {TIME_SLOTS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="fr">
                <label className="lbl">Ronda</label>
                <select className="sel" value={newGame.round} onChange={e=>setNewGame({...newGame,round:e.target.value})}>
                  {ROUNDS.map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <button className="btn btn-p btn-full" onClick={addGame}>AGREGAR PARTIDO</button>
          </div>

          <div>
            <div className="card-ttl">Partidos del {formatDateES(new Date(selDate + "T12:00:00"))}</div>
            {gamesOn(selDate).length===0
              ? <div className="empty"><div className="empty-t">No hay partidos para esta fecha</div></div>
              : gamesOn(selDate).map(g=>{
                const t1=getTeam(g.team1),t2=getTeam(g.team2);
                if(!t1||!t2) return null;
                return <div key={g.id} className={`game ${g.completed?"done":""}`}>
                  <div className="gm-meta">
                    <span className="gm-time">{g.time}</span>
                    <span className={`rnd ${g.round==="Final"?"rnd-fin":""}`}>{g.round}</span>
                    <span className={`cat ${g.category==="Masculino"?"cat-m":"cat-f"}`}>{g.category}</span>
                    {!g.completed && <button className="btn-d" onClick={()=>removeGame(g.id)}>Borrar</button>}
                  </div>
                  <div className="matchup" onClick={()=>{ if(!g.completed)setSelGameId(g.id); }}>
                    <div className="team-s">
                      <TeamLogo teamId={t1.id} size="sm" />
                      <div className="team-nm">{t1.name}</div>
                    </div>
                    <div className="sc-area">
                      {g.completed ? (
                        <div className="sc-vals"><span className={`sc ${g.score1>g.score2?"sc-w":"sc-l"}`}>{g.score1}</span><span className="vs">-</span><span className={`sc ${g.score2>g.score1?"sc-w":"sc-l"}`}>{g.score2}</span></div>
                      ) : <div className="vs">VS</div>}
                    </div>
                    <div className="team-s" style={{textAlign:"right"}}>
                      <TeamLogo teamId={t2.id} size="sm" />
                      <div className="team-nm">{t2.name}</div>
                    </div>
                  </div>
                </div>;
              })}
          </div>
        </>}

        {/* FORMACIÓN */}
        {tab==="formation" && (
          <div className="card">
            <div className="card-ttl" style={{justifyContent:"space-between", width:"100%"}}>
              <div style={{display:"flex", alignItems:"center", gap:"8px"}}>
                <Layout size={18} /> Formación de Equipo
              </div>
              {selTeamIdForFormation && (
                <button 
                  className={`pill ${is3DView ? "on" : ""}`} 
                  onClick={() => setIs3DView(!is3DView)}
                  style={{fontSize:"10px"}}
                >
                  {is3DView ? "MODO 2D" : "MODO 3D"}
                </button>
              )}
            </div>
            <div className="fr">
              <label className="lbl">Seleccionar Equipo</label>
              <select className="sel" value={selTeamIdForFormation||""} onChange={e=>setSelTeamIdForFormation(+e.target.value||null)}>
                <option value="">Elegir equipo...</option>
                {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {selTeamIdForFormation && (()=>{
              const team = getTeam(selTeamIdForFormation);
              if(!team) return null;
              return (
                <div style={{marginTop:"10px"}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px"}}>
                    <div className="notice" style={{marginBottom:0}}>Arrastra los titulares {is3DView ? "(Vista 3D)" : "(Vista 2D)"}</div>
                    <button className="btn btn-s" style={{background:"var(--orange)", color:"white"}} onClick={() => autoFormation(team.id)}>Auto-Formación</button>
                  </div>
                  
                  <div className="court-container">
                    <div className={`court ${is3DView ? "view-3d" : ""}`} id="court-area">
                      {/* Court lines - Half court layout */}
                      <div className="court-line court-mid"></div>
                      <div className="court-line court-circle"></div>
                      <div className="court-line court-paint"></div>
                      <div className="court-line court-3pt"></div>
                      <div className="court-rim"></div>

                      {(team.players || []).filter(p => p.isStarter).map(p => (
                        <motion.div
                          key={p.id}
                          className="player-bubble"
                          drag
                          dragMomentum={false}
                          dragElastic={0}
                          onDragEnd={(e, info) => {
                            const court = document.getElementById("court-area");
                            if(court) {
                              const rect = court.getBoundingClientRect();
                              // Use the drop coordinate relative to the court's current visual rect
                              const xP = ((info.point.x - rect.left) / rect.width) * 100;
                              const yP = ((info.point.y - rect.top) / rect.height) * 100;
                              setPlayerPos(team.id, p.id, xP, yP);
                            }
                          }}
                          style={{ 
                            position: "absolute", 
                            left: `${p.x || 50}%`,
                            top: `${p.y || 50}%`,
                            x: "-50%", 
                            y: "-50%",
                            zIndex: 100
                          }}
                        >
                          <div className="player-photo-circle" style={{borderColor: is3DView ? "var(--gold)" : "var(--orange)"}}>
                            {playerPhotos[p.id] ? <img src={playerPhotos[p.id]} alt="" /> : <User size={20} />}
                          </div>
                          <div className="player-info-card">
                            <div className="player-num-badge">#{p.number}</div>
                            <div className="player-name-lbl">{p.name}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Bench Area */}
                  <div style={{marginTop:"40px"}}>
                    <div className="card-ttl"><User size={16}/> Suplentes (Banquillo) - Toca para pasar a cancha</div>
                    <div style={{display:"flex", gap:"12px", overflowX:"auto", paddingBottom:"10px", minHeight:"80px"}}>
                      {(team.players || []).filter(p => !p.isStarter).length === 0 ? (
                        <div style={{fontSize:"12px", color:"var(--muted)", fontStyle:"italic", marginTop:"10px"}}>No hay suplentes asignados</div>
                      ) : (
                        (team.players || []).filter(p => !p.isStarter).map(p => (
                          <div 
                            key={p.id} 
                            style={{display:"flex", flexDirection:"column", alignItems:"center", gap:"6px", minWidth:"80px", cursor:"pointer", padding:"8px", borderRadius:"12px", border:"1px solid transparent"}}
                            onClick={() => togglePlayerStatus(team.id, p.id)}
                            className="bench-slot"
                          >
                            <div className="player-photo-circle" style={{width:40, height:40}}>
                              {playerPhotos[p.id] ? <img src={playerPhotos[p.id]} alt="" /> : <User size={18} />}
                            </div>
                            <div style={{fontSize:"10px", fontWeight:700}}>#{p.number}</div>
                            <div style={{fontSize:"9px", opacity:0.8, textAlign:"center", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", width:"100%"}}>{p.name}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <button className="btn btn-full btn-s" style={{marginTop:"20px"}} onClick={() => window.print()}>Imprimir Formación</button>
                </div>
              );
            })()}
          </div>
        )}

        {/* PLANTILLA */}
        {tab==="roster" && (
          <div className="card">
            <div className="card-ttl"><ImageIcon size={18} /> Plantilla Oficial</div>
            <div className="fr">
              <label className="lbl">Seleccionar Equipo</label>
              <select className="sel" value={selTeamIdForPlantilla||""} onChange={e=>setSelTeamIdForPlantilla(+e.target.value||null)}>
                <option value="">Elegir equipo...</option>
                {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {selTeamIdForPlantilla && (()=>{
              const team = getTeam(selTeamIdForPlantilla);
              if(!team) return null;
              return (
                <div className="roster-poster" id="roster-print">
                  <div style={{textAlign:"center"}}>
                    <TeamLogo teamId={team.id} size="lg" />
                    <h2 style={{fontFamily:"'Oswald',sans-serif",fontSize:"32px",fontWeight:800,textTransform:"uppercase",letterSpacing:"2px",color:"#fff"}}>{team.name}</h2>
                    <p style={{color:"var(--orange)",textTransform:"uppercase",letterSpacing:"3px",fontSize:"12px",fontWeight:700,marginTop:"4px"}}>{team.category} • Temporada 2025</p>
                  </div>
                  
                  {(!team.players || team.players.length === 0) ? (
                    <div className="empty" style={{color:"rgba(255,255,255,0.2)"}}>No hay jugadores registrados en este equipo</div>
                  ) : (
                    <div className="roster-grid">
                      {team.players.map(p => (
                        <div key={p.id} className="roster-card">
                          <div 
                            className="roster-photo" 
                            style={{cursor:"pointer", position:"relative"}} 
                            onClick={()=>handlePlayerPhotoClick(p.id)}
                            title="Haz clic para subir o cambiar foto"
                          >
                            {playerPhotos[p.id] ? (
                              <img src={playerPhotos[p.id]} alt="" />
                            ) : (
                              <div style={{display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", opacity:0.5}}>
                                <Camera size={24} />
                                <div style={{fontSize:"8px", marginTop:"4px"}}>SUBIR</div>
                              </div>
                            )}
                            <div className="photo-overlay" style={{
                              position:"absolute", bottom:0, left:0, right:0, background:"rgba(0,0,0,0.6)", 
                              color:"white", fontSize:"8px", padding:"2px 0", opacity:0, transition:"0.2s"
                            }}>EDITAR</div>
                          </div>
                          <div className="roster-name">{p.name}</div>
                          <div className="roster-num">#{p.number}</div>
                          <div style={{fontSize:"10px",color:"var(--muted)",textTransform:"uppercase",marginTop:4}}>{p.position}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="btn-print" style={{marginTop:"40px"}} onClick={() => window.print()}>Descargar como Fotografía</button>
                </div>
              );
            })()}
          </div>
        )}
        {/* MARCADOR */}
        {tab==="scores" && (
          <>
            <div className="card">
              <div className="card-ttl">Registrar Marcador</div>
              {pending.length===0
                ? <div className="empty"><div className="empty-t">Sin partidos pendientes. Agrega partidos en Calendario.</div></div>
                : <><div className="fr"><label className="lbl">Seleccionar Partido</label><select className="sel" value={selGameId||""} onChange={e=>setSelGameId(+e.target.value||null)}><option value="">Elige un partido...</option>{pending.map(g=>{const t1=getTeam(g.team1),t2=getTeam(g.team2);if(!t1||!t2)return null;return<option key={g.id} value={g.id}>{g.date} {g.time} — {t1.name} vs {t2.name}</option>;})}</select></div>
                  {selGameId&&(()=>{const g=games.find(x=>x.id===selGameId);if(!g)return null;const t1=getTeam(g.team1),t2=getTeam(g.team2);return<><hr className="divider"/><div style={{textAlign:"center",marginBottom:"16px"}}><span className={`rnd ${g.round==="Final"?"rnd-fin":""}`} style={{display:"inline-block",marginBottom:"6px"}}>{g.round}</span><div style={{fontSize:"11px",color:"var(--muted)"}}>{g.date} - {g.time}</div></div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",marginBottom:"16px"}}>
                    <div style={{flex:1,textAlign:"center"}}>
                      <TeamLogo teamId={t1.id} size="md"/>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"15px",fontWeight:700,marginBottom:"10px"}}>{t1.name}</div>
                      <input type="number" className="sc-inp" value={scores.s1} onChange={e=>setScores({...scores,s1:e.target.value})} placeholder="0" min={0}/>
                    </div>
                    <div style={{fontFamily:"'Oswald',sans-serif",fontSize:"18px",fontWeight:700,color:"var(--muted)"}}>VS</div>
                    <div style={{flex:1,textAlign:"center"}}>
                      <TeamLogo teamId={t2.id} size="md"/>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:"15px",fontWeight:700,marginBottom:"10px"}}>{t2.name}</div>
                      <input type="number" className="sc-inp" value={scores.s2} onChange={e=>setScores({...scores,s2:e.target.value})} placeholder="0" min={0}/>
                    </div>
                  </div>
                  {scores.s1!==""&&scores.s2!==""&&<div style={{textAlign:"center",marginBottom:"12px",fontSize:"13px",color:"var(--muted)"}}>{+scores.s1>+scores.s2?`Ganador: ${t1.name}`:+scores.s2>+scores.s1?`Ganador: ${t2.name}`:"Empate"}</div>}
                  <button className="btn btn-g btn-full" onClick={recordScore}>CONFIRMAR MARCADOR</button></>;})()} </>}
            </div>
            {completed.length>0&&<div className="card"><div className="card-ttl">Resultados ({completed.length})</div>{completed.slice().reverse().map(g=>{const t1=getTeam(g.team1),t2=getTeam(g.team2);if(!t1||!t2)return null;return<div key={g.id} className="game done"><div className="gm-meta"><span className="gm-time">{g.time}</span><span style={{fontSize:"10px",color:"var(--muted)"}}>{g.date}</span><span className={`rnd ${g.round==="Final"?"rnd-fin":""}`}>{g.round}</span></div><div className="matchup"><div className="team-s"><TeamLogo teamId={t1.id} size="sm"/><div className="team-nm" style={{color:g.score1>g.score2?"var(--green)":"var(--muted)"}}>{t1.name}</div></div><div className="sc-area"><div className={`sc ${g.score1>g.score2?"sc-w":"sc-l"}`}>{g.score1}</div><div className="vs">-</div><div className={`sc ${g.score2>g.score1?"sc-w":"sc-l"}`}>{g.score2}</div></div><div className="team-s" style={{textAlign:"right"}}><TeamLogo teamId={t2.id} size="sm"/><div className="team-nm" style={{color:g.score2>g.score1?"var(--green)":"var(--muted)"}}>{t2.name}</div></div></div></div>;})} </div>}
          </>
        )}

        {/* CARNETS */}
        {tab==="cards" && (
          <div className="card">
            <div className="card-ttl"><User size={18} /> Carnets de Jugador</div>
            <div className="fr">
              <label className="lbl">Seleccionar Equipo</label>
              <select className="sel" value={selTeamIdForCards||""} onChange={e=>setSelTeamIdForCards(+e.target.value||null)}>
                <option value="">Elegir equipo...</option>
                {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {selTeamIdForCards && (()=>{
              const team = getTeam(selTeamIdForCards);
              if(!team) return null;
              return (
                <div style={{marginTop:"20px"}}>
                  <button className="btn btn-full btn-p" style={{marginBottom:"20px"}} onClick={() => window.print()}>IMPRIMIR CARNETS</button>
                  <div className="id-cards-grid">
                    {(team.players || []).map(p => (
                      <div key={p.id} className="id-card">
                        <div className="id-card-side"></div>
                        <div className="id-card-main">
                          <div className="id-card-hdr">
                            <div className="id-tourney-name">{tourney}</div>
                            <div style={{opacity:0.6}}><TeamLogo teamId={team.id} size="sm" /></div>
                          </div>
                          <div className="id-card-body">
                            <div className="id-photo-frame">
                              {playerPhotos[p.id] ? <img src={playerPhotos[p.id]} alt="" /> : <User size={32} style={{opacity:0.1,marginTop:30,marginLeft:20}} />}
                            </div>
                            <div className="id-info">
                              <div className="id-player-name">{p.name}</div>
                              <div className="id-player-num">#{p.number}</div>
                              <div style={{fontSize:"11px", fontWeight:600, color:"#64748b"}}>{p.position}</div>
                              <div className="id-meta-row">
                                <div className="id-team-name">{team.name}</div>
                                <div style={{fontSize:"9px", color:"#94a3b8"}}>ID: {p.id.toString().slice(-6)}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        {tab==="poster" && <>
          <div className="card">
            <div className="card-ttl">Seleccionar Fecha para el Póster</div>
            <div className="suns">
              {gameDates.map((d)=>{
                const dt = new Date(d + "T12:00:00");
                return <div key={d} className={`sun ${selDate===d?"on":""}`} onClick={()=>setSelDate(d)}>
                  <div className="d">{dt.getDate()}</div>
                  <div className="m">{MONTHS_S[dt.getMonth()]}</div>
                </div>;
              })}
            </div>
            <button className="btn-print" onClick={()=>window.print()}>GENERAR PÓSTER PDF</button>
          </div>
          <div className="poster-wrap">
            <div className="poster">
              <div className="poster-hdr">
                <div className="poster-city">{venue.split(" ").slice(-2).join(" ") || venue}</div>
                <div className="poster-title">{tourney}</div>
                <div className="poster-dates">
                  <span>FECHA: {formatDateES(new Date(selDate + "T12:00:00"))}</span>
                </div>
              </div>

              {/* Games */}
              <div style={{padding:"10px 0 0"}}>
                {gamesOn(selDate).length===0 && <div className="empty" style={{color:"white"}}>No hay partidos en esta fecha</div>}
                {gamesOn(selDate).map((g)=>{
                  const t1=getTeam(g.team1), t2=getTeam(g.team2);
                  if(!t1||!t2) return null;
                  const logo1=getLogo(t1.id), logo2=getLogo(t2.id);
                  return <div key={g.id}>
                    <div className="poster-time-row">
                       <span className="poster-time-badge">{g.time}</span>
                      <span className="poster-time-badge">{g.round}</span>
                      <span className="poster-time-badge">{g.category}</span>
                    </div>
                        <div className="poster-game">
                          {/* Team 1 */}
                          <div className="poster-team-blk">
                            <div className="poster-logo-box">
                              {logo1 ? <img src={logo1} alt={t1.name}/> : <span className="poster-logo-init">{t1.name[0]}</span>}
                            </div>
                            <div className="poster-tnm">{t1.name}</div>
                          </div>
                          {/* VS */}
                          <div className="poster-vs-blk">
                            <span className="poster-vs-txt">VS</span>
                          </div>
                          {/* Team 2 */}
                          <div className="poster-team-blk right">
                            <div className="poster-logo-box">
                              {logo2 ? <img src={logo2} alt={t2.name}/> : <span className="poster-logo-init">{t2.name[0]}</span>}
                            </div>
                            <div className="poster-tnm">{t2.name}</div>
                          </div>
                          {/* Score */}
                          <div className={`poster-score-blk ${g.completed?"done":""}`}>
                            {g.completed ? `${g.score1}-${g.score2}` : ""}
                          </div>
                        </div>
                      </div>;
                    })}
                  </div>

                  {/* Footer */}
                  <div className="poster-ft">{venue}</div>
                </div>
              </div>
        </>}

        {/* ANÁLISIS IA */}
        {tab==="ai" && <>
          <div className="card">
            <div className="card-ttl" style={{display:"flex", alignItems:"center", gap:"8px"}}>
              <Sparkles size={18} className="text-orange" />
              Análisis Inteligente
            </div>
            <p style={{fontSize:"13px", color:"var(--muted)", marginBottom:"16px"}}>
              Obtén un resumen automático del torneo y los partidos clave de la semana usando Inteligencia Artificial.
            </p>
            
            <button 
              className="btn btn-p btn-full" 
              onClick={getAiAnalysis}
              disabled={isAiLoading}
              style={{display:"flex", alignItems:"center", justifyContent:"center", gap:"8px"}}
            >
              {isAiLoading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Generando análisis...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Analizar Torneo
                </>
              )}
            </button>

            {aiAnalysis && (
              <div className="ai-response">
                {aiAnalysis}
              </div>
            )}
          </div>
        </>}

        {/* EQUIPOS */}
        {tab==="teams" && <>
          {selTeamIdForPlantilla ? (
            <div className="card">
              <button className="btn btn-s" style={{marginBottom:"16px"}} onClick={()=>setSelTeamIdForPlantilla(null)}>← Volver a Equipos</button>
              <div className="card-ttl">Gestionar Jugadores: {getTeam(selTeamIdForPlantilla)?.name}</div>
              
              <div className="fr">
                <label className="lbl">Nuevo Jugador</label>
                <div className="g2">
                  <input className="inp" placeholder="Nombre completo" value={newPlayer.name} onChange={e=>setNewPlayer({...newPlayer,name:e.target.value})} />
                  <input className="inp" type="number" placeholder="Número (#)" value={newPlayer.number} onChange={e=>setNewPlayer({...newPlayer,number:e.target.value})} />
                </div>
              </div>
              <div className="fr">
                <label className="lbl">Posición y Estado</label>
                <div className="g2">
                  <select className="sel" value={newPlayer.position} onChange={e=>setNewPlayer({...newPlayer,position:e.target.value})}>
                    <option>Base</option>
                    <option>Escolta</option>
                    <option>Alero</option>
                    <option>Ala-Pívot</option>
                    <option>Pívot</option>
                  </select>
                  <select className="sel" value={newPlayer.isStarter ? "1" : "0"} onChange={e=>setNewPlayer({...newPlayer,isStarter:e.target.value==="1"})}>
                    <option value="1">Titular</option>
                    <option value="0">Suplente</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-p btn-full" onClick={()=>addPlayer(selTeamIdForPlantilla)}><UserPlus size={18}/> Agregar Jugador</button>

              <div style={{marginTop:"32px"}}>
                <div className="card-ttl">Jugadores ({(getTeam(selTeamIdForPlantilla)?.players || []).length})</div>
                {(getTeam(selTeamIdForPlantilla)?.players || []).map(p => (
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px",background:"var(--bg)",borderRadius:"16px",marginBottom:"8px",border:"1px solid var(--border)"}}>
                    <div style={{cursor:"pointer"}} onClick={()=>handlePlayerPhotoClick(p.id)}>
                      <PlayerPhoto playerId={p.id} />
                    </div>
                    <div style={{flex:1}}>
                      <div className="tnm">{p.name} <span className={`pill ${p.isStarter?"on":""}`} style={{fontSize:"8px", padding:"2px 8px"}} onClick={() => togglePlayerStatus(selTeamIdForPlantilla, p.id)}>{p.isStarter ? "Titular" : "Suplente"}</span></div>
                      <div style={{fontSize:"11px",color:"var(--muted)"}}>#{p.number} • {p.position}</div>
                    </div>
                    <button className="btn btn-d" onClick={()=>removePlayer(selTeamIdForPlantilla, p.id)}><Trash2 size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="card">
                <div className="card-ttl">Configuracion del Torneo</div>
                <div className="fr"><label className="lbl">Nombre del Torneo</label><input className="inp" value={tourney} onChange={e=>setTourney(e.target.value)}/></div>
                <div className="fr"><label className="lbl">Lugar / Cancha</label><input className="inp" value={venue} onChange={e=>setVenue(e.target.value)}/></div>
                <div className="notice">Los cambios se guardan automaticamente</div>
                <button className="btn btn-reset" onClick={resetAll}>REINICIAR TORNEO COMPLETO</button>
              </div>
              <div className="card">
                <div className="card-ttl">Agregar Equipo</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"9px",alignItems:"end"}}>
                  <div>
                    <div className="fr"><label className="lbl">Nombre del Equipo</label><input className="inp" value={newTeam.name} onChange={e=>setNewTeam({...newTeam,name:e.target.value})} placeholder="Ej: Los Aguilas"/></div>
                    <div className="fr" style={{marginBottom:0}}><label className="lbl">Categoria</label><select className="sel" value={newTeam.category} onChange={e=>setNewTeam({...newTeam,category:e.target.value})}><option>Masculino</option><option>Femenino</option></select></div>
                  </div>
                  <button className="btn btn-p" style={{height:"38px",alignSelf:"flex-end"}} onClick={addTeam}>+</button>
                </div>
              </div>
              <div className="card">
                <div className="card-ttl">Equipos Registrados ({teams.length})</div>
                {teams.length===0
                  ? <div className="empty"><div className="empty-t">Sin equipos</div></div>
                  : teams.map(t=>{
                      const logo = getLogo(t.id);
                      return <div key={t.id} style={{display:"flex",alignItems:"center",gap:"10px",padding:"12px 0",borderBottom:"1px solid var(--border)"}}>
                        {/* Logo */}
                        <div style={{flexShrink:0}}>
                          {logo
                            ? <img src={logo} className="team-logo" alt={t.name} onClick={()=>handleLogoClick(t.id)} style={{cursor:"pointer"}} title="Toca para cambiar logo"/>
                            : <div className="logo-placeholder" onClick={()=>handleLogoClick(t.id)} style={{cursor:"pointer"}} title="Subir logo">+</div>
                          }
                        </div>
                        {/* Info */}
                        <div style={{flex:1,minWidth:0}}>
                          <div className="tnm" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</div>
                          <div style={{display:"flex",gap:"6px",marginTop:"4px",alignItems:"center",flexWrap:"wrap"}}>
                            <span className={`cat ${t.category==="Masculino"?"cat-m":"cat-f"}`}>{t.category}</span>
                            <span style={{fontSize:"11px",color:"var(--muted)"}}>{t.wins}G / {t.losses}P</span>
                          </div>
                          <div style={{display:"flex",gap:"6px",marginTop:"6px"}}>
                            <button className="logo-upload-btn" onClick={()=>handleLogoClick(t.id)}>{logo?"Cambiar logo":"+ Logo"}</button>
                            <button className="logo-upload-btn" style={{background:"rgba(16,185,129,0.1)",color:"var(--green)",borderColor:"rgba(16,185,129,0.2)"}} onClick={()=>setSelTeamIdForPlantilla(t.id)}>Jugadores ({t.players?.length||0})</button>
                            {logo && <button className="logo-remove-btn" onClick={()=>handleLogoRemove(t.id)}>X</button>}
                          </div>
                        </div>
                        {/* Delete */}
                        <button className="btn btn-d" onClick={()=>removeTeam(t.id)}>X</button>
                      </div>;
                    })
                }
              </div>
            </>
          )}
        </>}

        </main>
      </div>
    </div>
  );
}
