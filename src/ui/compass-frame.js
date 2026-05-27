// --------------------------------------------------------
// MOLDURA DA BÚSSOLA — pixel art octogonal prateada.
// Substitui a moldura dourada CSS no #minimap-border.
// O interior é transparente para o minimapa 3D ficar visível.
// --------------------------------------------------------

const TONE = {
    hi:  '#d8d8e0',
    mid: '#a8a8b8',
    dark:'#5a5a6a',
    deep:'#2a2a3a',
    edge:'#0a0a14',
};

function band(rows) {
    return rows.map(r =>
        `<rect x="${r.x0}" y="${r.y}" width="${r.x1 - r.x0}" height="${r.h || 1}" fill="${r.color}"/>`
    ).join('');
}

// Octogono regular: cada linha do mapa contém [y0,y1, left, right]
// (inclusive). Aplicando offset `off` afina cada anel do exterior
// para dentro mantendo a forma.
function octRows(off) {
    const rows = [];
    const map = [
        [0,   0,  12, 28],
        [1,   1,  10, 30],
        [2,   2,  8,  32],
        [3,   4,  6,  34],
        [5,   6,  4,  36],
        [7,   8,  2,  38],
        [9,  30,  0,  40],
        [31, 32,  2,  38],
        [33, 34,  4,  36],
        [35, 36,  6,  34],
        [37, 37,  8,  32],
        [38, 38, 10,  30],
        [39, 39, 12,  28],
    ];
    for (const [y0, y1, l, r] of map) {
        for (let y = y0; y <= y1; y++) {
            const Y = y + (y <= 19 ? off : -off);
            const left  = l + off;
            const right = r - off;
            if (right > left) rows.push({ y: Y, x0: left, x1: right });
        }
    }
    return rows;
}

function ringFill(color, off) {
    return band(octRows(off).map(r => ({ ...r, color })));
}

// Pinta APENAS o anel entre dois insets (subtrai o interior).
// Crucial para deixar o miolo da bússola transparente.
function ringStroke(color, fromOff, toOff) {
    const outer = octRows(fromOff);
    const inner = octRows(toOff);
    const innerMap = new Map();
    for (const r of inner) innerMap.set(r.y, r);
    const rows = [];
    for (const o of outer) {
        const i = innerMap.get(o.y);
        if (!i) {
            rows.push({ y: o.y, x0: o.x0, x1: o.x1, color });
        } else {
            if (i.x0 > o.x0) rows.push({ y: o.y, x0: o.x0, x1: i.x0, color });
            if (o.x1 > i.x1) rows.push({ y: o.y, x0: i.x1, x1: o.x1, color });
        }
    }
    return band(rows);
}

function rivet(x, y) {
    return (
        `<rect x="${x}"   y="${y}"   width="2" height="2" fill="${TONE.edge}"/>` +
        `<rect x="${x}"   y="${y}"   width="1" height="1" fill="${TONE.hi}"/>` +
        `<rect x="${x+1}" y="${y+1}" width="1" height="1" fill="${TONE.deep}"/>`
    );
}

function letter(ch, x, y, color, outline) {
    const glyphs = {
        N: ['111','101','101','101','101'],
        E: ['111','100','111','100','111'],
        S: ['111','100','111','001','111'],
        W: ['101','101','101','101','111'],
        O: ['111','101','101','101','111'], // usamos N/S/E/W standard; mantemos O caso seja útil
    };
    const rows = glyphs[ch];
    if (!rows) return '';
    let out = '';
    if (outline) {
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            for (let r = 0; r < rows.length; r++) {
                for (let c = 0; c < rows[r].length; c++) {
                    if (rows[r][c] === '1') {
                        out += `<rect x="${x+c+dx}" y="${y+r+dy}" width="1" height="1" fill="${outline}"/>`;
                    }
                }
            }
        }
    }
    for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < rows[r].length; c++) {
            if (rows[r][c] === '1') {
                out += `<rect x="${x+c}" y="${y+r}" width="1" height="1" fill="${color}"/>`;
            }
        }
    }
    return out;
}

function buildCompassSVG() {
    const t = TONE;
    let svg = '';

    // Anéis APENAS (não preenchem o miolo): preto → escuro → meio → preto.
    svg += ringStroke(t.edge, 0, 1);
    svg += ringStroke(t.dark, 1, 2);
    svg += ringStroke(t.mid,  2, 4);
    svg += ringStroke(t.edge, 4, 5);
    // INTERIOR (off>=5) FICA TRANSPARENTE — minimapa 3D mostra-se por baixo.

    // Highlight em cima e sombra em baixo do anel exterior
    svg += band([
        { y: 1, x0: 11, x1: 29, color: t.hi },
        { y: 2, x0:  9, x1: 31, color: t.hi },
    ]);
    svg += band([
        { y: 37, x0:  9, x1: 31, color: t.deep },
        { y: 38, x0: 11, x1: 29, color: t.deep },
    ]);

    // Fissuras no metal (textura)
    svg += `<rect x="3"  y="14" width="1" height="1" fill="${t.edge}"/>`;
    svg += `<rect x="3"  y="15" width="1" height="1" fill="${t.deep}"/>`;
    svg += `<rect x="4"  y="15" width="1" height="1" fill="${t.deep}"/>`;
    svg += `<rect x="36" y="20" width="1" height="1" fill="${t.edge}"/>`;
    svg += `<rect x="35" y="21" width="1" height="1" fill="${t.deep}"/>`;
    svg += `<rect x="36" y="21" width="1" height="1" fill="${t.deep}"/>`;
    svg += `<rect x="20" y="2"  width="1" height="1" fill="${t.deep}"/>`;
    svg += `<rect x="14" y="37" width="1" height="1" fill="${t.deep}"/>`;
    svg += `<rect x="15" y="37" width="1" height="1" fill="${t.edge}"/>`;
    svg += `<rect x="25" y="36" width="1" height="1" fill="${t.deep}"/>`;

    // Rebites nas diagonais
    svg += rivet(6, 6);
    svg += rivet(32, 6);
    svg += rivet(6, 32);
    svg += rivet(32, 32);

    // Letras cardinais (N / S / E / W)
    const letterColor  = '#fff4c2';
    const letterShadow = '#0a0704';
    svg += letter('N', 18,  1, letterColor, letterShadow);
    svg += letter('S', 18, 34, letterColor, letterShadow);
    svg += letter('E', 35, 18, letterColor, letterShadow);
    svg += letter('W',  2, 18, letterColor, letterShadow);

    return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;image-rendering:pixelated;">${svg}</svg>`;
}

// Injecta a moldura uma única vez no #minimap-border.
// Em vez de SVG inline (200+ <rect> recompostos por frame por cima do
// canvas WebGL), serializamos a SVG para um data URI e pomos como
// background-image — o compositor trata como uma bitmap única em cache,
// custo de composição praticamente zero por frame.
export function instalarMolduraBussola() {
    const el = document.getElementById('minimap-border');
    if (!el) return;
    const svg = buildCompassSVG();
    const encoded = encodeURIComponent(svg)
        .replace(/'/g, '%27')
        .replace(/"/g, '%22');
    el.innerHTML = '';
    el.style.background = `url("data:image/svg+xml;utf8,${encoded}") center/100% 100% no-repeat`;
}

// auto-instala assim que o módulo é importado (o div já existe no index.html)
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', instalarMolduraBussola, { once: true });
    } else {
        instalarMolduraBussola();
    }
}
