import * as THREE from 'three';

// ----------------------------------------------------------------------
// CENA DE COMBATE
// ----------------------------------------------------------------------
// Estilo: corrompido roxo (mesma paleta de matBattleGrass + matCorruptHalo)
// Layout: arena circular plana, player à esquerda, inimigo à direita,
//         câmara estática lateral, fog escuro a fechar a arena.
// ----------------------------------------------------------------------

export const combateScene = new THREE.Scene();
combateScene.background = new THREE.Color(0x05000a);
combateScene.fog = new THREE.FogExp2(0x100020, 0.045);

// Posições fixas
export const posPlayerCombate = new THREE.Vector3(-2.6, 0, 0);
export const posInimigoCombate = new THREE.Vector3(2.8, 0.85, 0);

// ---- Iluminação ambiental + chave + contraluz roxo ----
combateScene.add(new THREE.AmbientLight(0x553388, 0.55));

const keyLight = new THREE.DirectionalLight(0xb070ff, 1.4);
keyLight.position.set(-4, 8, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 30;
keyLight.shadow.camera.left = -10;
keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 10;
keyLight.shadow.camera.bottom = -10;
keyLight.shadow.bias = -0.0005;
combateScene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xff60d0, 0.6);
rimLight.position.set(6, 4, -6);
combateScene.add(rimLight);

// luz pontual a pulsar entre os dois lutadores (dramatiza a arena)
const arenaPulse = new THREE.PointLight(0xaa55ff, 1.5, 14, 1.4);
arenaPulse.position.set(0, 2.2, 0);
combateScene.add(arenaPulse);

// ---- Chão da arena: shader roxo corrompido (estilo matBattleGrass) ----
export const matCombateChao = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;

        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float sn(vec2 p){
            vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                       mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        float fbm(vec2 p){
            float v=0.0,a=0.5;
            for(int i=0;i<4;i++){v+=a*sn(p);p=p*2.1+vec2(3.1,1.7);a*=0.5;}
            return v;
        }

        void main(){
            // Disco da arena com borda orgânica
            vec2 c = vUv - 0.5;
            float dist = length(c);
            float angle = atan(c.y, c.x);
            float warp = fbm(vec2(angle * 2.0, uTime * 0.12) + 1.7) * 0.10;
            float mask = smoothstep(0.50 + warp, 0.42 + warp, dist);
            if (mask < 0.01) discard;

            float n  = fbm(vUv * 14.0 + vec2(uTime * 0.05, 0.0));
            float n2 = fbm(vUv *  6.0 - vec2(0.0, uTime * 0.03) + 5.3);
            float sparkle = pow(sn(vUv * 40.0 + uTime * 0.6), 7.0);
            float pulse   = 0.5 + 0.5 * sin(uTime * 2.0);

            vec3 dark   = vec3(0.10, 0.02, 0.18);
            vec3 mid    = vec3(0.32, 0.08, 0.48);
            vec3 bright = vec3(0.62, 0.18, 0.92);
            vec3 spark  = vec3(0.90, 0.55, 1.00);

            vec3 col = mix(dark, mid, n * 0.6 + n2 * 0.4);
            col      = mix(col, bright, sparkle * pulse * 0.7);
            col      = mix(col, spark,  sparkle * 0.4);

            // anel de borda mais brilhante a delimitar a arena
            float borderGlow = smoothstep(0.40 + warp, 0.50 + warp, dist) * mask;
            col = mix(col, vec3(0.85, 0.35, 1.00), borderGlow * 0.9 * (0.7 + 0.3 * pulse));

            gl_FragColor = vec4(col, mask);
        }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
});

const arenaR = 7;
const arenaGeo = new THREE.PlaneGeometry(arenaR * 2, arenaR * 2, 1, 1);
const arenaMesh = new THREE.Mesh(arenaGeo, matCombateChao);
arenaMesh.rotation.x = -Math.PI / 2;
arenaMesh.position.y = 0.02;
arenaMesh.receiveShadow = true;
combateScene.add(arenaMesh);

// chão preto por baixo (recebe as sombras nítidas dos lutadores)
const floorShadow = new THREE.Mesh(
    new THREE.CircleGeometry(arenaR * 1.4, 48),
    new THREE.MeshStandardMaterial({ color: 0x080010, roughness: 1 })
);
floorShadow.rotation.x = -Math.PI / 2;
floorShadow.position.y = 0;
floorShadow.receiveShadow = true;
combateScene.add(floorShadow);

// tufos roxos espalhados (decorativo, igual ao mapa)
const matTufo = new THREE.MeshStandardMaterial({
    color: 0x4a1170,
    emissive: 0x6a20a0,
    emissiveIntensity: 0.6,
    roughness: 0.9,
});
const seededRand = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
const r = seededRand(91);
for (let i = 0; i < 60; i++) {
    const ang = r() * Math.PI * 2;
    const rad = 1.5 + r() * (arenaR - 1.6);
    const h = 0.18 + r() * 0.32;
    const tufo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, h, 4), matTufo);
    tufo.position.set(Math.cos(ang) * rad, h / 2, Math.sin(ang) * rad);
    tufo.rotation.y = r() * Math.PI * 2;
    tufo.castShadow = true;
    combateScene.add(tufo);
}

// pilares quebrados (atmosfera de ruína corrompida)
const matPilar = new THREE.MeshStandardMaterial({
    color: 0x1a0825,
    emissive: 0x3a0a55,
    emissiveIntensity: 0.25,
    roughness: 1,
});
function pilar(x, z, h) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, h, 8), matPilar);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    combateScene.add(m);
}
pilar(-5.5, -3.5, 2.2);
pilar( 5.8, -3.2, 1.8);
pilar(-5.2,  3.8, 1.4);
pilar( 5.3,  4.0, 2.6);

// partículas roxas no ar
const partGeo = new THREE.BufferGeometry();
const partCount = 120;
const partPos = new Float32Array(partCount * 3);
for (let i = 0; i < partCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const rd = 1 + Math.random() * (arenaR - 0.5);
    partPos[i * 3 + 0] = Math.cos(a) * rd;
    partPos[i * 3 + 1] = Math.random() * 4;
    partPos[i * 3 + 2] = Math.sin(a) * rd;
}
partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
const partMat = new THREE.PointsMaterial({
    color: 0xc090ff,
    size: 0.06,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});
const particulas = new THREE.Points(partGeo, partMat);
combateScene.add(particulas);

// ---- Cubo inimigo (placeholder) ----
const inimigoGeo = new THREE.BoxGeometry(1.6, 1.7, 1.6);
const inimigoMat = new THREE.MeshStandardMaterial({
    color: 0x7a1a1a,
    emissive: 0xff2266,
    emissiveIntensity: 0.55,
    roughness: 0.4,
    metalness: 0.2,
});
export const combateInimigo = new THREE.Mesh(inimigoGeo, inimigoMat);
combateInimigo.position.copy(posInimigoCombate);
combateInimigo.castShadow = true;
combateInimigo.receiveShadow = true;
combateScene.add(combateInimigo);

// ---- Atualização por frame (uniforms + animações) ----
let _t = 0;
export function updateCombateScene(deltaTime) {
    _t += deltaTime;
    matCombateChao.uniforms.uTime.value = _t;

    // pulsar a luz da arena
    arenaPulse.intensity = 1.2 + Math.sin(_t * 2.4) * 0.5;

    // inimigo a flutuar e a rodar lentamente
    combateInimigo.position.y = posInimigoCombate.y + Math.sin(_t * 1.6) * 0.12;
    combateInimigo.rotation.y += deltaTime * 0.6;
    combateInimigo.rotation.x = Math.sin(_t * 0.8) * 0.08;

    // partículas a subir lentamente
    const pos = particulas.geometry.attributes.position;
    for (let i = 0; i < partCount; i++) {
        pos.array[i * 3 + 1] += deltaTime * 0.25;
        if (pos.array[i * 3 + 1] > 4) pos.array[i * 3 + 1] = 0;
    }
    pos.needsUpdate = true;
}

// ---- Reset visual entre combates (volta a posição/rotação inicial) ----
export function resetCombateScene() {
    combateInimigo.position.copy(posInimigoCombate);
    combateInimigo.rotation.set(0, 0, 0);
    combateInimigo.visible = true;
    combateInimigo.scale.set(1, 1, 1);
    inimigoMat.opacity = 1;
    inimigoMat.transparent = false;
    inimigoMat.color.setHex(0x7a1a1a);
    inimigoMat.emissive.setHex(0xff2266);
}
