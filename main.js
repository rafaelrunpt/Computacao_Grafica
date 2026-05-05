import * as THREE from 'three';
import { criarMapa, verificaColisao, shopDoorInteract, castleEnterBox, matWater, matBattleGrass, matCorruptHalo, matContTrunk, matContLeaves, matContRock } from './mapa.js';
import { player, updatePlayerAnimation } from './jogador.js';
import { verificarEncontro, estadoJogo } from './combate.js';
import { renderizarMinimapa } from './minimapa.js';
import { lojaScene, lojaColliders, lojaSaidaBox, lojaSpawnPos } from './loja.js';
import { caseloScene, caseloColliders, caseloSaidaBox, caseloSpawnPos, caseloMiniCam, bossCrystal } from './castelo.js';

// --------------------------------------------------------
// 1. CONFIGURAÇÃO BASE
// --------------------------------------------------------
const scene = new THREE.Scene();
const clock = new THREE.Clock();
scene.background = new THREE.Color(0x87ceeb);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
document.body.appendChild(renderer.domElement);

const mainCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const lojaCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    mainCamera.aspect = window.innerWidth / window.innerHeight;
    mainCamera.updateProjectionMatrix();
    lojaCamera.aspect = window.innerWidth / window.innerHeight;
    lojaCamera.updateProjectionMatrix();
});

// --------------------------------------------------------
// 2. ILUMINAÇÃO EXTERIOR
// --------------------------------------------------------
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.bias = -0.001;
sunLight.shadow.normalBias = 0.05;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 50;
sunLight.shadow.camera.left = -50;
sunLight.shadow.camera.right = 50;
sunLight.shadow.camera.top = 50;
sunLight.shadow.camera.bottom = -50;
scene.add(sunLight);
scene.add(sunLight.target);

// --------------------------------------------------------
// 3. ESTADO DO JOGO
// --------------------------------------------------------
const keys = { w: false, a: false, s: false, d: false, e: false, m: false };
let mapaAberto = false;
const moveSpeed = 0.12;
const rotationSpeed = 0.2;


let estadoCena = 'mundo';
let ePressBloqueado = false; 

// posição do jogador na loja / castelo (independente do player do mundo)
const lojaPlayer   = { x: 0, z: 0, rotY: 0 };
const caseloPlayer = { x: 0, z: 0, rotY: 0 };

// --------------------------------------------------------
// 4. FADE OVERLAY
// --------------------------------------------------------
const fadeEl = document.createElement('div');
fadeEl.style.cssText = `
    position: fixed; inset: 0;
    background: #000;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.5s;
    z-index: 100;
`;
document.body.appendChild(fadeEl);

function fade(toOpacity, callback) {
    fadeEl.style.opacity = toOpacity;
    fadeEl.addEventListener('transitionend', callback, { once: true });
}

// --------------------------------------------------------
// 5. PROMPT UI
// --------------------------------------------------------
const promptEl = document.createElement('div');
promptEl.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.65);color:#fff;padding:8px 18px;border-radius:8px;font-family:sans-serif;font-size:16px;display:none;pointer-events:none;z-index:50;';
document.body.appendChild(promptEl);

function showPrompt(msg) { promptEl.textContent = msg; promptEl.style.display = 'block'; }
function hidePrompt()    { promptEl.style.display = 'none'; }

// --------------------------------------------------------
// 5b. TRANSIÇÃO MACABRA DO CASTELO
// --------------------------------------------------------
const castleTransCanvas = document.createElement('canvas');
castleTransCanvas.style.cssText = `
    position: fixed; inset: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    display: none;
    z-index: 200;
`;
document.body.appendChild(castleTransCanvas);
const ctCtx = castleTransCanvas.getContext('2d');

function resizeCastleTrans() {
    castleTransCanvas.width  = window.innerWidth;
    castleTransCanvas.height = window.innerHeight;
}
resizeCastleTrans();
window.addEventListener('resize', resizeCastleTrans);

const castleMsg = document.createElement('div');
castleMsg.style.cssText = `
    position: fixed; inset: 0;
    display: flex; align-items: center; justify-content: center;
    flex-direction: column;
    pointer-events: none;
    z-index: 210;
    opacity: 0;
    transition: opacity 0.3s;
`;
castleMsg.innerHTML = `
    <div style="font-family:'Courier New',monospace;font-size:36px;font-weight:bold;color:#cc44ff;
        text-shadow:0 0 30px #aa00ff,0 0 60px #6600cc,2px 2px 0 #000;
        letter-spacing:4px;text-align:center;line-height:1.4;">
        ☠ VOCÊ ENTRA NO CASTELO ☠
    </div>
    <div style="font-family:'Courier New',monospace;font-size:16px;color:#8844aa;
        text-shadow:0 0 10px #6600cc;margin-top:12px;opacity:0.85;">
        Há coisas aqui que não deveriam existir...
    </div>
`;
document.body.appendChild(castleMsg);

let ctRaf = null;
let ctStart = 0;
let ctPhase = 0; // 0=entrada, 1=flash, 2=névoa, 3=escurecer

function drawCastleEffect(elapsed) {
    const w = castleTransCanvas.width;
    const h = castleTransCanvas.height;
    ctCtx.clearRect(0, 0, w, h);

    if (ctPhase === 0) {
        // fase 0: 0–0.6s — tremelique + vinheta roxa que entra
        const p = Math.min(elapsed / 0.6, 1);
        // vinheta roxa crescente
        const grad = ctCtx.createRadialGradient(w/2, h/2, h * 0.1, w/2, h/2, h * 0.85);
        grad.addColorStop(0, `rgba(0,0,0,0)`);
        grad.addColorStop(1, `rgba(40,0,60,${p * 0.85})`);
        ctCtx.fillStyle = grad;
        ctCtx.fillRect(0, 0, w, h);

        // raios (linhas brancas/roxas rápidas)
        if (Math.random() > 0.55) {
            const x1 = w * (0.3 + Math.random() * 0.4);
            const y1 = 0;
            const x2 = x1 + (Math.random() - 0.5) * 120;
            const y2 = h * (0.4 + Math.random() * 0.4);
            ctCtx.strokeStyle = `rgba(${180 + Math.floor(Math.random()*75)},${Math.floor(Math.random()*60)},255,${0.5 + Math.random()*0.5})`;
            ctCtx.lineWidth = 1 + Math.random() * 2.5;
            ctCtx.shadowColor = '#aa00ff';
            ctCtx.shadowBlur = 18;
            ctCtx.beginPath();
            ctCtx.moveTo(x1, y1);
            // raio com ziguezague
            const segs = 4 + Math.floor(Math.random() * 4);
            for (let s = 1; s <= segs; s++) {
                const px = x1 + (x2 - x1) * (s / segs) + (Math.random() - 0.5) * 40;
                const py = y1 + (y2 - y1) * (s / segs);
                ctCtx.lineTo(px, py);
            }
            ctCtx.stroke();
            ctCtx.shadowBlur = 0;
        }

    } else if (ctPhase === 1) {
        // fase 1: 0.6–1.0s — flash branco/roxo intenso
        const p = (elapsed - 0.6) / 0.4;
        const alpha = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
        ctCtx.fillStyle = `rgba(120,0,180,${alpha * 0.9})`;
        ctCtx.fillRect(0, 0, w, h);
        // brilho central
        const cGrad = ctCtx.createRadialGradient(w/2, h/2, 0, w/2, h/2, h * 0.6);
        cGrad.addColorStop(0, `rgba(255,220,255,${alpha * 0.7})`);
        cGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctCtx.fillStyle = cGrad;
        ctCtx.fillRect(0, 0, w, h);

    } else if (ctPhase === 2) {
        // fase 2: 1.0–2.4s — névoa negra sobe + texto aparece
        const p = Math.min((elapsed - 1.0) / 1.4, 1);
        // névoa que sobe do chão
        const fogH = h * p;
        const fogGrad = ctCtx.createLinearGradient(0, h, 0, h - fogH);
        fogGrad.addColorStop(0, 'rgba(5,0,12,0.97)');
        fogGrad.addColorStop(0.6, 'rgba(20,0,40,0.88)');
        fogGrad.addColorStop(1, 'rgba(40,0,70,0)');
        ctCtx.fillStyle = fogGrad;
        ctCtx.fillRect(0, h - fogH, w, fogH);

        // partículas de névoa roxa flutuantes
        const nPart = 30;
        for (let i = 0; i < nPart; i++) {
            const seed = i * 137.5;
            const px = ((seed * 0.618) % 1) * w;
            const baseY = h - ((seed * 0.3) % 1) * fogH;
            const py = baseY - Math.sin(elapsed * 1.5 + i) * 20;
            const r = 10 + ((seed * 0.2) % 1) * 30;
            const a = 0.1 + ((seed * 0.4) % 1) * 0.3 * p;
            const partGrad = ctCtx.createRadialGradient(px, py, 0, px, py, r);
            partGrad.addColorStop(0, `rgba(80,0,120,${a})`);
            partGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctCtx.fillStyle = partGrad;
            ctCtx.fillRect(px - r, py - r, r * 2, r * 2);
        }

        // texto aparece a partir de p>0.4
        if (p > 0.4) {
            castleMsg.style.opacity = String(Math.min((p - 0.4) / 0.4, 1));
        }

        // topo da écran também escurece
        const topGrad = ctCtx.createLinearGradient(0, 0, 0, h * 0.4);
        topGrad.addColorStop(0, `rgba(5,0,12,${p * 0.8})`);
        topGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctCtx.fillStyle = topGrad;
        ctCtx.fillRect(0, 0, w, h * 0.4);

    } else if (ctPhase === 3) {
        // fase 3: 2.4–3.2s — escurece completamente para preto
        const p = Math.min((elapsed - 2.4) / 0.8, 1);
        ctCtx.fillStyle = `rgba(0,0,0,${p})`;
        ctCtx.fillRect(0, 0, w, h);
        castleMsg.style.opacity = String(1 - p);
    }
}

function castleTransLoop(timestamp) {
    if (!ctStart) ctStart = timestamp;
    const elapsed = (timestamp - ctStart) / 1000;

    // avançar fase
    if (ctPhase === 0 && elapsed >= 0.6) ctPhase = 1;
    if (ctPhase === 1 && elapsed >= 1.0) ctPhase = 2;
    if (ctPhase === 2 && elapsed >= 2.4) ctPhase = 3;

    drawCastleEffect(elapsed);

    if (elapsed < 3.2) {
        ctRaf = requestAnimationFrame(castleTransLoop);
    } else {
        // écran a preto — limpar canvas, ativar fadeEl a 1 para fade normal revelar a cena
        ctCtx.clearRect(0, 0, castleTransCanvas.width, castleTransCanvas.height);
        castleTransCanvas.style.display = 'none';
        castleMsg.style.opacity = '0';
        fadeEl.style.transition = 'none';
        fadeEl.style.opacity = '1';
        // forçar reflow antes de restaurar a transição
        void fadeEl.offsetHeight;
        fadeEl.style.transition = 'opacity 0.5s';
        if (ctOnEnd) ctOnEnd();
        ctRaf = null;
    }
}

let ctOnEnd = null;
function iniciarTransicaoCastelo(onEnd) {
    if (ctRaf) cancelAnimationFrame(ctRaf);
    ctStart = 0;
    ctPhase = 0;
    ctOnEnd = onEnd;
    castleMsg.style.opacity = '0';
    castleTransCanvas.style.display = 'block';
    fadeEl.style.opacity = '0'; // garantir que fade normal não interfere
    ctRaf = requestAnimationFrame(castleTransLoop);
}

// --------------------------------------------------------
// 6. TRANSIÇÕES
// --------------------------------------------------------
function entrarLoja() {
    if (ePressBloqueado) return;
    ePressBloqueado = true;
    hidePrompt();

    fade(1, () => {
        lojaPlayer.x = lojaSpawnPos.x;
        lojaPlayer.z = lojaSpawnPos.z;
        lojaPlayer.rotY = Math.PI;
        // transferir o player para a cena da loja
        scene.remove(player);
        lojaScene.add(player);
        estadoCena = 'loja';
        fade(0, () => { ePressBloqueado = false; });
    });
}

function sairLoja() {
    if (ePressBloqueado) return;
    ePressBloqueado = true;
    hidePrompt();

    fade(1, () => {
        lojaScene.remove(player);
        scene.add(player);
        // posicionar à frente da porta da loja no mundo
        player.position.set(-25, 0, 25);
        player.rotation.y = -Math.PI / 2; // virado para fora da loja (oeste→leste)
        estadoCena = 'mundo';
        fade(0, () => { ePressBloqueado = false; });
    });
}

// --------------------------------------------------------
// 7. COLISÃO NA LOJA
// --------------------------------------------------------
function verificaColisaoLoja(nx, nz) {
    const r = 0.25;
    const pb = new THREE.Box3(
        new THREE.Vector3(nx - r, 0, nz - r),
        new THREE.Vector3(nx + r, 1.7, nz + r)
    );
    for (const c of lojaColliders) {
        if (pb.intersectsBox(c)) return true;
    }
    return false;
}

// --------------------------------------------------------
// 8. INPUTS
// --------------------------------------------------------
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
    if (key === 'm' && estadoCena === 'mundo' && !estadoJogo.emCombate)
        mapaAberto = !mapaAberto;
});
window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

// --------------------------------------------------------
// 9. LOOP DE ANIMAÇÃO
// --------------------------------------------------------
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    renderer.setScissorTest(false);
    renderer.clear();

    if (estadoCena === 'mundo') {
        animateMundo(deltaTime);
    } else if (estadoCena === 'loja') {
        animateLoja(deltaTime);
    } else {
        animateCaselo(deltaTime);
    }
}

// ---- loop do mundo exterior ----
function animateMundo(deltaTime) {
    let isMoving = false;

    if (!estadoJogo.emCombate && !mapaAberto) {
        let dirX = 0, dirZ = 0;
        if (keys.w) dirZ -= 1;
        if (keys.s) dirZ += 1;
        if (keys.a) dirX -= 1;
        if (keys.d) dirX += 1;

        if (dirX !== 0 || dirZ !== 0) {
            isMoving = true;
            const targetAngle = Math.atan2(dirX, dirZ);
            let angleDiff = targetAngle - player.rotation.y;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            player.rotation.y += angleDiff * rotationSpeed;

            const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
            const mx = (dirX / len) * moveSpeed;
            const mz = (dirZ / len) * moveSpeed;
            if (!verificaColisao(player.position.x + mx, player.position.z)) player.position.x += mx;
            if (!verificaColisao(player.position.x, player.position.z + mz)) player.position.z += mz;
            verificarEncontro(player.position.x, player.position.z);
        }

        // interação com a porta
        const r = 0.25;
        const pb = new THREE.Box3(
            new THREE.Vector3(player.position.x - r, 0, player.position.z - r),
            new THREE.Vector3(player.position.x + r, 1.7, player.position.z + r)
        );
        if (shopDoorInteract && pb.intersectsBox(shopDoorInteract)) {
            showPrompt('E — Entrar na loja');
            if (keys.e) entrarLoja();
        } else if (castleEnterBox && pb.intersectsBox(castleEnterBox)) {
            showPrompt('E — Entrar no castelo');
            if (keys.e) entrarCaselo();
        } else {
            hidePrompt();
        }
    }

    updatePlayerAnimation(isMoving, deltaTime);

    matWater.uniforms.uTime.value += deltaTime;
    matBattleGrass.uniforms.uTime.value += deltaTime;
    matCorruptHalo.uniforms.uTime.value += deltaTime;
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(matBattleGrass.uniforms.uTime.value * 1.8));
    matContTrunk.emissiveIntensity  = pulse * 0.7;
    matContLeaves.emissiveIntensity = pulse * 0.9;
    matContRock.emissiveIntensity   = pulse * 0.6;

    const cameraOffset = new THREE.Vector3(0, 6, 7);
    mainCamera.position.lerp(player.position.clone().add(cameraOffset), 0.1);
    mainCamera.lookAt(player.position);

    sunLight.position.set(player.position.x + 10, 20, player.position.z + 10);
    sunLight.target.position.copy(player.position);

    if (mapaAberto) {
        renderizarMinimapa(renderer, scene, window.innerWidth, window.innerHeight, player.position, true);
    } else {
        renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
        renderer.render(scene, mainCamera);
        renderizarMinimapa(renderer, scene, window.innerWidth, window.innerHeight, player.position, false);
    }
}

// câmara estática da loja — posicionada uma vez, nunca muda
const LOJA_W = 14, LOJA_D = 12;
// posicionada do lado da porta (sul), elevada, olha para o fundo da loja
lojaCamera.position.set(0, 9, 10);
lojaCamera.lookAt(0, 1, -2);

// câmara ortográfica para o minimapa da loja
const lojaMiniCam = new THREE.OrthographicCamera(
    -LOJA_W / 2 - 1,  LOJA_W / 2 + 1,
     LOJA_D / 2 + 1, -LOJA_D / 2 - 1,
    0.1, 50
);
lojaMiniCam.position.set(0, 20, 0);
lojaMiniCam.lookAt(0, 0, 0);

// ---- loop do interior da loja ----
function animateLoja(deltaTime) {
    let isMoving = false;
    let dirX = 0, dirZ = 0;

    if (keys.w) dirZ -= 1;
    if (keys.s) dirZ += 1;
    if (keys.a) dirX -= 1;
    if (keys.d) dirX += 1;

    if (dirX !== 0 || dirZ !== 0) {
        isMoving = true;
        const targetAngle = Math.atan2(dirX, dirZ);
        let angleDiff = targetAngle - lojaPlayer.rotY;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        lojaPlayer.rotY += angleDiff * rotationSpeed;

        const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
        const mx = (dirX / len) * moveSpeed;
        const mz = (dirZ / len) * moveSpeed;
        if (!verificaColisaoLoja(lojaPlayer.x + mx, lojaPlayer.z)) lojaPlayer.x += mx;
        if (!verificaColisaoLoja(lojaPlayer.x, lojaPlayer.z + mz)) lojaPlayer.z += mz;
    }

    // deteção de saída pela porta
    const lp = new THREE.Vector3(lojaPlayer.x, 0.5, lojaPlayer.z);
    if (lojaSaidaBox.containsPoint(lp)) {
        showPrompt('E — Sair da loja');
        if (keys.e) sairLoja();
    } else {
        hidePrompt();
    }

    player.position.set(lojaPlayer.x, 0, lojaPlayer.z);
    player.rotation.y = lojaPlayer.rotY;
    updatePlayerAnimation(isMoving, deltaTime);

    // ecrã principal — câmara estática
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(lojaScene, lojaCamera);

    // minimapa da loja — câmara fixa, mostra sempre toda a planta
    const border = document.getElementById('minimap-border');
    if (border) border.style.display = 'block';
    const size = 150, margin = 20, bt = 3;
    renderer.setViewport(margin + bt, margin + bt, size, size);
    renderer.setScissor(margin + bt, margin + bt, size, size);
    renderer.setScissorTest(true);
    renderer.render(lojaScene, lojaMiniCam);
    renderer.setScissorTest(false);
}

// ---- câmara estática do castelo ----
const caseloCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
// dentro da sala, perto da entrada, olha para o altar no fundo
caseloCamera.position.set(0, 7, 14);
caseloCamera.lookAt(0, 2, -6);

window.addEventListener('resize', () => {
    caseloCamera.aspect = window.innerWidth / window.innerHeight;
    caseloCamera.updateProjectionMatrix();
});

function entrarCaselo() {
    if (ePressBloqueado) return;
    ePressBloqueado = true;
    hidePrompt();
    iniciarTransicaoCastelo(() => {
        caseloPlayer.x = caseloSpawnPos.x;
        caseloPlayer.z = caseloSpawnPos.z;
        caseloPlayer.rotY = Math.PI;
        scene.remove(player);
        caseloScene.add(player);
        estadoCena = 'caselo';
        fade(0, () => { ePressBloqueado = false; });
    });
}

function sairCaselo() {
    if (ePressBloqueado) return;
    ePressBloqueado = true;
    hidePrompt();
    fade(1, () => {
        caseloScene.remove(player);
        scene.add(player);
        player.position.set(0, 0, -70);
        player.rotation.y = Math.PI;
        estadoCena = 'mundo';
        fade(0, () => { ePressBloqueado = false; });
    });
}

function verificaColisaoCaselo(nx, nz) {
    const r = 0.25;
    const pb = new THREE.Box3(
        new THREE.Vector3(nx - r, 0, nz - r),
        new THREE.Vector3(nx + r, 1.7, nz + r)
    );
    for (const c of caseloColliders) {
        if (pb.intersectsBox(c)) return true;
    }
    return false;
}

function animateCaselo(deltaTime) {
    let isMoving = false;
    let dirX = 0, dirZ = 0;

    if (keys.w) dirZ -= 1;
    if (keys.s) dirZ += 1;
    if (keys.a) dirX -= 1;
    if (keys.d) dirX += 1;

    if (dirX !== 0 || dirZ !== 0) {
        isMoving = true;
        const targetAngle = Math.atan2(dirX, dirZ);
        let angleDiff = targetAngle - caseloPlayer.rotY;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        caseloPlayer.rotY += angleDiff * rotationSpeed;

        const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
        const mx = (dirX / len) * moveSpeed;
        const mz = (dirZ / len) * moveSpeed;
        if (!verificaColisaoCaselo(caseloPlayer.x + mx, caseloPlayer.z)) caseloPlayer.x += mx;
        if (!verificaColisaoCaselo(caseloPlayer.x, caseloPlayer.z + mz)) caseloPlayer.z += mz;
    }

    // saída pelo portão
    const cp = new THREE.Vector3(caseloPlayer.x, 0.5, caseloPlayer.z);
    if (caseloSaidaBox.containsPoint(cp)) {
        showPrompt('E — Sair do castelo');
        if (keys.e) sairCaselo();
    } else {
        hidePrompt();
    }

    // cristal do boss a rodar
    bossCrystal.rotation.y += deltaTime * 1.2;
    bossCrystal.position.y = 2.2 + Math.sin(Date.now() * 0.002) * 0.15;

    player.position.set(caseloPlayer.x, 0, caseloPlayer.z);
    player.rotation.y = caseloPlayer.rotY;
    updatePlayerAnimation(isMoving, deltaTime);

    // ecrã principal
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.render(caseloScene, caseloCamera);

    // minimapa do castelo
    const border = document.getElementById('minimap-border');
    if (border) border.style.display = 'block';
    const size = 150, margin = 20, bt = 3;
    renderer.setViewport(margin + bt, margin + bt, size, size);
    renderer.setScissor(margin + bt, margin + bt, size, size);
    renderer.setScissorTest(true);
    renderer.render(caseloScene, caseloMiniCam);
    renderer.setScissorTest(false);
}

// --------------------------------------------------------
// 10. INICIALIZAÇÃO
// --------------------------------------------------------
criarMapa(scene);
scene.add(player);
animate();
