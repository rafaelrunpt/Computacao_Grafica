import * as THREE from 'three';

// ---- texturas base ----
const _loader = new THREE.TextureLoader();

function loadTex(path, rx, ry) {
    return _loader.load(path, t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(rx, ry);
        t.anisotropy = 4; // 16 só ajuda em superfícies oblíquas — 4 já é bom e custa menos
    });
}

const TS = 6;
const W_MAP = 200, H_MAP_HALF = 95;

export const grassTex    = loadTex('assets/textures/relva.png',   W_MAP/TS, H_MAP_HALF/TS);
export const terraTex    = loadTex('assets/textures/terra.png',   W_MAP/TS, H_MAP_HALF/TS);
export const areiaTex    = loadTex('assets/textures/areia.png',   W_MAP/TS, H_MAP_HALF/TS);
let _woodCount = 0;
let _woodResolve;
export const woodTexturesReady = new Promise(r => { _woodResolve = r; });
const _onWoodLoad = () => { if (++_woodCount === 2) _woodResolve(); };

export const madeiraTex  = _loader.load('assets/textures/madeira.png', t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 16;
    _onWoodLoad();
});
export const madeira2Tex = _loader.load('assets/textures/madeira2.png', t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 16;
    _onWoodLoad();
});

// ---- shader de terreno ----
export function makeTerrainShader(grassCol, pathColor) {
    const mat = new THREE.MeshStandardMaterial({
        map: grassTex,
        color: new THREE.Color(grassCol),
        roughness: 0.9,
    });

    const extraUniforms = {
        uGrass:    { value: grassTex },
        uDirt:     { value: terraTex },
        uSand:     { value: areiaTex },
        uGrassCol: { value: new THREE.Color(grassCol) },
        uDirtCol:  { value: new THREE.Color(pathColor) },
        uRiverZ:   { value: 0.0 },
        uVPath0X: { value:  0.0 }, uVPath0W: { value: 3.2 }, uVPath0Z0: { value:-100.0 }, uVPath0Z1: { value: 100.0 },
        uVPath1X: { value:999.0 }, uVPath1W: { value: 3.2 }, uVPath1Z0: { value:   0.0 }, uVPath1Z1: { value:   0.0 },
        uVPath2X: { value:999.0 }, uVPath2W: { value: 3.2 }, uVPath2Z0: { value:   0.0 }, uVPath2Z1: { value:   0.0 },
        uHPath0Z: { value:999.0 }, uHPath0W: { value: 3.2 }, uHPath0X0: { value:  0.0 }, uHPath0X1: { value:   0.0 },
        uHPath1Z: { value:999.0 }, uHPath1W: { value: 3.2 }, uHPath1X0: { value:  0.0 }, uHPath1X1: { value:   0.0 },
        uHPath2Z: { value:999.0 }, uHPath2W: { value: 3.2 }, uHPath2X0: { value:  0.0 }, uHPath2X1: { value:   0.0 },
    };

    mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, extraUniforms);

        shader.vertexShader = shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            `#include <worldpos_vertex>
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`
        ).replace(
            'void main() {',
            'varying vec3 vWorldPos;\nvoid main() {'
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            'void main() {',
            `varying vec3 vWorldPos;
            uniform sampler2D uGrass, uDirt, uSand;
            uniform vec3 uGrassCol, uDirtCol;
            uniform float uRiverZ;
            uniform float uVPath0X,uVPath0W,uVPath0Z0,uVPath0Z1;
            uniform float uVPath1X,uVPath1W,uVPath1Z0,uVPath1Z1;
            uniform float uVPath2X,uVPath2W,uVPath2Z0,uVPath2Z1;
            uniform float uHPath0Z,uHPath0W,uHPath0X0,uHPath0X1;
            uniform float uHPath1Z,uHPath1W,uHPath1X0,uHPath1X1;
            uniform float uHPath2Z,uHPath2W,uHPath2X0,uHPath2X1;

            float _hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
            float _sn(vec2 p){
                vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);
                return mix(mix(_hash(i),_hash(i+vec2(1,0)),f.x),
                           mix(_hash(i+vec2(0,1)),_hash(i+vec2(1,1)),f.x),f.y);
            }
            float _fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<3;i++){v+=a*_sn(p);p=p*2.1+vec2(1.7,9.2);a*=0.5;} return v; }

            float vPathBlend(float wx, float wz, float cx, float hw, float z0, float z1) {
                if (wz < z0-1.0 || wz > z1+1.0) return 0.0;
                float d = abs(wx - cx);
                float n = _fbm(vec2(wz*0.18+cx*0.07, wx*0.11)) * hw * 0.8;
                float zf = smoothstep(z0-0.5,z0+3.0,wz)*smoothstep(z1+0.5,z1-3.0,wz);
                return (1.0 - smoothstep(hw*0.5-0.3, hw*1.1+n, d)) * zf;
            }
            float hPathBlend(float wz, float wx, float wz_c, float hw, float x0, float x1) {
                if (wx < x0-1.0 || wx > x1+1.0) return 0.0;
                float d = abs(wz - wz_c);
                float n = _fbm(vec2(wx*0.15+wz_c*0.09, wz*0.12)) * hw * 0.8;
                float xf = smoothstep(x0-0.5,x0+3.0,wx)*smoothstep(x1+0.5,x1-3.0,wx);
                return (1.0 - smoothstep(hw*0.5-0.3, hw*1.1+n, d)) * xf;
            }
            float sandBlend(float wz, float rz) {
                float d = abs(wz - rz);
                float n = _fbm(vec2(vWorldPos.x*0.12, wz*0.14+1.3)) * 2.5;
                return 1.0 - smoothstep(2.8, 6.5+n, d);
            }
            void main() {`
        ).replace(
            '#include <map_fragment>',
            `vec2 tuv = vWorldPos.xz / 6.0;
            vec4 cGrass = texture2D(uGrass, tuv) * vec4(uGrassCol, 1.0);
            vec4 cDirt  = texture2D(uDirt,  tuv) * vec4(uDirtCol,  1.0);
            vec4 cSand  = texture2D(uSand,  tuv) * vec4(1.00, 0.87, 0.62, 1.0);

            float dirtMask = 0.0;
            float wx = vWorldPos.x, wz = vWorldPos.z;
            dirtMask = max(dirtMask, vPathBlend(wx,wz, uVPath0X,uVPath0W,uVPath0Z0,uVPath0Z1));
            dirtMask = max(dirtMask, vPathBlend(wx,wz, uVPath1X,uVPath1W,uVPath1Z0,uVPath1Z1));
            dirtMask = max(dirtMask, vPathBlend(wx,wz, uVPath2X,uVPath2W,uVPath2Z0,uVPath2Z1));
            dirtMask = max(dirtMask, hPathBlend(wz,wx, uHPath0Z,uHPath0W,uHPath0X0,uHPath0X1));
            dirtMask = max(dirtMask, hPathBlend(wz,wx, uHPath1Z,uHPath1W,uHPath1X0,uHPath1X1));
            dirtMask = max(dirtMask, hPathBlend(wz,wx, uHPath2Z,uHPath2W,uHPath2X0,uHPath2X1));
            float sandMask = sandBlend(vWorldPos.z, uRiverZ);

            vec4 blended = cGrass;
            blended = mix(blended, cSand, sandMask);
            blended = mix(blended, cDirt, dirtMask);
            diffuseColor = blended;`
        );

        mat.userData.shader = shader;
    };

    mat.uniforms = extraUniforms;
    return mat;
}

// ---- shader de batalha — solo corrupto roxo ----
// Camadas: textura de relva tingida + vórtice giratório + veias radiais
// brilhantes + sparkles + crackling eléctrico nas bordas + halo interior.
export const matBattleGrass = new THREE.ShaderMaterial({
    uniforms: {
        uTime:  { value: 0 },
        uGrass: { value: grassTex },
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform sampler2D uGrass;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float sn(vec2 p){
            vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0 - 2.0*f);
            return mix(mix(hash(i),           hash(i + vec2(1.0, 0.0)), f.x),
                       mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p){
            float v = 0.0, a = 0.5;
            for (int i = 0; i < 3; i++) { v += a * sn(p); p = p * 2.1 + vec2(3.1, 1.7); a *= 0.5; }
            return v;
        }
        vec2 rot(vec2 p, float a) {
            float c = cos(a), s = sin(a);
            return mat2(c, -s, s, c) * p;
        }

        void main() {
            vec2  centered = vUv - 0.5;
            float angle    = atan(centered.y, centered.x);
            float dist     = length(centered);

            // máscara orgânica — borda irregular animada
            float warp = fbm(vec2(angle * 2.0, uTime * 0.15) + 0.5) * 0.22;
            float mask = smoothstep(0.50 + warp, 0.38 + warp, dist);
            if (mask < 0.01) discard;

            // textura de relva em world-space, tingida de roxo (corrupção)
            vec2 wuv      = vWorldPos.xz / 5.0;
            vec3 grassRGB = texture2D(uGrass, wuv).rgb;
            float grassL  = (grassRGB.r + grassRGB.g + grassRGB.b) / 3.0;
            vec3 corrupted = mix(
                vec3(0.10, 0.02, 0.18),
                vec3(0.45, 0.12, 0.65),
                grassL
            );

            // vórtice — coordenadas rotam mais depressa quanto mais perto do centro
            vec2 swirl = rot(centered, uTime * 0.12 + (0.45 - dist) * 3.5);
            float swirlN = fbm(swirl * 5.0 + vec2(uTime * 0.05, 0.0));

            // veias radiais — riscas claras que partem do centro
            float veins = 0.0;
            veins += pow(sn(vec2(angle * 14.0, dist * 4.0 - uTime * 0.35)), 5.0);
            veins += pow(sn(vec2(angle *  9.0 + 1.7, dist * 6.5 - uTime * 0.20)), 7.0) * 0.6;
            veins *= smoothstep(0.04, 0.42, dist) * mask;

            // sparkles em world space (luzes que pulsam)
            float spark = pow(sn(vWorldPos.xz * 1.6 + uTime * 0.45), 8.0);
            spark      += pow(sn(vWorldPos.xz * 2.4 - uTime * 0.28 + 5.1), 9.0) * 0.7;

            // crackling eléctrico na borda
            float edgeRing = smoothstep(0.42 + warp, 0.50 + warp, dist) * mask;
            float crackle  = pow(sn(vec2(angle * 28.0 + uTime * 2.4, dist * 60.0)), 4.0);

            // pulses
            float pulse     = 0.5 + 0.5 * sin(uTime * 2.2);
            float slowPulse = 0.5 + 0.5 * sin(uTime * 0.7);

            // palette
            vec3 deepDark = vec3(0.05, 0.01, 0.12);
            vec3 mid      = vec3(0.40, 0.10, 0.60);
            vec3 bright   = vec3(0.75, 0.28, 0.98);
            vec3 sparkCol = vec3(1.00, 0.55, 1.00);
            vec3 ember    = vec3(1.00, 0.70, 0.40);

            // compor
            vec3 col = mix(deepDark, corrupted, 0.85);
            col      = mix(col, mid,    swirlN * 0.55);
            col      = mix(col, bright, veins * (0.65 + 0.35 * pulse));
            col      = mix(col, sparkCol, spark * (0.55 + 0.45 * pulse));
            col      = mix(col, ember,    spark * 0.10);
            col      = mix(col, sparkCol, edgeRing * crackle * 0.85);

            // halo no centro
            float centerGlow = smoothstep(0.20, 0.0, dist);
            col += vec3(0.35, 0.10, 0.55) * centerGlow * (0.35 + 0.4 * slowPulse);

            // anel brilhante na borda
            float borderGlow = smoothstep(0.36 + warp, 0.50 + warp, dist) * mask;
            col = mix(col, bright, borderGlow * 0.50 * (0.6 + 0.4 * pulse));

            gl_FragColor = vec4(col, mask * 0.95);
        }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
});

// ---- shader de "céu" corrupto — variante sem o disco ----
// Mesmo aspecto visual de matBattleGrass mas sem a máscara circular
// nem o discard: cobre toda a geometria. Usado no castelo para o
// "céu" acima das paredes.
export const matBattleSky = new THREE.ShaderMaterial({
    uniforms: {
        uTime:      { value: 0 },
        uGrass:     { value: grassTex },
        uDarken:    { value: 1.0 },
        uScale:     { value: 1.0 },
        uTimeBoost: { value: 1.0 },
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform float uDarken;
        uniform float uScale;
        uniform float uTimeBoost;
        uniform sampler2D uGrass;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float sn(vec2 p){
            vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0 - 2.0*f);
            return mix(mix(hash(i),           hash(i + vec2(1.0, 0.0)), f.x),
                       mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p){
            float v = 0.0, a = 0.5;
            for (int i = 0; i < 3; i++) { v += a * sn(p); p = p * 2.1 + vec2(3.1, 1.7); a *= 0.5; }
            return v;
        }
        vec2 rot(vec2 p, float a) {
            float c = cos(a), s = sin(a);
            return mat2(c, -s, s, c) * p;
        }

        void main() {
            float T = uTime * uTimeBoost;
            // Coordenadas em world-space (com uScale, para padrões mais
            // densos em objectos pequenos como runas).
            vec2 wuv = vWorldPos.xz * 0.18 * uScale;

            // textura de relva tingida de roxo
            vec3 grassRGB = texture2D(uGrass, wuv).rgb;
            float grassL  = (grassRGB.r + grassRGB.g + grassRGB.b) / 3.0;
            vec3 corrupted = mix(
                vec3(0.10, 0.02, 0.18),
                vec3(0.45, 0.12, 0.65),
                grassL
            );

            // vórtice
            vec2 swirl = rot(wuv, T * 0.12);
            float swirlN = fbm(swirl * 1.6 + vec2(T * 0.05, 0.0));

            // veias radiais simuladas a partir do swirl + ruído
            float veins = pow(sn(wuv * 5.0 + T * 0.3), 5.0)
                        + pow(sn(wuv * 3.5 - T * 0.2 + 1.7), 7.0) * 0.6;

            // sparkles
            float spark = pow(sn(wuv * 4.0 + T * 0.45), 8.0);
            spark      += pow(sn(wuv * 6.0 - T * 0.28 + 5.1), 9.0) * 0.7;

            float pulse     = 0.5 + 0.5 * sin(T * 2.2);
            float slowPulse = 0.5 + 0.5 * sin(T * 0.7);

            vec3 deepDark = vec3(0.05, 0.01, 0.12);
            vec3 mid      = vec3(0.40, 0.10, 0.60);
            vec3 bright   = vec3(0.75, 0.28, 0.98);
            vec3 sparkCol = vec3(1.00, 0.55, 1.00);
            vec3 ember    = vec3(1.00, 0.70, 0.40);

            vec3 col = mix(deepDark, corrupted, 0.85);
            col      = mix(col, mid,    swirlN * 0.55);
            col      = mix(col, bright, veins * (0.65 + 0.35 * pulse));
            col      = mix(col, sparkCol, spark * (0.55 + 0.45 * pulse));
            col      = mix(col, ember,    spark * 0.10);

            // pulse global suave
            col *= 0.85 + 0.25 * slowPulse;

            // factor de escurecimento (1.0 = normal)
            col *= uDarken;

            gl_FragColor = vec4(col, 1.0);
        }
    `,
    side: THREE.DoubleSide,
});

// ---- variante escura do shader de corrupção ----
// Usa o mesmo shader mas com factor de escurecimento, para detalhes
// (ex.: runas no chão do castelo) que devem ter o mesmo padrão mas
// mais discretos que o "céu".
export const matBattleDark = matBattleSky.clone();
matBattleDark.uniforms = {
    uTime:      matBattleSky.uniforms.uTime,   // partilha o tempo (mesma animação)
    uGrass:     matBattleSky.uniforms.uGrass,
    uDarken:    { value: 0.55 },               // um pouco mais escuro que o céu
    uScale:     { value: 14.0 },               // padrão muito mais denso (runas pequenas)
    uTimeBoost: { value: 2.2 },                // animação mais rápida — magia bem viva
};

// ---- shader de água ----
export const matWater = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        varying float vWave;
        uniform float uTime;
        void main() {
            vUv = uv;
            vec3 pos = position;
            float a = (sin(pos.x * 0.45 + uTime * 1.4) * 0.5 + 0.5) * 0.050;
            float b = (sin(pos.x * 0.85 - pos.y * 0.6 + uTime * 1.9) * 0.5 + 0.5) * 0.030;
            float c = (sin(pos.y * 1.6 + uTime * 0.8) * 0.5 + 0.5) * 0.018;
            float wave = a + b + c;
            pos.z += wave;
            vWave = wave;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vWave;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float sn(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0 - 2.0*f);
            return mix(mix(hash(i),           hash(i + vec2(1, 0)), f.x),
                       mix(hash(i + vec2(0,1)), hash(i + vec2(1, 1)), f.x), f.y);
        }
        float fbm(vec2 p) {
            float v = 0.0, a = 0.5;
            for (int i = 0; i < 3; i++) { v += a * sn(p); p = p * 2.05 + vec2(1.7, 9.2); a *= 0.5; }
            return v;
        }

        void main() {
            vec2 p = vec2(vUv.x * 14.0, vUv.y * 3.0);
            float n1 = fbm(p + vec2(-uTime * 0.45, sin(uTime * 0.3) * 0.4));
            float n2 = fbm(p * 1.7 + vec2(-uTime * 0.65 + 4.7, uTime * 0.18));
            float w = mix(n1, n2, 0.5);
            float ripple = sin((vUv.x * 90.0 + n1 * 6.0) - uTime * 4.2) * 0.5 + 0.5;
            ripple = pow(ripple, 16.0);
            float glint = pow(sn(vec2(vUv.x * 5.0 - uTime * 0.4, vUv.y * 2.5)), 8.0);
            vec3 deep    = vec3(0.02, 0.10, 0.30);
            vec3 mid     = vec3(0.08, 0.40, 0.72);
            vec3 surface = vec3(0.35, 0.78, 0.96);
            vec3 col = mix(deep, mid, smoothstep(0.20, 0.55, w));
            col = mix(col, surface, smoothstep(0.55, 0.85, w));
            col += vec3(0.65, 0.88, 1.0) * ripple * 0.55;
            col += vec3(1.0, 0.95, 0.7) * glint * 0.30;
            col *= 1.0 + vWave * 4.0;
            float bankDist = 1.0 - abs(vUv.y - 0.5) * 2.0;
            float foamMask = smoothstep(0.20, 0.0, bankDist);
            float foamBreak = sn(vec2(vUv.x * 30.0 + uTime * 1.8, vUv.y * 8.0 + uTime * 0.4));
            float foam = clamp(foamMask * (0.5 + foamBreak * 0.6), 0.0, 1.0);
            col = mix(col, vec3(0.94, 0.98, 1.0), foam * 0.55);
            gl_FragColor = vec4(col, 0.93);
        }
    `,
});

// ---- materiais de corrupção ----
export const matContTrunk  = new THREE.MeshStandardMaterial({ color: 0x3a2830, emissive: 0x220033, emissiveIntensity: 0.3,  roughness: 0.85 });
export const matContLeaves = new THREE.MeshStandardMaterial({ color: 0x1e3020, emissive: 0x1a0028, emissiveIntensity: 0.35, roughness: 0.85 });
export const matContRock   = new THREE.MeshStandardMaterial({ color: 0x5a5060, emissive: 0x1a0030, emissiveIntensity: 0.25, roughness: 0.95 });

export const matCorruptHalo = new THREE.ShaderMaterial({
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

        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float sn(vec2 p){
            vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                       mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
        }
        float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<3;i++){v+=a*sn(p);p=p*2.1+vec2(1.7,9.2);a*=0.5;} return v; }

        void main() {
            vec2 c = vUv - 0.5;
            float dist = length(c);
            float angle = atan(c.y, c.x);
            float warp = fbm(vec2(angle * 1.5, uTime * 0.06) + 3.7) * 0.18;
            float innerEdge = 0.18 + warp;
            float outerEdge = 0.50 + warp * 0.5;
            float mask = smoothstep(outerEdge, innerEdge, dist);
            if (mask < 0.005) discard;
            float n = fbm(vUv * 8.0 + vec2(uTime * 0.02, 0.0));
            float pulse = 0.5 + 0.5 * sin(uTime * 1.4);
            vec3 black  = vec3(0.02, 0.00, 0.04);
            vec3 purple = vec3(0.22, 0.04, 0.32);
            vec3 col = mix(black, purple, n * 0.5 + 0.15 * pulse);
            float borderGlow = smoothstep(innerEdge + 0.04, outerEdge, dist) * mask;
            col = mix(col, vec3(0.50, 0.10, 0.65), borderGlow * 0.4 * (0.6 + 0.4 * pulse));
            gl_FragColor = vec4(col, mask * 0.82);
        }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
});
