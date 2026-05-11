import * as THREE from 'three';
import { criarMapa, verificaColisao, shopDoorInteract, castleEnterBox, guardianInteractBox, removerGuardiao, updateGuardiao, matWater, matBattleGrass, matCorruptHalo, matContTrunk, matContLeaves, matContRock, zonasSulLimpas, getBridgeHeight, getBauInteractBox, abrirBau, bauJaAberto, updateBau, bauJaColetado, coletarBau } from '../world/mapa.js';
import { player, updatePlayerAnimation, setCoroaVisivel, updateCoroaAnimacao } from '../entities/jogador.js';
import { adicionarItem, registarOnEquipChange, CATALOGO } from '../systems/inventario.js';
import { mostrarRecompensa } from '../ui/popup-recompensa.js';
import { verificarEncontro, estadoJogo } from '../systems/combate.js';
import { renderizarMinimapa } from '../world/minimapa.js';
import { lojaScene, lojaColliders, lojaSaidaBox } from '../world/loja.js';
import { caseloScene, caseloColliders, caseloSaidaBox, caseloMiniCam, bossCrystal } from '../world/castelo.js';
import { combateScene, updateCombateScene } from '../world/combate-scene.js';
import { renderer, mainCamera, lojaCamera, caseloCamera, combateCamera } from './renderer.js';
import { keys, registarCallbackInput } from './input.js';
import { ganharXP, playerStats } from '../systems/player-stats.js';
import { buildAvatarScene, syncAvatarMaterials, avatarRenderer, avatarScene, avatarCam, showPrompt, hidePrompt } from '../ui/hud.js';
import { abrirDialogoGuardiao, isDialogoAberto } from '../ui/npc-dialog.js';
import { abrirInventario, fecharInventario, isInventarioAberto } from '../ui/inventario-ui.js';
import { estado, lojaPlayer, caseloPlayer, setWorldScene, entrarLoja, sairLoja, entrarCaselo, sairCaselo } from './transicoes.js';
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

// ---- iluminação ----
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
// Valores refinados para eliminar shadow acne e linhas na ponte
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

// ---- sincronizar coroa equipada com o boneco 3D ----
function sincronizarCoroa() {
    setCoroaVisivel(playerStats.equipped?.cabeca === 'coroa_magica');
}
registarOnEquipChange(sincronizarCoroa);
sincronizarCoroa();

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
            if (isInventarioAberto() || isDialogoAberto() || mapaAberto) return;
        }
        if (e) e.stopPropagation?.();
        togglePause();
    }
);

// --------------------------------------------------------
// ÁUDIO (gerido em systems/audio.js)
// --------------------------------------------------------
inicializarAudio(mainCamera, {
    mundo: '../../assets/music/tema_mundo.mp3',
    dark:  '../../assets/music/darkwoods.mp3',
    shop:  '../../assets/music/shop.mp3',
    batalha: '../../assets/music/batalha.mp3',
}, {
    fechadura: '../../assets/sounds/fechadura.mp3',
    abrir_bau: '../../assets/sounds/abrir_bau.mp3',
    transicao_batalha: '../../assets/sounds/transicao_batalha.mp3',
});

// --------------------------------------------------------
// COLISÕES INTERIORES
// --------------------------------------------------------
function verificaColisaoLoja(nx, nz) {
    const r = 0.25;
    const pb = new THREE.Box3(
        new THREE.Vector3(nx - r, 0, nz - r),
        new THREE.Vector3(nx + r, 1.7, nz + r)
    );
    for (const c of lojaColliders) { if (pb.intersectsBox(c)) return true; }
    return false;
}

function verificaColisaoCaselo(nx, nz) {
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
function animateMundo(deltaTime) {
    let isMoving = false;

    if (!estadoJogo.emCombate && !mapaAberto && !isDialogoAberto() && !isInventarioAberto()) {
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
            else if (atual !== 'shop' && atual !== trackDesejada) switchMusic(trackDesejada, 2.0);

            isMoving = true;
            const targetAngle = Math.atan2(dirX, dirZ);
            let diff = targetAngle - player.rotation.y;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            player.rotation.y += diff * rotationSpeed;

            const len = Math.sqrt(dirX*dirX + dirZ*dirZ);
            const speedMultiplier = 60 * deltaTime;
            const mx = (dirX/len)*moveSpeed * speedMultiplier, mz = (dirZ/len)*moveSpeed * speedMultiplier;
            if (!verificaColisao(player.position.x + mx, player.position.z)) player.position.x += mx;
            if (!verificaColisao(player.position.x, player.position.z + mz)) player.position.z += mz;
            verificarEncontro(player.position.x, player.position.z);
        }

        const r = 0.25;
        const pb = new THREE.Box3(
            new THREE.Vector3(player.position.x - r, 0, player.position.z - r),
            new THREE.Vector3(player.position.x + r, 1.7, player.position.z + r)
        );

        if (guardianInteractBox && pb.intersectsBox(guardianInteractBox)) {
            showPrompt('E — Falar com o guardião');
            if (keys.e) { keys.e = false; abrirDialogoGuardiao(playerStats.level, () => removerGuardiao()); }
        } else if (shopDoorInteract && pb.intersectsBox(shopDoorInteract)) {
            if (zonasSulLimpas()) {
                showPrompt('E — Entrar na loja');
                if (keys.e) { switchMusic('shop', 1.0); entrarLoja(); }
            } else { showPrompt('Limpa as zonas corrompidas do sul para entrar'); }
        } else if (castleEnterBox && pb.intersectsBox(castleEnterBox)) {
            showPrompt('E — Entrar no castelo');
            if (keys.e) entrarCaselo();
        } else if (getBauInteractBox() && pb.intersectsBox(getBauInteractBox())) {
            if (!bauJaColetado()) {
                if (!bauJaAberto()) {
                    showPrompt('E — Abrir baú misterioso');
                    if (keys.e) {
                        keys.e = false;
                        if (abrirBau()) {
                            playSFX('fechadura');
                        }
                    }
                } else {
                    showPrompt('E — Coletar recompensa');
                    if (keys.e) {
                        keys.e = false;
                        if (coletarBau()) {
                            playSFX('abrir_bau');
                            adicionarItem('coroa_magica', 1);
                            const item = CATALOGO['coroa_magica'];
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
        } else { hidePrompt(); }
    }

    updatePlayerAnimation(isMoving, deltaTime);
    updateCoroaAnimacao(deltaTime);
    updateBau(deltaTime);
    updateGuardiao(deltaTime);
    player.position.y += getBridgeHeight(player.position.x, player.position.z);

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
    }

    sunLight.target.updateMatrixWorld();

    if (mapaAberto) {
        renderizarMinimapa(renderer, scene, window.innerWidth, window.innerHeight, player.position, true);
    } else {
        renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
        renderer.render(scene, mainCamera);
        renderizarMinimapa(renderer, scene, window.innerWidth, window.innerHeight, player.position, false);
    }
}

function animateLoja(deltaTime) {
    let isMoving = false, dirX = 0, dirZ = 0;
    if (!isInventarioAberto()) {
        if (keys.w) dirZ -= 1; if (keys.s) dirZ += 1;
        if (keys.a) dirX -= 1; if (keys.d) dirX += 1;
    }

    if (dirX !== 0 || dirZ !== 0) {
        isMoving = true;
        const targetAngle = Math.atan2(dirX, dirZ);
        let diff = targetAngle - lojaPlayer.rotY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        lojaPlayer.rotY += diff * rotationSpeed;
        const len = Math.sqrt(dirX*dirX + dirZ*dirZ);
        const speedMultiplier = 60 * deltaTime;
        const mx = (dirX/len)*moveSpeed * speedMultiplier, mz = (dirZ/len)*moveSpeed * speedMultiplier;
        if (!verificaColisaoLoja(lojaPlayer.x + mx, lojaPlayer.z)) lojaPlayer.x += mx;
        if (!verificaColisaoLoja(lojaPlayer.x, lojaPlayer.z + mz)) lojaPlayer.z += mz;
    }

    const r = 0.25;
    const pb = new THREE.Box3(
        new THREE.Vector3(lojaPlayer.x - r, 0, lojaPlayer.z - r),
        new THREE.Vector3(lojaPlayer.x + r, 1.7, lojaPlayer.z + r)
    );

    if (lojaSaidaBox.intersectsBox(pb)) {
        showPrompt('E — Sair da loja');
        if (keys.e) { keys.e = false; switchMusic('mundo', 1.0); sairLoja(); }
    } else { hidePrompt(); }

    player.position.set(lojaPlayer.x, 0, lojaPlayer.z);
    player.rotation.y = lojaPlayer.rotY;
    updatePlayerAnimation(isMoving, deltaTime);

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(lojaScene, moderator.freeCam ? mainCamera : lojaCamera);

    const border = document.getElementById('minimap-border');
    if (border) border.style.display = 'block';
    const size = 116, xPos = 52, yPos = 52;
    renderer.setViewport(xPos, yPos, size, size);
    renderer.setScissor(xPos, yPos, size, size);
    renderer.setScissorTest(true);
    renderer.render(lojaScene, lojaMiniCam);
    renderer.setScissorTest(false);
}

function animateCaselo(deltaTime) {
    let isMoving = false, dirX = 0, dirZ = 0;
    if (!isInventarioAberto()) {
        if (keys.w) dirZ -= 1; if (keys.s) dirZ += 1;
        if (keys.a) dirX -= 1; if (keys.d) dirX += 1;
    }

    if (dirX !== 0 || dirZ !== 0) {
        isMoving = true;
        const targetAngle = Math.atan2(dirX, dirZ);
        let diff = targetAngle - caseloPlayer.rotY;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        caseloPlayer.rotY += diff * rotationSpeed;
        const len = Math.sqrt(dirX*dirX + dirZ*dirZ);
        const speedMultiplier = 60 * deltaTime;
        const mx = (dirX/len)*moveSpeed * speedMultiplier, mz = (dirZ/len)*moveSpeed * speedMultiplier;
        if (!verificaColisaoCaselo(caseloPlayer.x + mx, caseloPlayer.z)) caseloPlayer.x += mx;
        if (!verificaColisaoCaselo(caseloPlayer.x, caseloPlayer.z + mz)) caseloPlayer.z += mz;
    }

    const r2 = 0.25;
    const pb2 = new THREE.Box3(
        new THREE.Vector3(caseloPlayer.x - r2, 0, caseloPlayer.z - r2),
        new THREE.Vector3(caseloPlayer.x + r2, 1.7, caseloPlayer.z + r2)
    );

    if (caseloSaidaBox.intersectsBox(pb2)) {
        showPrompt('E — Sair do castelo');
        if (keys.e) { keys.e = false; sairCaselo(); }
    } else { hidePrompt(); }

    bossCrystal.rotation.y += deltaTime * 1.2;
    bossCrystal.position.y = 2.2 + Math.sin(Date.now() * 0.002) * 0.15;

    player.position.set(caseloPlayer.x, 0, caseloPlayer.z);
    player.rotation.y = caseloPlayer.rotY;
    updatePlayerAnimation(isMoving, deltaTime);

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(caseloScene, moderator.freeCam ? mainCamera : caseloCamera);

    const border = document.getElementById('minimap-border');
    if (border) border.style.display = 'block';
    const size = 116, xPos = 52, yPos = 52;
    renderer.setViewport(xPos, yPos, size, size);
    renderer.setScissor(xPos, yPos, size, size);
    renderer.setScissorTest(true);
    renderer.render(caseloScene, caseloMiniCam);
    renderer.setScissorTest(false);
}

function animateCombate(deltaTime) {
    // sem WASD nem colisões — combate é controlado pela UI (botões)
    updatePlayerAnimation(false, deltaTime);
    updateCombateScene(deltaTime);

    // esconde o minimapa enquanto se está em combate
    const border = document.getElementById('minimap-border');
    if (border) border.style.display = 'none';

    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(combateScene, moderator.freeCam ? mainCamera : combateCamera);
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

    // garante que o minimapa volta a aparecer fora do combate
    if (estado.cena !== 'combate') {
        const border = document.getElementById('minimap-border');
        if (border && border.style.display === 'none') border.style.display = 'block';
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
        } else if (estado.cena === 'combate') {
            renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
            renderer.render(combateScene, combateCamera);
        }
    } else if (estado.cena === 'mundo')   animateMundo(deltaTime);
    else if (estado.cena === 'loja')    animateLoja(deltaTime);
    else if (estado.cena === 'caselo')  animateCaselo(deltaTime);
    else if (estado.cena === 'combate') animateCombate(deltaTime);

    avatarRenderer.render(avatarScene, avatarCam);
}

criarMapa(scene);
scene.add(player);

// ao fechar a tela inicial: arranca a música ambiente do mundo
onTelaInicialFechar(() => {
    switchMusic('mundo', 2.5);
});

animate();
