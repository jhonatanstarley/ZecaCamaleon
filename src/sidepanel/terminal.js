// src/sidepanel/terminal.js

// --- ELEMENTOS DO DOM (TERMINAL) ---
const output = document.getElementById('output');
const input = document.getElementById('command-input');

// --- ELEMENTOS DO MODAL HELP (MANUAL) ---
const modalHelp = document.getElementById('help-modal');
const btnHelpTrigger = document.getElementById('btn-help-trigger'); // Botão ? no Header
const btnCloseHelp = document.getElementById('btn-close-help');
const btnLangHelp = document.getElementById('btn-lang-toggle'); // Button EN inside Help
const contentManualPT = document.getElementById('content-pt');
const contentManualEN = document.getElementById('content-en');

// --- ELEMENTOS DO MODAL ADMIN (CONFIG) ---
const modalAdmin = document.getElementById('admin-modal');
const btnAdminTrigger = document.getElementById('btn-admin-trigger'); // Botão ⚙️ no Header
const btnCloseAdmin = document.getElementById('btn-close-admin');

// Config Content Sections
const configPT = document.getElementById('config-pt');
const configEN = document.getElementById('config-en');
const btnToggleConfigLang = document.getElementById('btn-toggle-config-lang');
const btnToggleConfigLangBack = document.getElementById('btn-toggle-config-lang-back');


// --- ELEMENTOS DO MENU DRAWER ---
const drawer = document.getElementById('menu-drawer');
const overlay = document.getElementById('menu-overlay');
const btnMenu = document.getElementById('btn-menu-trigger');
const btnCloseMenu = document.getElementById('btn-menu-close');

// Drawer Sections
const drawerPT = document.getElementById('drawer-pt');
const drawerEN = document.getElementById('drawer-en');

// PT Drawer Buttons
const btnDrawerAdmin = document.getElementById('btn-drawer-admin');
const btnDrawerHelp = document.getElementById('btn-drawer-help');
const btnDrawerLang = document.getElementById('btn-drawer-lang');

// EN Drawer Buttons
const btnDrawerAdminEN = document.getElementById('btn-drawer-admin-en');
const btnDrawerHelpEN = document.getElementById('btn-drawer-help-en');
const btnDrawerLangEN = document.getElementById('btn-drawer-lang-en');


// --- INPUTS DE ADMIN ---
const btnSaveAdmin = document.getElementById('btn-save-admin');
const btnSaveAdminEN = document.getElementById('btn-save-admin-en');
const adminMsg = document.getElementById('admin-msg');
const adminMsgEN = document.getElementById('admin-msg-en');

// PT Inputs
const adminProvider = document.getElementById('admin-provider');
const adminGeminiKey = document.getElementById('admin-gemini-key');
const adminBigmodelKey = document.getElementById('admin-bigmodel-key');
const adminTemp = document.getElementById('admin-temp');
const adminTempVal = document.getElementById('admin-temp-val');
const adminPersona = document.getElementById('admin-persona');

// EN Inputs
const adminProviderEN = document.getElementById('admin-provider-en');
const adminGeminiKeyEN = document.getElementById('admin-gemini-key-en');
const adminBigmodelKeyEN = document.getElementById('admin-bigmodel-key-en');
const adminTempEN = document.getElementById('admin-temp-en');
const adminTempValEN = document.getElementById('admin-temp-val-en');
const adminPersonaEN = document.getElementById('admin-persona-en');


// --- VARIÁVEIS DE ESTADO ---
let currentLang = 'pt';
let chatHistory = [];

// ============================================================================
// 1. EVENT LISTENERS (UI)
// ============================================================================

// --- MENU DRAWER ---
function toggleDrawer(show) {
  if (show) {
    drawer.classList.remove('hidden');
    overlay.classList.remove('hidden');
  } else {
    drawer.classList.add('hidden');
    overlay.classList.add('hidden');
  }
}

if (btnMenu) btnMenu.addEventListener('click', () => toggleDrawer(true));
if (btnCloseMenu) btnCloseMenu.addEventListener('click', () => toggleDrawer(false));
if (overlay) overlay.addEventListener('click', () => toggleDrawer(false));

// Quick Actions (Delegation for both PT and EN buttons)
function handleQuickAction(e) {
  const btn = e.target.closest('.drawer-item');
  if (btn && btn.hasAttribute('data-cmd')) {
    const cmd = btn.getAttribute('data-cmd');
    toggleDrawer(false);
    input.value = cmd;
    processCommand(cmd);
  }
}
if (drawerPT) drawerPT.addEventListener('click', handleQuickAction);
if (drawerEN) drawerEN.addEventListener('click', handleQuickAction);


// --- ADMIN MODAL (SETTINGS) ---
function toggleAdmin(show) {
  if (show) {
    modalAdmin.classList.remove('hidden');
    loadAdminConfig(); // Load keys
  } else {
    modalAdmin.classList.add('hidden');
  }
}

if (btnAdminTrigger) btnAdminTrigger.addEventListener('click', () => toggleAdmin(true));
if (btnCloseAdmin) btnCloseAdmin.addEventListener('click', () => toggleAdmin(false));
// Drawer Triggers (PT)
if (btnDrawerAdmin) btnDrawerAdmin.addEventListener('click', () => { toggleDrawer(false); toggleAdmin(true); });
// Drawer Triggers (EN)
if (btnDrawerAdminEN) btnDrawerAdminEN.addEventListener('click', () => { toggleDrawer(false); toggleAdmin(true); });

if (btnSaveAdmin) btnSaveAdmin.addEventListener('click', saveAdminConfig);
if (btnSaveAdminEN) btnSaveAdminEN.addEventListener('click', saveAdminConfig);


// --- HELP MODAL (MANUAL) ---
function toggleHelp(show) {
  if (show) modalHelp.classList.remove('hidden');
  else modalHelp.classList.add('hidden');
}

if (btnHelpTrigger) btnHelpTrigger.addEventListener('click', () => toggleHelp(true));
if (btnCloseHelp) btnCloseHelp.addEventListener('click', () => toggleHelp(false));
// Drawer Triggers (PT)
if (btnDrawerHelp) btnDrawerHelp.addEventListener('click', () => { toggleDrawer(false); toggleHelp(true); });
// Drawer Triggers (EN)
if (btnDrawerHelpEN) btnDrawerHelpEN.addEventListener('click', () => { toggleDrawer(false); toggleHelp(true); });


// --- LANGUAGE TOGGLES (GLOBAL) ---

function setLanguage(lang) {
  currentLang = lang;

  // 1. Toggle Drawer Content
  if (currentLang === 'pt') {
    drawerPT.classList.remove('hidden');
    drawerEN.classList.add('hidden');
  } else {
    drawerPT.classList.add('hidden');
    drawerEN.classList.remove('hidden');
  }

  // 2. Toggle Manual Content
  if (currentLang === 'pt') {
    contentManualPT.classList.remove('hidden');
    contentManualEN.classList.add('hidden');
    btnLangHelp.innerText = 'EN';
  } else {
    contentManualPT.classList.add('hidden');
    contentManualEN.classList.remove('hidden');
    btnLangHelp.innerText = 'PT';
  }

  // 3. Toggle Config Content (Optional: Sync with global lang)
  // We can choose to sync config modal too, or let it be independent.
  // Let's sync it for consistency if user changes via Drawer.
  switchConfigLang(currentLang);
}

function switchConfigLang(lang) {
  if (lang === 'en') {
    configPT.classList.add('hidden');
    configEN.classList.remove('hidden');
  } else {
    configPT.classList.remove('hidden');
    configEN.classList.add('hidden');
  }
}

// Config Modal Toggles
if (btnToggleConfigLang) btnToggleConfigLang.addEventListener('click', () => setLanguage('en'));
if (btnToggleConfigLangBack) btnToggleConfigLangBack.addEventListener('click', () => setLanguage('pt'));

// Manual Modal Toggle
if (btnLangHelp) btnLangHelp.addEventListener('click', () => {
  setLanguage(currentLang === 'pt' ? 'en' : 'pt');
});

// Drawer Toggles
if (btnDrawerLang) btnDrawerLang.addEventListener('click', () => setLanguage('en'));
if (btnDrawerLangEN) btnDrawerLangEN.addEventListener('click', () => setLanguage('pt'));


// --- SYNC INPUTS (PT <-> EN) ---
function syncInputs(source, target) {
  if (source && target) {
    source.addEventListener('input', () => target.value = source.value);
  }
}
// Sync Keys
syncInputs(adminGeminiKey, adminGeminiKeyEN);
syncInputs(adminGeminiKeyEN, adminGeminiKey);
syncInputs(adminBigmodelKey, adminBigmodelKeyEN);
syncInputs(adminBigmodelKeyEN, adminBigmodelKey);

// Sync Temp Slider
if (adminTemp) adminTemp.addEventListener('input', (e) => {
  if (adminTempVal) adminTempVal.innerText = e.target.value;
  if (adminTempEN) adminTempEN.value = e.target.value;
  if (adminTempValEN) adminTempValEN.innerText = e.target.value;
});
if (adminTempEN) adminTempEN.addEventListener('input', (e) => {
  if (adminTempValEN) adminTempValEN.innerText = e.target.value;
  if (adminTemp) adminTemp.value = e.target.value;
  if (adminTempVal) adminTempVal.innerText = e.target.value;
});


// ============================================================================
// 2. FUNÇÕES LÓGICAS (ADMIN E STORAGE)
// ============================================================================

async function loadAdminConfig() {
  const data = await chrome.storage.local.get([
    'ai_provider', 'gemini_key', 'bigmodel_key', 'gemini_temp', 'persona_id'
  ]);

  // Populate PT
  if (adminProvider) adminProvider.value = data.ai_provider || 'google';
  if (adminGeminiKey) adminGeminiKey.value = data.gemini_key || '';
  if (adminBigmodelKey) adminBigmodelKey.value = data.bigmodel_key || '';
  if (adminTemp) {
    adminTemp.value = data.gemini_temp || 0.7;
    if (adminTempVal) adminTempVal.innerText = adminTemp.value;
  }
  if (adminPersona) adminPersona.value = data.persona_id || '1';

  // Populate EN
  if (adminProviderEN) adminProviderEN.value = data.ai_provider || 'google';
  if (adminGeminiKeyEN) adminGeminiKeyEN.value = data.gemini_key || '';
  if (adminBigmodelKeyEN) adminBigmodelKeyEN.value = data.bigmodel_key || '';
  if (adminTempEN) {
    adminTempEN.value = data.gemini_temp || 0.7;
    if (adminTempValEN) adminTempValEN.innerText = adminTempEN.value;
  }
  if (adminPersonaEN) adminPersonaEN.value = data.persona_id || '1';
}

async function saveAdminConfig() {
  try {
    // Reads from PT inputs as primary source (since they are synced)
    const provider = adminProvider.value;
    const geminiKey = adminGeminiKey.value.trim();
    const bigmodelKey = adminBigmodelKey.value.trim();
    const temp = parseFloat(adminTemp.value);
    const persona = adminPersona.value; // Or adminPersonaEN.value if active

    // Check if user is editing on EN tab, maybe update provider/persona from EN inputs if they differ?
    // For simplicity, let's trust syncing or just read from active tab.
    // But since select boxes are not auto-synced by 'input' event, we should check visibility.
    let finalProvider = provider;
    let finalPersona = persona;

    if (!configEN.classList.contains('hidden')) {
      finalProvider = adminProviderEN.value;
      finalPersona = adminPersonaEN.value;
    }

    await chrome.storage.local.set({
      ai_provider: finalProvider,
      gemini_key: geminiKey,
      bigmodel_key: bigmodelKey,
      gemini_temp: temp,
      persona_id: finalPersona
    });

    const feedback = "✅ Saved/Salvo!";
    if (adminMsg) {
      adminMsg.innerText = feedback;
      setTimeout(() => adminMsg.innerText = "", 3000);
    }
    if (adminMsgEN) {
      adminMsgEN.innerText = feedback;
      setTimeout(() => adminMsgEN.innerText = "", 3000);
    }

    printLine("⚙️ System Configuration Updated.", "system");

  } catch (e) {
    if (adminMsg) adminMsg.innerText = "❌ Erro: " + e.message;
    if (adminMsgEN) adminMsgEN.innerText = "❌ Error: " + e.message;
  }
}

// ... (Rest of terminal functions: printLine, input listener, processCommand - UNCHANGED)

function parseMarkdown(text) {
  if (!text) return '';
  let formatted = text;
  if (/^```[\s\S]*```$/.test(formatted.trim())) {
    formatted = formatted.trim().replace(/^```[a-z]*\s?([\s\S]*?)```$/i, '$1').trim();
  }
  formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<i>$1</i>');
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

function printLine(text, type = 'system') {
  const div = document.createElement('div');
  div.className = `line ${type}`;
  if (type === 'zeca' || type === 'system') {
    div.innerHTML = parseMarkdown(text);
  } else {
    div.innerHTML = text;
  }
  output.appendChild(div);
  output.scrollTop = output.scrollHeight;
}

// AUTO-RESIZE INPUT
input.addEventListener('input', () => {
  input.style.height = 'auto'; // Reset to calculate
  input.style.height = (input.scrollHeight) + 'px'; // Grow
});

const btnSend = document.getElementById('btn-send');
let isProcessing = false;
let currentAbortFlag = { cancelled: false };

// --- TOGGLE UI STATE ---
function toggleSendState(processing) {
  isProcessing = processing;
  if (processing) {
    btnSend.innerHTML = '<i class="fas fa-stop"></i>';
    btnSend.classList.add('stop');
    btnSend.title = "Cancelar (Stop)";
  } else {
    btnSend.innerHTML = '<i class="fas fa-paper-plane"></i>';
    btnSend.classList.remove('stop');
    btnSend.title = "Enviar";
  }
}

// --- SEND MESSAGE LOGIC ---
async function handleSend() {
  // 1. IF PROCESSING -> CANCEL
  if (isProcessing) {
    currentAbortFlag.cancelled = true;
    printLine("⛔ Requisição cancelada pelo usuário.", 'error');
    toggleSendState(false);

    // Optional: Remove "typing" indicator if exists
    const loadingMsg = output.querySelector('.system:last-child');
    if (loadingMsg && loadingMsg.innerText.includes("digitando")) loadingMsg.remove();
    return;
  }

  // 2. IF IDLE -> SEND
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto'; // Reset height

  // Start Processing State
  toggleSendState(true);
  currentAbortFlag = { cancelled: false }; // Reset flag for new request
  const myFlag = currentAbortFlag; // Closure capture

  try {
    if (text.startsWith('/')) {
      printLine(`root@zeca:~$ ${text.replace(/\n/g, '<br>')}`, 'user');
      await processCommand(text, myFlag);
    } else {
      printLine(`Você: ${text.replace(/\n/g, '<br>')}`, 'user');
      await chatWithZeca(text, myFlag);
    }
  } catch (err) {
    printLine(`Erro: ${err.message}`, 'error');
  } finally {
    // Only reset if THIS request wasn't already cancelled/reset
    if (myFlag === currentAbortFlag) {
      toggleSendState(false);
    }
  }
}

// Event Listeners
if (btnSend) btnSend.addEventListener('click', handleSend);

input.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

async function chatWithZeca(message, abortFlag) {
  printLine("Zeca está digitando...", 'system');
  chatHistory.push({ role: "user", parts: [{ text: message }] });

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: "chat_mode",
      history: chatHistory
    }, (response) => {
      // CHECK CANCELLATION
      if (abortFlag && abortFlag.cancelled) return resolve();

      if (chrome.runtime.lastError) {
        const loadingMsg = output.querySelector('.system:last-child');
        if (loadingMsg) loadingMsg.remove();
        printLine(`Erro de Conexão: ${chrome.runtime.lastError.message}`, 'error');
        return resolve();
      }

      const loadingMsg = output.querySelector('.system:last-child');
      if (loadingMsg && loadingMsg.innerText.includes("digitando")) loadingMsg.remove();

      if (response && response.error) {
        printLine(`Erro: ${response.error}`, 'error');
      } else if (response && response.reply) {
        printLine(`🔥 Zeca: ${response.reply}`, 'zeca');
        chatHistory.push({ role: "model", parts: [{ text: response.reply }] });
      } else {
        printLine("Erro: Sem resposta do background.", 'error');
      }
      resolve();
    });
  });
}

async function processCommand(cmdStr, abortFlag) {
  const parts = cmdStr.split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  try {
    switch (cmd) {
      case '/help':
        toggleHelp(true);
        printLine("OPENING MAN_PAGES...", 'system');
        break;

      case '/config':
        toggleAdmin(true);
        printLine("OPENING CONFIGURATIONS...", 'system');
        break;

      case '/clear':
        output.innerHTML = '';
        break;

      case '/scan':
        printLine("Analyzing DOM structure...", 'system');
        const tab = await getCurrentTab();
        if (!tab?.id) return printLine("Error: No active tab found.", 'error');

        chrome.tabs.sendMessage(tab.id, { action: "scan_page" }, (res) => {
          if (chrome.runtime.lastError) {
            return printLine("Erro: Recarregue a página (Content Script ausente).", 'error');
          }
          printLine(`Scan Complete. Inputs detected: <b>${res?.count || 0}</b>`, 'zeca');
        });
        break;

      case '/dossier':
        const cleanArgs = args.trim();

        // 1. CLEAR COMMAND
        if (cleanArgs === '--clear' || cleanArgs === '-c') {
          await chrome.storage.local.remove('user_dossier');
          // Also notify background to clear vector store if possible (optional, but good practice)
          // For now, just clearing local storage text.
          printLine("🗑️ <b>DOSSIER WIPED.</b> Context memory is now empty.", 'system');
          return;
        }

        // 2. APPEND (OR OVERWRITE IF EMPTY)
        if (cleanArgs) {
          // Get existing data first
          const data = await chrome.storage.local.get('user_dossier');
          let currentDossier = data.user_dossier || '';

          // Append new info
          if (currentDossier) {
            currentDossier += '\n' + cleanArgs;
          } else {
            currentDossier = cleanArgs;
          }

          await chrome.storage.local.set({ user_dossier: currentDossier });
          printLine(`📝 Info appended to Dossier. <br><i>(Total Size: ${currentDossier.length} chars)</i>`, 'zeca');
          printLine("Vectorizing updated context (Hardcore Mode)...", 'system');

          // Send FULL updated dossier for re-vectorization
          chrome.runtime.sendMessage({ action: "vectorize", text: currentDossier }, (res) => {
            if (chrome.runtime.lastError) {
              return printLine("Erro Fatal: " + chrome.runtime.lastError.message, 'error');
            }
            if (res.error) printLine("Erro na Vetorização: " + res.error, 'error');
            else printLine(`✅ Vetorização concluída! ${res.count} sentenças indexadas.`, 'zeca');
          });

        } else {
          // 3. READ ONLY
          const data = await chrome.storage.local.get('user_dossier');
          if (data.user_dossier) {
            printLine(`<b>📁 Current Dossier Context:</b><br><br>${data.user_dossier.replace(/\n/g, '<br>')}`, 'system');
            printLine("<br><i>Use <b>/dossier --clear</b> to wipe data.</i>", 'system');
          } else {
            printLine("📁 Dossier is empty.", 'system');
          }
        }
        break;

      case '/provider':
        // Legacy CLI support, opens GUI
        toggleAdmin(true);
        printLine("Opening Config GUI...", "system");
        break;

      case '/gemini':
        if (!args) return printLine("Error: Empty prompt.", 'error');
        await chatWithZeca(args);
        break;

      case '/export':
        const memory = await chrome.storage.local.get(null);
        const blob = new Blob([JSON.stringify(memory, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({ url: url, filename: 'zeca_memory_dump.json' });
        printLine("Memory dump initiated.", 'system');
        break;

      case '/fill':
        printLine("Injecting data vectors...", 'system');
        const t = await getCurrentTab();
        chrome.tabs.sendMessage(t.id, { action: "scan_page_data" }, (res) => {
          if (chrome.runtime.lastError) return printLine("Erro: Recarregue a página.", 'error');
          if (res && res.fields) {
            chrome.runtime.sendMessage({ action: "match_and_fill", fields: res.fields }, (matchRes) => {
              if (chrome.runtime.lastError) return printLine("Erro Crítico Motor IA.", 'error');
              if (matchRes.error) printLine(`Erro IA: ${matchRes.error}`, 'error');
              else {
                printLine(`Injection Success: <b>${matchRes.count}</b> fields populated.`, 'zeca');
                chrome.tabs.sendMessage(t.id, { action: "fill_data", matches: matchRes.matches });
              }
              if (matchRes.debugLog) matchRes.debugLog.forEach(l => printLine(l, 'system'));
            });
          } else {
            printLine("Error: DOM read failed.", 'error');
          }
        });
        break;

      default:
        printLine(`Unknown command: ${cmd}. Type /help`, 'error');
    }
  } catch (err) {
    printLine(`Fatal Error: ${err.message}`, 'error');
  }
}

async function getCurrentTab() {
  let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}