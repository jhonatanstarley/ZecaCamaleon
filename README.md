# 🔥 Zeca: *Quente viu, quente vê!* 👁️

> **"A extensão que preenche o que o recrutador tem preguiça de ler."**

![Zeca Logo](icons/zeca128.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest_V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Powered By](https://img.shields.io/badge/AI-GLM4_&_Gemini-orange)](https://bigmodel.cn/)

---

## 💡 Sobre o Projeto

Idealizado por **Celso de Sá**, o **Zeca** é um camaleão cibernético que vive no seu navegador. Ele é uma **Extensão CLI (Command Line Interface)** focada em **Automação de Formulários de Vagas** (ATS, Gupy, LinkedIn, etc.).

O problema é simples: recrutadores pedem seu currículo, mas depois pedem para você preencher tudo de novo em formulários chatos. O Zeca resolve isso usando **IA Local (RAG)** e **LLMs** para ler a página, entender os campos e preencher com seus dados automaticamente.

---

## 🚀 Funcionalidades (Atualizado v1.2.7)

### 🧠 Cérebro & Memória
- **Memória Vetorial Local:** Você ensina o Zeca com seu CV (`/dossier`) e ele aprende seus dados. Tudo fica salvo no seu PC (IndexedDB/Storage).
- **🆕 Memória Cumulativa:** Agora você pode adicionar informações aos poucos. O Zeca concatena e re-vetoriza tudo. Use `/dossier --clear` para limpar.
- **🆕 Backup de Memória:** Exporte tudo o que o Zeca sabe sobre você com `/export`.

### 🤖 IA & Modelos (Tiered Strategy)
- **Smart Fill (Preenchimento):** Usa **GLM-4-Flash** (BigModel) ou **Gemini Flash** para preencher formulários com extrema velocidade e baixo custo.
- **Chat Avançado:** Converse com o Zeca (`/gemini`) para gerar cover letters ou tirar dúvidas. Agora com suporte a **Web Search** (via GLM-4-Plus) para dados em tempo real.
- **RAG de Alta Precisão:** Combina **Embedding-3** (2048 dims) com **Reranker** para encontrar a informação exata no seu dossiê.

### � Interface (Terminal Retro)
- **Scan de Página:** Analisa o DOM da página ativa para identificar campos de input (`/scan`).
- **Preenchimento Inteligente:** Usa `Cosine Similarity` para casar seus dados com os campos do formulário (`/fill`).
- **🆕 Multiline Input:** Área de texto expandível para colar textos longos.
- **🆕 Botão Send/Stop:** Cancele requisições demoradas com um clique.
- **🆕 Menu Lateral (Drawer):** Acesso rápido a todas as funções sem digitar comandos.

---

## 🛠️ Tech Stack

| Camada | Tecnologia |
|---|---|
| **Core** | JavaScript (ES6 Modules) |
| **AI Local** | [Transformers.js](https://huggingface.co/docs/transformers.js/) — Embeddings `all-MiniLM-L6-v2` |
| **AI Cloud** | **BigModel GLM-4** (ZhipuAI) & **Google Gemini** |
| **Engine** | ONNX Runtime Web (`.wasm` via WebAssembly) |
| **Interface** | HTML/CSS (Terminal Retro Style) |

---

## 📦 Instalação (Modo Dev)

Como este projeto usa arquivos binários pesados (`.wasm`), siga os passos abaixo:

**1. Clone este repositório:**

```bash
git clone https://github.com/SEU_USUARIO/zeca-extension.git
cd zeca-extension
```

**2. Baixe as Dependências (WASM):**

Baixe os arquivos abaixo e salve-os na pasta `src/libs/`:

- [`ort-wasm-simd.wasm`](https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.14.0/ort-wasm-simd.wasm)
- [`ort-wasm.wasm`](https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.14.0/ort-wasm.wasm)
- *(O arquivo `transformers.min.js` já deve estar presente na pasta)*

**3. Carregue no Chrome:**

- Abra `chrome://extensions/`
- Ative o **Modo do desenvolvedor** (canto superior direito)
- Clique em **Carregar sem compactação** *(Load unpacked)*
- Selecione a pasta raiz do projeto

---

## 💻 Como Usar

Clique no ícone do Zeca 🔥 ou use o atalho para abrir o painel lateral.

### Comandos Principais

| Comando | Descrição |
|---|---|
| `/config` | Abre o painel de configurações (API Keys, Provider, Persona). |
| `/scan` | O Zeca "olha" para a página aberta e acha os campos. |
| `/fill` | O Zeca preenche os campos com base no Dossiê (Smart Fill). |
| `/dossier [TEXTO]` | Adiciona novos dados à memória do Zeca. |
| `/dossier --clear` | 🗑️ Apaga toda a memória do Zeca. |
| `/gemini [MSG]` | Conversa direta com a IA (com Web Search se BigModel). |
| `/export` | 📥 Baixa o backup da memória (.json). |
| `/temp [0-2]` | Ajusta a criatividade da IA manualmente. |
| `/help` | Abre o manual completo. |

> 💡 **Dica:** Se você digitar qualquer coisa sem a barra `/`, o Zeca entra em modo chat e responde suas dúvidas!

---

## 🧬 Como a Memória do Zeca Funciona

O Zeca mantém a conversa de forma contínua e inteligente dentro da mesma sessão — mas é importante entender os dois tipos de memória que ele usa.

### 1. 🟡 Memória de Curto Prazo (RAM / Sessão)

No arquivo `terminal.js`, existe a variável `chatHistory`. A cada mensagem sua ou do Zeca, ela é adicionada nessa lista. Ao enviar uma nova mensagem, o histórico completo é enviado para a IA, garantindo que ele entenda o contexto recente.

**Porém:** como `chatHistory` vive na memória do JavaScript, ela é **apagada** se você fechar o painel.

### 2. 🟢 Memória de Longo Prazo (`chrome.storage.local`)

Esses dados **persistem** mesmo após fechar e reabrir o painel:

| Dado | Comando | O que salva |
|---|---|---|
| **Dossiê (Brain)** | `/dossier` | Seu CV e dados pessoais (Vetorizados). |
| **Conhecimento** | RAG | Vetores gerados pelo `embedding-3` (BigModel) ou Local. |
| **API Key** | `/config` | Suas chaves de API (Criptografadas no browser). |

O `systemInstruction` é reinjetado automaticamente a cada mensagem, então o Zeca nunca esquece quem você é — só esquece o papo furado anterior.

---

## 🤝 Contribuição

Pull Requests são bem-vindos! Se você manja de Prompt Engineering, Regex ou CSS Matrix, chega junto.

1. Fork o projeto
2. Crie sua Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a Branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## 📄 Licença

Distribuído sob a licença MIT. Veja [`LICENSE`](LICENSE.md) para mais informações.

---

<p align="center">
  Feito com ☕, ódio a formulários e IA.<br>
  <b>Idea by Celso de Sá</b>
</p>
