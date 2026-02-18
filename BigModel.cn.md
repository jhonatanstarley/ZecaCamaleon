# 🇨🇳 BigModel (ZhipuAI) - Guia Completo

Este documento serve como guia para configurar e entender a plataforma **BigModel open platform** (ZhipuAI), que fornece os modelos GLM-4 integrados à Zeca Extension.

**Site Oficial:** [https://bigmodel.cn](https://bigmodel.cn)  
**Documentação API:** [https://open.bigmodel.cn/dev/api/normal-model/glm-4](https://open.bigmodel.cn/dev/api/normal-model/glm-4)

---

## 1. 🚀 Como Criar sua Conta

1.  Acesse [https://bigmodel.cn](https://bigmodel.cn).
2.  Clique em **Registrar/Login** (botão azul no topo direito).
3.  Use seu número de celular (requer código SMS, geralmente funciona com números internacionais se selecionar o código do país corretamente) ou login via WeChat se disponível.
4.  Após o login, você acessará o **Console de Desenvolvedor**.

> **Nota:** Novos usuários geralmente ganham um saldo gratuito de tokens (ex: 25M tokens) válidos por 1 mês para testes.

---

## 2. 🔑 Gerando a API Key

Para usar na Zeca Extension, você precisa de uma chave de API.

1.  No painel, vá para o menu **API Keys** (ou ícone de chave).
2.  Clique em **Create API Key**.
3.  Dê um nome para a chave (ex: `Zeca-Extension`).
4.  Copie a chave gerada. O formato será algo como: `id.secret` (ex: `5f3a...29b.8X...3q`).
5.  **Na Zeca Extension:**
    *   Abra as Configurações (⚙️).
    *   Selecione Provedor: **BigModel GLM-4**.
    *   Cole a chave no campo **BigModel API Key**.

---

## 3. 🧠 Modelos Disponíveis e Usos

A plataforma oferece diversos modelos. Abaixo listamos os principais utilizados pela extensão e para que servem.

### 🏆 Modelos de Chat (Texto)

| Modelo | Descrição | Melhor Uso | Custo/Performance |
| :--- | :--- | :--- | :--- |
| **GLM-4-Plus** | O modelo mais inteligente e capaz. Estado da arte da ZhipuAI. | Raciocínio complexo, Chat, Coding, Web Search. | ⭐⭐⭐⭐⭐ (Alto) |
| **GLM-4-Air** | Equilíbrio entre performance e velocidade. | Chat geral, resumos. | ⭐⭐⭐ (Médio) |
| **GLM-4-Flash** | Modelo ultra-rápido e gratuito (ou muito barato). | **Smart Fill**, tarefas repetitivas, extração simples. | ⭐ (Grátis/Baixo) |
| **GLM-4-Long** | Suporta janelas de contexto gigantes (1M tokens). | Analisar livros inteiros, logs extensos. | ⭐⭐⭐⭐ |

### 🧭 Modelos Vetoriais (Embeddings)

| Modelo | Descrição | Melhor Uso |
| :--- | :--- | :--- |
| **Embedding-3** | Modelo de vetorização de altíssima precisão (2048 dimensões). | **RAG (Zeca Dossier)**, busca semântica, classificação. |
| **Embedding-2** | Versão anterior, mais leve. | Buscas simples. |

### 🎨 Modelos de Mídia (Imagens/Vídeo)

| Modelo | Descrição |
| :--- | :--- |
| **CogView-3 / Plus** | Geração de imagens DALL-E style. |
| **CogVideoX** | Geração de vídeos curtos a partir de texto. |

---

## 4. ⚙️ Como a Zeca Extension usa o BigModel?

A extensão utiliza uma **Estratégia em Camadas (Tiered Strategy)** para otimizar custos e inteligência:

1.  **Smart Fill (Preenchimento de Campos):**
    *   Usa **GLM-4-Flash**.
    *   *Por que?* É extremamente rápido e quase gratuito, ideal para ler o contexto e preencher inputs simples.

2.  **Chat (`/gemini` ou Chat Mode):**
    *   Usa **GLM-4-Plus**.
    *   *Por que?* Entrega a melhor qualidade de resposta, raciocínio lógico e capacidade de pesquisa na web (Web Search).

3.  **Memória (Dossier/RAG):**
    *   Usa **Embedding-3** para vetorizar sua memória.
    *   Usa **Rerank** para reordenar os resultados e encontrar a melhor informação possível.

---

## 5. 🛑 Limites de Taxa (Rate Limits)

*   **GLM-4-Flash:** Aproximadamente 100 concorrências. Ótimo para uso intensivo.
*   **GLM-4-Plus:** Aproximadamente 20 concorrências.
*   **Embedding-3:** Aproximadamente 50-100 concorrências.

**Dica:** Se você ver erros de "RPM" ou "TPM", aguarde alguns segundos e tente novamente. A extensão possui retentativas automáticas.