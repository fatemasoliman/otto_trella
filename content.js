console.log('Content script loaded');

// Scan form fields immediately when the content script loads
scanFormFields().then(formStructure => {
    console.log('Form fields scanned:', formStructure);
    // Store the form structure in chrome.storage.local
    chrome.storage.local.set({ formStructure: formStructure }, () => {
        console.log('Form structure stored in local storage');
        // Notify the popup that form fields are ready
        chrome.runtime.sendMessage({ action: 'formFieldsReady' });
    });
});

async function scanFormFields() {
    console.log('Scanning for form fields');
    const formStructure = [];
    const processedFields = new Set();

    // Start from the body and traverse all elements
    await traverseDOM(document.body, formStructure, processedFields);

    console.log('Scanned form structure:', formStructure);
    return formStructure;
}

async function traverseDOM(element, formStructure, processedFields, currentSection = null) {
    // Check if this element is a new section
    const sectionTitle = element.querySelector('label[type="body"], label[type="subheading"]');
    if (sectionTitle && !currentSection) {
        currentSection = {
            title: sectionTitle.textContent.trim(),
            fields: []
        };
        formStructure.push(currentSection);
    }

    // Check if this element is a form field
    const label = element.querySelector('label');
    const input = element.querySelector('input, textarea, select, [role="combobox"]');

    if (label && input && !processedFields.has(label.textContent.trim())) {
        const fieldInfo = await getFieldInfo(input, label.textContent.trim());
        if (currentSection) {
            currentSection.fields.push(fieldInfo);
        } else {
            formStructure.push({ title: 'General', fields: [fieldInfo] });
        }
        processedFields.add(label.textContent.trim());
    }

    // Recursively process child elements
    for (const child of element.children) {
        await traverseDOM(child, formStructure, processedFields, currentSection);
    }
}

async function getFieldInfo(input, label) {
    const type = getInputType(input);
    const value = getInputValue(input);
    const required = label.includes('*');
    const fieldInfo = { label, type, value, required };

    if (type === 'dropdown' || type === 'select-one') {
        const options = await extractDropdownOptions(input);
        fieldInfo.options = options || [];
    }

    return fieldInfo;
}

function getInputType(input) {
    if (input.getAttribute('role') === 'combobox') return 'dropdown';
    if (input.type === 'date' || input.querySelector('input[type="date"]')) return 'date';
    if (input.type === 'number' || input.querySelector('input[type="number"]')) return 'number';
    return input.type || 'text';
}

function getInputValue(input) {
    if (input.type === 'file') return '';
    if (input.getAttribute('role') === 'combobox') {
        return input.textContent.trim() || '';
    }
    return input.value || '';
}

async function extractDropdownOptions(dropdown) {
    const dropdownName = dropdown.id || dropdown.name || `Dropdown`;

    // Focus on the input field or parent element
    if (dropdown.tagName.toLowerCase() === 'input') {
        dropdown.focus();
    } else {
        const inputField = dropdown.closest('div').querySelector('input');
        if (inputField) {
            inputField.focus();
        }
    }

    // Simulate events to open the dropdown
    const events = ['mouseover', 'mousedown', 'mouseup', 'click'];
    events.forEach(eventType => {
        dropdown.dispatchEvent(new MouseEvent(eventType, { bubbles: true }));
    });

    console.log(`${dropdownName} should be triggered`);

    // Wait for the dropdown to open and extract the options
    await new Promise(resolve => setTimeout(resolve, 500));

    const optionElements = document.querySelectorAll('[id^="react-select-"][id$="-option"], .css-1jpqh9-option, [class*="option"], .css-1n7v3ny');

    let extractedOptions = [];
    if (optionElements.length > 0) {
        extractedOptions = Array.from(optionElements).map(el => el.textContent.trim());
        console.log(`Options extracted for ${dropdownName}:`, extractedOptions);
    } else {
        console.log(`No options found for ${dropdownName}`);
    }

    // Close the dropdown using Escape key
    const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        keyCode: 27,
        bubbles: true
    });
    dropdown.dispatchEvent(escapeEvent);

    // As an additional measure, click outside to close the dropdown
    document.body.click();

    // Wait for the dropdown to close before returning options
    await new Promise(resolve => setTimeout(resolve, 500));

    return extractedOptions;
}

function updateField(label, value) {
    const labelElement = Array.from(document.querySelectorAll('label')).find(el => el.textContent.trim() === label);
    if (labelElement) {
        const input = labelElement.nextElementSibling.querySelector('input, textarea, select, [role="combobox"]');
        if (input) {
            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = value === true || value === 'true';
            } else {
                input.value = value;
            }
            input.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`Updated field: ${label} with value: ${value}`);
        }
    }
}

function fillFormFields(fields) {
    fields.forEach(field => {
        updateField(field.label, field.value);
    });
    console.log('Form fields auto-filled');
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message in content script:', request);
    
    if (request.action === 'getFormFields') {
        // Use a promise to handle the asynchronous storage operation
        new Promise((resolve) => {
            chrome.storage.local.get(['formStructure'], (result) => {
                console.log('Sending form fields to popup:', result.formStructure);
                resolve(result.formStructure);
            });
        }).then(sendResponse);
        return true;  // Keep the message channel open
    } else if (request.action === 'updateField') {
        updateField(request.label, request.value);
        sendResponse({success: true});
    } else if (request.action === 'fillFormFields') {
        fillFormFields(request.fields);
        sendResponse({success: true});
    }
});


console.log('Content script setup complete');