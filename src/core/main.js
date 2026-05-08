import * as THREE from 'three';
import { criarMapa, verificaColisao, shopDoorInteract, castleEnterBox, guardianInteractBox, removerGuardiao, updateGuardiao, matWater, matBattleGrass, matCorruptHalo, matContTrunk, matContLeaves, matContRock, zonasSulLimpas, getBridgeHeight } from '../world/mapa.js';
import { player, updatePlayerAnimation } from '../entities/jogador.js';
import { verificarEncontro, estadoJogo } from '../systems/combate.js';
import { renderizarMinimapa } from '../world/minimapa.js';
import { lojaScene, lojaColliders, lojaSaidaBox } from '../world/loja.js';
import { caseloScene, caseloColliders, caseloSaidaBox, caseloMiniCam, bossCrystal } from '../world/castelo.js';
import { renderer, mainCamera, lojaCamera, caseloCamera } from './renderer.js';
import { keys, registarCallbackInput } from './input.js';
import { ganharXP, playerStats } from '../systems/player-stats.js';
import { buildAvatarScene, syncAvatarMaterials, avatarRenderer, avatarScene, avatarCam, showPrompt, hidePrompt } from '../ui/hud.js';
import { abrirDialogoGuardiao, isDialogoAberto } from '../ui/npc-dialog.js';
import { estado, lojaPlayer, caseloPlayer, setWorldScene, entrarLoja, sairLoja, entrarCaselo, sairCaselo } from './transicoes.js';
import moderator from '../systems/moderator.js'; // Ativa ferramentas de debug

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

// ---- toggleMapa ----
let mapaAberto = false;
registarCallbackInput(() => {
    if (estado.cena === 'mundo' && !estadoJogo.emCombate) mapaAberto = !mapaAberto;
});

// --------------------------------------------------------
// SISTEMA DE ÁUDIO
// --------------------------------------------------------
const listener = new THREE.AudioListener();
mainCamera.add(listener);

const sounds = {
    mundo: new THREE.Audio(listener),
    dark:  new THREE.Audio(listener),
    shop:  new THREE.Audio(listener)
};

let currentTrack = null;
let activeFades = new Map(); 
const audioLoader = new THREE.AudioLoader();

function loadTrack(name, path) {
    audioLoader.load(path, (buffer) => {
        sounds[name].setBuffer(buffer);
        sounds[name].setLoop(true);
        sounds[name].setVolume(0);
    }, undefined, (err) => console.warn(`Aviso: ${path} não encontrado.`));
}

loadTrack('mundo', '../../assets/music/tema_mundo.mp3');
loadTrack('dark',  '../../assets/music/darkwoods.mp3');
loadTrack('shop',  '../../assets/music/shop.mp3');

function switchMusic(nextTrackName, fadeTime = 1.5) {
    if (currentTrack === nextTrackName) return;
    const nextTrack = sounds[nextTrackName];
    if (!nextTrack || !nextTrack.buffer) return;

    if (currentTrack) {
        fadeOut(sounds[currentTrack], fadeTime);
    }

    fadeIn(nextTrack, fadeTime);
    currentTrack = nextTrackName;
}

function fadeIn(audio, duration) {
    if (activeFades.has(audio)) {
        clearInterval(activeFades.get(audio));
        activeFades.delete(audio);
    }
    if (!audio.isPlaying) audio.play();
    let vol = audio.getVolume();
    const interval = 50;
    const step = 0.3 / (duration * 1000 / interval);
    const timer = setInterval(() => {
        vol += step;
        if (vol >= 0.3) { vol = 0.3; clearInterval(timer); activeFades.delete(audio); }
        audio.setVolume(vol);
    }, interval);
    activeFades.set(audio, timer);
}

function fadeOut(audio, duration) {
    if (activeFades.has(audio)) {
        clearInterval(activeFades.get(audio));
        activeFades.delete(audio);
    }
    let vol = audio.getVolume();
    const interval = 50;
    const step = vol / (duration * 1000 / interval);
    const timer = setInterval(() => {
        vol -= step;
        if (vol <= 0) {
            vol = 0; audio.stop();
            clearInterval(timer); activeFades.delete(audio);
        }
        audio.setVolume(vol);
    }, interval);
    activeFades.set(audio, timer);
}

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

    if (!estadoJogo.emCombate && !mapaAberto && !isDialogoAberto()) {
        let dirX = 0, dirZ = 0;
        if (keys.w) dirZ -= 1;
        if (keys.s) dirZ += 1;
        if (keys.a) dirX -= 1;
        if (keys.d) dirX += 1;

        if (dirX !== 0 || dirZ !== 0) {
            const estaNaZonaDark = player.position.z < -3; 
            const trackDesejada = estaNaZonaDark ? 'dark' : 'mundo';
            if (!currentTrack) switchMusic(trackDesejada);
            else if (currentTrack !== 'shop' && currentTrack !== trackDesejada) switchMusic(trackDesejada, 2.0);

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
        } else { hidePrompt(); }
    }

    updatePlayerAnimation(isMoving, deltaTime);
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
    if (keys.w) dirZ -= 1; if (keys.s) dirZ += 1;
    if (keys.a) dirX -= 1; if (keys.d) dirX += 1;

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
    if (keys.w) dirZ -= 1; if (keys.s) dirZ += 1;
    if (keys.a) dirX -= 1; if (keys.d) dirX += 1;

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

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    buildAvatarScene();
    syncAvatarMaterials();

    if (moderator.freeCam && moderator.controls) {
        moderator.controls.update();
    }

    renderer.setScissorTest(false);
    renderer.clear();
    
    if      (estado.cena === 'mundo')  animateMundo(deltaTime);
    else if (estado.cena === 'loja')   animateLoja(deltaTime);
    else                               animateCaselo(deltaTime);
    
    avatarRenderer.render(avatarScene, avatarCam);
}

criarMapa(scene);
scene.add(player);
animate();
