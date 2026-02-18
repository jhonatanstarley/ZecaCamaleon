// src/offscreen/offscreen.js

import { pipeline, env } from '../libs/transformers.min.js';

// --- CONFIGURAÇÃO MULTI-THREAD & CACHE ---
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = '../libs/';
env.backends.onnx.wasm.numThreads = 4;
env.backends.onnx.wasm.proxy = true;

// --- ALMOXARIFADO DE VETORES (HIGH PERFORMANCE) ---
class VectorStore {
    constructor() {
        this.vectors = null; // Float32Array (Flat Buffer)
        this.metadata = [];  // Array<{ text, key }>
        this.dim = null;      // Detectado dinamicamente no primeiro load
        this.count = 0;
    }

    // Carrega dados crus (Array de Objetos) para Buffer Otimizado
    load(rawMemory) {
        if (!rawMemory || rawMemory.length === 0) {
            this.clear();
            return;
        }

        // Detecta dimensão do primeiro vetor válido
        const firstValid = rawMemory.find(item => item.vector && item.vector.length > 0);
        if (!firstValid) return; // Nada para carregar

        this.dim = firstValid.vector.length;
        this.count = rawMemory.length;
        this.metadata = new Array(this.count);

        // Aloca buffer único para todos os vetores (Sessão Contígua de Memória)
        this.vectors = new Float32Array(this.count * this.dim);

        for (let i = 0; i < this.count; i++) {
            const item = rawMemory[i];
            this.metadata[i] = { text: item.text, key: item.key };

            // Copia vetor para o buffer (Flat)
            if (item.vector && item.vector.length === this.dim) {
                this.vectors.set(item.vector, i * this.dim);
            } else {
                console.warn(`Vetor inválido no índice ${i}. Preenchendo com zeros.`);
            }
        }
        console.log(`🔥 VectorStore: ${this.count} itens carregados em FlatBuffer.`);
    }

    clear() {
        this.vectors = null;
        this.metadata = [];
        this.count = 0;
    }

    // Busca Otimizada (Dot Product em Flat Buffer)
    search(queryVector, limit = 5, threshold = 0.20) {
        if (!this.vectors || this.count === 0) return [];

        const scores = new Float32Array(this.count);
        const qVec = new Float32Array(queryVector); // Garante TypedArray

        // Loop Otimizado (Sem alocação de objetos no loop)
        for (let i = 0; i < this.count; i++) {
            let dot = 0.0;
            const offset = i * this.dim;

            // Unrolling manual para performance (opcional, mas ajuda em JS engines antigos)
            // Aqui confiamos no JIT do V8 para vetorizar
            for (let j = 0; j < this.dim; j++) {
                dot += qVec[j] * this.vectors[offset + j];
            }

            scores[i] = dot;
        }

        // Ordenação (Top-K)
        // Criamos índices para ordenar sem perder referência
        const indices = new Int32Array(this.count);
        for (let i = 0; i < this.count; i++) indices[i] = i;

        indices.sort((a, b) => scores[b] - scores[a]);

        const results = [];
        for (let i = 0; i < this.count && results.length < limit; i++) {
            const idx = indices[i];
            const score = scores[idx];

            if (score >= threshold) {
                results.push({
                    ...this.metadata[idx],
                    score: score
                });
            }
        }
        return results;
    }
}

// --- ESTADO GLOBAL ---
let extractor = null;
const vectorStore = new VectorStore();

// --- SISTEMA DE KEEP-ALIVE ---
setInterval(() => {
    // Ping simples para manter o Service Worker interessado neste documento
    chrome.runtime.sendMessage({ action: 'keep_alive_ping' }).catch(() => { });
}, 20000); // 20s (chrome mata em 30s)

async function loadModel() {
    if (!extractor) {
        console.log("🔥 Zeca Offscreen: Iniciando Motor IA...");
        try {
            extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                quantized: true,
                dtype: 'q8'
            });
        } catch (e) {
            console.error("🔥 Zeca Offscreen: Falha crítica no modelo.", e);
            throw e;
        }
    }
    return extractor;
}

// Normaliza texto
function normalizeText(text) {
    try {
        return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    } catch (e) {
        return String(text).toLowerCase().trim();
    }
}

// Filtra logs de ruído do console (WASM/Browser internos)
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args) => {
    const str = args.map(a => String(a)).join(' ');
    if (str.includes("Unknown CPU vendor") || str.includes("cannot be parsed")) return;
    originalConsoleError.apply(console, args);
};

console.warn = (...args) => {
    const str = args.map(a => String(a)).join(' ');
    if (str.includes("Unknown CPU vendor") || str.includes("cannot be parsed")) return;
    originalConsoleWarn.apply(console, args);
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.target !== 'offscreen') return;

    // --- NOVA AÇÃO: STORE VECTORS (API GENERATED) ---
    if (msg.action === 'store_vectors') {
        try {
            // Apenas repassa para o formato do storage, assumindo que já vem com 'vector'
            // msg.data deve ser array de { text, key, vector }
            const knowledgeBase = msg.data.map(item => ({
                key: item.key || 'api_generated',
                text: item.text,
                vector: item.vector
            }));

            // Retorna para o background salvar no storage
            sendResponse({ success: true, data: knowledgeBase });
        } catch (e) {
            console.error(e);
            sendResponse({ error: e.message });
        }
        return true;
    }

    // --- NOVA AÇÃO: MATCH VECTORS (QUERY VECTOR PRONTO) ---
    if (msg.action === 'match_vectors') {
        try {
            vectorStore.load(msg.memory);

            if (!vectorStore.dim) {
                sendResponse({ matches: [], count: 0, debugLog: ["❌ VectorStore vazio ou dimensão desconhecida."] });
                return;
            }

            // Verifica dimensão
            if (msg.queryVector.length !== vectorStore.dim) {
                throw new Error(`Dimensão incompatível: Query=${msg.queryVector.length}, Store=${vectorStore.dim}`);
            }

            const results = vectorStore.search(msg.queryVector, msg.limit || 20, msg.threshold || 0.0); // Retorna Top N para Rerank

            // Mapeia para formato padrão
            const matches = results.map(r => ({
                id: msg.fieldId, // Se for busca por campo
                value: r.text,
                score: r.score,
                metadata: r
            }));

            sendResponse({ matches: matches, count: matches.length });
        } catch (e) {
            console.error("Erro Match Vectors:", e);
            sendResponse({ error: e.message });
        }
        return true;
    }

    // --- VETORIZAR ESTRUTURADO ---
    if (msg.action === 'vectorize_structured' || msg.action === 'vectorize_offscreen') {
        (async () => {
            try {
                const model = await loadModel();
                let entries = [];

                // Prepara dados
                if (msg.action === 'vectorize_structured') {
                    entries = Object.entries(msg.data).map(([k, v]) => ({ key: k, text: String(v) }));
                } else {
                    const text = typeof msg.data === 'string' ? msg.data : msg.text;
                    const chunks = text.split(/[\n.;]+/).filter(s => s.trim().length > 4);
                    entries = chunks.map(c => ({ key: 'raw_chunk', text: c.trim() }));
                }

                // Processamento em Batch (Processar tudo de uma vez é mais rápido que Promise.all individual em loop)
                // Mas transformers.js pipeline atual aceita array de inputs? Sim.
                const textsToEmbed = entries.map(e => e.text);
                const output = await model(textsToEmbed, { pooling: 'mean', normalize: true });

                // O output.data é um Float32Array gigante com todos os embeddings concatenados
                // Precisamos fatiar
                const dim = 384;
                const knowledgeBase = [];

                for (let i = 0; i < entries.length; i++) {
                    const vector = output.data.slice(i * dim, (i + 1) * dim); // Slice cria cópia, ok para storage
                    knowledgeBase.push({
                        key: entries[i].key,
                        text: entries[i].text,
                        vector: Array.from(vector) // Serializa para salvar no storage (Chrome Storage não aceita TypedArray puro bem)
                    });
                }

                // Atualiza Store Local também
                const currentMemory = msg.memory || []; // Se vier memória antiga para merge
                // Na prática, o background costuma substituir. Vamos assumir que devolvemos o novo set.

                sendResponse({ success: true, data: knowledgeBase });

            } catch (error) {
                console.error(error);
                sendResponse({ error: error.message });
            }
        })();
        return true;
    }

    // --- MATCH INTELIGENTE (AGORA OTIMIZADO) ---
    if (msg.action === 'match_offscreen') {
        (async () => {
            try {
                const model = await loadModel();

                vectorStore.load(msg.memory);

                if (vectorStore.count === 0) {
                    sendResponse({ matches: [], count: 0 });
                    return;
                }

                let matches = [];
                let debugLog = [];

                for (let field of msg.fields) {
                    // Embedding do Label do Campo
                    const output = await model(field.label, { pooling: 'mean', normalize: true });
                    const fieldVector = output.data; // Float32Array direto

                    // Busca no VectorStore (Top 5 para debug)
                    const results = vectorStore.search(fieldVector, 5, 0.15); // Threshold Baixo para Debug

                    if (results.length === 0) {
                        debugLog.push(`❌ [NO_MATCH] ${field.label}: Sem correspondência semântica.`);
                        continue;
                    }

                    // Pega o melhor match (Top 1)
                    const bestItem = results[0];
                    const userValue = bestItem.text;
                    const bestScore = bestItem.score;

                    // --- TRATAMENTO POR TIPO ---

                    // A) SELECT/COMBOBOX
                    if (field.tag === 'select' && field.options.length > 0) {
                        const valVec = (await model(normalizeText(userValue), { pooling: 'mean', normalize: true })).data;

                        let bestOptionVal = null;
                        let bestOptionScore = -1;
                        let bestOptionText = "N/A";

                        // Vetoriza todas opções
                        const optTexts = field.options.map(o => normalizeText(o.text));
                        const optOutputs = await model(optTexts, { pooling: 'mean', normalize: true });

                        // Compara
                        for (let i = 0; i < field.options.length; i++) {
                            const optVec = optOutputs.data.slice(i * 384, (i + 1) * 384);

                            let dot = 0.0;
                            for (let j = 0; j < 384; j++) dot += valVec[j] * optVec[j];

                            if (dot > bestOptionScore) {
                                bestOptionScore = dot;
                                bestOptionVal = field.options[i].value;
                                bestOptionText = field.options[i].text;
                            }
                        }

                        // Threshold Reduzido (0.25) - Modo "Macio"
                        if (bestOptionScore > 0.25) {
                            matches.push({ id: field.id, value: bestOptionVal, score: bestScore });
                            debugLog.push(`✅ [SELECT] ${field.label} matched "${bestOptionText}" (${bestOptionScore.toFixed(2)})`);
                        } else {
                            debugLog.push(`❌ [SELECT] ${field.label}: Best "${bestOptionText}" (${bestOptionScore.toFixed(2)}) < 0.25`);
                        }
                    }

                    // B) CHECKBOX/RADIO
                    else if (field.type === 'radio' || field.type === 'checkbox') {
                        const valVec = (await model(normalizeText(userValue), { pooling: 'mean', normalize: true })).data;

                        let dot = 0.0;
                        for (let j = 0; j < 384; j++) dot += valVec[j] * fieldVector[j];

                        // Threshold Reduzido (0.25) - Modo "Macio"
                        if (dot > 0.25) {
                            matches.push({ id: field.id, value: "true", score: dot });
                            debugLog.push(`✅ [BOOL] ${field.label} matched (${dot.toFixed(2)})`);
                        } else {
                            debugLog.push(`❌ [BOOL] ${field.label}: Score ${dot.toFixed(2)} < 0.25`);
                        }
                    }

                    // C) TEXTO
                    else {
                        // Threshold Texto (0.28)
                        if (bestScore > 0.28) {
                            matches.push({ id: field.id, value: userValue, score: bestScore });
                            debugLog.push(`✅ [TEXT] ${field.label} matched "${userValue}" (${bestScore.toFixed(2)})`);
                        } else {
                            debugLog.push(`❌ [TEXT] ${field.label}: Score ${bestScore.toFixed(2)} < 0.28`);
                        }
                    }
                }

                sendResponse({ matches: matches, count: matches.length, debugLog: debugLog });

            } catch (error) {
                console.error("Erro Match:", error);
                sendResponse({ error: error.message });
            }
        })();
        return true;
    }

    // --- LISTAR ARQUIVOS DO BRAIN (DYNAMIC) ---
    if (msg.action === 'list_brain_files') {
        (async () => {
            try {
                // Tenta carregar do index JSON (que deve ser gerado no build ou mantido manualmente)
                const indexUrl = chrome.runtime.getURL('src/brain/brain_index.json');
                const resp = await fetch(indexUrl);
                if (resp.ok) {
                    const files = await resp.json();
                    console.log("📂 [Offscreen] Brain Files (Index):", files);
                    sendResponse({ files: files });
                } else {
                    throw new Error("Index not found");
                }
            } catch (e) {
                console.warn("⚠️ [Offscreen] Falha no índice dinâmico, usando fallback estático:", e);
                // Fallback hardcoded caso o index falhe
                const fallbackFiles = [
                    'src/brain/arquiteto.md',
                    'src/brain/persuasor.md',
                    'src/brain/zeca_base.md'
                ];
                sendResponse({ files: fallbackFiles });
            }
        })();
        return true; // Async response
    }
});