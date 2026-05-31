import * as THREE from 'three';
import { criarMapa, verificaColisao, shopDoorInteract, bruxaInteractBox, updateBruxaMapa, castleEnterBox, tavernEnterBox, guardianInteractBox, removerGuardiao, updateGuardiao, isGuardiaoPassagemConcedida, matWater, matBattleGrass, matBattleSky, matCorruptHalo, matContTrunk, matContLeaves, matContRock, zonasSulLimpas, isShopDesbloqueada, resetZonasBatalha, getBridgeHeight, getBauInteractBox, abrirBau, bauJaAberto, updateBau, bauJaColetado, coletarBau, getBauMascaraInteractBox, abrirBauMascara, bauMascaraJaAberto, updateBauMascara, bauMascaraJaColetado, coletarBauMascara, fadeables, cullables, worldParticles, updateZoneParticles, getSantuarios, ativarSantuario, updateSantuarios, updateCogumelos, updateVegetacao } from '../world/mapa.js';
import { player, updatePlayerAnimation, setCoroaVisivel, setBrincosVisivel, setOculosVisivel, setAureolaVisivel, setMascaraVisivel, setTochaVisivel, updateCoroaAnimacao } from '../entities/jogador.js';
import { adicionarItem, registarOnEquipChange, CATALOGO, usarItem, temItem } from '../systems/inventario.js';
import { ganharCintilas } from '../systems/currency.js';
import { mostrarRecompensa } from '../ui/popup-recompensa.js';
import { verificarEncontro, estadoJogo, zonaBatalhaProximoCentro, iniciarCombateEm, iniciarBossFight } from '../systems/combate.js';
import { atualizarFaseDesvio } from '../systems/boss-attacks.js';
import { renderizarMinimapa } from '../world/minimapa.js';
import '../ui/compass-frame.js'; // instala moldura pixel prateada no #minimap-border
import { lojaScene, lojaColliders, lojaSaidaBox, getLojaHeight, tryMoveLoja, getBauLojaInteractBox, bauLojaJaAberto, bauLojaJaColetado, abrirBauLoja, coletarBauLoja, updateBauLoja, updateMerchant, getMerchantInteractBox } from '../world/loja.js';
import { abrirDialogoMercador, isDialogoMercadorAberto } from '../ui/merchant-dialog.js';
import { caseloScene, caseloColliders, caseloSaidaBox, caseloMiniCam, bossCrystal, bossCrystalInteractBox, bossCrystalRestY, PEDESTAIS, pedestalProximoDe, colocarItemPedestal, todosPedestaisCheios, atualizarPedestais, atualizarAtmosferaCastelo } from '../world/castelo.js';
import { mostrarPista, esconderPista, isPistaAberta } from '../ui/pista-popup.js';
import { quantidade as qtdInv, removerItem as removerInv } from '../systems/inventario.js';
import { tavernScene, getTavernHeight, tryMoveTavern, tavernSaidaBox, tavernBarmanBox, quartoEnterBox, bartenderIntroBox, bartenderVendorBox, bartenderIntroFeita, marcarBartenderIntroFeita, updateTavernNPCs } from '../world/tavern.js';
import { abrirIntroBartender, isIntroBartenderAberta } from '../ui/intro-bartender.js';
import { abrirBartenderShop, isBartenderShopAberta } from '../ui/bartender-shop.js';
import { abrirBruxaArcano, isBruxaArcanoAberto } from '../ui/bruxa-arcano.js';
import { quartoScene, tryMoveQuarto, getQuartoHeight, quartoSaidaBox, updateQuarto, quartoSpawnPos, quartoBauBox, bauQuartoAberto, abrirBauQuarto, bauQuartoColetado, coletarBauQuarto, quartoCamaBox } from '../world/quarto.js';
import { bossDebugScene, bossDebugCamera, updateBossDebug } from '../world/boss-debug-scene.js';
import { curar } from '../systems/player-stats.js';
import { todasZonasLimpas } from '../world/mapa.js';
import { combateScene, updateCombateScene } from '../world/combate-scene.js';
import { skybox, starMat } from '../world/sky.js';
import { renderer, mainCamera, lojaCamera, caseloCamera, tavernCamera, quartoCamera, combateCamera, combateBossCamera } from './renderer.js';
import { isBossMode, precarregarBoss } from '../world/combate-scene.js';
import { keys, registarCallbackInput } from './input.js';
import { pollGamepad, registarCallbacksGamepad } from './gamepad.js';
import { ganharXP, playerStats, recalcularMaxHp, adicionarBonusSantuario } from '../systems/player-stats.js';
import { buildAvatarScene, syncAvatarMaterials, renderAvatarIfDirty, avatarRenderer, avatarScene, avatarCam, showPrompt, hidePrompt } from '../ui/hud.js';
// Para alternar entre as duas UIs de diálogo, trocar este import:
//   '../ui/npc-dialog.js'         → versão original
//   '../ui/npc-dialog-arcano.js'  → versão Arcano (teste)
import { abrirDialogoGuardiao, abrirDialogoGuardiaoCedePassagem, isDialogoAberto } from '../ui/npc-dialog.js';
import { abrirInventario, fecharInventario, isInventarioAberto } from '../ui/inventario-ui.js';
import { abrirLoadoutMenu, fecharLoadoutMenu, isLoadoutMenuAberto, mostrarBotaoLoadout } from '../ui/loadout-menu.js';
import { toggleQuestBook, isQuestBookAberto } from '../ui/quest-book.js';
import { descobrirQuest, completarQuest } from '../systems/quests.js';
import { abrirLockpick, isLockpickAberto } from '../ui/lockpick.js';
import { criarLostItems, updateLostItems, getLostItemAt } from '../world/lost-items.js';
import { coletarItemPerdido, precisaCutsceneEspaco, marcarCutsceneVista, revelarItensEstelares } from '../systems/merchant-fetch-quest.js';
import { initSpaceCutscene, startSpaceCutscene, updateSpaceCutscene, isSpaceCutsceneActive } from '../world/space-quest-cutscene.js';
import { estado, lojaPlayer, caseloPlayer, tavernPlayer, quartoPlayer, setWorldScene, entrarLoja, sairLoja, entrarCaselo, sairCaselo, entrarTavern, sairTavern, entrarQuarto, sairQuarto, fade } from './transicoes.js';
import moderator from '../systems/moderator.js'; // Ativa ferramentas de debug
import { isPauseAberto, togglePause } from '../ui/pause-menu.js';
import { tickFps, setFpsDebugTargets, sampleCullingNow } from '../ui/fps-counter.js';
import { inicializarAudio, switchMusic, getCurrentTrack, playSFX, tocarAtivacaoCristal, saltarParaClimaxMusical, tocarSomAmbienteRio } from '../systems/audio.js';
import { isTelaInicialAberta, updateTitleCamera, titleCamera, onTelaInicialFechar } from '../ui/tela-inicial.js';
import { initNightMode, setNightMode, updateNightMode, pauseNightMode, resumeNightMode, renderNightWorld, resizeNightComposer, isNightInitialized } from '../world/night-mode.js';
import { initWalkDust, updateWalkDust } from '../world/walk-dust.js';
import { settings, onSettingChange } from '../systems/settings.js';
import { dispararTutorial, descartarTutorial, descartarTutorialPorAccao } from '../ui/tutorial.js';

export { ganharXP, playerStats };

// --------------------------------------------------------
// CENA PRINCIPAL
// --------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(settings.nightMode ? 0x020205 : 0x87ceeb);
const clock = new THREE.Clock();

// ---- Céu Estrelado (Skybox Procedural) ----
// skybox e starMat vivem em ../world/sky.js para poderem ser partilhados
// com a cena de combate sem dependências circulares.
scene.add(skybox);
skybox.visible = !!settings.nightMode;

// Toggle DIA/NOITE em tempo real a partir das pills do menu inicial.
// Em modo dia o céu estrelado fica escondido e o fundo passa a azul.
onSettingChange('nightMode', (on) => {
    skybox.visible = !!on;
    if (scene.background?.isColor) scene.background.setHex(on ? 0x020205 : 0x87ceeb);
    // Altura da câmara: 3.8 à noite (mais imersivo), 5.5 de dia (melhor visibilidade)
    _camOffset.y = on ? 3.8 : 5.5;
    // Iluminação mudou: re-bake da shadow map para reflectir o novo cenário.
    renderer.shadowMap.needsUpdate = true;
});

const _camTarget = new THREE.Vector3();
const _camOffset = new THREE.Vector3(0, settings.nightMode ? 3.8 : 5.5, 9.5);
let _prevTodosCheios = false;

// ---- câmara: fade-out de obstáculos entre câmara e player ----
// Atenção: muitas meshes (árvores clonadas do template) partilham o mesmo material.
// Por isso o fade tem de ser POR-MESH: clonamos o material só naquela mesh
// enquanto ela está a tapar, e restauramos quando deixa de tapar.
const _camLook = new THREE.Vector3();
const _camRayDir = new THREE.Vector3();
const _camRaycaster = new THREE.Raycaster();
const FADE_TARGET_OPACITY = 0.25;
const FADE_SPEED = 8;

// ---- frontal culling: esconde objectos atrás da câmara ----
// Tira-os do render E do shadow pass. Trade-off: sombras desaparecem
// quando o objecto que as projecta sai do cone à frente da câmara.
const _camFwd = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _toObj  = new THREE.Vector3();
// Box3 partilhada para queries de colisão de interiores e de interacção
// no mundo. Antes alocavam-se Box3 + 2 Vector3 a cada frame (3× por frame
// só no mundo + 2× por frame em cada interior em movimento) — agora é
// zero-alloc.
const _interactBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
const _colBoxLoja   = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
const _colBoxCaselo = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
// Box3 partilhada pelas animate* dos interiores (loja/caselo/tavern/quarto)
// para a sua AABB de interacção. Só uma cena corre por frame, dá para
// reusar a mesma instância.
const _scenePB = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
// Cores estáticas do brilho pulsante do cristal do boss (no caselo) —
// antes eram alocadas a cada frame.
const _bossCrystalC1 = new THREE.Color(0x220044);
const _bossCrystalC2 = new THREE.Color(0x9933ff);
// dot mínimo para um objecto continuar visível: -0.15 dá um cone de ~107°
// à frente da câmara — margem para os lados sem mostrar nada que esteja
// claramente atrás.
const CULL_DOT_MIN = -0.15;
// objectos a menos de 9 m da câmara ficam sempre visíveis (segurança contra
// pop-in para coisas grandes que estejam parcialmente atrás mas projectem
// pixels no ecrã).
const CULL_NEAR_KEEP_SQ = 81;

// Aplica layer 1 (invisível à main cam, visível à shadow cam) em vez de visible=false.
// Desta forma objetos culled continuam a projectar sombras correctamente.
function _setLayer(obj, inFront) {
    if (obj.userData._culled === !inFront) return;
    obj.userData._culled = !inFront;
    
    // Cache de meshes para evitar traverse recursivo (pesado para o CPU com centenas de árvores)
    if (!obj.userData._meshCache) {
        const meshes = [];
        obj.traverse(c => { if (c.isMesh) meshes.push(c); });
        obj.userData._meshCache = meshes;
    }
    
    const meshes = obj.userData._meshCache;
    for (let i = 0; i < meshes.length; i++) {
        if (inFront) { meshes[i].layers.enable(0); meshes[i].layers.disable(1); }
        else          { meshes[i].layers.disable(0); meshes[i].layers.enable(1); }
    }
}

function _cullBehindCamera(camera) {
    camera.getWorldDirection(_camFwd);
    const cp = camera.position;
    const dotMin = CULL_DOT_MIN;
    const nearSq = CULL_NEAR_KEEP_SQ;

    for (let i = 0; i < cullables.length; i++) {
        const obj = cullables[i];
        
        // Se estiver abaixo do chão, escondemos logo
        if (obj.position.y < -1.0) {
            _setLayer(obj, false);
            continue;
        }

        const center = obj.userData.cullCenter || obj.position;
        _toObj.x = center.x - cp.x;
        _toObj.y = center.y - cp.y;
        _toObj.z = center.z - cp.z;
        
        const d2 = _toObj.x*_toObj.x + _toObj.y*_toObj.y + _toObj.z*_toObj.z;
        if (d2 < nearSq) { _setLayer(obj, true); continue; }
        
        const invD = 1 / Math.sqrt(d2);
        const dot = (_toObj.x * invD * _camFwd.x) + (_toObj.y * invD * _camFwd.y) + (_toObj.z * invD * _camFwd.z);
        _setLayer(obj, dot > dotMin);
    }
}

function _restoreAllCullables() {
    for (let i = 0; i < cullables.length; i++) _setLayer(cullables[i], true);
}
// mesh → { originalMaterial, clonedMaterials: Material[], originalOpacities: number[] }
const _fadedMeshes = new Map();
const _activeFadeMeshes = new Set();
// Cache permanente de materiais transparentes para evitar recompilação de shaders
const _transparentMaterialCache = new Map(); // originalMaterial.uuid -> clonedMaterial(s)

function _getTransparentMaterial(original) {
    const key = Array.isArray(original) ? original.map(m => m.uuid).join('|') : original.uuid;
    if (_transparentMaterialCache.has(key)) return _transparentMaterialCache.get(key);
    
    const origMats = Array.isArray(original) ? original : [original];
    const cloned = origMats.map(m => {
        const c = m.clone();
        c.transparent = true;
        return c;
    });
    const result = Array.isArray(original) ? cloned : cloned[0];
    _transparentMaterialCache.set(key, result);
    return result;
}

function _isPartOfPlayer(obj) {
    while (obj) { if (obj === player) return true; obj = obj.parent; }
    return false;
}

function _fadeMesh(mesh, deltaTime) {
    let entry = _fadedMeshes.get(mesh);
    if (!entry) {
        const original = mesh.material;
        const transparent = _getTransparentMaterial(original);
        mesh.material = transparent;
        
        const origMats = Array.isArray(original) ? original : [original];
        const transMats = Array.isArray(transparent) ? transparent : [transparent];
        
        entry = {
            originalMaterial: original,
            clonedMaterials: transMats,
            originalOpacities: origMats.map(m => m.opacity),
        };
        _fadedMeshes.set(mesh, entry);
    }
    const lerp = Math.min(1, FADE_SPEED * deltaTime);
    for (const m of entry.clonedMaterials) {
        m.opacity += (FADE_TARGET_OPACITY - m.opacity) * lerp;
    }
}

function _restoreMesh(mesh, deltaTime) {
    const entry = _fadedMeshes.get(mesh);
    if (!entry) return;
    const lerp = Math.min(1, FADE_SPEED * deltaTime);
    let done = true;
    for (let i = 0; i < entry.clonedMaterials.length; i++) {
        const target = entry.originalOpacities[i];
        const m = entry.clonedMaterials[i];
        m.opacity += (target - m.opacity) * lerp;
        if (Math.abs(m.opacity - target) > 0.005) done = false;
    }
    if (done) {
        // Restauramos a opacidade exacta para evitar drift
        for (let i = 0; i < entry.clonedMaterials.length; i++) {
            entry.clonedMaterials[i].opacity = entry.originalOpacities[i];
        }
        mesh.material = entry.originalMaterial;
        _fadedMeshes.delete(mesh);
        // NOTA: Não fazemos dispose() do material clonado pois ele está na _transparentMaterialCache
    }
}

// ---- iluminação ----
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

// ---- Sombra fixa cobrindo o mapa todo ----
// Frustum apertado contra mapBounds (-100/100). Resolução adaptativa à
// qualidade — o shadow pass é proporcional a mapSize² × nº objectos.
const SHADOW_SIZE_BY_QUALITY = { baixa: 512, media: 1024, alta: 2048 };
const _shadowSize = SHADOW_SIZE_BY_QUALITY[settings.quality] ?? 1024;
const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(_shadowSize, _shadowSize);
sunLight.shadow.bias = -0.0001;
sunLight.shadow.normalBias = 0.08;
// Frustum APERTADO à volta do player (a câmara de sombra segue-o em
// animateMundo). Antes cobria o mapa inteiro (±105), o que tornava cada
// re-bake brutal; agora só renderiza o que está perto do herói.
sunLight.shadow.camera.near   =   1;
sunLight.shadow.camera.far    = 320;
sunLight.shadow.camera.left   =  -32;
sunLight.shadow.camera.right  =   32;
sunLight.shadow.camera.top    =   32;
sunLight.shadow.camera.bottom =  -32;
// Offset do sol em relação ao player (mantém a MESMA direcção de sombra
// que tinha o sol fixo em (80,120,80) a apontar para a origem).
const _sunOffset = new THREE.Vector3(80, 120, 80);
sunLight.position.set(80, 120, 80);
sunLight.target.position.set(0, 0, 0);
scene.add(sunLight, sunLight.target);
sunLight.shadow.camera.layers.enable(1); // shadow camera vê os objetos culled (layer 1)

// ---- spotlight do jogador (cor oposta ao roxo: amarelo/ouro) ----
// Posicionado muito alto para evitar colisão com o cenário e simular luz orbital
// Penumbra a 1.0 garante um desvanecimento suave do centro para as bordas
const playerSpot = new THREE.SpotLight(0xfff500, 280, 22, 0.32, 1.0, 2.0);
playerSpot.castShadow = true;
// Shadow map de 1024 para melhor precisão nas sombras do herói.
playerSpot.shadow.mapSize.set(1024, 1024);
// Ajuste de bias para evitar "shadow acne" e garantir que a sombra se liga ao pé do herói
playerSpot.shadow.bias = -0.0001; 
playerSpot.shadow.normalBias = 0.05;
// Câmara de sombra ajustada para a altura de 15m
playerSpot.shadow.camera.near = 5;
playerSpot.shadow.camera.far = 25;
playerSpot.shadow.camera.fov = 40;
playerSpot.shadow.camera.layers.enable(1); // Importante: ver objetos na layer 1 para sombras
scene.add(playerSpot, playerSpot.target);

// ---- constantes de movimento ----
const moveSpeed     = 0.12;
const rotationSpeed = 0.2;

// ---- minimapa da loja ----
const LOJA_W = 14, LOJA_D = 12;
const lojaMiniCam = new THREE.OrthographicCamera(
    -LOJA_W/2 - 1, LOJA_W/2 + 1,
     LOJA_D/2 + 1, -LOJA_D/2 - 1,
    0.1, 50
);
lojaMiniCam.position.set(0, 20, 0);
lojaMiniCam.lookAt(0, 0, 0);

// ---- injetar cena do mundo nas transições ----
setWorldScene(scene);

// ---- estado das quests ----
// estados: 'oferecer' (ainda não falou), 'aceite' (em curso), 'completa'
const questAureola = { estado: 'oferecer' };

// ---- sincronizar acessório equipado com o boneco 3D ----
function sincronizarAcessorio() {
    const eq = playerStats.equipped?.acessorio;
    setCoroaVisivel(eq === 'coroa_magica');
    setBrincosVisivel(eq === 'brincos_vida');
    setOculosVisivel(eq === 'oculos_carga');
    setAureolaVisivel(eq === 'aureola_caidos');
    setMascaraVisivel(eq === 'mascara_eclipse');
    setTochaVisivel(playerStats.equipped?.mao === 'tocha');
}
registarOnEquipChange(sincronizarAcessorio);
sincronizarAcessorio();

// ---- toggleMapa / toggleInventario ----
let mapaAberto = false;
registarCallbackInput(
    () => {
        if (estado.cena === 'mundo' && !estadoJogo.emCombate && !isInventarioAberto() && !isPauseAberto() && !isQuestBookAberto() && !isSpaceCutsceneActive()) mapaAberto = !mapaAberto;
    },
    () => {
        // I abre o inventário só fora do combate, sem mapa nem diálogo aberto
        if (estadoJogo.emCombate) return;
        if (mapaAberto || isQuestBookAberto()) return;
        if (isDialogoAberto() || isPauseAberto()) return;
        if (isInventarioAberto()) fecharInventario();
        else abrirInventario();
    },
    (e) => {
        // ESC/P — pausa. Não abre se outra UI sobreposta estiver aberta (deixa-a fechar primeiro)
        if (!isPauseAberto()) {
            if (isInventarioAberto() || isDialogoAberto() || mapaAberto || isLockpickAberto() || isQuestBookAberto()) return;
        }
        if (e) e.stopPropagation?.();
        togglePause();
    },
    () => {
        // B — Diário de Missões
        if (estadoJogo.emCombate || mapaAberto || isInventarioAberto() || isDialogoAberto() || isPauseAberto() || isLockpickAberto()) return;
        toggleQuestBook();
    },
    () => {
        // N — Empunhar/guardar a Tocha do Viajante
        if (estadoJogo.emCombate || isInventarioAberto() || isDialogoAberto() || isPauseAberto() || isLockpickAberto()) return;
        if (!temItem('tocha')) return;
        usarItem('tocha');
    },
    () => {
        // V — Abrir/fechar o menu de equipar ataques (loadout)
        if (estadoJogo.emCombate || isSpaceCutsceneActive()) return;
        if (mapaAberto || isInventarioAberto() || isDialogoAberto() || isPauseAberto() || isLockpickAberto() || isQuestBookAberto() || isBruxaArcanoAberto()) return;
        if (isLoadoutMenuAberto()) fecharLoadoutMenu();
        else abrirLoadoutMenu();
    }
);

// Gamepad: replica os mesmos handlers (mapa, inventário, pausa, etc.).
// Os mesmos guards aplicam-se — o gamepad é só outro driver de input.
registarCallbacksGamepad({
    onToggleMapa: () => {
        if (estado.cena === 'mundo' && !estadoJogo.emCombate && !isInventarioAberto() && !isPauseAberto() && !isQuestBookAberto() && !isSpaceCutsceneActive()) mapaAberto = !mapaAberto;
    },
    onToggleInventario: () => {
        if (estadoJogo.emCombate) return;
        if (mapaAberto || isQuestBookAberto()) return;
        if (isDialogoAberto() || isPauseAberto()) return;
        if (isInventarioAberto()) fecharInventario();
        else abrirInventario();
    },
    onTogglePause: (e) => {
        if (!isPauseAberto()) {
            if (isInventarioAberto() || isDialogoAberto() || mapaAberto || isLockpickAberto() || isQuestBookAberto()) return;
        }
        if (e) e.stopPropagation?.();
        togglePause();
    },
    onToggleQuestBook: () => {
        if (estadoJogo.emCombate || mapaAberto || isInventarioAberto() || isDialogoAberto() || isPauseAberto() || isLockpickAberto()) return;
        toggleQuestBook();
    },
    onToggleTocha: () => {
        if (estadoJogo.emCombate || isInventarioAberto() || isDialogoAberto() || isPauseAberto() || isLockpickAberto()) return;
        if (!temItem('tocha')) return;
        usarItem('tocha');
    },
    onToggleLoadout: () => {
        if (estadoJogo.emCombate || isSpaceCutsceneActive()) return;
        if (mapaAberto || isInventarioAberto() || isDialogoAberto() || isPauseAberto() || isLockpickAberto() || isQuestBookAberto() || isBruxaArcanoAberto()) return;
        if (isLoadoutMenuAberto()) fecharLoadoutMenu();
        else abrirLoadoutMenu();
    },
});

// --------------------------------------------------------
// ÁUDIO (gerido em systems/audio.js)
// --------------------------------------------------------
inicializarAudio(mainCamera, {
    title:   'assets/music/main_tittle.mp3',
    mundo:   'assets/music/tema_mundo.mp3',
    dark:    'assets/music/darkwoods.mp3',
    shop:    'assets/music/shop.mp3',
    tavern:  'assets/music/taverna.mp3',
    batalha: 'assets/music/batalha.mp3',
    castle:  'assets/music/castle.mp3',
    boss:    'assets/music/boss.mp3',
}, {
    fechadura: 'assets/sounds/fechadura.mp3',
    abrir_bau: 'assets/sounds/abrir_bau.mp3',
    trovao:    'assets/sounds/trovao.mp3',
    cristal:   'assets/sounds/cristal.mp3',
    swoosh:    'assets/sounds/swoosh.mp3',
    spike_s:   'assets/sounds/Attacks/boss/spike_s.mp3',
    clock:     'assets/sounds/Attacks/nucleo/clock.mp3',
    transicao_batalha: 'assets/sounds/transicao_batalha.mp3',
    river:     'assets/sounds/amb_river.flac',
    step_grass: 'assets/sounds/footsteps/relva.mp3',
    step_wood:  'assets/sounds/footsteps/wood.mp3',
    step_stone: 'assets/sounds/footsteps/stone.mp3',
});

// --------------------------------------------------------
// COLISÕES INTERIORES
// --------------------------------------------------------
function verificaColisaoLoja(nx, ny, nz) {
    if (moderator.noClip) return false;
    const r = 0.25;
    _colBoxLoja.min.set(nx - r, ny, nz - r);
    _colBoxLoja.max.set(nx + r, ny + 1.7, nz + r);
    for (const c of lojaColliders) { if (_colBoxLoja.intersectsBox(c)) return true; }
    return false;
}

function verificaColisaoCaselo(nx, nz) {
    if (moderator.noClip) return false;
    const r = 0.25;
    _colBoxCaselo.min.set(nx - r, 0, nz - r);
    _colBoxCaselo.max.set(nx + r, 1.7, nz + r);
    for (const c of caseloColliders) { if (_colBoxCaselo.intersectsBox(c)) return true; }
    return false;
}

// --------------------------------------------------------
// LOOPS POR CENA
// --------------------------------------------------------
let _frameCount = 0; // contador global de frames para throttling

// --- BLOB SHADOW DO JOGADOR (Dia / Exterior) ---
// Usamos uma sombra falsa (blob) para o jogador no mundo exterior e 
// congelamos o shadow map do sol! Desta forma, o mapa enorme (com centenas
// de árvores) é renderizado para sombra apenas uma única vez no arranque, 
// poupando massivamente a GPU e devolvendo os FPS na totalidade.
const _blobCanvas = document.createElement('canvas');
_blobCanvas.width = 64; _blobCanvas.height = 64;
const _bctx = _blobCanvas.getContext('2d');
const _bgrad = _bctx.createRadialGradient(32, 32, 0, 32, 32, 32);
_bgrad.addColorStop(0, 'rgba(0,0,0,0.65)');
_bgrad.addColorStop(0.4, 'rgba(0,0,0,0.4)');
_bgrad.addColorStop(1, 'rgba(0,0,0,0)');
_bctx.fillStyle = _bgrad;
_bctx.fillRect(0, 0, 64, 64);
const _blobTex = new THREE.CanvasTexture(_blobCanvas);
const _blobMat = new THREE.MeshBasicMaterial({ 
    map: _blobTex, transparent: true, depthWrite: false
});
const _blobGeo = new THREE.PlaneGeometry(1.6, 1.6);
_blobGeo.rotateX(-Math.PI / 2);
const playerBlobShadow = new THREE.Mesh(_blobGeo, _blobMat);
playerBlobShadow.frustumCulled = false;
scene.add(playerBlobShadow);

function _forceShadowUpdate() {
    renderer.shadowMap.needsUpdate = true;
}

// Re-bake da shadow map do sol só quando vale a pena: se o jogador andou o
// suficiente desde o último bake (o mundo aberto tem centenas de árvores —
// re-renderizar a sombra a cada frame mata os FPS). Em qualidade alta
// exigimos menos distância entre bakes; em baixa, mais.
const _lastShadowPos = new THREE.Vector3(Infinity, Infinity, Infinity);
function _maybeMarkShadowUpdate() {
    // Limiar pequeno → re-bake quase contínuo enquanto o jogador anda
    // (sombra fluida, sem "saltos"); quando está parado a distância é 0 e
    // não gastamos nada.
    const limiar = settings.quality === 'alta' ? 0.25 : 0.7;
    if (_lastShadowPos.distanceToSquared(player.position) >= limiar * limiar) {
        renderer.shadowMap.needsUpdate = true;
        _lastShadowPos.copy(player.position);
    }
}

function animateMundo(deltaTime) {
    let isMoving = false;
    updateNightMode(deltaTime);
    updateWalkDust(deltaTime);

    // Cinemática das amostras estelares — conduz a câmara e bloqueia o
    // controlo do jogador enquanto está activa.
    const emCutscene = isSpaceCutsceneActive();
    if (emCutscene) updateSpaceCutscene(deltaTime, mainCamera);

    // Blob desligado de dia: o jogador agora projecta sombra direccional real
    // (shadow map re-baked por _maybeMarkShadowUpdate). Mantê-lo daria duas
    // sombras sobrepostas. À noite a sombra vem da tocha, por isso fica sempre off.
    playerBlobShadow.position.set(player.position.x, 0.03, player.position.z);
    playerBlobShadow.visible = false;

    // A câmara de sombra do sol segue o player: mantém-no sempre dentro do
    // frustum apertado (±32) para a shadow map ser barata de re-bakar.
    sunLight.target.position.set(player.position.x, 0, player.position.z);
    sunLight.position.set(
        player.position.x + _sunOffset.x,
        _sunOffset.y,
        player.position.z + _sunOffset.z,
    );

    // Partículas roxas das zonas corruptas — animadas no vertex shader.
    // Um único uniform update partilhado por todas as zonas (sem upload de buffer).
    updateZoneParticles(deltaTime);

    // Otimização de sombras: Quando o mapa está aberto, expandimos o frustum
    // para cobrir o mundo inteiro (±105). Caso contrário, seguimos o player (±32).
    const camS = sunLight.shadow.camera;
    const deveSerGlobal = mapaAberto;
    const estavaGlobal = (camS.left === -105);

    if (deveSerGlobal) {
        if (!estavaGlobal) {
            camS.left = camS.bottom = -105;
            camS.right = camS.top = 105;
            camS.updateProjectionMatrix();
            sunLight.target.position.set(0, 0, 0);
            sunLight.position.set(_sunOffset.x, _sunOffset.y, _sunOffset.z);
            renderer.shadowMap.needsUpdate = true; // Bake global uma vez
        }
    } else {
        if (estavaGlobal) {
            camS.left = camS.bottom = -32;
            camS.right = camS.top = 32;
            camS.updateProjectionMatrix();
            renderer.shadowMap.needsUpdate = true; // Bake local imediato ao fechar
        }
        // Seguimento do sol só se o player se mexeu (mesmo limiar do bake para poupar matrix updates)
        const limiar = settings.quality === 'alta' ? 0.25 : 0.7;
        if (_lastShadowPos.distanceToSquared(player.position) >= limiar * limiar) {
            sunLight.target.position.set(player.position.x, 0, player.position.z);
            sunLight.position.set(
                player.position.x + _sunOffset.x,
                _sunOffset.y,
                player.position.z + _sunOffset.z,
            );
        }
    }

    if (!emCutscene && !estadoJogo.emCombate && !mapaAberto && !isDialogoAberto() && !isInventarioAberto() && !isLockpickAberto() && !isBruxaArcanoAberto() && !isLoadoutMenuAberto()) {
        let dirX = 0, dirZ = 0;
        if (keys.w) dirZ -= 1;
        if (keys.s) dirZ += 1;
        if (keys.a) dirX -= 1;
        if (keys.d) dirX += 1;

        if (dirX !== 0 || dirZ !== 0) {
            const estaNaZonaDark = player.position.z < -3;
            const trackDesejada = estaNaZonaDark ? 'dark' : 'mundo';
            const atual = getCurrentTrack();
            if (!atual) switchMusic(trackDesejada);
            else if (atual !== 'shop' && atual !== 'tavern' && atual !== trackDesejada) switchMusic(trackDesejada, 2.0);

            isMoving = true;
            const targetAngle = Math.atan2(dirX, dirZ);
            let diff = targetAngle - player.rotation.y;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff >  Math.PI) diff -= Math.PI * 2;

            const speedMultiplier = 60 * deltaTime;
            player.rotation.y += diff * rotationSpeed * speedMultiplier;

            const len = Math.sqrt(dirX*dirX + dirZ*dirZ);
            const mx = (dirX/len)*moveSpeed * speedMultiplier, mz = (dirZ/len)*moveSpeed * speedMultiplier;
            if (moderator.noClip || !verificaColisao(player.position.x + mx, player.position.z)) player.position.x += mx;
            if (moderator.noClip || !verificaColisao(player.position.x, player.position.z + mz)) player.position.z += mz;
            verificarEncontro(player.position.x, player.position.z);
        }

        const r = 0.25;
        _interactBox.min.set(player.position.x - r, 0, player.position.z - r);
        _interactBox.max.set(player.position.x + r, 1.7, player.position.z + r);
        const pb = _interactBox;
        if (guardianInteractBox && pb.intersectsBox(guardianInteractBox)) {
            const passou = isGuardiaoPassagemConcedida();
            showPrompt('E — Parlamentar com o Guardião');
            if (keys.e) {
                keys.e = false;
                if (!passou && playerStats.level >= 2) {
                    // Nível 2+: o guardião reconhece o poder do jogador e cede passagem.
                    abrirDialogoGuardiaoCedePassagem(() => removerGuardiao());
                } else {
                    abrirDialogoGuardiao(playerStats.level, () => removerGuardiao(), passou);
                }
            }
        } else if (shopDoorInteract && pb.intersectsBox(shopDoorInteract)) {
            if (isShopDesbloqueada() || zonasSulLimpas()) {
                showPrompt('E — Adentrar a Loja');
                if (keys.e) { keys.e = false; switchMusic('shop', 1.0); entrarLoja(); }
            } else { showPrompt('Purificai as zonas fustigadas do sul para adentrar'); }
        } else if (castleEnterBox && pb.intersectsBox(castleEnterBox)) {
            showPrompt('E — Adentrar o Castelo');
            if (keys.e) { keys.e = false; playSFX('trovao'); entrarCaselo(); }
        } else if (tavernEnterBox && pb.intersectsBox(tavernEnterBox)) {
            showPrompt('E — Entrar na Estalagem');
            if (keys.e) { keys.e = false; switchMusic('tavern', 1.0); entrarTavern(); }
        } else if (bruxaInteractBox && pb.intersectsBox(bruxaInteractBox)) {
            showPrompt('E — Parlamentar com a Bruxa');
            if (keys.e) { keys.e = false; abrirBruxaArcano(); }
        } else if (getBauInteractBox() && pb.intersectsBox(getBauInteractBox())) {
            if (!bauJaColetado()) {
                if (!bauJaAberto()) {
                    showPrompt('E — Arrombar a Fechadura');
                    if (keys.e) {
                        keys.e = false;
                        abrirLockpick({
                            onSuccess: () => {
                                if (abrirBau()) playSFX('fechadura');
                            },
                        });
                    }
                } else {
                    showPrompt('E — Reivindicar Espólio');
                    if (keys.e) {
                        keys.e = false;
                        if (coletarBau()) {
                            playSFX('abrir_bau');
                            adicionarItem('coroa_magica', 1);
                            ganharCintilas(40);
                            const item = CATALOGO['coroa_magica'];
                            mostrarRecompensa({
                                icone: item.icone,
                                nome: item.nome,
                                descricao: item.descricao,
                                cintilas: 40,
                            });
                            hidePrompt();
                        }
                    }
                }
            } else { hidePrompt(); }
        } else if (getBauMascaraInteractBox() && pb.intersectsBox(getBauMascaraInteractBox())) {
            if (!bauMascaraJaColetado()) {
                if (!bauMascaraJaAberto()) {
                    showPrompt('E — Arrombar a Fechadura');
                    if (keys.e) {
                        keys.e = false;
                        abrirLockpick({
                            onSuccess: () => {
                                if (abrirBauMascara()) playSFX('fechadura');
                            },
                        });
                    }
                } else {
                    showPrompt('E — Reivindicar Espólio');
                    if (keys.e) {
                        keys.e = false;
                        if (coletarBauMascara()) {
                            playSFX('abrir_bau');
                            adicionarItem('mascara_eclipse', 1);
                            const item = CATALOGO['mascara_eclipse'];
                            mostrarRecompensa({
                                icone: item.icone,
                                nome: item.nome,
                                descricao: item.descricao,
                            });
                            hidePrompt();
                        }
                    }
                }
            } else { hidePrompt(); }
        } else {
            // Santuários — bênção +5 HP máx, uma vez por "dia" (reset ao dormir)
            const santuariosArr = getSantuarios();
            let santuarioAtivo = -1;
            for (let i = 0; i < santuariosArr.length; i++) {
                if (santuariosArr[i].box.intersectsBox(pb)) { santuarioAtivo = i; break; }
            }
            if (santuarioAtivo >= 0 && !santuariosArr[santuarioAtivo].ativado) {
                showPrompt('E — Receber Bênção do Santuário (+5 HP máx)');
                if (keys.e) {
                    keys.e = false;
                    if (ativarSantuario(santuarioAtivo)) {
                        adicionarBonusSantuario(5);
                        playSFX('cristal');
                        hidePrompt();
                        
                        // Mostra popup de recompensa após a animação de burst (2s)
                        setTimeout(() => {
                            mostrarRecompensa({
                                titulo: '⚜ Dádiva Ancestral ⚜',
                                icone: 'assets/icones/Heart.png',
                                nome: 'Bênção de Vigor',
                                descricao: 'O teu espírito fortalece-se (+5 HP máximo permanentemente).',
                                dica: 'A tua alma transborda vitalidade',
                                duracao: 3500
                            });
                        }, 2000);
                    }
                }
            } else {
                const lost = getLostItemAt(pb);
                if (lost) {
                    showPrompt(`E — Recolher ${lost.item.nome}`);
                    if (keys.e) {
                        keys.e = false;
                        if (coletarItemPerdido(lost.id)) {
                            playSFX('abrir_bau');
                            hidePrompt();
                        }
                    }
                } else {
                    const zonaBatalha = zonaBatalhaProximoCentro(player.position.x, player.position.z);
                    if (zonaBatalha) {
                        showPrompt('E — Iniciar Batalha');
                        if (keys.e) {
                            keys.e = false;
                            iniciarCombateEm(player.position.x, player.position.z, zonaBatalha.tipo);
                        }
                    } else {
                        hidePrompt();
                    }
                }
            }
        }
    }

    const currentSurface = getBridgeHeight(player.position.x, player.position.z) > 0 ? 'wood' : 'grass';
    updatePlayerAnimation(isMoving, deltaTime, currentSurface);
    updateCoroaAnimacao(deltaTime);
    updateBau(deltaTime);
    updateBauMascara(deltaTime);
    updateLostItems(deltaTime);
    updateSantuarios(deltaTime);
    updateCogumelos(deltaTime);
    updateVegetacao(deltaTime, player.position);
    updateGuardiao(deltaTime);
    updateBruxaMapa(deltaTime, player.position);
    tocarSomAmbienteRio(player.position.z, 0); // Som dinâmico do rio (Z=0)
    if (!moderator.lockY) {
        player.userData.baseY = getBridgeHeight(player.position.x, player.position.z);
    }

    matWater.uniforms.uTime.value      += deltaTime;
    matBattleGrass.uniforms.uTime.value += deltaTime;
    matCorruptHalo.uniforms.uTime.value += deltaTime;
    const pulse = 0.4 + 0.6*Math.abs(Math.sin(matBattleGrass.uniforms.uTime.value * 1.8));
    matContTrunk.emissiveIntensity  = pulse * 0.7;
    matContLeaves.emissiveIntensity = pulse * 0.9;
    matContRock.emissiveIntensity   = pulse * 0.6;

    if (!moderator.freeCam && !emCutscene) {
        _camTarget.set(player.position.x + _camOffset.x, _camOffset.y, player.position.z + _camOffset.z);
        mainCamera.position.lerp(_camTarget, 1 - Math.pow(0.01, deltaTime));
        mainCamera.lookAt(player.position.x, 1.2, player.position.z);

        // Raycast de fade: throttled a cada 6 frames (10Hz @ 60fps).
        // intersectObjects(fadeables, true) é recursivo sobre centenas de meshes;
        // dura bem entre frames porque o fade em si é interpolado a cada frame.
        if (_frameCount % 6 === 0) {
            _camLook.set(player.position.x, player.position.y + 0.6, player.position.z);
            _camRayDir.subVectors(_camLook, mainCamera.position);
            const dist = _camRayDir.length();
            
            // Só faz raycast se estivermos a uma distância razoável (evita fade massivo 
            // no regresso da free cam distantes).
            if (dist < 25.0) {
                _camRayDir.divideScalar(dist);
                _camRaycaster.set(mainCamera.position, _camRayDir);
                _camRaycaster.far = dist;
                const hits = _camRaycaster.intersectObjects(fadeables, true);
                _activeFadeMeshes.clear();
                for (const hit of hits) {
                    if (_isPartOfPlayer(hit.object)) continue;
                    if (!hit.object.material) continue;
                    _activeFadeMeshes.add(hit.object);
                }
            } else {
                _activeFadeMeshes.clear();
            }
        }

        // Fade aplicado todo frame (smooth), só o raycast é throttled.
        for (const mesh of _activeFadeMeshes) _fadeMesh(mesh, deltaTime);
        for (const mesh of _fadedMeshes.keys()) {
            if (!_activeFadeMeshes.has(mesh)) _restoreMesh(mesh, deltaTime);
        }
    }

    if (mapaAberto) {
        renderizarMinimapa(renderer, scene, window.innerWidth, window.innerHeight, player.position, true);
    } else {
        // Actualizar spotlight (lanterna mágica do herói)
        // Só visível de NOITE no mundo exterior; sempre visível noutras cenas (combate/interiores).
        // playerSpot só em interiores. À noite no mundo é a tocha do herói que ilumina.
        const luzNecessaria = (estado.cena !== 'mundo');
        playerSpot.visible = luzNecessaria;
        if (luzNecessaria) {
            playerSpot.position.set(player.position.x, player.position.y + 15.0, player.position.z);
            playerSpot.target.position.set(player.position.x, player.position.y, player.position.z);
        }

        renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
        // Culling todo o frame — o throttle a cada 2 frames + restore a cada frame
        // fazia o estado dos objectos alternar a 30Hz (mesh pisca → parece sombra a piscar).
        // Durante a cinemática a câmara está alta e fora do enquadramento de
        // jogo normal — não fazemos culling por câmara para nada desaparecer.
        if (emCutscene) _restoreAllCullables();
        else            _cullBehindCamera(mainCamera);
        sampleCullingNow();
        
        // Shadow map: re-bake throttled por distância percorrida (ver
        // _maybeMarkShadowUpdate). Em combate ou com aves no céu, forçamos 
        // fluidez máxima.
        if (estadoJogo.emCombate) {
            renderer.shadowMap.needsUpdate = true;
        } else {
            _maybeMarkShadowUpdate();
        }

        // Modo nocturno usa EffectComposer (bloom + output sRGB). Em
        // qualidade baixa saltamos o composer (mip-chain do bloom é caro).
        if (isNightInitialized() && settings.quality !== 'baixa') {
            renderNightWorld();
        } else {
            renderer.render(scene, mainCamera);
        }

        // Durante a cinemática a HUD inteira é apagada — não renderizar o
        // minimapa nem deixar o seu border aparecer.
        if (emCutscene) {
            const border = document.getElementById('minimap-border');
            if (border) border.style.display = 'none';
        } else {
            renderizarMinimapa(renderer, scene, window.innerWidth, window.innerHeight, player.position, false);
        }
    }
}

function animateLoja(deltaTime) {
    let isMoving = false, dirX = 0, dirZ = 0;
    if (!isInventarioAberto() && !isDialogoMercadorAberto() && !isBruxaArcanoAberto()) {
        if (keys.w) dirZ -= 1; if (keys.s) dirZ += 1;
        if (keys.a) dirX -= 1; if (keys.d) dirX += 1;
    }

    if (dirX !== 0 || dirZ !== 0) {
        isMoving = true;

        // Movimento relativo à câmara
        const cam = moderator.freeCam ? mainCamera : lojaCamera;
        cam.getWorldDirection(_camFwd);
        _camFwd.y = 0;
        _camFwd.normalize();
        _camRight.crossVectors(THREE.Object3D.DEFAULT_UP, _camFwd);

        _moveDir.set(0, 0, 0);
        if (keys.w) _moveDir.add(_camFwd);
        if (keys.s) _moveDir.sub(_camFwd);
        if (keys.a) _moveDir.add(_camRight);
        if (keys.d) _moveDir.sub(_camRight);
        _moveDir.normalize();

        const targetAngle = Math.atan2(_moveDir.x, _moveDir.z);
        let diff = targetAngle - lojaPlayer.rotY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff >  Math.PI) diff -= Math.PI * 2;

        const speedMultiplier = 60 * deltaTime;
        lojaPlayer.rotY += diff * rotationSpeed * speedMultiplier;
        
        const mx = _moveDir.x * moveSpeed * speedMultiplier;
        const mz = _moveDir.z * moveSpeed * speedMultiplier;
        
        // Predição
        const nextX = lojaPlayer.x + mx;
        const nextZ = lojaPlayer.z + mz;

        if (moderator.noClip) {
            lojaPlayer.x = nextX;
            lojaPlayer.z = nextZ;
        } else {
            const cx = lojaPlayer.x, cz = lojaPlayer.z;
            // Tenta diagonal primeiro, depois desliza em cada eixo (X / Z).
            let newY = tryMoveLoja(lojaPlayer.y, nextX, nextZ, cx, cz);
            if (newY !== null) {
                lojaPlayer.x = nextX;
                lojaPlayer.z = nextZ;
                lojaPlayer.y = newY;
            } else if ((newY = tryMoveLoja(lojaPlayer.y, nextX, cz, cx, cz)) !== null) {
                lojaPlayer.x = nextX;
                lojaPlayer.y = newY;
            } else if ((newY = tryMoveLoja(lojaPlayer.y, cx, nextZ, cx, cz)) !== null) {
                lojaPlayer.z = nextZ;
                lojaPlayer.y = newY;
            }
        }
    }

    // Idle grounding (sempre, exceto em noclip): mantém o player assente no terreno.
    // O lockY do moderator não interfere aqui — as fixedHeightZones devem ser autoridade.
    if (!moderator.noClip) {
        const groundY = getLojaHeight(lojaPlayer.x, lojaPlayer.z);
        if (groundY !== null) lojaPlayer.y = groundY;
    }

    const r = 0.25;
    _scenePB.min.set(lojaPlayer.x - r, lojaPlayer.y,        lojaPlayer.z - r);
    _scenePB.max.set(lojaPlayer.x + r, lojaPlayer.y + 1.7,  lojaPlayer.z + r);
    const pb = _scenePB;

    if (lojaSaidaBox.intersectsBox(pb)) {
        showPrompt('E — Deixar a Loja');
        if (keys.e) {
            keys.e = false;
            switchMusic('mundo', 1.0);
            // Ao sair: se a quest da Alice foi aceite e a cinemática ainda
            // não tocou, dispara a chuva de amostras estelares. Os itens só
            // são revelados no fim da cinemática (via callback).
            sairLoja(() => {
                if (precisaCutsceneEspaco()) {
                    marcarCutsceneVista();
                    startSpaceCutscene(() => revelarItensEstelares());
                }
            });
        }
    } else if (getMerchantInteractBox() && pb.intersectsBox(getMerchantInteractBox())) {
        showPrompt('E — Parlamentar com a Mercadora');
        if (keys.e) { keys.e = false; abrirDialogoMercador(); }
    } else if (getBauLojaInteractBox() && pb.intersectsBox(getBauLojaInteractBox())) {
        if (!bauLojaJaColetado()) {
            if (!bauLojaJaAberto()) {
                showPrompt('E — Arrombar Arca Oculta');
                if (keys.e) {
                    keys.e = false;
                    if (abrirBauLoja()) playSFX('fechadura');
                }
            } else {
                showPrompt('E — Reivindicar Espólio');
                if (keys.e) {
                    keys.e = false;
                    if (coletarBauLoja()) {
                        playSFX('abrir_bau');
                        adicionarItem('pocao', 1);
                        ganharCintilas(20);
                        const item = CATALOGO['pocao'];
                        mostrarRecompensa({ icone: item.icone, nome: item.nome, descricao: item.descricao, cintilas: 20 });
                        hidePrompt();
                    }
                }
            }
        } else { hidePrompt(); }
    } else { hidePrompt(); }

    updateBauLoja(deltaTime);
    updateMerchant(deltaTime, lojaPlayer);

    player.position.set(lojaPlayer.x, lojaPlayer.y, lojaPlayer.z);
    player.userData.baseY = lojaPlayer.y;
    player.rotation.y = lojaPlayer.rotY;
    updatePlayerAnimation(isMoving, deltaTime, 'wood');
    updateCoroaAnimacao(deltaTime);

    // Actualizar spotlight (lanterna mágica do herói)
    // Só visível de NOITE no mundo exterior; sempre visível noutras cenas (combate/interiores).
    // playerSpot só em interiores. À noite no mundo é a tocha do herói que ilumina.
    const luzNecessaria = (estado.cena !== 'mundo');
    playerSpot.visible = luzNecessaria;
    if (luzNecessaria) {
        playerSpot.position.set(player.position.x, player.position.y + 15.0, player.position.z);
        playerSpot.target.position.set(player.position.x, player.position.y, player.position.z);
    }

    // Shadow map: throttled por distância (ver _maybeMarkShadowUpdate).
    // A mercadora roda lentamente: forçamos um bake adicional a cada 8
    // frames (~7Hz) para manter a sombra dela actualizada sem custo.
    // No modo ALTO, garantimos fluidez total.
    const shadowThrottle = settings.quality === 'alta' ? 0 : 7;
    if ((_frameCount & shadowThrottle) === 0) renderer.shadowMap.needsUpdate = true;

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(lojaScene, moderator.freeCam ? mainCamera : lojaCamera);

    // Minimapa/bússola só no mundo exterior
    const border = document.getElementById('minimap-border');
    if (border) border.style.display = 'none';
}

function animateCaselo(deltaTime) {
    let isMoving = false, dirX = 0, dirZ = 0;
    if (!isInventarioAberto() && !isLoadoutMenuAberto()) {
        if (keys.w) dirZ -= 1; if (keys.s) dirZ += 1;
        if (keys.a) dirX -= 1; if (keys.d) dirX += 1;
    }

    if (dirX !== 0 || dirZ !== 0) {
        isMoving = true;

        // Movimento relativo à câmara
        const cam = moderator.freeCam ? mainCamera : caseloCamera;
        cam.getWorldDirection(_camFwd);
        _camFwd.y = 0;
        _camFwd.normalize();
        _camRight.crossVectors(THREE.Object3D.DEFAULT_UP, _camFwd);

        _moveDir.set(0, 0, 0);
        if (keys.w) _moveDir.add(_camFwd);
        if (keys.s) _moveDir.sub(_camFwd);
        if (keys.a) _moveDir.add(_camRight);
        if (keys.d) _moveDir.sub(_camRight);
        _moveDir.normalize();

        const targetAngle = Math.atan2(_moveDir.x, _moveDir.z);
        let diff = targetAngle - caseloPlayer.rotY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff >  Math.PI) diff -= Math.PI * 2;

        const speedMultiplier = 60 * deltaTime;
        caseloPlayer.rotY += diff * rotationSpeed * speedMultiplier;
        
        const mx = _moveDir.x * moveSpeed * speedMultiplier;
        const mz = _moveDir.z * moveSpeed * speedMultiplier;
        
        if (!verificaColisaoCaselo(caseloPlayer.x + mx, caseloPlayer.z)) caseloPlayer.x += mx;
        if (!verificaColisaoCaselo(caseloPlayer.x, caseloPlayer.z + mz)) caseloPlayer.z += mz;
    }

    const r2 = 0.25;
    _scenePB.min.set(caseloPlayer.x - r2, caseloPlayer.y,        caseloPlayer.z - r2);
    _scenePB.max.set(caseloPlayer.x + r2, caseloPlayer.y + 1.7,  caseloPlayer.z + r2);
    const pb2 = _scenePB;

    if (caseloSaidaBox.intersectsBox(pb2)) {
        showPrompt('E — Abandonar o Castelo');
        if (keys.e) { keys.e = false; sairCaselo(); }
        if (isPistaAberta()) esconderPista();
    } else if (todosPedestaisCheios() && bossCrystalInteractBox.intersectsBox(pb2)) {
        // só fica accionável depois dos 5 pedestais estarem cheios
        showPrompt('E — Enfrentar o Suserano da Danação');
        if (keys.e) {
            keys.e = false;
            iniciarBossFight();
        }
        if (isPistaAberta()) esconderPista();
    } else {
        // proximidade a um dos pedestais
        const idx = pedestalProximoDe(caseloPlayer.x, caseloPlayer.z);
        if (idx >= 0) {
            const ped = PEDESTAIS[idx];
            if (ped.placed) {
                showPrompt(`✦ ${CATALOGO[ped.itemId]?.nome || 'Item'} já colocado`);
                if (isPistaAberta()) esconderPista();
            } else if (ped.itemId && qtdInv(ped.itemId) > 0) {
                showPrompt(`E — Colocar ${CATALOGO[ped.itemId].nome}`);
                if (keys.e) {
                    keys.e = false;
                    if (colocarItemPedestal(idx)) {
                        completarQuest(ped.itemId);
                        // Recompensa em cintilas por restituir cada artefacto à
                        // sua runa. Calibrado para que, somado às restantes
                        // quests e combates, dê para mestrar todos os ataques
                        // da loja (ver análise de balanceamento).
                        const RECOMPENSA_PEDESTAL = {
                            coroa_magica:   70,
                            brincos_vida:   70,
                            oculos_carga:   75,
                            mascara_eclipse: 70,
                            aureola_caidos: 90,
                        };
                        const premioPedestal = RECOMPENSA_PEDESTAL[ped.itemId] || 0;
                        if (premioPedestal > 0) ganharCintilas(premioPedestal);
                        removerInv(ped.itemId, 1);
                        // se o item estava equipado, desequipa-o
                        if (playerStats.equipped?.acessorio === ped.itemId) {
                            playerStats.equipped.acessorio = null;
                            recalcularMaxHp();
                            sincronizarAcessorio();
                        }
                        // Empurra o jogador para fora do círculo (o pilar tem
                        // agora colisão, mas evita que fique encavalitado).
                        const [px, pz] = ped.pos;
                        const dx = caseloPlayer.x - px;
                        const dz = caseloPlayer.z - pz;
                        const d = Math.hypot(dx, dz) || 1;
                        const empurraoDist = 0.95;     // sai do raio da coluna (0.45) + folga
                        caseloPlayer.x = px + (dx / d) * empurraoDist;
                        caseloPlayer.z = pz + (dz / d) * empurraoDist;
                        esconderPista();
                        playSFX('fechadura');
                        if (todosPedestaisCheios()) {
                            mostrarPista('As cinco runas estão completas. O cristal pulsa — aproximai-vos e premei E quando estiverdes pronto.');
                        }
                    }
                }
            } else {
                // sem o item ou pedestal por revelar → mostra a pista
                showPrompt('E — Perscrutar a Runa');
                if (keys.e) {
                    keys.e = false;
                    if (ped.itemId) descobrirQuest(ped.itemId);
                    mostrarPista(ped.pista);
                }
            }
        } else {
            hidePrompt();
            if (isPistaAberta()) esconderPista();
        }
    }

    atualizarPedestais(deltaTime);
    atualizarAtmosferaCastelo(deltaTime);

    const cheios = todosPedestaisCheios();
    if (cheios && !_prevTodosCheios) {
        tocarAtivacaoCristal();
        // Salta para a marca de 1 minuto da música atual (seção épica)
        saltarParaClimaxMusical();
        // Pré-carrega o boss agora que o jogador acaba de cumprir o ritual.
        // A batalha arranca quando ele interagir com o cristal — temos esses
        // segundos para fazer o upload das ~24 texturas + meshes sem hitch.
        precarregarBoss();
    }
    _prevTodosCheios = cheios;

    // A rotação e posição Y do bossCrystal são agora geridas em castelo.js (atualizarPedestais)
    // para estarem sincronizadas com a corrupção e as partículas.
    // Apenas mantemos aqui o brilho pulsante quando ativado.
    if (cheios) {
        // Escurece a cor base
        bossCrystal.material.color.setHex(0x0a001a);
        
        // Transição progressiva e lenta (1 segundo para mudar de cor = ciclo de 2s)
        const glow = Math.sin(performance.now() * 0.001 * Math.PI) * 0.5 + 0.5; 
        bossCrystal.material.emissiveIntensity = 2.5 + glow * 4.5; // Brilho mais forte no pico
        
        bossCrystal.material.emissive.copy(_bossCrystalC1).lerp(_bossCrystalC2, glow);
    } else {
        bossCrystal.material.color.setHex(0x8844ff);
        bossCrystal.material.emissive.setHex(0x4400aa);
        bossCrystal.material.emissiveIntensity = 1.8;
    }

    player.position.set(caseloPlayer.x, caseloPlayer.y, caseloPlayer.z);
    if (!moderator.lockY) player.userData.baseY = caseloPlayer.y;
    player.rotation.y = caseloPlayer.rotY;
    updatePlayerAnimation(isMoving, deltaTime, 'stone');
    updateCoroaAnimacao(deltaTime);

    // anima o shader de corrupção da abóbada do castelo
    matBattleSky.uniforms.uTime.value += deltaTime;

    // Actualizar spotlight (lanterna mágica do herói)
    // Só visível de NOITE no mundo exterior; sempre visível noutras cenas (combate/interiores).
    // playerSpot só em interiores. À noite no mundo é a tocha do herói que ilumina.
    const luzNecessaria = (estado.cena !== 'mundo');
    playerSpot.visible = luzNecessaria;
    if (luzNecessaria) {
        playerSpot.position.set(player.position.x, player.position.y + 15.0, player.position.z);
        playerSpot.target.position.set(player.position.x, player.position.y, player.position.z);
    }

    // Shadow map: throttled por distância. O castelo tem efeitos atmosféricos
    // contínuos (pulsar do cristal) que beneficiam de um refresh periódico.
    const shadowThrottle = settings.quality === 'alta' ? 0 : 7;
    if ((_frameCount & shadowThrottle) === 0) renderer.shadowMap.needsUpdate = true;

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(caseloScene, moderator.freeCam ? mainCamera : caseloCamera);

    // Minimapa/bússola só no mundo exterior
    const border = document.getElementById('minimap-border');
    if (border) border.style.display = 'none';
}

function animateTavern(deltaTime) {
    let isMoving = false, dirX = 0, dirZ = 0;
    if (!isInventarioAberto() && !isIntroBartenderAberta() && !isBartenderShopAberta()) {
        if (keys.w) dirZ -= 1; if (keys.s) dirZ += 1;
        if (keys.a) dirX -= 1; if (keys.d) dirX += 1;
    }

    if (dirX !== 0 || dirZ !== 0) {
        isMoving = true;

        // Movimento relativo à câmara
        const cam = moderator.freeCam ? mainCamera : tavernCamera;
        cam.getWorldDirection(_camFwd);
        _camFwd.y = 0;
        _camFwd.normalize();
        _camRight.crossVectors(THREE.Object3D.DEFAULT_UP, _camFwd);

        _moveDir.set(0, 0, 0);
        if (keys.w) _moveDir.add(_camFwd);
        if (keys.s) _moveDir.sub(_camFwd);
        if (keys.a) _moveDir.add(_camRight);
        if (keys.d) _moveDir.sub(_camRight);
        _moveDir.normalize();

        const targetAngle = Math.atan2(_moveDir.x, _moveDir.z);
        let diff = targetAngle - tavernPlayer.rotY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff >  Math.PI) diff -= Math.PI * 2;

        const speedMultiplier = 60 * deltaTime;
        tavernPlayer.rotY += diff * rotationSpeed * speedMultiplier;
        
        const mx = _moveDir.x * moveSpeed * speedMultiplier;
        const mz = _moveDir.z * moveSpeed * speedMultiplier;

        const nextX = tavernPlayer.x + mx;
        const nextZ = tavernPlayer.z + mz;

        if (moderator.noClip) {
            tavernPlayer.x = nextX;
            tavernPlayer.z = nextZ;
        } else {
            const newY = tryMoveTavern(tavernPlayer.y, nextX, nextZ);
            if (newY !== null) {
                tavernPlayer.x = nextX;
                tavernPlayer.z = nextZ;
                tavernPlayer.y = newY;
            }
        }
    }

    // grounding contínuo
    if (!moderator.noClip) {
        const groundY = getTavernHeight(tavernPlayer.x, tavernPlayer.z);
        if (groundY !== null) tavernPlayer.y = groundY;
    }

    const r = 0.25;
    _scenePB.min.set(tavernPlayer.x - r, tavernPlayer.y,        tavernPlayer.z - r);
    _scenePB.max.set(tavernPlayer.x + r, tavernPlayer.y + 1.7,  tavernPlayer.z + r);
    const pb = _scenePB;

    // bloqueia movimento/interacções enquanto a intro do bartender está aberta
    // Intro do bartender — mandatória na primeira entrada na taverna.
    // Não depende de posição: assim que estás na cena 'tavern' com a intro
    // ainda por fazer, abre-se. Evita o caso em que o shadow map re-bake no regresso do
    // quarto cai dentro do quartoEnterBox e o jogador, virado a sul, sai
    // da bartenderIntroBox antes do per-frame check apanhar.
    if (!bartenderIntroFeita() && !isIntroBartenderAberta() && !isBartenderShopAberta()) {
        abrirIntroBartender(() => {
            marcarBartenderIntroFeita();
            mostrarPista('O taberneiro retirou-se para o seu recanto da estalagem. Procurai-o se precisardes de elixires ou golpes.');
            // Falaste com o taberneiro → ensina a empunhar a tocha (tecla N).
            dispararTutorial('tocha');
        });
        hidePrompt();
    } else if (isIntroBartenderAberta() || isBartenderShopAberta()) {
        hidePrompt();
    } else if (tavernSaidaBox.intersectsBox(pb)) {
        showPrompt('E — Deixar a Estalagem');
        if (keys.e) { keys.e = false; switchMusic('mundo', 1.0); sairTavern(); }
        if (isPistaAberta()) esconderPista();
    } else if (quartoEnterBox && quartoEnterBox.intersectsBox(pb)) {
        showPrompt('E — Ascender aos Aposentos');
        if (keys.e) { keys.e = false; entrarQuarto(); }
        if (isPistaAberta()) esconderPista();
    } else if (bartenderIntroFeita() && bartenderVendorBox.intersectsBox(pb)) {
        showPrompt('E — Parlamentar com o Taberneiro');
        if (keys.e) {
            keys.e = false;
            abrirBartenderShop();
        }
        if (isPistaAberta()) esconderPista();
    } else if (tavernBarmanBox.intersectsBox(pb)) {
        // ---- Quest do estalajadeiro: Auréola dos Caídos ----
        if (questAureola.estado === 'completa') {
            showPrompt('✦ Estalajadeiro: "Que a tua luz nunca se apague."');
            if (isPistaAberta()) esconderPista();
        } else if (questAureola.estado === 'aceite') {
            if (todasZonasLimpas()) {
                showPrompt('E — Reivindicar Espólio');
                if (keys.e) {
                    keys.e = false;
                    questAureola.estado = 'completa';
                    adicionarItem('aureola_caidos', 1);
                    const it = CATALOGO['aureola_caidos'];
                    mostrarRecompensa({ icone: it.icone, nome: it.nome, descricao: it.descricao });
                    esconderPista();
                }
            } else {
                showPrompt('E — Parlamentar com o Estalajadeiro');
                if (keys.e) {
                    keys.e = false;
                    mostrarPista('Estalajadeiro: "Ainda restam sombras lá fora. Limpai-as todas, e depois regressai — guardo-vos a auréola."');
                }
            }
        } else {
            showPrompt('E — Parlamentar com o Estalajadeiro');
            if (keys.e) {
                keys.e = false;
                questAureola.estado = 'aceite';
                mostrarPista('Estalajadeiro: "Estas terras choram pelos caídos. Limpa todas as zonas corruptas do mapa e a Auréola dos Caídos será tua."');
            }
        }
    } else {
        hidePrompt();
        if (isPistaAberta()) esconderPista();
    }

    player.position.set(tavernPlayer.x, tavernPlayer.y, tavernPlayer.z);
    player.userData.baseY = tavernPlayer.y;
    player.rotation.y = tavernPlayer.rotY;
    updatePlayerAnimation(isMoving, deltaTime, 'stone');
    updateCoroaAnimacao(deltaTime);

    updateMerchant(deltaTime, player.position);

    // Actualizar spotlight na loja
    playerSpot.position.set(player.position.x, player.position.y + 15.0, player.position.z);
    playerSpot.target.position.set(player.position.x, player.position.y, player.position.z);

    // Actualizar spotlight (lanterna mágica do herói)
    // Só visível de NOITE no mundo exterior; sempre visível noutras cenas (combate/interiores).
    // playerSpot só em interiores. À noite no mundo é a tocha do herói que ilumina.
    const luzNecessaria = (estado.cena !== 'mundo');
    playerSpot.visible = luzNecessaria;
    if (luzNecessaria) {
        playerSpot.position.set(player.position.x, player.position.y + 15.0, player.position.z);
        playerSpot.target.position.set(player.position.x, player.position.y, player.position.z);
    }

    // Shadow map: throttled. NPCs da taverna mexem-se devagar — um refresh
    // periódico (8 em 8 frames) chega para os acompanhar.
    // No modo ALTO, garantimos fluidez total.
    const shadowThrottle = settings.quality === 'alta' ? 0 : 7;
    if ((_frameCount & shadowThrottle) === 0) renderer.shadowMap.needsUpdate = true;

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);

    renderer.setScissorTest(false);
    renderer.render(tavernScene, moderator.freeCam ? mainCamera : tavernCamera);

    // Minimapa/bússola só no mundo exterior
    const border = document.getElementById('minimap-border');
    if (border) border.style.display = 'none';
}

function animateQuarto(deltaTime) {
    let isMoving = false, dirX = 0, dirZ = 0;
    if (!isInventarioAberto()) {
        if (keys.w) dirZ -= 1; if (keys.s) dirZ += 1;
        if (keys.a) dirX -= 1; if (keys.d) dirX += 1;
    }

    if (dirX !== 0 || dirZ !== 0) {
        isMoving = true;

        const cam = moderator.freeCam ? mainCamera : quartoCamera;
        cam.getWorldDirection(_camFwd);
        _camFwd.y = 0; _camFwd.normalize();
        _camRight.crossVectors(THREE.Object3D.DEFAULT_UP, _camFwd);

        _moveDir.set(0, 0, 0);
        if (keys.w) _moveDir.add(_camFwd);
        if (keys.s) _moveDir.sub(_camFwd);
        if (keys.a) _moveDir.add(_camRight);
        if (keys.d) _moveDir.sub(_camRight);
        _moveDir.normalize();

        const targetAngle = Math.atan2(_moveDir.x, _moveDir.z);
        let diff = targetAngle - quartoPlayer.rotY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff >  Math.PI) diff -= Math.PI * 2;

        const speedMultiplier = 60 * deltaTime;
        quartoPlayer.rotY += diff * rotationSpeed * speedMultiplier;

        const mx = _moveDir.x * moveSpeed * speedMultiplier;
        const mz = _moveDir.z * moveSpeed * speedMultiplier;

        const nextX = quartoPlayer.x + mx;
        const nextZ = quartoPlayer.z + mz;

        if (moderator.noClip) {
            quartoPlayer.x = nextX;
            quartoPlayer.z = nextZ;
        } else {
            const newY = tryMoveQuarto(quartoPlayer.y, nextX, nextZ);
            if (newY !== null) {
                quartoPlayer.x = nextX;
                quartoPlayer.z = nextZ;
                quartoPlayer.y = newY;
            } else {
                // tenta deslizar por um eixo
                const nyx = tryMoveQuarto(quartoPlayer.y, nextX, quartoPlayer.z);
                if (nyx !== null) { quartoPlayer.x = nextX; quartoPlayer.y = nyx; }
                else {
                    const nyz = tryMoveQuarto(quartoPlayer.y, quartoPlayer.x, nextZ);
                    if (nyz !== null) { quartoPlayer.z = nextZ; quartoPlayer.y = nyz; }
                }
            }
        }
    }

    if (!moderator.noClip) {
        quartoPlayer.y = getQuartoHeight(quartoPlayer.x, quartoPlayer.z);
    }

    const r = 0.25;
    _scenePB.min.set(quartoPlayer.x - r, quartoPlayer.y,       quartoPlayer.z - r);
    _scenePB.max.set(quartoPlayer.x + r, quartoPlayer.y + 1.7, quartoPlayer.z + r);
    const pb = _scenePB;

    if (quartoSaidaBox.intersectsBox(pb)) {
        showPrompt('E — Regressar à Estalagem');
        if (keys.e) { keys.e = false; sairQuarto(); }
    } else if (quartoBauBox && quartoBauBox.intersectsBox(pb) && !bauQuartoColetado()) {
        if (!bauQuartoAberto()) {
            showPrompt('E — Abrir a Arca');
            if (keys.e) {
                keys.e = false;
                abrirBauQuarto();
                playSFX('fechadura');
            }
        } else {
            showPrompt('E — Reivindicar Espólio');
            if (keys.e) {
                keys.e = false;
                if (coletarBauQuarto()) {
                    playSFX('abrir_bau');
                    // elixires iniciais — agora vêm daqui
                    adicionarItem('pocao', 3);
                    adicionarItem('mega', 1);
                    mostrarRecompensa({
                        icone: 'assets/icones/big_potion.png',
                        nome: 'Poção Lunar',
                        descricao: '×3 Elixir de Cura  +  ×1 Elixir Maior',
                    });
                    hidePrompt();
                }
            }
        }
    } else if (quartoCamaBox && quartoCamaBox.intersectsBox(pb)) {
        showPrompt('E — Repousar (as trevas recrudescerão)');
        if (keys.e) {
            keys.e = false;
            estado.ePressBloqueado = true;
            hidePrompt();
            fade(1, () => {
                const n = resetZonasBatalha();
                curar(9999); // dormir cura totalmente
                fade(0, () => { estado.ePressBloqueado = false; });
                mostrarPista(n > 0
                    ? `Repousastes. ${n} zona${n>1?'s':''} corrupta${n>1?'s':''} voltaram a manifestar-se.`
                    : 'Repousastes. Vitalidade totalmente recuperada.');
            });
        }
    } else {
        hidePrompt();
    }

    player.position.set(quartoPlayer.x, quartoPlayer.y, quartoPlayer.z);
    player.userData.baseY = quartoPlayer.y;
    player.rotation.y = quartoPlayer.rotY;
    updatePlayerAnimation(isMoving, deltaTime, 'wood');
    updateCoroaAnimacao(deltaTime);

    updateQuarto(deltaTime);

    // Actualizar spotlight no quarto
    playerSpot.position.set(player.position.x, player.position.y + 15.0, player.position.z);
    playerSpot.target.position.set(player.position.x, player.position.y, player.position.z);

    // Actualizar spotlight (lanterna mágica do herói)
    // Só visível de NOITE no mundo exterior; sempre visível noutras cenas (combate/interiores).
    // playerSpot só em interiores. À noite no mundo é a tocha do herói que ilumina.
    const luzNecessaria = (estado.cena !== 'mundo');
    playerSpot.visible = luzNecessaria;
    if (luzNecessaria) {
        playerSpot.position.set(player.position.x, player.position.y + 15.0, player.position.z);
        playerSpot.target.position.set(player.position.x, player.position.y, player.position.z);
    }

    // Shadow map: throttled por distância (quarto pequeno e quase estático).
    // No modo ALTO, garantimos fluidez total.
    const shadowThrottle = settings.quality === 'alta' ? 0 : 15;
    if ((_frameCount & shadowThrottle) === 0) renderer.shadowMap.needsUpdate = true;

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(quartoScene, moderator.freeCam ? mainCamera : quartoCamera);

    const border = document.getElementById('minimap-border');
    if (border) border.style.display = 'none';
}

function animateCombate(deltaTime) {
    // sem WASD nem colisões — combate é controlado pela UI (botões).
    // No boss fight, no entanto, o jogador usa WASD para se desviar dos
    // ataques do boss enquanto escolhe na UI.
    atualizarFaseDesvio(deltaTime);
    // animação dos passos só faz sentido quando o player se mexe activamente
    updatePlayerAnimation(false, deltaTime);
    updateCoroaAnimacao(deltaTime);
    updateCombateScene(deltaTime);

    // esconde o minimapa enquanto se está em combate
    const border = document.getElementById('minimap-border');
    if (border) border.style.display = 'none';

    // Actualizar spotlight (lanterna mágica do herói)
    // Só visível de NOITE no mundo exterior; sempre visível noutras cenas (combate/interiores).
    // playerSpot só em interiores. À noite no mundo é a tocha do herói que ilumina.
    const luzNecessaria = (estado.cena !== 'mundo');
    playerSpot.visible = luzNecessaria;
    if (luzNecessaria) {
        playerSpot.position.set(player.position.x, player.position.y + 15.0, player.position.z);
        playerSpot.target.position.set(player.position.x, player.position.y, player.position.z);
    }

    // No modo ALTO, as sombras do combate (movimento do boss/player) devem ser a 60fps
    if (settings.quality === 'alta') {
        renderer.shadowMap.needsUpdate = true;
    } else if ((_frameCount & 7) === 0) {
        renderer.shadowMap.needsUpdate = true;
    }

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    const camCombate = isBossMode() ? combateBossCamera : combateCamera;
    renderer.render(combateScene, moderator.freeCam ? mainCamera : camCombate);
}

function animateBossDebug(deltaTime) {
    updateBossDebug(deltaTime);
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(bossDebugScene, moderator.freeCam ? mainCamera : bossDebugCamera);
}

// --- LOGICA DE RENDERIZAÇÃO ---

function _updatePlayerSpot() {
    // Só visível de NOITE no mundo exterior; sempre visível noutras cenas (combate/interiores).
    // playerSpot só em interiores. À noite no mundo é a tocha do herói que ilumina.
    const luzNecessaria = (estado.cena !== 'mundo');
    playerSpot.visible = luzNecessaria;
    if (luzNecessaria) {
        playerSpot.position.set(player.position.x, player.position.y + 15.0, player.position.z);
        playerSpot.target.position.set(player.position.x, player.position.y, player.position.z);
    }
}

let _prevCena = null;
let _lastFrameTime = performance.now();
function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const maxFpsMs = 1000 / (settings.maxFps || 60);
    const elapsedMs = now - _lastFrameTime;

    if (elapsedMs < maxFpsMs) {
        return;
    }

    _lastFrameTime = now - (elapsedMs % maxFpsMs);
    _frameCount++;
    let deltaTime = Math.min(elapsedMs / 1000, 0.033);
    tickFps();

    pollGamepad();

    // As dicas de tutorial fecham assim que a respectiva acção é usada.
    // `keys` reflecte teclado e comando, por isso cobre ambos os inputs.
    if (keys.w || keys.a || keys.s || keys.d) descartarTutorialPorAccao('mover');
    if (keys.n) descartarTutorialPorAccao('tocha');
    if (keys.i || keys.e) descartarTutorialPorAccao('inventario');
    if (keys.v) descartarTutorialPorAccao('arsenal');

    starMat.uniforms.uTime.value += deltaTime;

    mostrarBotaoLoadout(!estadoJogo.emCombate && !isSpaceCutsceneActive());
    if (estado.cena !== _prevCena) {
        if (estado.cena === 'mundo') {
            resumeNightMode();
            if (settings.nightMode) setNightMode(true);
            // Primeira vez no mundo aberto → dica (fixa) de como abrir a bolsa.
            dispararTutorial('inventario');
        } else if (_prevCena === 'mundo') {
            pauseNightMode();
        }
        _prevCena = estado.cena;
        _forceShadowUpdate();
        playerSpot.castShadow = (estado.cena !== 'mundo');
    }

    // TELA INICIAL
    if (isTelaInicialAberta()) {
        updateTitleCamera(deltaTime);
        matWater.uniforms.uTime.value      += deltaTime;
        matBattleGrass.uniforms.uTime.value += deltaTime;
        matCorruptHalo.uniforms.uTime.value += deltaTime;
        _updatePlayerSpot();
        renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
        renderer.setScissorTest(false);
        renderer.clear();
        renderer.render(scene, titleCamera);
        return;
    }

    if (isPauseAberto()) deltaTime = 0;

    buildAvatarScene();
    syncAvatarMaterials();

    if (moderator.freeCam && moderator.controls) {
        moderator.controls.update();
    }

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.clear();

    // Minimapa/bússola
    {
        const border = document.getElementById('minimap-border');
        if (border) {
            const queremos = (estado.cena === 'mundo' && !isSpaceCutsceneActive()) ? 'block' : 'none';
            if (border.style.display !== queremos) border.style.display = queremos;
        }
    }

    _updatePlayerSpot();

    if (isPauseAberto()) {
        if (estado.cena === 'mundo')        renderer.render(scene, mainCamera);
        else if (estado.cena === 'loja')    renderer.render(lojaScene, lojaCamera);
        else if (estado.cena === 'caselo')  renderer.render(caseloScene, caseloCamera);
        else if (estado.cena === 'tavern')  renderer.render(tavernScene, tavernCamera);
        else if (estado.cena === 'quarto')  renderer.render(quartoScene, quartoCamera);
        else if (estado.cena === 'combate') renderer.render(combateScene, isBossMode() ? combateBossCamera : combateCamera);
        else if (estado.cena === 'boss_debug') renderer.render(bossDebugScene, bossDebugCamera);
    } else {
        if (estado.cena === 'mundo')        animateMundo(deltaTime);
        else if (estado.cena === 'loja')    animateLoja(deltaTime);
        else if (estado.cena === 'caselo')  animateCaselo(deltaTime);
        else if (estado.cena === 'tavern')  animateTavern(deltaTime);
        else if (estado.cena === 'quarto')  animateQuarto(deltaTime);
        else if (estado.cena === 'combate') animateCombate(deltaTime);
        else if (estado.cena === 'boss_debug') animateBossDebug(deltaTime);
    }

    renderAvatarIfDirty();

    keys.e = false;
    keys.i = false;
    keys.b = false;
    keys.m = false;
    keys.n = false;
    keys.v = false;
    keys.p = false;
}

criarMapa(scene);
criarLostItems(scene);

// Rasto de poeira do jogador — corre no mundo exterior tanto de dia
// como de noite (independente do módulo nocturno).
initWalkDust(scene, player);

// Cinemática da chuva de amostras estelares (quest da Alice).
initSpaceCutscene(scene, player);

// (a inicialização do modo nocturno é deferida — ver onTelaInicialFechar
// mais abaixo. Permite que a escolha das pills DIA/NOITE no menu inicial
// tenha efeito sem reload.)

// O jogador arranca sempre no quarto inicial
quartoScene.add(player);
quartoPlayer.x = quartoSpawnPos.x;
quartoPlayer.y = quartoSpawnPos.y;
quartoPlayer.z = quartoSpawnPos.z;
quartoPlayer.rotY = Math.PI; // virado para a cama (norte)
player.position.set(quartoSpawnPos.x, quartoSpawnPos.y, quartoSpawnPos.z);
player.rotation.y = quartoPlayer.rotY;

// ao fechar a tela inicial: a escolha de DIA/NOITE foi feita nas pills do
// menu — lemos settings.nightMode AGORA (não no module load) para que o
// toggle tenha efeito sem precisar de recarregar a página.
onTelaInicialFechar(() => {
    // Primeira dica: como andar. Aparece nos aposentos, no canto superior.
    dispararTutorial('movimento');

    if (settings.nightMode && !isNightInitialized()) {
        initNightMode(scene, sunLight, ambientLight, player, mainCamera, renderer);
        setNightMode(true);
    } else if (!settings.nightMode) {
        // Modo dia — o fundo do menu (preto espacial 0x020205) tem de dar
        // lugar ao azul-céu do mundo aberto agora que o jogo arranca.
        if (scene.background?.isColor) scene.background.setHex(0x87ceeb);
    }
});

// Debug do contador FPS: regista a scene principal + câmara do mundo para
// que o overlay calcule vis/cull. (Outras cenas dão valores aproximados.)
setFpsDebugTargets(scene, mainCamera);

animate();
