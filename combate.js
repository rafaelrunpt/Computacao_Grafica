import { mapGrid, tileSize } from './mapa.js';

// Usamos um objeto para guardar o estado, assim o main.js consegue ler as alterações
export const estadoJogo = {
    emCombate: false
};

export function verificarEncontro(jogadorX, jogadorZ) {
    if (estadoJogo.emCombate) return;

    // 1. Descobrir em que bloco da grelha o jogador está a pisar
    const gridX = Math.round(jogadorX / tileSize);
    const gridZ = Math.round(jogadorZ / tileSize);

    // Proteção para não dar erro se o jogador sair dos limites do mapa
    if (gridZ < 0 || gridZ >= mapGrid.length || gridX < 0 || gridX >= mapGrid[0].length) return;

    const tileAtual = mapGrid[gridZ][gridX];

    // 2. Se o bloco for 3 (Relva Alta), rolamos os dados!
    if (tileAtual === 3) {
        // Chance de 1.5% a cada "frame" de movimento para encontrar um monstro
        if (Math.random() < 0.015) {
            iniciarTransicao();
        }
    }
}

function iniciarTransicao() {
    estadoJogo.emCombate = true;

    // Transição estilo Pokémon clássico (O ecrã pisca a preto e branco invertendo as cores)
    let piscas = 0;
    const tempoPisca = 100; // milissegundos
    
    const intervalo = setInterval(() => {
        document.body.style.filter = piscas % 2 === 0 ? 'invert(100%)' : 'none';
        piscas++;

        // Fim da transição (piscou 6 vezes)
        if (piscas > 6) {
            clearInterval(intervalo);
            document.body.style.filter = 'none';
            
            // Aqui é onde mais tarde faremos load da Arena e da UI.
            // Por agora, damos um alerta e devolvemos o controlo ao jogador.
            setTimeout(() => {
                alert("BOO encontraste um shaco");
                estadoJogo.emCombate = false; 
            }, 100);
        }
    }, tempoPisca);
}