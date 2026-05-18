// Diálogo de introdução do bartender — explica como o herói chegou ali.
// UI sequencial: cada clique/espaço avança uma linha; no fim chama onEnd.

const LINHAS = [
    'Estalajadeiro: "Olhai quem despertou… mais uma alma perdida no seio deste nevoeiro."',
    '"Encontrámos-vos à beira do rio meridional, em farrapos, mas com o sopro da vida — tivestes mais mercê que outrora muitos outros."',
    '"Estas terras apodrecem a olhos vistos. Manchas de trevas engolem a relva, os arvoredos e até a própria luz divina."',
    '"Nós, os Goblins, tomámos a liberdade de vos recolher e providenciar estes aposentos. Não aguardeis mais dádivas sem custo."',
    '"Quando as vossas forças permitirem, vinde falar comigo. Vendo elixires e posso ensinar-vos a arte da lâmina — ser-vos-ão de grande serventia."',
    '"E escutai este conselho: repousai antes de partirdes. As bestas despertam sempre que o sol se põe além do horizonte."',
];

let _box = null;
let _idx = 0;
let _onEnd = null;
let _aberto = false;
let _onKey = null;
let _onClick = null;

function build() {
    if (_box) return _box;
    _box = document.createElement('div');
    _box.id = 'intro-bartender-box';
    _box.style.cssText = `
        position: fixed;
        left: 50%; bottom: 60px;
        transform: translateX(-50%);
        width: min(720px, 92vw);
        background: linear-gradient(180deg, rgba(18,12,8,0.95), rgba(8,6,4,0.97));
        border: 2px solid #b07840;
        border-radius: 14px;
        padding: 24px 28px;
        color: #f0d9a8;
        font-family: 'Courier New', monospace;
        font-size: 17px; line-height: 1.55;
        box-shadow: 0 0 30px rgba(180,100,40,0.5), inset 0 0 24px rgba(60,30,10,0.6);
        z-index: 600;
        opacity: 0; transition: opacity 0.25s;
    `;
    _box.innerHTML = `
        <div id="intro-bartender-text"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;
                    color:#9a7050;font-size:13px;letter-spacing:1px;">
            <span id="intro-bartender-progress">1 / ${LINHAS.length}</span>
            <span>[ ESPAÇO / CLIQUE para prosseguir ]</span>
        </div>
    `;
    document.body.appendChild(_box);
    return _box;
}

function render() {
    const t = document.getElementById('intro-bartender-text');
    const p = document.getElementById('intro-bartender-progress');
    if (t) t.textContent = LINHAS[_idx];
    if (p) p.textContent = `${_idx + 1} / ${LINHAS.length}`;
}

function avancar() {
    if (!_aberto) return;
    _idx++;
    if (_idx >= LINHAS.length) {
        fechar();
        if (_onEnd) _onEnd();
        return;
    }
    render();
}

function fechar() {
    if (!_aberto) return;
    _aberto = false;
    _box.style.opacity = '0';
    setTimeout(() => { if (_box) _box.style.display = 'none'; }, 250);
    if (_onKey)   { window.removeEventListener('keydown', _onKey); _onKey = null; }
    if (_onClick) { window.removeEventListener('click',  _onClick); _onClick = null; }
}

export function abrirIntroBartender(onEnd) {
    build();
    _idx = 0;
    _onEnd = onEnd || null;
    _aberto = true;
    _box.style.display = 'block';
    requestAnimationFrame(() => { _box.style.opacity = '1'; });
    render();
    _onKey = (e) => {
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            avancar();
        }
    };
    _onClick = (_e) => avancar();
    window.addEventListener('keydown', _onKey);
    // pequeno delay para não consumir o clique que abriu a intro
    setTimeout(() => window.addEventListener('click', _onClick), 50);
}

export function isIntroBartenderAberta() { return _aberto; }
