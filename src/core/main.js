import * as THREE from 'three';
import { criarMapa, verificaColisao, shopDoorInteract, castleEnterBox, tavernEnterBox, guardianInteractBox, removerGuardiao, updateGuardiao, isGuardiaoPassagemConcedida, matWater, matBattleGrass, matBattleSky, matCorruptHalo, matContTrunk, matContLeaves, matContRock, zonasSulLimpas, isShopDesbloqueada, resetZonasBatalha, getBridgeHeight, getBauInteractBox, abrirBau, bauJaAberto, updateBau, bauJaColetado, coletarBau, getBauMascaraInteractBox, abrirBauMascara, bauMascaraJaAberto, updateBauMascara, bauMascaraJaColetado, coletarBauMascara, fadeables, cullables } from '../world/mapa.js';
import { player, updatePlayerAnimation, setCoroaVisivel, setBrincosVisivel, setOculosVisivel, setAureolaVisivel, setMascaraVisivel, updateCoroaAnimacao } from '../entities/jogador.js';
import { adicionarItem, registarOnEquipChange, CATALOGO } from '../systems/inventario.js';
import { ganharCintilas } from '../systems/currency.js';
import { mostrarRecompensa } from '../ui/popup-recompensa.js';
import { verificarEncontro, estadoJogo, zonaBatalhaProximoCentro, iniciarCombateEm, iniciarBossFight } from '../systems/combate.js';
import { atualizarFaseDesvio } from '../systems/boss-attacks.js';
import { renderizarMinimapa } from '../world/minimapa.js';
import { lojaScene, lojaColliders, lojaSaidaBox, getLojaHeight, tryMoveLoja, getBauLojaInteractBox, bauLojaJaAberto, bauLojaJaColetado, abrirBauLoja, coletarBauLoja, updateBauLoja, getMerchantInteractBox, updateMerchant } from '../world/loja.js';
import { abrirDialogoMercador, isDialogoMercadorAberto } from '../ui/merchant-dialog.js';
import { caseloScene, caseloColliders, caseloSaidaBox, caseloMiniCam, bossCrystal, bossCrystalInteractBox, PEDESTAIS, pedestalProximoDe, colocarItemPedestal, todosPedestaisCheios, atualizarPedestais } from '../world/castelo.js';
import { mostrarPista, esconderPista, isPistaAberta } from '../ui/pista-popup.js';
import { quantidade as qtdInv, removerItem as removerInv } from '../systems/inventario.js';
import { tavernScene, getTavernHeight, tryMoveTavern, tavernSaidaBox, tavernBarmanBox, quartoEnterBox, bartenderIntroBox, bartenderVendorBox, bartenderIntroFeita, marcarBartenderIntroFeita, updateTavernNPCs } from '../world/tavern.js';
import { abrirIntroBartender, isIntroBartenderAberta } from '../ui/intro-bartender.js';
import { abrirBartenderShop, isBartenderShopAberta } from '../ui/bartender-shop.js';
import { quartoScene, tryMoveQuarto, getQuartoHeight, quartoSaidaBox, updateQuarto, quartoSpawnPos, quartoBauBox, bauQuartoAberto, abrirBauQuarto, quartoCamaBox } from '../world/quarto.js';
import { curar } from '../systems/player-stats.js';
import { todasZonasLimpas } from '../world/mapa.js';
import { combateScene, updateCombateScene } from '../world/combate-scene.js';
import { renderer, mainCamera, lojaCamera, caseloCamera, tavernCamera, quartoCamera, combateCamera, combateBossCamera } from './renderer.js';
import { isBossMode } from '../world/combate-scene.js';
import { keys, registarCallbackInput } from './input.js';
import { ganharXP, playerStats, recalcularMaxHp } from '../systems/player-stats.js';
import { buildAvatarScene, syncAvatarMaterials, avatarRenderer, avatarScene, avatarCam, showPrompt, hidePrompt } from '../ui/hud.js';
// Para alternar entre as duas UIs de diálogo, troca este import:
//   '../ui/npc-dialog.js'         → versão original
//   '../ui/npc-dialog-arcano.js'  → versão Arcano (teste)
import { abrirDialogoGuardiao, abrirDialogoGuardiaoCedePassagem, isDialogoAberto } from '../ui/npc-dialog-arcano.js';
import { abrirInventario, fecharInventario, isInventarioAberto } from '../ui/inventario-ui.js';
import { abrirLockpick, isLockpickAberto } from '../ui/lockpick.js';
import { criarLostItems, updateLostItems, getLostItemAt } from '../world/lost-items.js';
import { coletarItemPerdido } from '../systems/merchant-fetch-quest.js';
import { estado, lojaPlayer, caseloPlayer, tavernPlayer, quartoPlayer, setWorldScene, entrarLoja, sairLoja, entrarCaselo, sairCaselo, entrarTavern, sairTavern, entrarQuarto, sairQuarto, fade } from './transicoes.js';
import moderator from '../systems/moderator.js'; // Ativa ferramentas de debug
import { isPauseAberto, togglePause } from '../ui/pause-menu.js';
import { tickFps } from '../ui/fps-counter.js';
import { inicializarAudio, switchMusic, getCurrentTrack, playSFX } from '../systems/audio.js';
import { isTelaInicialAberta, updateTitleCamera, titleCamera, onTelaInicialFechar } from '../ui/tela-inicial.js';

export { ganharXP, playerStats };

// --------------------------------------------------------
// CENA PRINCIPAL
// --------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const clock = new THREE.Clock();

const _camTarget = new THREE.Vector3();
const _camOffset = new THREE.Vector3(0, 6, 7);

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
// dot mínimo para um objecto continuar visível: -0.15 dá um cone de ~107°
// à frente da câmara — margem para os lados sem mostrar nada que esteja
// claramente atrás.
const CULL_DOT_MIN = -0.15;
// objectos a menos de 12 m da câmara ficam sempre visíveis (segurança contra
// pop-in para coisas grandes que estejam parcialmente atrás mas projectem
// pixels no ecrã).
const CULL_NEAR_KEEP_SQ = 144;

// Aplica layer 1 (invisível à main cam, visível à shadow cam) em vez de visible=false.
// Desta forma objetos culled continuam a projectar sombras correctamente.
function _setLayer(obj, inFront) {
    // Optimização: só traversar se o estado mudou
    if (obj.userData._culled === !inFront) return;
    obj.userData._culled = !inFront;
    obj.traverse(c => {
        if (inFront) { c.layers.enable(0); c.layers.disable(1); }
        else          { c.layers.disable(0); c.layers.enable(1); }
    });
}

function _cullBehindCamera(camera) {
    camera.getWorldDirection(_camFwd);
    const cp = camera.position;
    for (let i = 0; i < cullables.length; i++) {
        const obj = cullables[i];
        const center = obj.userData.cullCenter || obj.position;
        _toObj.subVectors(center, cp);
        const d2 = _toObj.lengthSq();
        if (d2 < CULL_NEAR_KEEP_SQ) { _setLayer(obj, true); continue; }
        _toObj.multiplyScalar(1 / Math.sqrt(d2));
        _setLayer(obj, _toObj.dot(_camFwd) > CULL_DOT_MIN);
    }
}

function _restoreAllCullables() {
    for (let i = 0; i < cullables.length; i++) _setLayer(cullables[i], true);
}
// mesh → { originalMaterial, clonedMaterials: Material[], originalOpacities: number[] }
const _fadedMeshes = new Map();
const _activeFadeMeshes = new Set();
function _isPartOfPlayer(obj) {
    while (obj) { if (obj === player) return true; obj = obj.parent; }
    return false;
}
function _fadeMesh(mesh, deltaTime) {
    let entry = _fadedMeshes.get(mesh);
    if (!entry) {
        const original = mesh.material;
        const origMats = Array.isArray(original) ? original : [original];
        const cloned = origMats.map(m => {
            const c = m.clone();
            c.transparent = true;
            return c;
        });
        mesh.material = Array.isArray(original) ? cloned : cloned[0];
        entry = {
            originalMaterial: original,
            clonedMaterials: cloned,
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
        if (Math.abs(m.opacity - target) > 0.01) done = false;
    }
    if (done) {
        mesh.material = entry.originalMaterial;
        for (const m of entry.clonedMaterials) m.dispose();
        _fadedMeshes.delete(mesh);
    }
}

// ---- iluminação ----
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

// ---- Sombra fixa cobrindo o mapa todo ----
// 2048² texels sobre frustum -120 a 120 (240 unidades) = 0.117 unidades/texel.
// Qualidade muito fina mesmo sem seguir o player, e como é fixa o mapa grande (M)
// mostra sempre as mesmas sombras independentemente da posição do jogador.
const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.bias = -0.0001;
sunLight.shadow.normalBias = 0.08;
sunLight.shadow.camera.near   =   1;
sunLight.shadow.camera.far    = 300;
sunLight.shadow.camera.left   = -120;
sunLight.shadow.camera.right  =  120;
sunLight.shadow.camera.top    =  120;
sunLight.shadow.camera.bottom = -120;
sunLight.position.set(80, 120, 80);
sunLight.target.position.set(0, 0, 0);
scene.add(sunLight, sunLight.target);
sunLight.shadow.camera.layers.enable(1); // shadow camera vê os objetos culled (layer 1)

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
}
registarOnEquipChange(sincronizarAcessorio);
sincronizarAcessorio();

// ---- toggleMapa / toggleInventario ----
let mapaAberto = false;
registarCallbackInput(
    () => {
        if (estado.cena === 'mundo' && !estadoJogo.emCombate && !isInventarioAberto() && !isPauseAberto()) mapaAberto = !mapaAberto;
    },
    () => {
        // I abre o inventário só fora do combate, sem mapa nem diálogo aberto
        if (estadoJogo.emCombate) return;
        if (mapaAberto) return;
        if (isDialogoAberto()) return;
        if (isPauseAberto()) return;
        if (isInventarioAberto()) fecharInventario();
        else abrirInventario();
    },
    (e) => {
        // ESC/P — pausa. Não abre se outra UI sobreposta estiver aberta (deixa-a fechar primeiro)
        if (!isPauseAberto()) {
            if (isInventarioAberto() || isDialogoAberto() || mapaAberto || isLockpickAberto()) return;
        }
        if (e) e.stopPropagation?.();
        togglePause();
    }
);

// --------------------------------------------------------
// ÁUDIO (gerido em systems/audio.js)
// --------------------------------------------------------
inicializarAudio(mainCamera, {
    title:   '../../assets/music/main_tittle.mp3',
    mundo:   '../../assets/music/tema_mundo.mp3',
    dark:    '../../assets/music/darkwoods.mp3',
    shop:    '../../assets/music/shop.mp3',
    tavern:  '../../assets/music/taverna.mp3',
    batalha: '../../assets/music/batalha.mp3',
    castle:  '../../assets/music/castle.mp3',
    boss:    '../../assets/music/boss.mp3',
}, {
    fechadura: '../../assets/sounds/fechadura.mp3',
    abrir_bau: '../../assets/sounds/abrir_bau.mp3',
    trovao:    '../../assets/sounds/trovao.mp3',
    transicao_batalha: '../../assets/sounds/transicao_batalha.mp3',
    step_grass: '../../assets/sounds/footsteps/relva.mp3',
    step_wood:  '../../assets/sounds/footsteps/wood.mp3',
    step_stone: '../../assets/sounds/footsteps/stone.mp3',
});

// --------------------------------------------------------
// COLISÕES INTERIORES
// --------------------------------------------------------
function verificaColisaoLoja(nx, ny, nz) {
    if (moderator.noClip) return false;
    const r = 0.25;
    const pb = new THREE.Box3(
        new THREE.Vector3(nx - r, ny, nz - r),
        new THREE.Vector3(nx + r, ny + 1.7, nz + r)
    );
    for (const c of lojaColliders) { if (pb.intersectsBox(c)) return true; }
    return false;
}

function verificaColisaoCaselo(nx, nz) {
    if (moderator.noClip) return false;
    const r = 0.25;
    const pb = new THREE.Box3(
        new THREE.Vector3(nx - r, 0, nz - r),
        new THREE.Vector3(nx + r, 1.7, nz + r)
    );
    for (const c of caseloColliders) { if (pb.intersectsBox(c)) return true; }
    return false;
}

// --------------------------------------------------------
// LOOPS POR CENA
// --------------------------------------------------------
let _frameCount = 0; // contador global de frames para throttling

function animateMundo(deltaTime) {
    let isMoving = false;

    if (!estadoJogo.emCombate && !mapaAberto && !isDialogoAberto() && !isInventarioAberto() && !isLockpickAberto()) {
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
            player.rotation.y += diff * rotationSpeed;

            const len = Math.sqrt(dirX*dirX + dirZ*dirZ);
            const speedMultiplier = 60 * deltaTime;
            const mx = (dirX/len)*moveSpeed * speedMultiplier, mz = (dirZ/len)*moveSpeed * speedMultiplier;
            if (moderator.noClip || !verificaColisao(player.position.x + mx, player.position.z)) player.position.x += mx;
            if (moderator.noClip || !verificaColisao(player.position.x, player.position.z + mz)) player.position.z += mz;
            verificarEncontro(player.position.x, player.position.z);
        }

        const r = 0.25;
        const pb = new THREE.Box3(
            new THREE.Vector3(player.position.x - r, 0, player.position.z - r),
            new THREE.Vector3(player.position.x + r, 1.7, player.position.z + r)
        );
        if (guardianInteractBox && pb.intersectsBox(guardianInteractBox)) {
            const passou = isGuardiaoPassagemConcedida();
            showPrompt('E — Falar com o guardião');
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
                showPrompt('E — Entrar na loja');
                if (keys.e) { switchMusic('shop', 1.0); entrarLoja(); }
            } else { showPrompt('Limpa as zonas corrompidas do sul para entrar'); }
        } else if (castleEnterBox && pb.intersectsBox(castleEnterBox)) {
            showPrompt('E — Entrar no castelo');
            if (keys.e) { playSFX('trovao'); entrarCaselo(); }
        } else if (tavernEnterBox && pb.intersectsBox(tavernEnterBox)) {
            showPrompt('E — Entrar na taverna');
            if (keys.e) { keys.e = false; switchMusic('tavern', 1.0); entrarTavern(); }
        } else if (getBauInteractBox() && pb.intersectsBox(getBauInteractBox())) {
            if (!bauJaColetado()) {
                if (!bauJaAberto()) {
                    showPrompt('E — Forçar fechadura');
                    if (keys.e) {
                        keys.e = false;
                        abrirLockpick({
                            onSuccess: () => {
                                if (abrirBau()) playSFX('fechadura');
                            },
                        });
                    }
                } else {
                    showPrompt('E — Coletar recompensa');
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
                    showPrompt('E — Forçar fechadura');
                    if (keys.e) {
                        keys.e = false;
                        abrirLockpick({
                            onSuccess: () => {
                                if (abrirBauMascara()) playSFX('fechadura');
                            },
                        });
                    }
                } else {
                    showPrompt('E — Coletar recompensa');
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
                    showPrompt('E — Iniciar combate');
                    if (keys.e) {
                        keys.e = false;
                        iniciarCombateEm(player.position.x, player.position.z);
                    }
                } else {
                    hidePrompt();
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
    updateGuardiao(deltaTime);
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

    if (!moderator.freeCam) {
        _camTarget.set(player.position.x + _camOffset.x, _camOffset.y, player.position.z + _camOffset.z);
        mainCamera.position.lerp(_camTarget, 1 - Math.pow(0.01, deltaTime));
        mainCamera.lookAt(player.position.x, 0.6, player.position.z);

        // Raycast de fade: throttled a cada 3 frames — o resultado dura bem entre frames.
        if (_frameCount % 3 === 0) {
            _camLook.set(player.position.x, player.position.y + 0.6, player.position.z);
            _camRayDir.subVectors(_camLook, mainCamera.position);
            const dist = _camRayDir.length();
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
        }

        // Fade aplicado todo frame (smooth), só o raycast é throttled.
        for (const mesh of _activeFadeMeshes) _fadeMesh(mesh, deltaTime);
        for (const mesh of _fadedMeshes.keys()) {
            if (!_activeFadeMeshes.has(mesh)) _restoreMesh(mesh, deltaTime);
        }
    }

    if (mapaAberto) {
        _restoreAllCullables();
        renderizarMinimapa(renderer, scene, window.innerWidth, window.innerHeight, player.position, true);
    } else {
        renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
        // Culling todo o frame — o throttle a cada 2 frames + restore a cada frame
        // fazia o estado dos objectos alternar a 30Hz (mesh pisca → parece sombra a piscar).
        _cullBehindCamera(mainCamera);
        renderer.render(scene, mainCamera);
        _restoreAllCullables();
        renderizarMinimapa(renderer, scene, window.innerWidth, window.innerHeight, player.position, false);
    }
    _frameCount++;
}

function animateLoja(deltaTime) {
    let isMoving = false, dirX = 0, dirZ = 0;
    if (!isInventarioAberto() && !isDialogoMercadorAberto()) {
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
        lojaPlayer.rotY += diff * rotationSpeed;
        
        const speedMultiplier = 60 * deltaTime;
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
    const pb = new THREE.Box3(
        new THREE.Vector3(lojaPlayer.x - r, lojaPlayer.y, lojaPlayer.z - r),
        new THREE.Vector3(lojaPlayer.x + r, lojaPlayer.y + 1.7, lojaPlayer.z + r)
    );

    if (lojaSaidaBox.intersectsBox(pb)) {
        showPrompt('E — Sair da loja');
        if (keys.e) { keys.e = false; switchMusic('mundo', 1.0); sairLoja(); }
    } else if (getMerchantInteractBox() && pb.intersectsBox(getMerchantInteractBox())) {
        showPrompt('E — Falar com o mercador');
        if (keys.e) { keys.e = false; abrirDialogoMercador(); }
    } else if (getBauLojaInteractBox() && pb.intersectsBox(getBauLojaInteractBox())) {
        if (!bauLojaJaColetado()) {
            if (!bauLojaJaAberto()) {
                showPrompt('E — Abrir baú escondido');
                if (keys.e) {
                    keys.e = false;
                    if (abrirBauLoja()) playSFX('fechadura');
                }
            } else {
                showPrompt('E — Coletar recompensa');
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

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(lojaScene, moderator.freeCam ? mainCamera : lojaCamera);

    // Minimapa/bússola só no mundo exterior
    const border = document.getElementById('minimap-border');
    if (border) border.style.display = 'none';
}

function animateCaselo(deltaTime) {
    let isMoving = false, dirX = 0, dirZ = 0;
    if (!isInventarioAberto()) {
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
        caseloPlayer.rotY += diff * rotationSpeed;
        
        const speedMultiplier = 60 * deltaTime;
        const mx = _moveDir.x * moveSpeed * speedMultiplier;
        const mz = _moveDir.z * moveSpeed * speedMultiplier;
        
        if (!verificaColisaoCaselo(caseloPlayer.x + mx, caseloPlayer.z)) caseloPlayer.x += mx;
        if (!verificaColisaoCaselo(caseloPlayer.x, caseloPlayer.z + mz)) caseloPlayer.z += mz;
    }

    const r2 = 0.25;
    const pb2 = new THREE.Box3(
        new THREE.Vector3(caseloPlayer.x - r2, caseloPlayer.y, caseloPlayer.z - r2),
        new THREE.Vector3(caseloPlayer.x + r2, caseloPlayer.y + 1.7, caseloPlayer.z + r2)
    );

    if (caseloSaidaBox.intersectsBox(pb2)) {
        showPrompt('E — Sair do castelo');
        if (keys.e) { keys.e = false; sairCaselo(); }
        if (isPistaAberta()) esconderPista();
    } else if (todosPedestaisCheios() && bossCrystalInteractBox.intersectsBox(pb2)) {
        // só fica accionável depois dos 5 pedestais estarem cheios
        showPrompt('E — Confrontar o Soberano da Corrupção');
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
                showPrompt(`E — Colocar ${CATALOGO[ped.itemId].icone} ${CATALOGO[ped.itemId].nome}`);
                if (keys.e) {
                    keys.e = false;
                    if (colocarItemPedestal(idx)) {
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
                            mostrarPista('As cinco runas estão completas. O cristal pulsa — aproxima-te e premе E quando estiveres pronto.');
                        }
                    }
                }
            } else {
                // sem o item ou pedestal por revelar → mostra a pista
                showPrompt('E — Examinar a runa');
                if (keys.e) {
                    keys.e = false;
                    mostrarPista(ped.pista);
                }
            }
        } else {
            hidePrompt();
            if (isPistaAberta()) esconderPista();
        }
    }

    atualizarPedestais(deltaTime);
    bossCrystal.rotation.y += deltaTime * 1.2;
    // Pousa em cima do totem (z = -3.5). Sobe e desce suavemente.
    bossCrystal.position.y = 1.85 + Math.sin(Date.now() * 0.002) * 0.15;
    // Quando todos os pedestais estiverem cheios, o cristal acelera e brilha
    if (todosPedestaisCheios()) {
        bossCrystal.material.emissiveIntensity = 2.4 + Math.sin(performance.now() * 0.006) * 1.0;
        bossCrystal.rotation.y += deltaTime * 2.0;
    }

    player.position.set(caseloPlayer.x, caseloPlayer.y, caseloPlayer.z);
    if (!moderator.lockY) player.userData.baseY = caseloPlayer.y;
    player.rotation.y = caseloPlayer.rotY;
    updatePlayerAnimation(isMoving, deltaTime, 'stone');

    // anima o shader de corrupção da abóbada do castelo
    matBattleSky.uniforms.uTime.value += deltaTime;

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
        tavernPlayer.rotY += diff * rotationSpeed;
        
        const speedMultiplier = 60 * deltaTime;
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
    const pb = new THREE.Box3(
        new THREE.Vector3(tavernPlayer.x - r, tavernPlayer.y,        tavernPlayer.z - r),
        new THREE.Vector3(tavernPlayer.x + r, tavernPlayer.y + 1.7,  tavernPlayer.z + r),
    );

    // bloqueia movimento/interacções enquanto a intro do bartender está aberta
    if (isIntroBartenderAberta() || isBartenderShopAberta()) {
        hidePrompt();
    } else if (tavernSaidaBox.intersectsBox(pb)) {
        showPrompt('E — Sair da taverna');
        if (keys.e) { keys.e = false; switchMusic('mundo', 1.0); sairTavern(); }
        if (isPistaAberta()) esconderPista();
    } else if (quartoEnterBox && quartoEnterBox.intersectsBox(pb)) {
        showPrompt('E — Subir ao quarto');
        if (keys.e) { keys.e = false; entrarQuarto(); }
        if (isPistaAberta()) esconderPista();
    } else if (!bartenderIntroFeita() && bartenderIntroBox.intersectsBox(pb)) {
        // intro automática — assim que o jogador sai do quarto e dá um passo.
        // Guard com isIntroBartenderAberta() para só disparar uma vez.
        if (!isIntroBartenderAberta()) {
            abrirIntroBartender(() => {
                marcarBartenderIntroFeita();
                mostrarPista('O bartender afastou-se para o seu canto da taverna. Procura-o se precisares de poções ou ataques.');
            });
        }
        hidePrompt();
    } else if (bartenderIntroFeita() && bartenderVendorBox.intersectsBox(pb)) {
        showPrompt('E — Falar com o bartender');
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
                showPrompt('E — Reclamar recompensa');
                if (keys.e) {
                    keys.e = false;
                    questAureola.estado = 'completa';
                    adicionarItem('aureola_caidos', 1);
                    const it = CATALOGO['aureola_caidos'];
                    mostrarRecompensa({ icone: it.icone, nome: it.nome, descricao: it.descricao });
                    esconderPista();
                }
            } else {
                showPrompt('E — Falar com o estalajadeiro');
                if (keys.e) {
                    keys.e = false;
                    mostrarPista('Estalajadeiro: "Ainda há sombras lá fora. Limpa tudo, depois volta — guardo-te a auréola."');
                }
            }
        } else {
            showPrompt('E — Falar com o estalajadeiro');
            if (keys.e) {
                keys.e = false;
                questAureola.estado = 'aceite';
                mostrarPista('Estalajadeiro: "Estas terras choram pelos caídos. Purifica todas as zonas corruptas do mapa e a Auréola dos Caídos será tua."');
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

    updateTavernNPCs(deltaTime, player.position);

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
        quartoPlayer.rotY += diff * rotationSpeed;

        const speedMultiplier = 60 * deltaTime;
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
    const pb = new THREE.Box3(
        new THREE.Vector3(quartoPlayer.x - r, quartoPlayer.y,       quartoPlayer.z - r),
        new THREE.Vector3(quartoPlayer.x + r, quartoPlayer.y + 1.7, quartoPlayer.z + r),
    );

    if (quartoSaidaBox.intersectsBox(pb)) {
        showPrompt('E — Voltar à taverna');
        if (keys.e) { keys.e = false; sairQuarto(); }
    } else if (quartoBauBox && quartoBauBox.intersectsBox(pb) && !bauQuartoAberto()) {
        showPrompt('E — Abrir baú');
        if (keys.e) {
            keys.e = false;
            abrirBauQuarto();
            playSFX('abrir_bau');
            // poções iniciais — agora vêm daqui
            adicionarItem('pocao', 3);
            adicionarItem('mega', 1);
            const it = CATALOGO['pocao'];
            mostrarRecompensa({
                icone: it.icone,
                nome: 'Poções de Cura',
                descricao: '×3 Poção de Cura  +  ×1 Poção Maior',
            });
        }
    } else if (quartoCamaBox && quartoCamaBox.intersectsBox(pb)) {
        showPrompt('E — Dormir (repõe as áreas corruptas)');
        if (keys.e) {
            keys.e = false;
            estado.ePressBloqueado = true;
            hidePrompt();
            fade(1, () => {
                const n = resetZonasBatalha();
                curar(9999); // dormir cura totalmente
                fade(0, () => { estado.ePressBloqueado = false; });
                mostrarPista(n > 0
                    ? `Dormiste. ${n} zona${n>1?'s':''} corrupta${n>1?'s':''} voltaram a manifestar-se.`
                    : 'Dormiste. HP totalmente recuperado.');
            });
        }
    } else {
        hidePrompt();
    }

    player.position.set(quartoPlayer.x, quartoPlayer.y, quartoPlayer.z);
    player.userData.baseY = quartoPlayer.y;
    player.rotation.y = quartoPlayer.rotY;
    updatePlayerAnimation(isMoving, deltaTime, 'wood');

    updateQuarto(deltaTime);

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
    updateCombateScene(deltaTime);

    // esconde o minimapa enquanto se está em combate
    const border = document.getElementById('minimap-border');
    if (border) border.style.display = 'none';

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    const camCombate = isBossMode() ? combateBossCamera : combateCamera;
    renderer.render(combateScene, moderator.freeCam ? mainCamera : camCombate);
}

function animate() {
    requestAnimationFrame(animate);
    let deltaTime = clock.getDelta();
    tickFps();

    // TELA INICIAL — câmara orbital cinematográfica sobre o mundo
    if (isTelaInicialAberta()) {
        updateTitleCamera(deltaTime);
        // mantém shaders animados para a água/zonas brilharem
        matWater.uniforms.uTime.value      += deltaTime;
        matBattleGrass.uniforms.uTime.value += deltaTime;
        matCorruptHalo.uniforms.uTime.value += deltaTime;
        renderer.setScissorTest(false);
        renderer.clear();
        renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
        renderer.render(scene, titleCamera);
        return;
    }

    // PAUSA — mantém render mas congela lógica/animações
    if (isPauseAberto()) deltaTime = 0;

    buildAvatarScene();
    syncAvatarMaterials();

    if (moderator.freeCam && moderator.controls) {
        moderator.controls.update();
    }

    renderer.setScissorTest(false);
    renderer.clear();

    // Minimapa/bússola: só aparece no mundo exterior
    {
        const border = document.getElementById('minimap-border');
        if (border) {
            const queremos = (estado.cena === 'mundo') ? 'block' : 'none';
            if (border.style.display !== queremos) border.style.display = queremos;
        }
    }

    if (isPauseAberto()) {
        // Render passivo da cena actual, sem actualizar lógica
        if (estado.cena === 'mundo') {
            renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
            renderer.render(scene, mainCamera);
        } else if (estado.cena === 'loja') {
            renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
            renderer.render(lojaScene, lojaCamera);
        } else if (estado.cena === 'caselo') {
            renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
            renderer.render(caseloScene, caseloCamera);
        } else if (estado.cena === 'tavern') {
            renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
            renderer.render(tavernScene, tavernCamera);
        } else if (estado.cena === 'quarto') {
            renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
            renderer.render(quartoScene, quartoCamera);
        } else if (estado.cena === 'combate') {
            renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
            renderer.render(combateScene, isBossMode() ? combateBossCamera : combateCamera);
        }
    } else if (estado.cena === 'mundo')   animateMundo(deltaTime);
    else if (estado.cena === 'loja')    animateLoja(deltaTime);
    else if (estado.cena === 'caselo')  animateCaselo(deltaTime);
    else if (estado.cena === 'tavern')  animateTavern(deltaTime);
    else if (estado.cena === 'quarto')  animateQuarto(deltaTime);
    else if (estado.cena === 'combate') animateCombate(deltaTime);

    avatarRenderer.render(avatarScene, avatarCam);
}

criarMapa(scene);
criarLostItems(scene);

// O jogador arranca sempre no quarto inicial
quartoScene.add(player);
quartoPlayer.x = quartoSpawnPos.x;
quartoPlayer.y = quartoSpawnPos.y;
quartoPlayer.z = quartoSpawnPos.z;
quartoPlayer.rotY = Math.PI; // virado para a cama (norte)
player.position.set(quartoSpawnPos.x, quartoSpawnPos.y, quartoSpawnPos.z);
player.rotation.y = quartoPlayer.rotY;

// ao fechar a tela inicial: sem música por enquanto (quarto é silencioso)
onTelaInicialFechar(() => {});

animate();
