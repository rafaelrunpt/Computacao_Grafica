// Popup central com texto longo (usado para mostrar pistas das runas).
const overlay = document.createElement('div');
overlay.id = 'pista-overlay';
overlay.style.cssText = `
    position: fixed; left: 50%; top: 18%;
    transform: translate(-50%, 0) translateY(-12px);
    max-width: 520px; padding: 18px 26px;
    background: linear-gradient(180deg, rgba(40,20,60,0.95), rgba(20,10,30,0.95));
    border: 1px solid #a878ff;
    border-radius: 10px;
    color: #f5e8ff;
    font-family: 'Georgia', serif;
    font-size: 16px; line-height: 1.5;
    box-shadow: 0 8px 28px rgba(120,60,200,0.45), inset 0 0 12px rgba(120,80,200,0.25);
    opacity: 0; pointer-events: none;
    transition: opacity 0.35s ease, transform 0.35s ease;
    z-index: 950;
    text-align: center;
`;
const title = document.createElement('div');
title.style.cssText = `
    font-size: 11px; letter-spacing: 3px; color: #c8a8ff;
    text-transform: uppercase; margin-bottom: 8px;
    font-family: 'Georgia', serif;
`;
title.textContent = '✦ Pista da Runa ✦';
const body = document.createElement('div');
overlay.append(title, body);
document.body.appendChild(overlay);

let _hideTimer = null;
let _aberta = false;
// `duracao` opcional: se 0/omitido, fica visível até esconderPista() ser chamada.
export function mostrarPista(texto, duracao = 0) {
    body.textContent = texto;
    overlay.style.opacity = '1';
    overlay.style.transform = 'translate(-50%, 0) translateY(0)';
    _aberta = true;
    if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
    if (duracao > 0) _hideTimer = setTimeout(() => esconderPista(), duracao);
}

export function esconderPista() {
    if (!_aberta) return;
    overlay.style.opacity = '0';
    overlay.style.transform = 'translate(-50%, 0) translateY(-12px)';
    if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
    _aberta = false;
}

export function isPistaAberta() { return _aberta; }
