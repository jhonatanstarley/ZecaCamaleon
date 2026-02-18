// src/content.js

// --- 1. UTILITÁRIOS DE EXTRAÇÃO ---

function getLabelText(element) {
    let labelText = "";

    // Busca label por ID
    if (element.id) {
        const label = document.querySelector(`label[for="${element.id}"]`);
        if (label) labelText = label.innerText;
    }

    // Busca label pai
    if (!labelText) {
        const parentLabel = element.closest('label');
        if (parentLabel) labelText = parentLabel.innerText;
    }

    // Busca por atributos de acessibilidade e placeholders
    if (!labelText) labelText = element.getAttribute('aria-label') || "";
    if (!labelText) labelText = element.getAttribute('placeholder') || "";
    if (!labelText) labelText = element.getAttribute('name') || "";

    // Caso especial para Radio/Checkbox: Busca texto no irmão seguinte
    if (!labelText && (element.type === 'radio' || element.type === 'checkbox')) {
        const nextSibling = element.nextElementSibling;
        if (nextSibling && (nextSibling.tagName === 'LABEL' || nextSibling.tagName === 'SPAN')) {
            labelText = nextSibling.innerText;
        } else {
            // Tenta o pai se o irmão falhar
            const parent = element.parentElement;
            if (parent) labelText = parent.innerText;
        }
    }

    // Limpeza de ruído (parenteses, asteriscos, espaços)
    return labelText ? labelText.replace(/\(.*\)/g, '').replace(/\*/g, '').trim().replace(/\s+/g, ' ') : "";
}

// --- 2. SIMULADOR DE DIGITAÇÃO E INTERAÇÃO ---

async function simulateTyping(element, text) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.focus();
    element.click();

    // Hack para React/Angular/Vue detectarem mudança de estado
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value").set;
    const valueSetter = prototypeValueSetter || Object.getOwnPropertyDescriptor(element, "value").set;

    // Limpa campo
    if (valueSetter) valueSetter.call(element, '');
    else element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));

    // Digitação caractere a caractere
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const currentVal = element.value;
        const newVal = currentVal + char;

        element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));

        if (valueSetter) valueSetter.call(element, newVal);
        else element.value = newVal;

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));

        // Delay humano
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5));
    }

    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
}

// --- 3. LISTENER PRINCIPAL ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // --- AÇÃO: SCAN VISUAL ---
    if (request.action === "scan_page") {
        const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
        inputs.forEach(el => {
            el.style.border = "2px solid #ff9800";
            el.style.boxShadow = "0 0 5px rgba(255, 152, 0, 0.5)";
            el.dataset.zecaDetected = "true";
        });
        sendResponse({ count: inputs.length });
        return true;
    }

    // --- AÇÃO: EXTRAÇÃO DE DADOS ---
    if (request.action === "scan_page_data") {
        const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
        const fields = [];

        inputs.forEach((el, index) => {
            const zecaId = `zeca-field-${index}`;
            // Evita re-marcar se já tiver ID
            if (!el.dataset.zecaId) el.dataset.zecaId = zecaId;
            else el.dataset.zecaId = zecaId; // Garante consistência

            const label = getLabelText(el);

            if (label && !el.disabled && !el.readOnly) {
                const fieldData = {
                    id: zecaId,
                    // Nome é crucial para agrupar radios
                    name: el.name || el.id || zecaId,
                    label: label,
                    type: el.type || 'text',
                    tag: el.tagName.toLowerCase(),
                    options: []
                };

                // EXTRACT OPTIONS (SELECT)
                if (el.tagName.toLowerCase() === 'select') {
                    fieldData.options = Array.from(el.options).map(opt => ({
                        text: opt.text.trim(),
                        value: opt.value
                    })).filter(o => o.text && o.value);
                }

                // EXTRACT OPTIONS (RADIO/CHECKBOX)
                if (el.type === 'radio' || el.type === 'checkbox') {
                    // Tenta encontrar opções vizinhas com mesmo name
                    if (el.name) {
                        const group = document.querySelectorAll(`input[name="${el.name}"]`);
                        // Adiciona a própria opção e irmãs como contexto para a IA saber o que escolher
                        // Mas cuidado para não duplicar se iterarmos sobre todas
                        fieldData.options = Array.from(group).map(input => ({
                            text: getLabelText(input),
                            value: input.value
                        }));
                    } else {
                        // Checkbox isolado (ex: "Li e aceito")
                        fieldData.options = [{ text: label, value: "true" }];
                    }
                }

                fields.push(fieldData);
            }
        });

        sendResponse({ fields: fields });
        return true;
    }

    // --- AÇÃO: PREENCHIMENTO INTELIGENTE ---
    if (request.action === "fill_data") {
        (async () => {
            const matches = request.matches;
            let filledCount = 0;

            for (const match of matches) {
                const el = document.querySelector(`[data-zeca-id="${match.id}"]`);
                if (!el) continue;

                let valueToFill = match.value;

                // CASO A: SELECT (COMBOBOX)
                if (el.tagName.toLowerCase() === 'select') {
                    // Tenta setar valor direto (match exato técnico)
                    el.value = valueToFill;

                    // Se falhar, tenta achar pelo texto ou conversão
                    if (el.selectedIndex === -1) {
                        const options = Array.from(el.options);
                        const matchingOption = options.find(opt =>
                            opt.value === valueToFill ||
                            opt.text.trim().toLowerCase() === String(valueToFill).toLowerCase()
                        );
                        if (matchingOption) {
                            el.value = matchingOption.value;
                        }
                    }
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    filledCount++;
                }

                // CASO B: RADIO (Exclusivo)
                else if (el.type === 'radio') {
                    // Radio precisa ser clicado se o value bater
                    // Verifica se O VALOR SUGERIDO BATE COM O VALOR DESTE RADIO
                    if (String(el.value).toLowerCase() === String(valueToFill).toLowerCase()) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.click();
                        el.checked = true;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        filledCount++;
                    }
                }

                // CASO C: CHECKBOX (Múltiplo ou Booleano)
                else if (el.type === 'checkbox') {
                    // Se valueToFill for "true", marca (booleano simples)
                    const shouldCheck = String(valueToFill).toLowerCase() === "true" ||
                        String(el.value).toLowerCase() === String(valueToFill).toLowerCase();

                    if (shouldCheck && !el.checked) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.click();
                        el.checked = true;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        filledCount++;
                    }
                }

                // CASO D: INPUTS TEXTUAIS E NUMÉRICOS
                else {
                    await simulateTyping(el, String(valueToFill));
                    filledCount++;
                }

                // Feedback Visual
                el.style.border = "2px solid #00ff41";
                el.style.boxShadow = "0 0 8px #00ff41";
            }
            sendResponse({ success: true, filled: filledCount });
        })();
        return true;
    }
});