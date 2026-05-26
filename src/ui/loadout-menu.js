// --------------------------------------------------------
// MENU DE LOADOUT — Arsenal de Batalha (pixel art)
// --------------------------------------------------------
// Design pixelizado em "ruínas abandonadas". Estrutura/visual desenhados
// no Claude Design (Arsenal Pixel.html) e portados para o jogo, mantendo
// a API: abrirLoadoutMenu(onConfirm?, onCancel?), fecharLoadoutMenu,
// isLoadoutMenuAberto, mostrarBotaoLoadout. Ícones dos ataques vêm dos
// PNGs reais em ATAQUES[id].icone (com image-rendering:pixelated).
// --------------------------------------------------------

import { ATAQUES, ataqueState, equiparAtaque } from '../systems/ataques.js';

// ---- fontes pixel (carrega 1 vez ao importar o módulo) ----
(function _injectFonts() {
    if (document.getElementById('loadout-pixel-fonts')) return;
    const pre1 = document.createElement('link');
    pre1.rel = 'preconnect'; pre1.href = 'https://fonts.googleapis.com';
    const pre2 = document.createElement('link');
    pre2.rel = 'preconnect'; pre2.href = 'https://fonts.gstatic.com'; pre2.crossOrigin = '';
    const link = document.createElement('link');
    link.id = 'loadout-pixel-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap';
    document.head.appendChild(pre1);
    document.head.appendChild(pre2);
    document.head.appendChild(link);
})();

// ---- estilos scoped ao overlay ----
(function _injectStyles() {
    if (document.getElementById('loadout-pixel-styles')) return;
    const style = document.createElement('style');
    style.id = 'loadout-pixel-styles';
    style.textContent = `
        :root {
            --atk-body-hi:#c2342e;
            --atk-body-mid:#8a1b1b;
            --atk-body-lo:#4a0c10;
            --atk-gold-hi:#ffd86b;
            --atk-text:#fff4c2;
        }
        @keyframes sparkle{
            0%, 70%, 100% { opacity:0; transform:scale(.6); }
            80% { opacity:1; transform:scale(1); }
            90% { opacity:.4; transform:scale(.8); }
        }
        .world-arsenal-btn {
            position: fixed; bottom: 14px; right: 14px;
            display: inline-flex; align-items: center; justify-content: center;
            padding: 6px 12px;
            background: linear-gradient(180deg, var(--atk-body-hi) 0%, var(--atk-body-mid) 45%, var(--atk-body-lo) 100%);
            border: 6px solid transparent;
            border-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' shape-rendering='crispEdges'><path fill='%231a0306' d='M2,0h8v1h-8z M1,1h1v1h-1z M10,1h1v1h-1z M0,2h1v8h-1z M11,2h1v8h-1z M1,10h1v1h-1z M10,10h1v1h-1z M2,11h8v1h-8z'/><path fill='%23c98a22' d='M2,1h8v1h-8z M1,2h1v8h-1z M10,2h1v8h-1z M2,10h8v1h-8z M3,3h6v1h-6z M3,4h1v4h-1z M8,4h1v4h-1z M3,8h6v1h-6z'/><path fill='%23ffd86b' d='M2,2h8v1h-8z M2,3h1v6h-1z M9,3h1v6h-1z M2,9h8v1h-8z'/></svg>") 4 / 6px / 0 round;
            box-shadow: 0 2px 0 0 #1a0306, inset 0 -2px 0 0 rgba(0,0,0,0.3);
            cursor: pointer; z-index: 55;
            font-family: 'Press Start 2P', monospace; color: var(--atk-text);
            font-size: 9px; letter-spacing: 1px;
            text-shadow: 0 1px 0 #4a0c10, 0 2px 0 #1a0306;
            transition: transform .1s steps(2);
            image-rendering: pixelated;
        }
        .world-arsenal-btn:hover { transform: scale(1.05); filter: brightness(1.1); }
        .world-arsenal-btn:active { transform: scale(0.95); }
        .world-arsenal-btn::before {
            content: ""; position: absolute; left: 4px; right: 4px; top: 2px; height: 4px;
            background: linear-gradient(180deg, rgba(255,230,180,0.4), transparent);
            pointer-events: none;
        }
        .world-arsenal-btn::after {
            content: ""; position: absolute; top: 6px; right: 10px; width: 4px; height: 4px;
            background: #fff4c2; box-shadow: -3px 3px 0 rgba(255,244,194,0.6);
            pointer-events: none; animation: sparkle 3s steps(2) infinite;
        }

        #loadout-overlay { --gold-0:#d9a441; --gold-1:#b3852f; --gold-2:#7a5a1f; --bg-1:#15110b; --bg-2:#1d160e; --text:#e7d6a8; --text-dim:#9b8458; --text-faint:#5e4d2e; --rust:#7a2a1e; --rust-hi:#a83a26; --rust-shadow:#2a0d08; --moss:#3a4a20; --moss-2:#557528; }
        #loadout-overlay, #loadout-overlay * { image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges; }
        #loadout-overlay .lo-stage { position: relative; width: min(1100px, 94vw); }
        #loadout-overlay .lo-panel {
            position: relative;
            background: radial-gradient(ellipse at center, #1c1509 0%, #0c0905 80%);
            padding: 28px 28px 22px;
            border: 20px solid transparent;
            border-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' shape-rendering='crispEdges'><path fill='%230a0704' d='M2,0h8v1h-8z M1,1h1v1h-1z M10,1h1v1h-1z M0,2h1v8h-1z M11,2h1v8h-1z M1,10h1v1h-1z M10,10h1v1h-1z M2,11h8v1h-8z'/><path fill='%237a5a1f' d='M2,1h8v1h-8z M1,2h1v8h-1z M10,2h1v8h-1z M2,10h8v1h-8z M3,3h6v1h-6z M3,4h1v4h-1z M8,4h1v4h-1z M3,8h6v1h-6z'/><path fill='%23d9a441' d='M2,2h8v1h-8z M2,3h1v6h-1z M9,3h1v6h-1z M2,9h8v1h-8z'/></svg>") 4 / 20px / 0 round;
            box-shadow: 0 0 60px 24px rgba(217,164,65,.08);
        }
        #loadout-overlay .lo-stud {
            position: absolute; width: 18px; height: 18px; background: var(--gold-0);
            box-shadow: 0 0 0 2px #0a0704, inset -3px -3px 0 var(--gold-2), inset 3px 3px 0 #f0c869;
            z-index: 5;
        }
        #loadout-overlay .lo-stud.tl { top: -6px; left: -6px; }
        #loadout-overlay .lo-stud.tr { top: -6px; right: -6px; }
        #loadout-overlay .lo-stud.bl { bottom: -6px; left: -6px; }
        #loadout-overlay .lo-stud.br { bottom: -6px; right: -6px; }
        #loadout-overlay .lo-crack, #loadout-overlay .lo-cobweb { position: absolute; pointer-events: none; z-index: 4; }
        #loadout-overlay .lo-moss {
            position: absolute; pointer-events: none; z-index: 6;
            background:
              radial-gradient(circle at 20% 20%, var(--moss-2) 2px, transparent 3px),
              radial-gradient(circle at 60% 50%, var(--moss-2) 2px, transparent 3px),
              radial-gradient(circle at 35% 70%, var(--moss) 2px, transparent 3px),
              radial-gradient(circle at 80% 30%, var(--moss) 2px, transparent 3px),
              radial-gradient(circle at 50% 90%, var(--moss-2) 2px, transparent 3px);
            background-size: 14px 14px; opacity: .5;
        }
        #loadout-overlay .lo-title {
            font-family: 'Press Start 2P', monospace; font-size: 22px; line-height: 1;
            color: var(--gold-0); text-align: center; letter-spacing: 2px;
            text-shadow: 0 2px 0 var(--gold-2), 0 4px 0 #2a1a08, 0 0 14px rgba(217,164,65,.35);
            margin: 6px 0 12px;
        }
        #loadout-overlay .lo-subtitle {
            font-family: 'VT323', monospace; font-size: 22px; text-align: center;
            color: var(--text-dim); letter-spacing: 1px;
            border-bottom: 2px solid var(--gold-2);
            padding-bottom: 10px; margin: 0 0 18px; position: relative;
        }
        #loadout-overlay .lo-subtitle::after {
            content: ""; position: absolute; left: 42%; bottom: -2px;
            width: 60px; height: 4px; background: var(--bg-1);
        }
        #loadout-overlay .lo-subtitle kbd {
            background: var(--bg-1); border: 2px solid var(--gold-2); color: var(--gold-0);
            font-family: 'Press Start 2P', monospace; font-size: 10px;
            padding: 2px 6px; margin: 0 4px;
            box-shadow: inset -2px -2px 0 #000, inset 2px 2px 0 #3a2a16;
        }
        #loadout-overlay .lo-slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
        #loadout-overlay .lo-slot {
            position: relative; background: linear-gradient(#1a130a, #0f0a06);
            padding: 14px 8px 12px; text-align: center;
            border: 3px solid var(--gold-2);
            box-shadow: inset 0 0 0 2px #0a0704, inset 0 0 0 5px var(--gold-2);
            cursor: pointer; transition: transform .08s steps(2); user-select: none;
        }
        #loadout-overlay .lo-slot:hover { transform: translateY(-2px); }
        #loadout-overlay .lo-slot[data-active="true"] {
            background: linear-gradient(#3a2a10, #1f1608); border-color: var(--gold-0);
            box-shadow: inset 0 0 0 2px #0a0704, inset 0 0 0 5px var(--gold-0), 0 0 0 2px #0a0704, 0 0 24px 4px rgba(217,164,65,.35);
            animation: lo-torch 1.6s steps(2) infinite;
        }
        @keyframes lo-torch {
            0%,100% { box-shadow: inset 0 0 0 2px #0a0704, inset 0 0 0 5px var(--gold-0), 0 0 0 2px #0a0704, 0 0 24px 4px rgba(217,164,65,.35); }
            50%     { box-shadow: inset 0 0 0 2px #0a0704, inset 0 0 0 5px var(--gold-0), 0 0 0 2px #0a0704, 0 0 18px 2px rgba(217,164,65,.22); }
        }
        #loadout-overlay .lo-slot .lo-label {
            font-family: 'Press Start 2P', monospace; font-size: 10px;
            color: var(--gold-0); letter-spacing: 1px; text-shadow: 0 2px 0 #2a1a08;
        }
        #loadout-overlay .lo-slot .lo-name { font-family: 'VT323', monospace; font-size: 22px; color: var(--text); line-height: 1; margin-top: 8px; }
        #loadout-overlay .lo-slot .lo-name.empty { color: var(--text-faint); font-style: italic; }
        #loadout-overlay .lo-slot .lo-icon {
            width: 48px; height: 48px; margin: 8px auto 6px; background: #0a0704;
            border: 2px solid var(--gold-2); display: grid; place-items: center;
            box-shadow: inset 0 0 0 2px #0a0704;
        }
        #loadout-overlay .lo-slot .lo-icon.empty { background: repeating-linear-gradient(45deg, #15110b 0 4px, #0a0805 4px 8px); }
        #loadout-overlay .lo-slot .lo-icon.empty::after { content: "—"; color: var(--text-faint); font-size: 20px; }
        #loadout-overlay .lo-slot .lo-icon img { width: 36px; height: 36px; object-fit: contain; image-rendering: pixelated; }
        #loadout-overlay .lo-chip { position: absolute; width: 6px; height: 6px; background: var(--rust-shadow); }
        #loadout-overlay .lo-chip.tr { top: -2px; right: -2px; }
        #loadout-overlay .lo-chip.bl { bottom: -2px; left: -2px; }
        #loadout-overlay .lo-section {
            font-family: 'Press Start 2P', monospace; font-size: 12px;
            color: var(--gold-0); letter-spacing: 1px;
            border-bottom: 2px solid var(--gold-2);
            padding-bottom: 8px; margin-bottom: 12px;
            text-shadow: 0 2px 0 #2a1a08; position: relative;
        }
        #loadout-overlay .lo-section::after {
            content: ""; position: absolute; left: 30%; bottom: -2px;
            width: 24px; height: 4px; background: var(--bg-1);
        }
        #loadout-overlay .lo-moves { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; max-height: 32vh; overflow-y: auto; padding-right: 4px; }
        #loadout-overlay .lo-moves::-webkit-scrollbar { width: 8px; }
        #loadout-overlay .lo-moves::-webkit-scrollbar-track { background: #0a0704; }
        #loadout-overlay .lo-moves::-webkit-scrollbar-thumb { background: var(--gold-2); border: 1px solid #0a0704; }
        #loadout-overlay .lo-move {
            display: grid; grid-template-columns: 56px 1fr auto; align-items: center; gap: 12px;
            padding: 10px 14px; background: linear-gradient(#1a130a, #0f0a06);
            border: 3px solid var(--gold-2); box-shadow: inset 0 0 0 2px #0a0704;
            cursor: pointer; transition: background .1s steps(2);
        }
        #loadout-overlay .lo-move:hover { background: linear-gradient(#251a0d, #150d07); }
        #loadout-overlay .lo-move .lo-icon {
            width: 40px; height: 40px; background: #0a0704;
            border: 2px solid var(--gold-2); display: grid; place-items: center;
            box-shadow: inset 0 0 0 2px #0a0704;
        }
        #loadout-overlay .lo-move .lo-icon img { width: 30px; height: 30px; object-fit: contain; image-rendering: pixelated; }
        #loadout-overlay .lo-move .lo-name {
            font-family: 'Press Start 2P', monospace; font-size: 11px;
            color: var(--gold-0); letter-spacing: 1px; text-shadow: 0 2px 0 #2a1a08;
        }
        #loadout-overlay .lo-move .lo-desc { font-family: 'VT323', monospace; font-size: 20px; color: var(--text-dim); margin-top: 4px; line-height: 1; }
        #loadout-overlay .lo-move .lo-tag {
            font-family: 'Press Start 2P', monospace; font-size: 9px;
            color: var(--gold-0); background: #0a0704;
            border: 2px solid var(--gold-2); padding: 6px 8px; letter-spacing: 1px;
            white-space: nowrap;
        }
        #loadout-overlay .lo-pip { display: inline-block; width: 8px; height: 8px; background: var(--text-dim); margin: 0 4px 1px 4px; vertical-align: middle; }
        #loadout-overlay .lo-actions { display: flex; justify-content: center; gap: 14px; margin-top: -2px; margin-bottom: 6px; }
        #loadout-overlay .lo-btn {
            font-family: 'Press Start 2P', monospace; font-size: 13px;
            letter-spacing: 2px; color: #fff5d6;
            background: linear-gradient(var(--rust-hi), var(--rust));
            border: none; border-radius: 14px; padding: 12px 28px; cursor: pointer;
            box-shadow:
              0 0 0 3px #0a0704, 0 0 0 6px var(--rust-shadow), 0 0 0 9px #0a0704,
              inset 0 -5px 0 var(--rust-shadow), inset 0 3px 0 #c95a3e;
            text-shadow: 0 2px 0 #2a0d08;
            transform: translateY(0); transition: transform .06s steps(2);
        }
        #loadout-overlay .lo-btn:hover { transform: scale(1.03); }
        #loadout-overlay .lo-btn:active {
            transform: scale(0.88);
            box-shadow:
              0 0 0 3px #0a0704, 0 0 0 6px var(--rust-shadow), 0 0 0 9px #0a0704,
              inset 0 -2px 0 var(--rust-shadow), inset 0 2px 0 #a83a26;
            filter: brightness(.85);
        }
        #loadout-overlay .lo-btn.secondary {
            background: linear-gradient(#3a2a16, #1f1408); color: var(--text-dim);
            box-shadow:
              0 0 0 3px #0a0704, 0 0 0 6px #1a1208, 0 0 0 9px #0a0704,
              inset 0 -5px 0 #1a1208, inset 0 3px 0 #5a3f22;
        }
        #loadout-overlay .lo-hint {
            position: absolute; right: 18px; bottom: -30px;
            font-family: 'Press Start 2P', monospace; font-size: 8px;
            color: var(--text-faint); letter-spacing: 1px;
        }
        #loadout-overlay .lo-hint b { color: var(--gold-1); }
        #loadout-overlay .lo-scan {
            position: absolute; inset: 0; pointer-events: none; z-index: 50;
            background: repeating-linear-gradient(0deg, rgba(0,0,0,.18) 0 1px, transparent 1px 3px);
            mix-blend-mode: multiply;
        }
        #loadout-overlay .lo-vignette { position: absolute; inset: 0; pointer-events: none; z-index: 49; box-shadow: inset 0 0 200px 60px #000; }
        #loadout-overlay .lo-dust-edge {
            position: absolute; left: 0; right: 0; bottom: 0; height: 24px;
            pointer-events: none; z-index: 3;
            background: radial-gradient(ellipse 60% 100% at 50% 100%, rgba(60,40,20,.6), transparent 70%);
        }
        @media (max-width: 760px) {
            #loadout-overlay .lo-title { font-size: 14px; }
            #loadout-overlay .lo-subtitle { font-size: 18px; }
            #loadout-overlay .lo-slots { grid-template-columns: repeat(2, 1fr); }
            #loadout-overlay .lo-section { font-size: 10px; }
            #loadout-overlay .lo-move .lo-name { font-size: 9px; }
        }
    `;
    document.head.appendChild(style);
})();

// ---- botão flutuante no HUD (mantido) ----
const triggerBtn = document.createElement('button');
triggerBtn.id = 'loadout-trigger';
triggerBtn.className = 'world-arsenal-btn';
triggerBtn.title = 'Arsenal de Batalha — escolher golpes (V)';
const worldSwordsSvg = `
    <svg style="width:14px;height:14px;margin-right:5px;" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
        <g fill="#0a0704">
          <rect x="1" y="0" width="2" height="1"/><rect x="0" y="1" width="1" height="2"/><rect x="3" y="1" width="1" height="1"/><rect x="2" y="2" width="1" height="1"/><rect x="4" y="2" width="1" height="1"/><rect x="3" y="3" width="1" height="1"/><rect x="5" y="3" width="1" height="1"/><rect x="4" y="4" width="1" height="1"/><rect x="6" y="4" width="1" height="1"/><rect x="5" y="5" width="1" height="1"/><rect x="7" y="5" width="1" height="1"/><rect x="6" y="6" width="1" height="1"/><rect x="8" y="6" width="1" height="1"/><rect x="7" y="7" width="1" height="1"/><rect x="10" y="7" width="1" height="1"/><rect x="6" y="8" width="1" height="1"/><rect x="11" y="8" width="1" height="1"/><rect x="7" y="9" width="1" height="1"/><rect x="10" y="9" width="1" height="1"/><rect x="8" y="10" width="1" height="1"/><rect x="11" y="10" width="1" height="1"/><rect x="9" y="11" width="1" height="1"/><rect x="12" y="11" width="1" height="1"/><rect x="10" y="12" width="1" height="1"/><rect x="13" y="12" width="1" height="1"/><rect x="11" y="13" width="1" height="1"/><rect x="14" y="13" width="1" height="1"/><rect x="12" y="14" width="2" height="1"/><rect x="13" y="15" width="2" height="1"/>
        </g>
        <g fill="#e8f0ff"><rect x="1" y="1" width="2" height="1"/><rect x="2" y="2" width="2" height="1" fill="#a8b8d4"/><rect x="3" y="2" width="1" height="1"/></g>
        <g fill="#a8b8d4"><rect x="3" y="3" width="1" height="1" fill="#e8f0ff"/><rect x="4" y="3" width="1" height="1"/><rect x="4" y="4" width="1" height="1" fill="#e8f0ff"/><rect x="5" y="4" width="1" height="1"/><rect x="5" y="5" width="1" height="1" fill="#e8f0ff"/><rect x="6" y="5" width="1" height="1"/><rect x="6" y="6" width="1" height="1" fill="#e8f0ff"/><rect x="7" y="6" width="1" height="1"/><rect x="7" y="7" width="1" height="1" fill="#e8f0ff"/><rect x="8" y="7" width="1" height="1"/></g>
        <g fill="#f0b73a"><rect x="8" y="8" width="3" height="1"/><rect x="8" y="9" width="2" height="1"/></g>
        <g fill="#8a1b1b"><rect x="9" y="10" width="2" height="1"/><rect x="10" y="11" width="2" height="1"/><rect x="11" y="12" width="2" height="1"/><rect x="12" y="13" width="2" height="1"/></g>
        <g fill="#ffd86b"><rect x="13" y="14" width="1" height="1"/><rect x="14" y="15" width="1" height="1" fill="#c98a22"/></g>
        <g fill="#0a0704"><rect x="13" y="0" width="2" height="1"/><rect x="15" y="1" width="1" height="2"/><rect x="12" y="1" width="1" height="1"/><rect x="13" y="2" width="1" height="1"/><rect x="11" y="2" width="1" height="1"/><rect x="12" y="3" width="1" height="1"/><rect x="10" y="3" width="1" height="1"/><rect x="11" y="4" width="1" height="1"/><rect x="9" y="4" width="1" height="1"/><rect x="10" y="5" width="1" height="1"/><rect x="8" y="5" width="1" height="1"/><rect x="9" y="6" width="1" height="1"/><rect x="7" y="6" width="1" height="1"/><rect x="8" y="7" width="1" height="1"/><rect x="5" y="7" width="1" height="1"/><rect x="9" y="8" width="1" height="1"/><rect x="4" y="8" width="1" height="1"/><rect x="8" y="9" width="1" height="1"/><rect x="5" y="9" width="1" height="1"/><rect x="7" y="10" width="1" height="1"/><rect x="4" y="10" width="1" height="1"/><rect x="6" y="11" width="1" height="1"/><rect x="3" y="11" width="1" height="1"/><rect x="5" y="12" width="1" height="1"/><rect x="2" y="12" width="1" height="1"/><rect x="4" y="13" width="1" height="1"/><rect x="1" y="13" width="1" height="1"/><rect x="2" y="14" width="2" height="1"/><rect x="1" y="15" width="2" height="1"/></g>
        <g fill="#e8f0ff"><rect x="13" y="1" width="2" height="1"/></g>
        <g fill="#a8b8d4"><rect x="12" y="2" width="2" height="1"/></g>
        <g fill="#e8f0ff"><rect x="12" y="3" width="1" height="1"/><rect x="11" y="3" width="1" height="1" fill="#a8b8d4"/><rect x="11" y="4" width="1" height="1"/><rect x="10" y="4" width="1" height="1" fill="#a8b8d4"/><rect x="10" y="5" width="1" height="1"/><rect x="9" y="5" width="1" height="1" fill="#a8b8d4"/><rect x="9" y="6" width="1" height="1"/><rect x="8" y="6" width="1" height="1" fill="#a8b8d4"/><rect x="8" y="7" width="1" height="1"/></g>
        <g fill="#f0b73a"><rect x="5" y="8" width="3" height="1"/><rect x="6" y="9" width="2" height="1"/></g>
        <g fill="#8a1b1b"><rect x="5" y="10" width="2" height="1"/><rect x="4" y="11" width="2" height="1"/><rect x="3" y="12" width="2" height="1"/><rect x="2" y="13" width="2" height="1"/></g>
        <g fill="#ffd86b"><rect x="2" y="14" width="1" height="1"/><rect x="1" y="15" width="1" height="1" fill="#c98a22"/></g>
        <rect x="7" y="7" width="2" height="2" fill="#ffffff"/><rect x="7" y="8" width="1" height="1" fill="#ffd86b"/><rect x="8" y="7" width="1" height="1" fill="#ffd86b"/>
    </svg>
`;
triggerBtn.innerHTML = `${worldSwordsSvg} ARSENAL`;
triggerBtn.onclick = () => abrirLoadoutMenu();
document.body.appendChild(triggerBtn);

export function mostrarBotaoLoadout(v) { triggerBtn.style.display = v ? 'block' : 'none'; }

let _aberto = false;
let _onConfirm = null;
let _onCancel = null;
let _slotSel = 0;

export function isLoadoutMenuAberto() { return _aberto; }

// ---- shell ----
const overlay = document.createElement('div');
overlay.id = 'loadout-overlay';
overlay.style.cssText = `
    position: fixed; inset: 0;
    background: radial-gradient(ellipse at center, rgba(20,16,10,0.78) 0%, rgba(5,4,2,0.95) 70%), #050402;
    display: none; align-items: center; justify-content: center;
    z-index: 75; pointer-events: auto;
`;
document.body.appendChild(overlay);

overlay.innerHTML = `
    <div class="lo-vignette"></div>
    <div class="lo-scan"></div>
    <div class="lo-stage">
        <div class="lo-panel" id="loadout-panel">
            <span class="lo-stud tl"></span>
            <span class="lo-stud tr"></span>
            <span class="lo-stud bl"></span>
            <span class="lo-stud br"></span>

            <div class="lo-crack" style="top:6px; left:80px;">
                <svg width="80" height="40" viewBox="0 0 80 40" shape-rendering="crispEdges">
                  <g fill="#0a0704">
                    <rect x="0" y="20" width="4" height="2"/><rect x="4" y="18" width="4" height="2"/>
                    <rect x="8" y="16" width="6" height="2"/><rect x="14" y="14" width="4" height="2"/>
                    <rect x="18" y="12" width="6" height="2"/><rect x="24" y="10" width="4" height="2"/>
                    <rect x="28" y="12" width="4" height="2"/><rect x="32" y="14" width="6" height="2"/>
                    <rect x="38" y="16" width="4" height="2"/><rect x="42" y="14" width="2" height="6"/>
                    <rect x="38" y="20" width="6" height="2"/>
                  </g>
                </svg>
            </div>
            <div class="lo-crack" style="bottom:30px; right:60px; transform:scaleX(-1) rotate(15deg);">
                <svg width="120" height="50" viewBox="0 0 120 50" shape-rendering="crispEdges">
                  <g fill="#0a0704">
                    <rect x="0" y="20" width="6" height="2"/><rect x="6" y="22" width="4" height="2"/>
                    <rect x="10" y="24" width="6" height="2"/><rect x="16" y="22" width="4" height="2"/>
                    <rect x="20" y="24" width="6" height="2"/><rect x="26" y="26" width="4" height="2"/>
                    <rect x="30" y="28" width="6" height="2"/><rect x="36" y="30" width="4" height="2"/>
                    <rect x="40" y="28" width="4" height="2"/><rect x="44" y="30" width="6" height="2"/>
                    <rect x="50" y="32" width="4" height="2"/>
                  </g>
                </svg>
            </div>

            <div class="lo-cobweb" style="top:4px; left:4px;">
                <svg width="80" height="80" viewBox="0 0 80 80" shape-rendering="crispEdges">
                  <g stroke="#8a7a55" stroke-width="1" fill="none" opacity=".7">
                    <path d="M0 0 L40 30"/><path d="M0 20 L40 30"/><path d="M0 40 L40 30"/>
                    <path d="M20 0 L40 30"/><path d="M40 0 L40 30"/>
                    <path d="M0 0 L20 8 L0 18"/><path d="M0 18 L24 22 L0 32"/>
                    <path d="M0 32 L28 30"/><path d="M20 0 L26 16 L40 0"/>
                  </g>
                </svg>
            </div>
            <div class="lo-cobweb" style="top:4px; right:4px; transform:scaleX(-1);">
                <svg width="80" height="80" viewBox="0 0 80 80" shape-rendering="crispEdges">
                  <g stroke="#8a7a55" stroke-width="1" fill="none" opacity=".55">
                    <path d="M0 0 L40 30"/><path d="M0 20 L40 30"/><path d="M0 40 L40 30"/>
                    <path d="M20 0 L40 30"/><path d="M40 0 L40 30"/>
                    <path d="M0 0 L20 8 L0 18"/><path d="M0 18 L24 22 L0 32"/>
                  </g>
                </svg>
            </div>

            <div class="lo-moss" style="top:40px; left:-2px; width:24px; height:80px;"></div>
            <div class="lo-moss" style="bottom:60px; right:-2px; width:24px; height:60px;"></div>

            <h1 class="lo-title">ARSENAL DE BATALHA</h1>
            <p class="lo-subtitle" id="loadout-subtitle">
                Escolhei um slot e atribuí-lhe um golpe — <kbd>V</kbd> para cancelar
            </p>

            <div class="lo-slots" id="loadout-slots"></div>

            <div class="lo-section">▌ GOLPES DESBLOQUEADOS</div>
            <div class="lo-moves" id="loadout-moves"></div>

            <div class="lo-actions">
                <button class="lo-btn secondary" id="loadout-cancel">CANCELAR</button>
                <button class="lo-btn" id="loadout-confirm"><span style="margin-right:8px;">✓</span>CONFIRMAR</button>
            </div>

            <div class="lo-hint">PIXEL • <b>v0.3</b> • RUÍNAS</div>
            <div class="lo-dust-edge"></div>
        </div>
    </div>
`;

const slotsEl     = overlay.querySelector('#loadout-slots');
const movesEl     = overlay.querySelector('#loadout-moves');
const subtitleEl  = overlay.querySelector('#loadout-subtitle');
const btnConfirmar = overlay.querySelector('#loadout-confirm');
const btnCancelar  = overlay.querySelector('#loadout-cancel');

btnConfirmar.onclick = () => {
    const cb = _onConfirm; _onConfirm = null; _onCancel = null;
    fecharLoadoutMenu();
    if (cb) cb();
};
btnCancelar.onclick = () => {
    const cb = _onCancel; _onConfirm = null; _onCancel = null;
    fecharLoadoutMenu();
    if (cb) cb();
};

function _iconEl(ic) {
    if (ic && (ic.endsWith('.png') || ic.endsWith('.jpg') || ic.includes('/'))) {
        return `<img src="${ic}" alt="">`;
    }
    return `<span style="font-family:'VT323',monospace;font-size:24px;color:#e7d6a8;">${ic || '⚔'}</span>`;
}

function _tipoTag(at) {
    return at.magico
        ? '<span style="color:#a8c8ff;">mágico</span>'
        : '<span style="color:#ffc080;">físico</span>';
}

function renderSlots() {
    let html = '';
    for (let i = 0; i < 4; i++) {
        const id = ataqueState.slots[i];
        const at = id ? ATAQUES[id] : null;
        const active = (i === _slotSel);
        const chipPos = (i % 2 === 0) ? 'tr' : 'bl';
        html += `
            <div class="lo-slot" data-slot="${i}" data-active="${active}">
                <span class="lo-chip ${chipPos}"></span>
                <div class="lo-label">SLOT ${i + 1}</div>
                <div class="lo-icon ${at ? '' : 'empty'}">${at ? _iconEl(at.icone) : ''}</div>
                <div class="lo-name ${at ? '' : 'empty'}">${at ? at.nome : 'vazio'}</div>
            </div>
        `;
    }
    slotsEl.innerHTML = html;
    slotsEl.querySelectorAll('.lo-slot').forEach(el => {
        el.addEventListener('click', () => {
            _slotSel = parseInt(el.dataset.slot, 10);
            renderSlots();
            renderCatalogo();
        });
    });
}

function renderCatalogo() {
    const desblo = Array.from(ataqueState.desbloqueados);
    if (desblo.length === 0) {
        movesEl.innerHTML = `<div style="font-family:'VT323',monospace;font-size:20px;color:#5e4d2e;font-style:italic;text-align:center;padding:14px;">— sem golpes desbloqueados —</div>`;
        return;
    }
    let html = '';
    for (const id of desblo) {
        const at = ATAQUES[id];
        if (!at) continue;
        const jaEm = ataqueState.slots.indexOf(id);
        const cd = at.cooldown > 0 ? `CD ${at.cooldown}` : 'CD 0';
        const tagText = jaEm >= 0 ? `SLOT ${jaEm + 1}` : '— —';
        html += `
            <div class="lo-move" data-id="${id}">
                <div class="lo-icon">${_iconEl(at.icone)}</div>
                <div>
                    <div class="lo-name">${at.nome.toUpperCase()}</div>
                    <div class="lo-desc">${at.desc} <span class="lo-pip"></span> ${cd} <span class="lo-pip"></span> ${_tipoTag(at)}</div>
                </div>
                <div class="lo-tag">${tagText}</div>
            </div>
        `;
    }
    movesEl.innerHTML = html;
    movesEl.querySelectorAll('.lo-move').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.dataset.id;
            const jaEm = ataqueState.slots.indexOf(id);
            if (jaEm >= 0 && jaEm !== _slotSel) {
                // troca com o slot destino
                const antigo = ataqueState.slots[_slotSel];
                ataqueState.slots[_slotSel] = id;
                ataqueState.slots[jaEm] = antigo;
            } else {
                equiparAtaque(_slotSel, id);
            }
            renderSlots();
            renderCatalogo();
        });
    });
}

function _onKey(e) {
    if (!_aberto) return;
    if (e.key === 'Escape') { e.preventDefault(); btnCancelar.click(); }
    else if (e.key === 'Enter') { e.preventDefault(); btnConfirmar.click(); }
}
window.addEventListener('keydown', _onKey);

export function abrirLoadoutMenu(onConfirm = null, onCancel = null) {
    if (_aberto) return;
    _aberto = true;
    _onConfirm = onConfirm;
    _onCancel = onCancel;
    _slotSel = 0;
    btnConfirmar.innerHTML = onConfirm
        ? `<span style="margin-right:8px;">⚔</span>INICIAR BATALHA`
        : `<span style="margin-right:8px;">✓</span>CONFIRMAR`;
    btnCancelar.style.display = onConfirm ? '' : 'none';
    subtitleEl.innerHTML = onConfirm
        ? `Escolhei um slot e atribuí-lhe um golpe — <kbd>ESC</kbd> para cancelar`
        : `Escolhei um slot e atribuí-lhe um golpe — <kbd>V</kbd> ou <kbd>ENTER</kbd> para fechar`;
    renderSlots();
    renderCatalogo();
    overlay.style.display = 'flex';
}

export function fecharLoadoutMenu() {
    _aberto = false;
    overlay.style.display = 'none';
}
