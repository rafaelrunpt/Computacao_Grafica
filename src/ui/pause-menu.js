// --------------------------------------------------------
// MENU DE TRÉGUA — abre/fecha com ESC ou P
// --------------------------------------------------------
import { settings, setSetting, resetSettings, onSettingChange } from '../systems/settings.js';
import { playerStats, getAtkEfetivo } from '../systems/player-stats.js';
import { CATALOGO as CATALOGO_INV } from '../systems/inventario.js';
import { estado, lojaPlayer } from '../core/transicoes.js';
import { lojaSpawnPos } from '../world/loja.js';
import { kbGlyph, psGlyph } from './glyphs.js';
import { limparTutoriais } from './tutorial.js';

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
titulo.innerHTML = '⚜ TRÉGUA ⚜';
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
dica.textContent = 'ESC para prosseguir';
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

    const r1 = row(); r1.appendChild(labelLine('Sopro do Mundo (Geral)'));
    r1.appendChild(slider(0, 1, 0.01, settings.masterVolume, v => setSetting('masterVolume', v), '%'));
    conteudo.appendChild(r1);

    const r2 = row(); r2.appendChild(labelLine('Melodias'));
    r2.appendChild(slider(0, 1, 0.01, settings.musicVolume, v => setSetting('musicVolume', v), '%'));
    conteudo.appendChild(r2);

    const r3 = row(); r3.appendChild(labelLine('Ecos da Batalha (SFX)'));
    r3.appendChild(slider(0, 1, 0.01, settings.sfxVolume, v => setSetting('sfxVolume', v), '%'));
    conteudo.appendChild(r3);

    const r4 = row();
    r4.appendChild(labelLine('Silenciar o Reino'));
    r4.appendChild(toggle(settings.muted, v => setSetting('muted', v)));
    conteudo.appendChild(r4);
}

// Seletor "Teclado vs Comando" — dois botões grandes, igual ao modal inicial.
function _inputMethodChoice(selectedIdx, onChange) {
    const wrap = document.createElement('div');
    wrap.style.cssText = `display:flex;gap:8px;`;
    const opts = [
        { icon: '⌨',  label: 'TECLADO', val: 'keyboard' },
        { icon: '🎮', label: 'COMANDO', val: 'gamepad'  },
    ];
    const btns = [];
    const paint = (i) => {
        btns.forEach((b, j) => {
            const sel = j === i;
            b.style.background  = sel ? 'rgba(212,168,48,0.18)' : 'rgba(40,28,12,0.5)';
            b.style.borderColor = sel ? '#d4a830' : 'rgba(176,120,64,0.5)';
            b.style.color       = sel ? '#ffe9a0' : '#a08060';
            b.style.boxShadow   = sel ? '0 0 12px rgba(212,168,48,0.3), inset 0 0 10px rgba(212,168,48,0.12)' : 'none';
        });
    };
    opts.forEach((opt, i) => {
        const b = document.createElement('button');
        b.style.cssText = `
            flex:1; padding: 9px 10px;
            border: 1.5px solid rgba(176,120,64,0.5);
            border-radius: 6px;
            background: rgba(40,28,12,0.5);
            color: #a08060;
            font-family: inherit; cursor: pointer;
            display:flex; align-items:center; justify-content:center; gap:8px;
            transition: all .15s ease;
        `;
        b.innerHTML = `<span style="font-size:18px;">${opt.icon}</span><span style="font-size:11px;letter-spacing:2px;">${opt.label}</span>`;
        b.onclick = () => { paint(i); onChange(opts[i].val); };
        btns.push(b);
        wrap.appendChild(b);
    });
    paint(selectedIdx);
    return wrap;
}

function renderJogabilidade() {
    conteudo.innerHTML = '';

    const rInput = row();
    rInput.appendChild(labelLine('Método de Comando'));
    rInput.appendChild(_inputMethodChoice(
        settings.inputMethod === 'gamepad' ? 1 : 0,
        (v) => setSetting('inputMethod', v),
    ));
    conteudo.appendChild(rInput);

    const r1 = row(); r1.appendChild(labelLine('Agilidade da Mão (Rato)'));
    r1.appendChild(slider(0.1, 3.0, 0.05, settings.mouseSensitivity, v => setSetting('mouseSensitivity', v), 'x'));
    conteudo.appendChild(r1);

    const r2 = row(); r2.appendChild(labelLine('Inverter Eixo Y do Olhar'));
    r2.appendChild(toggle(settings.invertY, v => setSetting('invertY', v)));
    conteudo.appendChild(r2);
}

function renderVideo() {
    conteudo.innerHTML = '';
    const r1 = row(); r1.appendChild(labelLine('Esplendor Visual (sombras / AA)'));
    r1.appendChild(select([['baixa','Baixa'],['media','Média'],['alta','Alta']], settings.quality, v => setSetting('quality', v)));
    conteudo.appendChild(r1);

    // Resolução do canvas — reduz fragment work proporcionalmente. Aplicação
    // imediata (sem reload) porque renderer.setPixelRatio é runtime-safe.
    // Slider de 10% a 200%. 200% = renderScale 1.0 (máximo antigo).
    const rRes = row(); rRes.appendChild(labelLine('Densidade de Pixéis (Resolução)'));
    rRes.appendChild(slider(0.1, 2.0, 0.05, settings.renderScale * 2.0, v => setSetting('renderScale', v / 2.0), '%'));
    conteudo.appendChild(rRes);

    const r2 = row(); r2.appendChild(labelLine('Alcance do Olhar (FOV)'));
    r2.appendChild(slider(50, 110, 1, settings.fov, v => setSetting('fov', v), '°'));
    conteudo.appendChild(r2);

    const r3 = row(); r3.appendChild(labelLine('Ecrã Inteiro'));
    r3.appendChild(toggle(!!document.fullscreenElement, v => {
        setSetting('fullscreen', v);
        if (v && !document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else if (!v && document.fullscreenElement) document.exitFullscreen?.();
    }));
    conteudo.appendChild(r3);

    const r4 = row(); r4.appendChild(labelLine('Mostrar Cadência (FPS)'));
    r4.appendChild(toggle(settings.showFps, v => setSetting('showFps', v)));
    conteudo.appendChild(r4);

    const r5 = row(); r5.appendChild(labelLine('Modo Depuração VFX (Frame a Frame)'));
    r5.appendChild(toggle(settings.vfxDebug, v => setSetting('vfxDebug', v)));
    conteudo.appendChild(r5);
}

function renderIluminacao() {
    conteudo.innerHTML = '';

    const ativo = !!settings.nightMode;

    const intro = document.createElement('div');
    intro.style.cssText = `
        font-size:12px;color:#c8a96e;line-height:1.5;margin-bottom:14px;
        padding:8px 10px;background:rgba(0,0,0,0.35);
        border:1px solid #6a5020;border-radius:5px;font-style:italic;
    `;
    intro.innerHTML = `
        O modo nocturno acrescenta dezenas de fontes de luz dinâmicas
        ao mundo exterior — pirilampos, lanternas, wisps mágicos e runas.
        Por ter peso considerável sobre a placa gráfica, é escolhido no
        portão inicial e fica vigente durante toda a jornada.
    `;
    conteudo.appendChild(intro);

    const estadoBox = document.createElement('div');
    estadoBox.style.cssText = `
        display:flex;align-items:center;justify-content:space-between;
        padding:12px 14px;
        background:rgba(0,0,0,0.4);
        border:1px solid ${ativo ? '#d4a830' : '#6a5020'};
        border-radius:6px;margin-bottom:12px;
    `;
    estadoBox.innerHTML = `
        <span style="font-size:13px;letter-spacing:1px;">Estado actual</span>
        <span style="font-size:14px;font-weight:bold;letter-spacing:2px;
            color:${ativo ? '#ffe0a0' : '#8a7a4a'};
            text-shadow:${ativo ? '0 0 10px rgba(255,210,80,0.5)' : 'none'};">
            ${ativo ? '🌙 NOITE — Benchmark Activo' : '☀ DIA — Modo Rápido'}
        </span>
    `;
    conteudo.appendChild(estadoBox);

    const btnRow = row();
    btnRow.style.cssText = `display:flex;gap:8px;margin-top:6px;`;

    const btnAlternar = btn(ativo ? '☀ Voltar ao Dia' : '🌙 Despertar a Noite', '#c8a96e');
    btnAlternar.style.flex = '1';
    btnAlternar.onclick = () => {
        if (confirm(ativo
            ? 'Voltar ao dia exige reiniciar a jornada. Prosseguir?'
            : 'Despertar a noite acrescenta luzes ao mundo e exige reiniciar a jornada. Prosseguir?')) {
            setSetting('nightMode', !ativo);
            location.reload();
        }
    };
    btnRow.appendChild(btnAlternar);
    conteudo.appendChild(btnRow);

    const dicaPerformance = document.createElement('div');
    dicaPerformance.style.cssText = `
        font-size:11px;color:#a08050;line-height:1.4;margin-top:18px;
        padding:6px 10px;border-left:2px solid #8a6a30;font-style:italic;
    `;
    dicaPerformance.innerHTML = `
        ✦ Alternar o modo durante a jornada obriga a recompilar todos os
        shaders das luzes — por isso só é possível ao reiniciar. Podeis
        escolher também no portão inicial.
    `;
    conteudo.appendChild(dicaPerformance);
}

function renderControlos() {
    // Cada linha mostra Acção | Teclado | Comando (PlayStation). A coluna do
    // método de input activo (settings.inputMethod) é destacada — o resto
    // fica esbatido para guiar o jogador sem esconder o outro mapeamento.
    const wasdKb = `${kbGlyph('W')} ${kbGlyph('A')} ${kbGlyph('S')} ${kbGlyph('D')}`;
    const wasdGp = `${psGlyph('lstick')} <span style="opacity:.55;margin:0 4px;">ou</span> ${psGlyph('dpad')}`;
    const escKb  = `${kbGlyph('Esc')} <span style="opacity:.55;">/</span> ${kbGlyph('P')}`;
    const escGp  = `${psGlyph('circle')} <span style="opacity:.55;">/</span> ${psGlyph('options')}`;

    const linhas = [
        { acao: 'Deslocamento',   kb: wasdKb,         gp: wasdGp },
        { acao: 'Interagir / Falar / Entrar', kb: kbGlyph('E'), gp: psGlyph('cross') },
        { acao: 'Inventário',     kb: kbGlyph('I'),   gp: psGlyph('triangle') },
        { acao: 'Códice de Encargos', kb: kbGlyph('B'), gp: psGlyph('square') },
        { acao: 'Arsenal de Batalha', kb: kbGlyph('V'), gp: psGlyph('l2') },
        { acao: 'Mapa',           kb: kbGlyph('M'),   gp: psGlyph('r1') },
        { acao: 'Tocha do Viajante', kb: kbGlyph('N'), gp: psGlyph('l1') },
        { acao: 'Trégua / Ajustes',  kb: escKb,       gp: escGp },
    ];

    const isGp = settings.inputMethod === 'gamepad';
    const colHi  = 'color:#ffe9a0;';
    const colDim = 'color:#a08560;opacity:0.55;';

    const linhasHtml = linhas.map(l => `
        <tr style="border-bottom:1px dashed rgba(200,169,110,0.12);">
            <td style="padding:7px 10px;color:#c8a96e;letter-spacing:0.5px;">${l.acao}</td>
            <td style="padding:7px 10px;text-align:center;${isGp ? colDim : colHi}">${l.kb}</td>
            <td style="padding:7px 10px;text-align:center;${isGp ? colHi : colDim}">${l.gp}</td>
        </tr>
    `).join('');

    conteudo.innerHTML = `
        <div style="font-size:14px;line-height:1.6;">
            <div style="font-size:13px;color:#c8a96e;letter-spacing:1px;margin-bottom:8px;">MANEJO</div>

            <div style="font-size:11px;color:${isGp ? '#a08050' : '#ffe9a0'};margin-bottom:6px;letter-spacing:1px;">
                Em uso: <b style="color:${isGp ? '#ff9090' : '#a0ffc8'};">${isGp ? 'COMANDO' : 'TECLADO'}</b>
                <span style="opacity:.6;">— podeis trocar em Ajustes (Manejo).</span>
            </div>

            <table style="width:100%;border-collapse:collapse;font-family:'Courier New',monospace;font-size:13px;">
                <thead>
                    <tr style="text-align:center;font-size:11px;color:#8a6a30;letter-spacing:2px;">
                        <th style="padding:6px;text-align:left;">ACÇÃO</th>
                        <th style="padding:6px;${isGp ? 'opacity:.5;' : ''}">TECLADO</th>
                        <th style="padding:6px;${isGp ? '' : 'opacity:.5;'}">COMANDO</th>
                    </tr>
                </thead>
                <tbody>${linhasHtml}</tbody>
            </table>

            <div style="font-size:11px;color:#a08050;margin-top:12px;font-style:italic;">
                ${isGp
                    ? 'Em combate por comando ainda vem por aí — por agora a parte de jogo no mundo está suportada.'
                    : 'Reajuste de manejo — em preparo.'}
            </div>
        </div>
    `;
}

function renderEstatisticas() {
    conteudo.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = `font-family:'Courier New',monospace;font-size:14px;line-height:1.8;`;
    wrap.innerHTML = `
        <div style="font-size:13px;color:#c8a96e;letter-spacing:1px;margin-bottom:8px;font-family:'Georgia',serif;">FEITOS E PROEZAS DA JORNADA</div>
        <div>Nível: <span style="color:#ffe0a0;">${playerStats.level}</span></div>
        <div>XP: <span style="color:#a0c0ff;">${playerStats.xp} / ${playerStats.xpToNext}</span></div>
        <div>HP: <span style="color:#ff9090;">${playerStats.hp} / ${playerStats.maxHp}</span></div>
        <div>ATK: <span style="color:#c0a060;">${playerStats.atk ?? '—'}</span>${getAtkEfetivo() !== playerStats.atk ? ` <span style="color:#aaffbb;">(${getAtkEfetivo()} c/ bónus)</span>` : ''}</div>
        <div>Artefacto em uso: <span style="color:#ffe0a0;">${(() => {
            const id = playerStats.equipped?.acessorio;
            if (!id) return '— nada —';
            const it = (CATALOGO_INV && CATALOGO_INV[id]) || null;
            return it ? `${it.icone} ${it.nome}` : id;
        })()}</span></div>
    `;
    conteudo.appendChild(wrap);
}

function renderTutorial() {
    conteudo.innerHTML = `
        <div style="font-size:13px;line-height:1.6;">
            <div style="font-size:13px;color:#c8a96e;letter-spacing:1px;margin-bottom:8px;">ENSINO</div>
            <p style="margin:0 0 10px;">
                Despertais num aposento desconhecido. Falai com o taberneiro, parti pela porta para a estalagem,
                e descobri o mundo: terras corrompidas para purificar, mercadores para vos apetrechar, e um castelo
                onde vos aguarda o desafio final.
            </p>

            <div style="color:#c8a96e;margin-top:10px;margin-bottom:4px;letter-spacing:1px;">🎮 DESLOCAMENTO</div>
            <ul style="padding-left:18px;margin:0 0 8px;">
                <li><b>W A S D</b> — caminhar &nbsp;·&nbsp; <b>E</b> — interagir &nbsp;·&nbsp; <b>I</b> — alforges &nbsp;·&nbsp; <b>B</b> — códice</li>
                <li><b>Esc</b> — trégua / ajustes</li>
            </ul>

            <div style="color:#c8a96e;margin-top:8px;margin-bottom:4px;letter-spacing:1px;">⚔ COMBATE NORMAL</div>
            <ul style="padding-left:18px;margin:0 0 8px;">
                <li>Em zonas sombrias, premi <b>E</b> no centro para iniciar o combate.</li>
                <li>Os ataques requerem repouso — escolhei o momento certo.</li>
                <li>A vitória traz sabedoria; elevar o vosso nível aumenta o vosso vigor.</li>
            </ul>

            <div style="color:#c8a96e;margin-top:8px;margin-bottom:4px;letter-spacing:1px;">🏰 CASTELO & ARTEFACTOS</div>
            <ul style="padding-left:18px;margin:0 0 8px;">
                <li>Cinco pedestais — colocai cada um dos 5 artefactos para desafiar o guardião.</li>
                <li>Artefactos concedem bênçãos: vitalidade, cura pós-batalha, evasão, entre outros.</li>
                <li>Ao reunir os 5, o cristal do totem brilhará — premi <b>E</b> para entrar.</li>
            </ul>

            <div style="color:#c8a96e;margin-top:8px;margin-bottom:4px;letter-spacing:1px;">👑 CONFRONTO FINAL</div>
            <ul style="padding-left:18px;margin:0 0 8px;">
                <li>Esquerda (esquiva) — <b>A/D</b> mudam a lane, <b>W</b> salta, <b>S</b> agacha.</li>
                <li>Direita (acção) — <b>J</b> ATAQUE &nbsp;·&nbsp; <b>K</b> ITENS &nbsp;·&nbsp; <b>L</b> FUGIR.</li>
                <li>Painel de ataque: <b>J K L ;</b> escolhem a habilidade. Itens: <b>U I O P</b>.</li>
                <li><b>Esc</b> fecha qualquer painel.</li>
            </ul>

            <div style="color:#c8a96e;margin-top:8px;margin-bottom:4px;letter-spacing:1px;">🎯 ATAQUES DO GUARDIÃO</div>
            <ul style="padding-left:18px;margin:0 0 8px;">
                <li><b style="color:#ff8080;">Aéreo</b> (selo vermelho no solo) — cai numa lane. Saí ou saltal.</li>
                <li><b style="color:#ffcc80;">Rasante</b> (barra laranja no solo) — varre o chão. <b>Saltal</b>.</li>
                <li><b style="color:#c8a0ff;">Lateral</b> (coluna roxa + seta) — provém do lado indicado. Mudai de lane ou <b>agachai-vos</b>.</li>
                <li><b style="color:#a0ffc8;">Varredura</b> (muralha verde) — atravessa as 3 lanes. <b>Agachai-vos</b>.</li>
            </ul>
            <p style="margin:6px 0 0;font-size:12px;color:#a08050;font-style:italic;">
                À medida que o guardião enfraquece, os seus golpes aceleram.
                Abaixo dos 25% de vida, entra em fúria — o aviso surgirá com cores invertidas.
            </p>
        </div>
    `;
}

const tabs = [
    { id: 'audio',     label: 'Sopros',         render: renderAudio },
    { id: 'jog',       label: 'Manejo',         render: renderJogabilidade },
    { id: 'video',     label: 'Visões',         render: renderVideo },
    { id: 'lights',    label: '🌙 Lume',         render: renderIluminacao },
    { id: 'ctrl',      label: 'Acções',         render: renderControlos },
    { id: 'stats',     label: 'Feitos',         render: renderEstatisticas },
    { id: 'tut',       label: 'Ensino',         render: renderTutorial },
];

let _abaActiva = 'audio';

// Quando o método de input muda, re-renderiza o painel aberto (Controles
// muda os destaques, Manejo actualiza a sua selecção). Só age se o pause
// estiver visível e a aba afectada estiver activa.
onSettingChange('inputMethod', () => {
    if (!_aberto) return;
    if (_abaActiva !== 'ctrl' && _abaActiva !== 'jog' && _abaActiva !== 'tut') return;
    const t = tabs.find(t => t.id === _abaActiva); if (t) t.render();
});

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
    const continuar = btn('▶ Prosseguir', '#ffe0a0');
    continuar.onclick = fecharPause;
    acoes.appendChild(continuar);

    if (estado.cena === 'loja') {
        const voltarEntrada = btn('↺ Regressar à Entrada', '#c0a060');
        voltarEntrada.onclick = () => {
            lojaPlayer.x = lojaSpawnPos.x;
            lojaPlayer.y = lojaSpawnPos.y;
            lojaPlayer.z = lojaSpawnPos.z;
            lojaPlayer.rotY = 0;
            fecharPause();
        };
        acoes.appendChild(voltarEntrada);
    }

    const reiniciar = btn('↻ Recomeçar', '#c0a060');
    reiniciar.onclick = () => {
        if (confirm('Desejais recomeçar a vossa jornada? Todo o progresso desta sessão será perdido.')) location.reload();
    };
    acoes.appendChild(reiniciar);

    const menu = btn('⌂ Portão Inicial', '#c0a060');
    menu.onclick = () => {
        if (confirm('Desejais voltar ao portão inicial? O vosso progresso actual será perdido.')) location.reload();
    };
    acoes.appendChild(menu);

    const reset = btn('Restaurar Ajustes', '#a08050');
    reset.onclick = () => {
        if (confirm('Desejais restaurar os ajustes para os valores originais?')) {
            resetSettings();
            // re-render aba activa
            const t = tabs.find(t => t.id === _abaActiva); if (t) t.render();
        }
    };
    acoes.appendChild(reset);

    const sair = btn('✕ Partir', '#9e3b45');
    sair.onclick = () => {
        if (confirm('Queres sair do jogo? Fecha a aba para sair.')) {
            window.close();
            // se window.close não funcionar, desliga a página
            document.body.innerHTML = `<div style="color:#f0d080;font-family:Georgia,serif;text-align:center;padding:60px;">Obrigado por jogares. Podes fechar esta aba.</div>`;
        }
    };
    acoes.appendChild(sair);
}

// --- abrir / fechar ---
export function abrirPause() {
    limparTutoriais();
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

