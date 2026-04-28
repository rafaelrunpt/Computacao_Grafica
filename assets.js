import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

export const modelos = {
    casa: null
};

export function carregarAssets() {
    const loader = new GLTFLoader();

    // Lista vazia por agora, mas a estrutura está pronta para o futuro
    const listaParaCarregar = [];

    const promessas = listaParaCarregar.map(item => {
        return new Promise((resolve, reject) => {
            loader.load(item.url, 
                (gltf) => {
                    gltf.scene.traverse(node => {
                        if (node.isMesh) {
                            node.castShadow = true;
                            node.receiveShadow = true;
                        }
                    });
                    modelos[item.id] = gltf.scene;
                    resolve();
                },
                undefined,
                (error) => reject(error)
            );
        });
    });

    return Promise.all(promessas);
}