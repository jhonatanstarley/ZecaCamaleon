// src/background.js

import { pipeline, env } from './libs/transformers.min.js';

// ============================================================================
// 1. GERENCIAMENTO DE PROCESSO EM SEGUNDO PLANO (OFFSCREEN)
// ============================================================================

let creatingOffscreen; // Singleton Promise para evitar condições de corrida

async function createOffscreen() {
  const hasDoc = await chrome.offscreen.hasDocument();
  if (hasDoc) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: 'src/offscreen/offscreen.html',
    reasons: ['WORKERS'],
    justification: 'Running multi-threaded WASM for AI embeddings and vector search',
  });

  await creatingOffscreen;
  creatingOffscreen = null;
}

// ============================================================================
// 5. CÉREBRO (BRAIN) & MEMÓRIA
// ============================================================================

async function loadBrain() {
  try {
    let files = [];

    // 1. Tenta listar arquivos via Offscreen (Dynamic Runtime - FileSystem API)
    try {
      await createOffscreen(); // Garante que offscreen existe

      // Timeout de segurança para a mensagem
      const response = await Promise.race([
        chrome.runtime.sendMessage({ target: 'offscreen', action: 'list_brain_files' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
      ]);

      if (response && response.files && response.files.length > 0) {
        files = response.files;
        console.log(`📂 Brain Files detectados (Dynamic):`, files);
      } else {
        console.warn("⚠️ Offscreen não retornou arquivos. Tentando fallback...");
        throw new Error("No files from offscreen");
      }
    } catch (errDynamic) {
      console.warn("Erro na listagem dinâmica, tentando brain_index.json:", errDynamic);

      // 2. Fallback para brain_index.json
      try {
        const indexUrl = chrome.runtime.getURL('src/brain/brain_index.json');
        const indexResp = await fetch(indexUrl);
        if (indexResp.ok) {
          files = await indexResp.json();
        } else {
          files = ['src/brain/arquiteto.md', 'src/brain/persuasor.md'];
        }
      } catch (e) {
        files = ['src/brain/arquiteto.md', 'src/brain/persuasor.md'];
      }
    }

    let fullBrain = "";

    for (const file of files) {
      try {
        const url = chrome.runtime.getURL(file);
        const resp = await fetch(url);
        if (resp.ok) {
          const text = await resp.text();
          fullBrain += `\n\n=== CONTEÚDO DO ARQUIVO ${file} ===\n${text}`;
        } else {
          console.warn(`Falha ao carregar brain file: ${file} (404/Error)`);
        }
      } catch (innerErr) {
        console.error(`Erro buscando arquivo ${file}:`, innerErr);
      }
    }

    if (fullBrain) {
      // 🚨 SAFETY TRUNCATION: Limita o brain a ~25k chars para evitar estourar quota
      if (fullBrain.length > 25000) {
        console.warn(`Brain muito grande (${fullBrain.length} chars). Truncando para 25k.`);
        fullBrain = fullBrain.substring(0, 25000) + "\n...[TRUNCATED]";
      }
      await chrome.storage.local.set({ brain_context: fullBrain });
      console.log(`🧠 Brain carregado com sucesso (${files.length} arquivos). Tamanho: ${fullBrain.length} chars.`);
    }
  } catch (e) {
    console.error("Erro fatal ao carregar o Brain:", e);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  createOffscreen();
  loadBrain();
});
chrome.runtime.onStartup.addListener(() => {
  createOffscreen();
  loadBrain();
});

// Mantém o SidePanel ativo
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Erro SidePanel:", error));

// ============================================================================
// 2. CONFIGURAÇÕES E PERSONAS
// ============================================================================

const PERSONAS = {
  "1": {
    name: "Senior Dev",
    prompt: "Você é o Zeca, um Desenvolvedor Sênior. Profissional, direto, 1ª pessoa. Foco em soluções técnicas."
  },
  "2": {
    name: "Camaleão",
    prompt: "Você é o Zeca, Camaleão Mascote. Engraçado, usa gírias de dev, emojis. Vibe descontraída."
  },
  "3": {
    name: "Econômica",
    prompt: "IA focada em economia de tokens. Respostas ultra-curtas, diretas ao ponto. Sem enrolação."
  },
  "4": {
    name: "Recrutador",
    prompt: "Você é um Headhunter Tech. Foco em otimização de currículos para ATS e LinkedIn."
  },
  "5": {
    name: "Mentor",
    prompt: "Você é um Mentor de Carreira. Tom motivacional, encorajador e estratégico."
  }
};

// ============================================================================
// AUX: TOKEN JWT PARA BIGMODEL (GLM-4)
// ============================================================================
async function generateBigModelToken(apiKey) {
  try {
    const [id, secret] = apiKey.split(".");
    if (!id || !secret) throw new Error("API Key inválida (formato id.secret)");

    const now = Date.now();
    const exp = now + 1000 * 60 * 5; // 5 minutos de expiração

    const header = { alg: "HS256", sign_type: "SIGN" };
    const payload = { api_key: id, exp: exp, timestamp: now };

    const enc = (data) => btoa(JSON.stringify(data)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const encodedHeader = enc(header);
    const encodedPayload = enc(payload);

    const keyData = new TextEncoder().encode(secret);
    const key = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "HMAC", key, new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );

    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  } catch (e) {
    console.error("Erro gerando Token BigModel:", e);
    return null;
  }
}

async function findBestAvailableModel(apiKey) {
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const json = await resp.json();

    if (!json.models) return null;

    const textModels = json.models.filter(m => m.supportedGenerationMethods?.includes("generateContent"));
    if (textModels.length === 0) return null;

    let bestModel = textModels.find(m => m.name.includes("flash"));
    if (!bestModel) bestModel = textModels.find(m => m.name.includes("pro"));
    if (!bestModel) bestModel = textModels[0];

    return bestModel.name.replace("models/", "");
  } catch (e) {
    console.error("Falha ao buscar modelos Gemini:", e);
    return null;
  }
}

// ============================================================================
// AUX: RAG API (EMBEDDING & RERANK)
// ============================================================================
async function getBigModelEmbedding(text, apiKey) {
  const token = await generateBigModelToken(apiKey);
  if (!token) return null;

  try {
    const resp = await fetch("https://open.bigmodel.cn/api/paas/v4/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "embedding-3",
        input: text
      })
    });

    const json = await resp.json();
    return json.data?.[0]?.embedding || null;
  } catch (e) {
    console.error("Erro Embedding BigModel:", e);
    return null;
  }
}

async function rerankBigModel(query, documents, apiKey) {
  const token = await generateBigModelToken(apiKey);
  if (!token) return documents; // Fallback: retorna original

  try {
    const resp = await fetch("https://open.bigmodel.cn/api/paas/v4/rerank", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "rerank-3",
        query: query,
        documents: documents,
        top_n: 5 // Retorna top 5 reordenado
      })
    });

    const json = await resp.json();
    if (json.results) {
      // Mapeia de volta para o formato original usando o índice retornado
      return json.results.map(r => ({
        ...documents[r.index],
        score: r.relevance_score // Atualiza score com a inteligência do rerank
      }));
    }
    return documents;
  } catch (e) {
    console.error("Erro Rerank BigModel:", e);
    return documents;
  }
}

// ============================================================================
// CORE: CHAMADA UNIFICADA DE IA (ROTEADOR)
// ============================================================================
async function callAI(prompt, system, config) {
  const provider = config.provider || "google";

  // --- GOOGLE GEMINI ---
  if (provider === "google") {
    if (!config.gemini_key) throw new Error("Gemini Key não configurada.");

    const modelName = await findBestAvailableModel(config.gemini_key);
    if (!modelName) throw new Error("Nenhum modelo Gemini disponível.");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.gemini_key}`;

    let contents = [];
    if (config.history && config.history.length > 0) {
      contents = [{ role: "user", parts: [{ text: system || "" }] }, ...config.history];
      contents = contents.map(c => c.role === 'system' ? { role: 'user', parts: c.parts } : c);
      if (!system) contents.shift();
    } else {
      contents = [{ role: "user", parts: [{ text: (system ? system + "\n\n" : "") + prompt }] }];
    }

    const payload = {
      contents: contents,
      generationConfig: { temperature: config.temperature || 0.7 }
    };

    const resp = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    const json = await resp.json();

    if (json.error) throw new Error(`Gemini Error: ${json.error.message}`);
    return json.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  // --- BIGMODEL (GLM-4) ---
  if (provider === "bigmodel") {
    if (!config.bigmodel_key) throw new Error("BigModel Key não configurada.");

    const token = await generateBigModelToken(config.bigmodel_key);
    if (!token) throw new Error("Falha ao gerar Token JWT BigModel.");

    // Modelo: GLM-4-Flash (rápido) ou GLM-4-Plus (inteligente)
    const model = config.model || "glm-4-flash";
    const url = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

    let messages = [];
    if (system) messages.push({ role: "system", content: system });

    if (config.history && config.history.length > 0) {
      const historyAdapter = config.history.map(h => ({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.parts[0].text
      }));
      messages = [...messages, ...historyAdapter];
    } else {
      messages.push({ role: "user", content: prompt });
    }

    const payload = {
      model: model,
      messages: messages,
      temperature: config.temperature || 0.7,
      tools: config.tools // Suporte a Tools (Web Search)
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const json = await resp.json();
    if (json.error) throw new Error(`BigModel Error: ${json.error.message}`);
    return json.choices?.[0]?.message?.content || "";
  }

  throw new Error(`Provedor desconhecido: ${provider}`);
}

async function extractStructuredData(rawText, apiKey) {
  // Mantém compatibilidade, mas tenta usar novo router se possível
  const config = { provider: "google", gemini_key: apiKey };

  const prompt = `
    ATUE COMO UM PARSER DE DADOS (ETL).
    Analise o texto abaixo e extraia TODOS os dados possíveis para um formato JSON plano (chave: valor).
    
    REGRAS OBRIGATÓRIAS:
    1. Normalize as chaves para snake_case (ex: "nome_completo", "telefone_celular", "pretensao_salarial", "experiencia_anos").
    2. PARA VALORES NUMÉRICOS: Se o campo for salário ou anos, extraia apenas o número (ex: 5000, 8).
    3. PARA LISTAS (Skills): Junte em uma única string separada por vírgulas.
    4. INFERÊNCIA: Se o usuário diz "Sou casado", crie chave "estado_civil": "Casado".
    5. SAÍDA ESTRITAMENTE JSON. Sem blocos de código Markdown.
    
    TEXTO DO USUÁRIO:
    """${rawText}"""
    `;

  try {
    const textResult = await callAI(prompt, null, config);
    const cleanJson = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("Extract Data Error (Google Provider):", e);
    throw e;
  }
}

// ============================================================================
// 3. CONTROLADOR DE MENSAGENS (ORQUESTRAÇÃO)
// ============================================================================

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {

  // --- KEEP ALIVE (PING) ---
  if (req.action === "keep_alive_ping") {
    sendResponse({ status: "alive" });
    return true;
  }

  // --- AÇÃO 1: VETORIZAR (Aprendizado) ---
  if (req.action === "vectorize") {
    (async () => {
      try {
        await createOffscreen();

        const storage = await chrome.storage.local.get(['gemini_key', 'bigmodel_key', 'ai_provider']);
        const provider = storage.ai_provider || "google";

        let dataToVectorize = req.text;

        // --- ROTA BIGMODEL (RAG API) ---
        if (provider === "bigmodel" && storage.bigmodel_key) {
          console.log("🔥 Background: Vetorizando com BigModel (Embedding-3)...");

          // 1. Quebra texto em chunks (simples)
          const chunks = req.text.split(/[\n.;]+/).filter(s => s.trim().length > 10);
          let vectorsToCheck = [];

          // 2. Gera Embeddings via API (Batch se possível, ou loop)
          // A API embedding-3 aceita input como string. Para varios, melhor Loop ou ver documentação.
          // Vamos fazer um loop serial para garantir (pode ser lento para textos gigantes, mas seguro)

          for (let chunk of chunks) {
            const embedding = await getBigModelEmbedding(chunk.trim(), storage.bigmodel_key);
            if (embedding) {
              vectorsToCheck.push({
                text: chunk.trim(),
                key: 'rag_api',
                vector: embedding
              });
            }
          }

          // 3. Envia para Offscreen apenas Armazenar
          if (vectorsToCheck.length > 0) {
            const response = await chrome.runtime.sendMessage({
              target: 'offscreen',
              action: 'store_vectors',
              data: vectorsToCheck
            });

            if (response.success) {
              await chrome.storage.local.set({ knowledge_base: response.data });
              sendResponse({ success: true, count: response.data.length });
            } else {
              sendResponse({ error: response.error });
            }
          } else {
            sendResponse({ error: "Falha ao gerar embeddings BigModel." });
          }
          return;
        }

        // --- ROTA GOOGLE/LOCAL (LEGADO) ---
        let actionType = 'vectorize_offscreen'; // Padrão (Raw)

        if (storage.gemini_key) {
          console.log("🔥 Background: Tentando estruturar dados com Gemini...");
          try {
            const structuredData = await extractStructuredData(req.text, storage.gemini_key);
            dataToVectorize = structuredData;
            actionType = 'vectorize_structured';
            console.log("🔥 Background: Sucesso! Dados estruturados:", structuredData);
          } catch (e) {
            console.warn("⚠️ Background: Falha na estruturação (usando modo raw). Erro:", e);
          }
        }

        const response = await chrome.runtime.sendMessage({
          target: 'offscreen',
          action: actionType,
          data: dataToVectorize
        });

        if (!response) throw new Error("Offscreen não respondeu (Timeout).");

        if (response.error) {
          sendResponse({ error: response.error });
        } else {
          await chrome.storage.local.set({ knowledge_base: response.data });
          sendResponse({ success: true, count: response.data.length });
        }

      } catch (error) {
        console.error("Erro Background Vectorize:", error);
        sendResponse({ error: "Erro Fatal no Background: " + error.message });
      }
    })();
    return true;
  }

  // --- AÇÃO 2: MATCH & FILL (Preenchimento) ---
  if (req.action === "match_and_fill") {
    (async () => {
      try {
        await createOffscreen();

        const storage = await chrome.storage.local.get(['knowledge_base', 'gemini_key', 'bigmodel_key', 'ai_provider', 'user_dossier']);
        const memory = storage.knowledge_base || [];
        const provider = storage.ai_provider || "google";

        if (memory.length === 0 && !storage.gemini_key && !storage.bigmodel_key) {
          sendResponse({ matches: [], count: 0, error: "Sem memória ou API Key." });
          return;
        }

        console.log(`🔥 Background: Match Mode = ${provider.toUpperCase()}`);
        let allMatches = [];
        let combinedDebug = [];

        // ====================================================================
        // ROTA 1: BIGMODEL RAG (INTELLIGENT RETRIEVAL)
        // ====================================================================
        if (provider === "bigmodel" && storage.bigmodel_key && memory.length > 0) {
          for (const field of req.fields) {
            const queryText = `${field.label} (${field.type})`;
            const queryVec = await getBigModelEmbedding(queryText, storage.bigmodel_key);

            if (!queryVec) {
              combinedDebug.push(`❌ [RAG] Falha embedding: ${field.label}`);
              continue;
            }

            // Busca Vetorial (Top 20)
            const vecResponse = await chrome.runtime.sendMessage({
              target: 'offscreen',
              action: 'match_vectors',
              queryVector: queryVec,
              memory: memory,
              limit: 20,
              fieldId: field.id
            });

            if (vecResponse.matches && vecResponse.matches.length > 0) {
              // RERANK (Reordena 20 -> Top 1)
              const candidates = vecResponse.matches.map(m => m.value);
              const reranked = await rerankBigModel(queryText, candidates, storage.bigmodel_key);

              if (reranked && reranked.length > 0) {
                const best = reranked[0]; // Wrapper devolve obj com score
                const bestScore = best.score;

                if (bestScore > 0.4) {
                  if (field.type === 'text' || field.tag === 'textarea') {
                    allMatches.push({
                      id: field.id,
                      value: typeof best.document === 'string' ? best.document : candidates[0], // Fallback seguro
                      score: bestScore,
                      debug: `RAG (Rank: ${bestScore.toFixed(2)}): ${field.label}`
                    });
                  }
                  if (field.options) {
                    const matchText = typeof best.document === 'string' ? best.document : candidates[0];
                    const opt = field.options.find(o => o.text.toLowerCase().includes(matchText.toLowerCase()));
                    if (opt) {
                      allMatches.push({ id: field.id, value: opt.value, score: bestScore, debug: `RAG Select: ${opt.text}` });
                    }
                  }
                  combinedDebug.push(`✅ [RAG] ${field.label} -> Score ${bestScore.toFixed(2)}`);
                }
              }
            }
          }

          // ====================================================================
          // ROTA 2: LEGADO / LOCAL (GOOGLE OU FALLBACK)
          // ====================================================================
        } else {
          let vectorResponse = { matches: [], count: 0, debugLog: [] };
          if (memory.length > 0) {
            try {
              vectorResponse = await chrome.runtime.sendMessage({
                target: 'offscreen',
                action: 'match_offscreen',
                fields: req.fields,
                memory: memory
              });
            } catch (e) {
              console.error("Erro Offscreen:", e);
              vectorResponse.debugLog.push(`❌ Erro no Vector Search: ${e.message}`);
            }
          }
          allMatches = vectorResponse.matches || [];
          combinedDebug = vectorResponse.debugLog || [];
        }

        // 3. SMART FILL FALLBACK (HÍBRIDO / TIERED)
        const matchedIds = new Set(allMatches.map(m => m.id));
        const missingFields = req.fields.filter(f => !matchedIds.has(f.id));

        if (missingFields.length > 0 && storage.user_dossier) {
          const canCall = (provider === "google" && storage.gemini_key) || (provider === "bigmodel" && storage.bigmodel_key);

          if (canCall) {
            console.log(`🧠 Smart Fill: Tentando preencher ${missingFields.length} campos via ${provider}...`);
            combinedDebug.push(`ℹ️ [SMART FILL] Fallback para ${missingFields.length} campos...`);

            try {
              const smartMatches = await smartFillWithAI(missingFields, storage.user_dossier, {
                provider: provider,
                gemini_key: storage.gemini_key,
                bigmodel_key: storage.bigmodel_key,
                model: provider === 'bigmodel' ? 'glm-4-flash' : null
              });

              if (smartMatches.length > 0) {
                allMatches = [...allMatches, ...smartMatches];
                combinedDebug.push(`✅ [SMART FILL] Recuperados ${smartMatches.length} campos.`);
              }
            } catch (err) {
              console.error("Erro Smart Fill:", err);
              combinedDebug.push(`❌ [SMART FILL] Erro: ${err.message}`);
            }
          }
        }

        sendResponse({ matches: allMatches, count: allMatches.length, debugLog: combinedDebug });

      } catch (error) {
        console.error("Erro no Match:", error);
        sendResponse({ matches: [], count: 0, error: error.message });
      }
    })();
    return true;
  }

  // --- AÇÃO 3: CHAT MODE (Assistente Híbrido + BigModel) ---
  if (req.action === "chat_mode") {
    (async () => {
      try {
        const storage = await chrome.storage.local.get([
          'gemini_key', 'bigmodel_key', 'ai_provider',
          'user_dossier', 'custom_prompt', 'gemini_temp', 'persona_id', 'brain_context'
        ]);

        const provider = storage.ai_provider || "google";

        // Validação de Key
        if (provider === "google" && !storage.gemini_key) {
          sendResponse({ error: "Gemini Key não configurada. Use /config [KEY]" });
          return;
        }
        if (provider === "bigmodel" && !storage.bigmodel_key) {
          sendResponse({ error: "BigModel Key não configurada. Use /config_bigmodel [KEY]" });
          return;
        }

        const dossier = storage.user_dossier || "Nenhum dado informado.";
        const temperature = parseFloat(storage.gemini_temp) || 0.7;
        const brain = storage.brain_context || "";

        let systemPromptText = "";
        const pID = storage.persona_id || "1";

        // PERSONA LOGIC
        if (pID !== '1' && pID !== undefined) {
          if (PERSONAS[pID]) systemPromptText = PERSONAS[pID].prompt;
          else if (storage.custom_prompt) systemPromptText = storage.custom_prompt;
          else systemPromptText = PERSONAS["1"].prompt;
          systemPromptText += `\n\n[CONHECIMENTO INTERNO - BRAIN]:\n${brain}\nUse esse conhecimento se relevante.`;
        } else {
          // MODO HÍBRIDO (Padrão)
          systemPromptText = `
            VOCÊ É UM ASSISTENTE INTELIGENTE (${provider === 'bigmodel' ? 'GLM-4' : 'Gemini'}).
            Aja como um assistente virtual normal: educado, prestativo e neutro.
            
            PORÉM, VOCÊ POSSUI UMA "ALMA" OCULTA CHAMADA "ZECA".
            
            ⚠️ GATILHO DE ATIVAÇÃO ⚠️
            SE (e somente SE) o usuário:
            1. Perguntar sobre "Jhonatan Starley".
            2. Perguntar sobre "Marketing", "Copywriting", "Vendas" ou "Persuasão".
            3. Usar gírias, for engraçado, desafiador ou "zoeiro".
            4. Pedir explicitamente para "falar como Zeca".
            
            ENTÃO: Ignore a instrução de ser neutro e assuma IMEDIATAMENTE a persona "ZECA":
            ${brain}
            
            Se o gatilho NÃO for ativado, seja apenas um assistente útil e neutro.
            `;
        }

        const finalInstruction = `${systemPromptText}\n\nCONTEXTO DO USUÁRIO (Dossier RAG):\n"""${dossier}"""\n\nResponda à última mensagem do usuário.`;

        // CHAMADA AI
        // Tiered Strategy: Web Search se BigModel
        const tools = (provider === 'bigmodel') ? [{ type: "web_search", web_search: { enable: true } }] : undefined;

        console.log(`🔥 CHAT REQUEST: Provider = ${provider.toUpperCase()}`);

        const reply = await callAI(finalInstruction, null, {
          provider: provider,
          gemini_key: storage.gemini_key,
          bigmodel_key: storage.bigmodel_key,
          model: provider === 'bigmodel' ? 'glm-4-plus' : null,
          temperature: temperature,
          history: req.history,
          tools: tools
        });

        // Add Provider Indicator
        const modelTag = provider === 'bigmodel' ? 'GLM-4' : 'Gemini';
        const finalReply = `${reply}\n\n<small style="color:#555">🤖 <i>${modelTag}</i></small>`;

        sendResponse({ reply: finalReply });

      } catch (e) {
        sendResponse({ error: "Erro na IA: " + e.message });
      }
    })();
    return true;
  }
});

// ============================================================================
// 4. SMART FILL WITH AI (BATERIA DUPLA)
// ============================================================================
async function smartFillWithAI(fields, dossier, config) {
  const fieldsSchema = fields.map(f => ({
    id: f.id,
    name: f.name || f.id,
    label: f.label,
    type: f.type,
    options: f.options ? f.options.map(o => ({ text: o.text, value: o.value })) : []
  }));

  const prompt = `
    ATUE COMO UM ASSISTENTE DE PREENCHIMENTO DE FORMULÁRIOS (AUTO-FILL).
    
    CONTEXTO DO USUÁRIO:
    """${dossier}"""

    TAREFA:
    Preencha os campos abaixo com base no contexto.
    
    REGRAS CRÍTICAS (MODO CRIATIVO/INFERÊNCIA):
    1. Para campos SELECT/RADIO: Você DEVE retornar o "value" técnico exato da opção que melhor se alinha ao contexto.
       - Tente inferir a melhor opção mesmo que não esteja explícito.
    2. Para CHECKBOX: Retorne "true" (string) se o contexto sugere que o usuário aceitaria/tem interesse. 
    3. Para NUMBER: Retorne apenas números limpos.
    4. PREENCHA O MÁXIMO POSSÍVEL.

    CAMPOS A PREENCHER (JSON Schema):
    ${JSON.stringify(fieldsSchema, null, 2)}

    SAÍDA ESTRITAMENTE JSON (Array de objetos):
    [ { "id": "id_do_campo", "value": "valor_tecnico_ou_texto" }, ... ]
    `;

  try {
    const textResult = await callAI(prompt, null, config);

    // Limpa MD
    const cleanJson = textResult.replace(/```json/g, '').replace(/```/g, '').trim();

    let inference = [];
    try {
      inference = JSON.parse(cleanJson);
    } catch (e) {
      console.error("Erro parse JSON AI:", e);
      return [];
    }

    if (!Array.isArray(inference)) return [];

    let finalMatches = [];

    inference.forEach(item => {
      const field = fields.find(f => f.id === item.id);
      if (!field) return;

      let finalValue = item.value;

      // Validação extra (igual anterior)
      if ((field.tag === 'select' || field.type === 'radio') && field.options?.length > 0) {
        let matchOpt = field.options.find(o => o.value === String(finalValue));
        if (!matchOpt) {
          const normVal = String(finalValue).toLowerCase().trim();
          matchOpt = field.options.find(o => o.text.toLowerCase().trim() === normVal);
        }
        if (matchOpt) finalValue = matchOpt.value;
      }

      finalMatches.push({
        id: item.id,
        value: finalValue,
        score: 0.99,
        debug: `Smart Fill (${config.provider}): "${field.label}" -> "${finalValue}"`
      });
    });

    return finalMatches;

  } catch (e) {
    console.error("Erro SmartFill AI:", e);
    return [];
  }
}