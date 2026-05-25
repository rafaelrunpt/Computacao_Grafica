// ======================================================================
// BRUXA DA LOJA DE POÇÕES (Procedural)
// ----------------------------------------------------------------------
// Criada com geometrias básicas para manter o estilo do jogo.
// Inclui animações de respiração, movimento do chapéu e uma poção flutuante.
// ======================================================================
import * as THREE from 'three';

let _bruxaGroup = null;
let _potionFloating = null;
let _hatGroup = null;
let _t = 0;

// Materiais
const matRobe = new THREE.MeshStandardMaterial({ color: 0x3d0e75, roughness: 0.8 }); // Roxo Escuro
const matRobeBainha = new THREE.MeshStandardMaterial({ color: 0x2a0852, roughness: 0.9 }); // Roxo mais escuro
const matPele = new THREE.MeshStandardMaterial({ color: 0x9ad59a, roughness: 0.6 }); // Pele esverdeada
const matChapeu = new THREE.MeshStandardMaterial({ color: 0x1a0a2e, roughness: 0.9 }); // Quase preto
const matCabelo = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 }); // Cabelo prateado
const matDetalhe = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 }); // Dourado
const matBoca = new THREE.MeshStandardMaterial({ color: 0x5a1030, roughness: 0.7 }); // Boca/lábios
const matSobrancelha = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 });

export function criarBruxa(scene, pos) {
    _bruxaGroup = new THREE.Group();
    _bruxaGroup.position.set(pos.x, pos.y + 0.05, pos.z);

    // Altura alvo: ~1.65 (jogador ~1.55, com chapéu fica ligeiramente maior)

    // 1. CORPO (Túnica Cónica) — mais baixa e esguia
    const corpoGeo = new THREE.ConeGeometry(0.35, 1.0, 14);
    const corpo = new THREE.Mesh(corpoGeo, matRobe);
    corpo.position.y = 0.5;
    corpo.castShadow = true;
    _bruxaGroup.add(corpo);

    // Bainha da túnica (anel mais escuro em baixo)
    const bainhaGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.08, 14, 1, true);
    const bainha = new THREE.Mesh(bainhaGeo, matRobeBainha);
    bainha.position.y = 0.04;
    _bruxaGroup.add(bainha);

    // Cinto dourado
    const cintoGeo = new THREE.TorusGeometry(0.22, 0.018, 6, 16);
    const cinto = new THREE.Mesh(cintoGeo, matDetalhe);
    cinto.position.y = 0.78;
    cinto.rotation.x = Math.PI / 2;
    _bruxaGroup.add(cinto);

    // Gola/colarinho
    const golaGeo = new THREE.ConeGeometry(0.18, 0.1, 12, 1, true);
    const gola = new THREE.Mesh(golaGeo, matRobeBainha);
    gola.position.y = 1.02;
    _bruxaGroup.add(gola);

    // 2. CABEÇA (ligeiramente oval, mais pequena)
    const cabecaGeo = new THREE.SphereGeometry(0.18, 20, 20);
    const cabeca = new THREE.Mesh(cabecaGeo, matPele);
    cabeca.position.y = 1.18;
    cabeca.scale.set(1, 1.05, 0.95);
    cabeca.castShadow = true;
    _bruxaGroup.add(cabeca);

    // Olhos brilhantes (mais bem definidos: esclera escura + íris amarela)
    const matEscleraOlho = new THREE.MeshStandardMaterial({ color: 0xfff8dc, roughness: 0.3 });
    const escleraGeo = new THREE.SphereGeometry(0.028, 10, 10);
    const escE = new THREE.Mesh(escleraGeo, matEscleraOlho);
    escE.position.set(-0.07, 1.22, 0.155);
    _bruxaGroup.add(escE);
    const escD = new THREE.Mesh(escleraGeo, matEscleraOlho);
    escD.position.set(0.07, 1.22, 0.155);
    _bruxaGroup.add(escD);

    const matIris = new THREE.MeshBasicMaterial({ color: 0xfff000 });
    const irisGeo = new THREE.SphereGeometry(0.016, 8, 8);
    const irisE = new THREE.Mesh(irisGeo, matIris);
    irisE.position.set(-0.07, 1.22, 0.175);
    _bruxaGroup.add(irisE);
    const irisD = new THREE.Mesh(irisGeo, matIris);
    irisD.position.set(0.07, 1.22, 0.175);
    _bruxaGroup.add(irisD);

    // Sobrancelhas (inclinadas pra dar ar misterioso)
    const sobGeo = new THREE.BoxGeometry(0.05, 0.012, 0.015);
    const sobE = new THREE.Mesh(sobGeo, matSobrancelha);
    sobE.position.set(-0.07, 1.255, 0.165);
    sobE.rotation.z = 0.25;
    _bruxaGroup.add(sobE);
    const sobD = new THREE.Mesh(sobGeo, matSobrancelha);
    sobD.position.set(0.07, 1.255, 0.165);
    sobD.rotation.z = -0.25;
    _bruxaGroup.add(sobD);

    // Nariz (cone pequeno e adunco — clássico de bruxa)
    const narizGeo = new THREE.ConeGeometry(0.025, 0.09, 8);
    const nariz = new THREE.Mesh(narizGeo, matPele);
    nariz.position.set(0, 1.19, 0.18);
    nariz.rotation.x = Math.PI / 2;
    nariz.rotation.z = Math.PI;
    _bruxaGroup.add(nariz);

    // Verruga no nariz
    const verrugaGeo = new THREE.SphereGeometry(0.012, 6, 6);
    const matVerruga = new THREE.MeshStandardMaterial({ color: 0x6b8e6b, roughness: 0.9 });
    const verruga = new THREE.Mesh(verrugaGeo, matVerruga);
    verruga.position.set(0.018, 1.205, 0.205);
    _bruxaGroup.add(verruga);

    // Boca (pequeno sorriso curvo)
    const bocaGeo = new THREE.TorusGeometry(0.025, 0.006, 6, 10, Math.PI);
    const boca = new THREE.Mesh(bocaGeo, matBoca);
    boca.position.set(0, 1.13, 0.175);
    boca.rotation.x = Math.PI; // sorriso (concavidade pra cima invertida)
    _bruxaGroup.add(boca);

    // 3. CABELO (mechas a sair do chapéu)
    const cabeloGeo = new THREE.CylinderGeometry(0.19, 0.24, 0.45, 14, 1, true);
    const cabelo = new THREE.Mesh(cabeloGeo, matCabelo);
    cabelo.position.y = 1.05;
    _bruxaGroup.add(cabelo);

    // Mechas laterais (mais soltas)
    const mechaGeo = new THREE.CylinderGeometry(0.025, 0.01, 0.3, 6);
    const mechaE = new THREE.Mesh(mechaGeo, matCabelo);
    mechaE.position.set(-0.17, 1.05, 0.05);
    mechaE.rotation.z = 0.15;
    _bruxaGroup.add(mechaE);
    const mechaD = new THREE.Mesh(mechaGeo, matCabelo);
    mechaD.position.set(0.17, 1.05, 0.05);
    mechaD.rotation.z = -0.15;
    _bruxaGroup.add(mechaD);

    // 4. CHAPÉU PONTIAGUDO
    _hatGroup = new THREE.Group();
    _hatGroup.position.y = 1.32;

    // Aba do chapéu (disco em vez de torus fino — mais visível)
    const abaGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.025, 20);
    const aba = new THREE.Mesh(abaGeo, matChapeu);
    aba.castShadow = true;
    _hatGroup.add(aba);

    // Cone do chapéu
    const coneChapeuGeo = new THREE.ConeGeometry(0.2, 0.55, 14);
    coneChapeuGeo.translate(0, 0.275, 0);
    const coneChapeu = new THREE.Mesh(coneChapeuGeo, matChapeu);
    coneChapeu.rotation.x = -0.18;
    coneChapeu.castShadow = true;
    _hatGroup.add(coneChapeu);

    // Faixa do chapéu (base do cone)
    const faixaGeo = new THREE.CylinderGeometry(0.205, 0.205, 0.06, 14);
    const faixa = new THREE.Mesh(faixaGeo, matRobe);
    faixa.position.y = 0.04;
    _hatGroup.add(faixa);

    // Fivela dourada
    const fivelaGeo = new THREE.BoxGeometry(0.08, 0.05, 0.02);
    const fivela = new THREE.Mesh(fivelaGeo, matDetalhe);
    fivela.position.set(0, 0.045, 0.2);
    _hatGroup.add(fivela);

    // Estrela na ponta do chapéu
    const estrelaGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const estrela = new THREE.Mesh(estrelaGeo, matDetalhe);
    estrela.position.set(0.55 * Math.sin(-0.18), Math.cos(-0.18) * 0.55, 0);
    _hatGroup.add(estrela);

    _bruxaGroup.add(_hatGroup);

    // 5. POÇÃO FLUTUANTE
    _potionFloating = new THREE.Group();
    _potionFloating.position.set(0.42, 0.85, 0.3);
    
    const vidroGeo = new THREE.SphereGeometry(0.09, 12, 12);
    const matVidro = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, transparent: true, opacity: 0.3, roughness: 0 
    });
    const vidro = new THREE.Mesh(vidroGeo, matVidro);
    
    const liquidoGeo = new THREE.SphereGeometry(0.07, 12, 12);
    const matLiquido = new THREE.MeshBasicMaterial({ color: 0x00ffcc }); // Ciano brilhante
    const liquido = new THREE.Mesh(liquidoGeo, matLiquido);
    
    _potionFloating.add(vidro, liquido);
    
    // Luz da poção
    const potLight = new THREE.PointLight(0x00ffcc, 0.8, 2);
    _potionFloating.add(potLight);
    
    _bruxaGroup.add(_potionFloating);

    _bruxaGroup.rotation.y = 0; // Virada para Z positivo

    scene.add(_bruxaGroup);
}

export function updateBruxa(dt, playerPos) {
    if (!_bruxaGroup) return;
    _t += dt;

    // 1. Respiração / Flutuação leve do corpo
    _bruxaGroup.position.y += Math.sin(_t * 2) * 0.001;
    
    // 2. Animação do Chapéu (balança suavemente)
    if (_hatGroup) {
        _hatGroup.rotation.z = Math.sin(_t * 1.5) * 0.05;
        _hatGroup.rotation.x = Math.cos(_t * 1.2) * 0.03;
    }

    // 3. Poção Flutuante (órbita e sobe/desce)
    if (_potionFloating) {
        _potionFloating.position.y = 0.85 + Math.sin(_t * 3) * 0.12;
        _potionFloating.rotation.y += dt * 2;
    }

    // 4. Olhar para o jogador (rotação suave no eixo Y)
    if (playerPos) {
        const dx = playerPos.x - _bruxaGroup.position.x;
        const dz = playerPos.z - _bruxaGroup.position.z;
        const distSq = dx * dx + dz * dz;
        
        if (distSq < 25) { // Se o jogador estiver perto (5 unidades)
            const targetAngle = Math.atan2(dx, dz);
            let diff = targetAngle - _bruxaGroup.rotation.y;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            _bruxaGroup.rotation.y += diff * 0.05;
        }
    }
}
