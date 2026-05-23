import * as THREE from 'three';

// Tesselação reduzida (32x16). A 450 unidades a esfera ocupa quase todo o
// frustum — o detalhe veio sempre do shader (estrelas/lua), não da malha;
// 64x64 = 8192 triângulos era desperdício puro no vertex stage.
const starGeo = new THREE.SphereGeometry(450, 32, 16);
export const starMat = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 }
    },
    vertexShader: `
        varying vec3 vNormal;
        void main() {
            vNormal = normalize(normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        varying vec3 vNormal;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        void main() {
            vec3 n = normalize(vNormal);

            // --- ESTRELAS DOURADAS ---
            float lon = atan(n.z, n.x);
            float lat = asin(n.y);
            vec2 starUV = vec2(lon * 25.0, lat * 40.0);
            vec2 ipos = floor(starUV);
            vec2 fpos = fract(starUV);
            
            float h = hash(ipos);
            float star = 0.0;
            if (h > 0.97) {
                float size = hash(ipos + 0.5) * 0.4 + 0.1;
                float dist = length(fpos - 0.5);
                star = smoothstep(size, 0.0, dist);
            }
            
            // --- LUA EM QUARTO MINGUANTE ---
            // Direcção mais alta no céu para entrar no campo de visão
            vec3 moonDir = normalize(vec3(-0.18, 0.24, -0.95));
            float moonDot = dot(n, moonDir);
            float moonMask = smoothstep(0.9982, 0.9985, moonDot);

            // Disco oclusor — desviado em +x (lado direito) e marginalmente
            // maior, "come" o lado direito do disco da lua.
            vec3 occDir = normalize(moonDir + vec3(0.035, 0.0, 0.0));
            float occDot = dot(n, occDir);
            float occMask = smoothstep(0.9979, 0.9983, occDot);
            moonMask *= (1.0 - occMask);

            float moonGlow = pow(max(0.0, moonDot), 600.0) * 0.9;
            moonGlow += pow(max(0.0, moonDot), 30.0) * 0.18;

            vec3 starCol = vec3(1.0, 0.85, 0.4) * star;
            vec3 moonCol = vec3(1.0, 0.9, 0.5) * moonMask;
            vec3 auraCol = vec3(1.0, 0.8, 0.3) * moonGlow;
            
            vec3 nebula = vec3(0.01, 0.005, 0.035) * (n.y * 0.5 + 0.5);
            vec3 col = nebula + starCol + moonCol + auraCol;
            
            gl_FragColor = vec4(col, 1.0);
        }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    clippingPlanes: []
});

export const skybox = new THREE.Mesh(starGeo, starMat);
skybox.frustumCulled = false;

// Segunda instância do céu nocturno para a cena de combate. Um THREE.Mesh
// só pode ter um pai, por isso o combate não pode reutilizar o `skybox` do
// mundo — esta partilha apenas a geometria e o material.
export const skyboxCombate = new THREE.Mesh(starGeo, starMat);
skyboxCombate.frustumCulled = false;
