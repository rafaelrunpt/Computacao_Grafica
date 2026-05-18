// --------------------------------------------------------
// MENU DE PAUSA — abre/fecha com ESC ou P
// --------------------------------------------------------
import { settings, setSetting, resetSettings } from '../systems/settings.js';
import { playerStats, getAtkEfetivo } from '../systems/player-stats.js';
import { CATALOGO as CATALOGO_INV } from '../systems/inventario.js';

let _aberto = false;
let _bloqueado = false;

export function isPauseAberto() { return _aberto; }
export function bloquearPause(b) { _bloqueado = b; if (b && _aberto) fecharPause(); }

// --- shell / overlay ---
const overlay = document.createElement('div');
overlay.id = 'pause-overlay';
overlay.style.cssText = `
    position: fixed; inset: 0;
    background: radial-gradient(ellipse at center, rgba(20,10,0,0.7) 0%, rgba(0,0,0,0.92) 100%);
    display: none;
    align-items: center; justify-content: center;
    z-index: 80;
    font-family: 'Georgia', serif;
`;
document.body.appendChild(overlay);

const panel = document.createElement('div');
panel.style.cssText = `
    width: 620px; max-width: 94vw; max-height: 88vh;
    background: linear-gradient(180deg, #2a1a08 0%, #3a2510 50%, #2a1a08 100%);
    border: 3px solid #d4a830;
    border-radius: 12px;
    box-shadow:
        0 0 30px rgba(220,160,60,0.5),
        inset 0 0 20px rgba(0,0,0,0.7),
        0 8px 24px rgba(0,0,0,0.85);
    color: #f0d080;
    padding: 18px 22px 14px 22px;
    display: flex; flex-direction: column; gap: 10px;
    position: relative;
`;
overlay.appendChild(panel);

panel.insertAdjacentHTML('afterbegin', `
    <div style="position:absolute;inset:6px;border:1px solid #c8a96e;border-radius:8px;pointer-events:none;"></div>
`);

const titulo = document.createElement('div');
titulo.innerHTML = '⚜ PAUSA ⚜';
titulo.style.cssText = `
    text-align:center;font-size:24px;font-weight:bold;letter-spacing:6px;
    color:#f0d080;text-shadow:0 0 10px #a07000, 2px 2px 0 #000;
    border-bottom:1px solid #8a6a30;padding-bottom:8px;
`;
panel.appendChild(titulo);

// --- abas ---
const tabsBar = document.createElement('div');
tabsBar.style.cssText = `display:flex;gap:4px;flex-wrap:wrap;justify-content:center;`;
panel.appendChild(tabsBar);

const conteudo = document.createElement('div');
conteudo.style.cssText = `
    background: rgba(0,0,0,0.35);
    border: 1px solid #6a5020;
    border-radius: 6px;
    padding: 14px 16px;
    overflow-y: auto;
    max-height: 56vh;
    min-height: 240px;
`;
panel.appendChild(conteudo);

// --- ações inferiores ---
const acoes = document.createElement('div');
acoes.style.cssText = `display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:4px;`;
panel.appendChild(acoes);

const dica = document.createElement('div');
dica.style.cssText = `text-align:center;font-size:11px;color:#c8a96e;font-family:'Courier New',monospace;letter-spacing:1px;`;
dica.textContent = 'ESC para retomar';
panel.appendChild(dica);

// --- helpers de UI ---
function btn(label, color = '#c8a96e') {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `
        background:linear-gradient(180deg,rgba(80,50,20,0.9),rgba(40,25,10,0.95));
        border:1px solid ${color};border-radius:6px;
        color:#f0d080;font-family:'Georgia',serif;font-size:14px;
        padding:8px 14px;cursor:pointer;letter-spacing:1px;
        transition:transform .08s, box-shadow .2s;
    `;
    b.onmouseenter = () => { b.style.transform = 'translateY(-1px)'; b.style.boxShadow = `0 0 12px ${color}80`; };
    b.onmouseleave = () => { b.style.transform = 'translateY(0)';   b.style.boxShadow = 'none'; };
    return b;
}

function labelLine(text) {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText = `font-size:13px;color:#f0d080;margin-bottom:4px;letter-spacing:1px;`;
    return d;
}

function row() {
    const d = document.createElement('div');
    d.style.cssText = `margin-bottom:14px;`;
    return d;
}

function slider(min, max, step, value, onInput, suffix = '') {
    const wrap = document.createElement('div');
    wrap.style.cssText = `display:flex;align-items:center;gap:10px;`;
    const s = document.createElement('input');
    s.type = 'range'; s.min = min; s.max = max; s.step = step; s.value = value;
    s.style.cssText = `flex:1;accent-color:#d4a830;`;
    const v = document.createElement('span');
    v.style.cssText = `min-width:54px;text-align:right;font-family:'Courier New',monospace;color:#ffe0a0;font-size:13px;`;
    const fmt = () => v.textContent = (suffix === '%' ? Math.round(s.value * 100) + '%' : Number(s.value).toFixed(step < 1 ? 2 : 0) + suffix);
    fmt();
    s.oninput = () => { fmt(); onInput(parseFloat(s.value)); };
    wrap.appendChild(s); wrap.appendChild(v);
    return wrap;
}

function toggle(value, onChange) {
    const lbl = document.createElement('label');
    lbl.style.cssText = `display:inline-flex;align-items:center;gap:8px;cursor:pointer;color:#f0d080;font-size:13px;`;
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!value;
    cb.style.cssText = `accent-color:#d4a830;width:16px;height:16px;`;
    cb.onchange = () => onChange(cb.checked);
    lbl.appendChild(cb);
    const span = document.createElement('span'); span.textContent = value ? 'Activado' : 'Desactivado';
    lbl.appendChild(span);
    cb.addEventListener('change', () => span.textContent = cb.checked ? 'Activado' : 'Desactivado');
    return lbl;
}

function select(options, value, onChange) {
    const s = document.createElement('select');
    s.style.cssText = `background:#1a1208;color:#f0d080;border:1px solid #c8a96e;border-radius:4px;padding:5px 8px;font-family:'Georgia',serif;`;
    for (const [val, label] of options) {
        const o = document.createElement('option'); o.value = val; o.textContent = label;
        if (val === value) o.selected = true;
        s.appendChild(o);
    }
    s.onchange = () => onChange(s.value);
    return s;
}

// --- conteúdo das abas ---
function renderAudio() {
    conteudo.innerHTML = '';

    const r1 = row(); r1.appendChild(labelLine('Volume Geral (Master)'));
    r1.appendChild(slider(0, 1, 0.01, settings.masterVolume, v => setSetting('masterVolume', v), '%'));
    conteudo.appendChild(r1);

    const r2 = row(); r2.appendChild(labelLine('Volume da Música'));
    r2.appendChild(slider(0, 1, 0.01, settings.musicVolume, v => setSetting('musicVolume', v), '%'));
    conteudo.appendChild(r2);

    const r3 = row(); r3.appendChild(labelLine('Volume dos Efeitos (SFX)'));
    r3.appendChild(slider(0, 1, 0.01, settings.sfxVolume, v => setSetting('sfxVolume', v), '%'));
    conteudo.appendChild(r3);

    const r4 = row();
    r4.appendChild(labelLine('Silenciar Tudo'));
    r4.appendChild(toggle(settings.muted, v => setSetting('muted', v)));
    conteudo.appendChild(r4);
}

function renderJogabilidade() {
    conteudo.innerHTML = '';
    const r1 = row(); r1.appendChild(labelLine('Sensibilidade do Rato'));
    r1.appendChild(slider(0.1, 3.0, 0.05, settings.mouseSensitivity, v => setSetting('mouseSensitivity', v), 'x'));
    conteudo.appendChild(r1);

    const r2 = row(); r2.appendChild(labelLine('Inverter Eixo Y da Câmara'));
    r2.appendChild(toggle(settings.invertY, v => setSetting('invertY', v)));
    conteudo.appendChild(r2);
}

function renderVideo() {
    conteudo.innerHTML = '';
    const r1 = row(); r1.appendChild(labelLine('Qualidade Gráfica (sombras / AA)'));
    r1.appendChild(select([['baixa','Baixa'],['media','Média'],['alta','Alta']], settings.quality, v => setSetting('quality', v)));
    conteudo.appendChild(r1);

    const r2 = row(); r2.appendChild(labelLine('Campo de Visão (FOV)'));
    r2.appendChild(slider(50, 110, 1, settings.fov, v => setSetting('fov', v), '°'));
    conteudo.appendChild(r2);

    const r3 = row(); r3.appendChild(labelLine('Modo Ecrã Cheio'));
    r3.appendChild(toggle(!!document.fullscreenElement, v => {
        setSetting('fullscreen', v);
        if (v && !document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else if (!v && document.fullscreenElement) document.exitFullscreen?.();
    }));
    conteudo.appendChild(r3);

    const r4 = row(); r4.appendChild(labelLine('Mostrar FPS'));
    r4.appendChild(toggle(settings.showFps, v => setSetting('showFps', v)));
    conteudo.appendChild(r4);
}

function renderControlos() {
    conteudo.innerHTML = `
        <div style="font-size:14px;line-height:1.8;">
            <div style="font-size:13px;color:#c8a96e;letter-spacing:1px;margin-bottom:8px;">CONTROLOS</div>
            <table style="width:100%;border-collapse:collapse;font-family:'Courier New',monospace;font-size:13px;">
                <tr><td style="padding:4px 8px;color:#ffe0a0;width:120px;">W A S D</td><td>Movimentação</td></tr>
                <tr><td style="padding:4px 8px;color:#ffe0a0;">E</td><td>Interagir / falar / entrar</td></tr>
                <tr><td style="padding:4px 8px;color:#ffe0a0;">I</td><td>Inventário</td></tr>
                <tr><td style="padding:4px 8px;color:#ffe0a0;">M</td><td>Mapa / Minimapa</td></tr>
                <tr><td style="padding:4px 8px;color:#ffe0a0;">L</td><td>Menu de debug</td></tr>
                <tr><td style="padding:4px 8px;color:#ffe0a0;">ESC / P</td><td>Pausa</td></tr>
            </table>
            <div style="font-size:11px;color:#a08050;margin-top:12px;font-style:italic;">
                Remapeamento de teclas — em desenvolvimento
            </div>
        </div>
    `;
}

function renderEstatisticas() {
    conteudo.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = `font-family:'Courier New',monospace;font-size:14px;line-height:1.8;`;
    wrap.innerHTML = `
        <div style="font-size:13px;color:#c8a96e;letter-spacing:1px;margin-bottom:8px;font-family:'Georgia',serif;">ESTATÍSTICAS DA PARTIDA</div>
        <div>Nível: <span style="color:#ffe0a0;">${playerStats.level}</span></div>
        <div>XP: <span style="color:#a0c0ff;">${playerStats.xp} / ${playerStats.xpToNext}</span></div>
        <div>HP: <span style="color:#ff9090;">${playerStats.hp} / ${playerStats.maxHp}</span></div>
        <div>ATK: <span style="color:#c0a060;">${playerStats.atk ?? '—'}</span>${getAtkEfetivo() !== playerStats.atk ? ` <span style="color:#aaffbb;">(${getAtkEfetivo()} c/ bónus)</span>` : ''}</div>
        <div>Acessório equipado: <span style="color:#ffe0a0;">${(() => {
            const id = playerStats.equipped?.acessorio;
            if (!id) return '— nenhum —';
            const it = (CATALOGO_INV && CATALOGO_INV[id]) || null;
            return it ? `${it.icone} ${it.nome}` : id;
        })()}</span></div>
    `;
    conteudo.appendChild(wrap);
}

function renderTutorial() {
    conteudo.innerHTML = `
        <div style="font-size:13px;line-height:1.6;">
            <div style="font-size:13px;color:#c8a96e;letter-spacing:1px;margin-bottom:8px;">COMO JOGAR</div>
            <p style="margin:0 0 10px;">
                Acordas num quarto desconhecido. Fala com o bartender, sai pela porta para a taverna,
                e descobre o mundo: zonas corruptas para limpar, lojas para te apetrechares, e um castelo
                onde te espera o boss final.
            </p>

            <div style="color:#c8a96e;margin-top:10px;margin-bottom:4px;letter-spacing:1px;">🎮 MOVIMENTO</div>
            <ul style="padding-left:18px;margin:0 0 8px;">
                <li><b>W A S D</b> — andar &nbsp;·&nbsp; <b>E</b> — interagir &nbsp;·&nbsp; <b>I</b> — inventário</li>
                <li><b>Esc</b> — pausa/opções</li>
            </ul>

            <div style="color:#c8a96e;margin-top:8px;margin-bottom:4px;letter-spacing:1px;">⚔ COMBATE NORMAL</div>
            <ul style="padding-left:18px;margin:0 0 8px;">
                <li>Em zonas escuras, prime <b>E</b> no centro para entrar em combate.</li>
                <li>Ataques têm cooldown — usa o slot certo para o momento certo.</li>
                <li>Vencer dá XP, subir de nível aumenta o dano.</li>
            </ul>

            <div style="color:#c8a96e;margin-top:8px;margin-bottom:4px;letter-spacing:1px;">🏰 CASTELO & ACESSÓRIOS</div>
            <ul style="padding-left:18px;margin:0 0 8px;">
                <li>Cinco pedestais — coloca cada um dos 5 acessórios para desbloquear o boss.</li>
                <li>Acessórios dão buffs: HP, cura pós-combate, evasão, etc.</li>
                <li>Ao preencher os 5, o cristal do totem acende — interage com <b>E</b> para entrar.</li>
            </ul>

            <div style="color:#c8a96e;margin-top:8px;margin-bottom:4px;letter-spacing:1px;">👑 BOSS FIGHT</div>
            <ul style="padding-left:18px;margin:0 0 8px;">
                <li>Esquerda (esquivar) — <b>A/D</b> mudam de lane, <b>W</b> salta, <b>S</b> agacha.</li>
                <li>Direita (acção) — <b>J</b> ATAQUE &nbsp;·&nbsp; <b>K</b> ITENS &nbsp;·&nbsp; <b>L</b> FUGIR.</li>
                <li>Painel de ataque aberto: <b>J K L ;</b> escolhem o slot. Itens: também <b>U I O P</b>.</li>
                <li><b>Esc</b> fecha qualquer painel.</li>
            </ul>

            <div style="color:#c8a96e;margin-top:8px;margin-bottom:4px;letter-spacing:1px;">🎯 ATAQUES DO BOSS</div>
            <ul style="padding-left:18px;margin:0 0 8px;">
                <li><b style="color:#ff8080;">Aéreo</b> (anel vermelho no chão) — cai numa lane. Sai dessa lane ou salta.</li>
                <li><b style="color:#ffcc80;">Rasante</b> (barra laranja no chão) — varre o chão. <b>Salta</b>.</li>
                <li><b style="color:#c8a0ff;">Lateral</b> (coluna roxa + seta) — vem do lado indicado. Muda de lane ou <b>agacha</b>.</li>
                <li><b style="color:#a0ffc8;">Varredura</b> (parede verde à altura do peito) — atravessa as 3 lanes. <b>Agacha</b>.</li>
            </ul>
            <p style="margin:6px 0 0;font-size:12px;color:#a08050;font-style:italic;">
                À medida que o boss perde vida, os projécteis aceleram (até aos 30%).
                Abaixo dos 25% entra em fúria — o aviso aparece com cores trocadas.
            </p>
        </div>
    `;
}

const tabs = [
    { id: 'audio',     label: 'Áudio',         render: renderAudio },
    { id: 'jog',       label: 'Jogabilidade',  render: renderJogabilidade },
    { id: 'video',     label: 'Vídeo',         render: renderVideo },
    { id: 'ctrl',      label: 'Controlos',     render: renderControlos },
    { id: 'stats',     label: 'Estatísticas',  render: renderEstatisticas },
    { id: 'tut',       label: 'Tutorial',      render: renderTutorial },
];

let _abaActiva = 'audio';

function renderTabsBar() {
    tabsBar.innerHTML = '';
    for (const t of tabs) {
        const b = document.createElement('button');
        b.textContent = t.label;
        const activa = _abaActiva === t.id;
        b.style.cssText = `
            background:${activa ? 'linear-gradient(180deg,#5a3a12,#3a2510)' : 'rgba(0,0,0,0.4)'};
            color:${activa ? '#ffe0a0' : '#c8a96e'};
            border:1px solid ${activa ? '#d4a830' : '#6a5020'};
            border-radius:6px 6px 0 0;
            padding:6px 12px;cursor:pointer;
            font-family:'Georgia',serif;font-size:13px;letter-spacing:1px;
            ${activa ? 'box-shadow:0 -2px 8px rgba(220,160,60,0.4);' : ''}
        `;
        b.onclick = () => { _abaActiva = t.id; renderTabsBar(); t.render(); };
        tabsBar.appendChild(b);
    }
}

function renderAcoes() {
    acoes.innerHTML = '';
    const continuar = btn('▶ Continuar', '#ffe0a0');
    continuar.onclick = fecharPause;
    acoes.appendChild(continuar);

    const reiniciar = btn('↻ Reiniciar', '#c0a060');
    reiniciar.onclick = () => {
        if (confirm('Reiniciar o jogo? Vais perder o progresso da sessão actual.')) location.reload();
    };
    acoes.appendChild(reiniciar);

    const menu = btn('⌂ Menu Principal', '#c0a060');
    menu.onclick = () => {
        if (confirm('Voltar ao menu principal? Vais perder o progresso da sessão.')) location.reload();
    };
    acoes.appendChild(menu);

    const reset = btn('Repor opções', '#a08050');
    reset.onclick = () => {
        if (confirm('Repor as opções para os valores por defeito?')) {
            resetSettings();
            // re-render aba activa
            const t = tabs.find(t => t.id === _abaActiva); if (t) t.render();
        }
    };
    acoes.appendChild(reset);

    const sair = btn('✕ Sair do Jogo', '#9e3b45');
    sair.onclick = () => {
        if (confirm('Sair do jogo? Fecha a aba/janela do navegador para sair.')) {
            window.close();
            // se window.close não funcionar, desliga a página
            document.body.innerHTML = `<div style="color:#f0d080;font-family:Georgia,serif;text-align:center;padding:60px;">Obrigado por jogar. Podes fechar esta aba.</div>`;
        }
    };
    acoes.appendChild(sair);
}

// --- abrir / fechar ---
export function abrirPause() {
    if (_bloqueado || _aberto) return;
    _aberto = true;
    renderTabsBar();
    const t = tabs.find(t => t.id === _abaActiva); if (t) t.render();
    renderAcoes();
    overlay.style.display = 'flex';
}

export function fecharPause() {
    if (!_aberto) return;
    _aberto = false;
    overlay.style.display = 'none';
}

export function togglePause() { _aberto ? fecharPause() : abrirPause(); }

// fechar com clique fora
overlay.addEventListener('click', (e) => { if (e.target === overlay) fecharPause(); });
