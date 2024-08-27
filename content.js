console.log('Content script loaded');

function scanFormFields() {
    console.log('Scanning for form fields');
    const formStructure = [];
    const processedFields = new Set();

    // Start from the body and traverse all elements
    traverseDOM(document.body, formStructure, processedFields);

    console.log('Scanned form structure:', formStructure);
    return formStructure;
}

function traverseDOM(element, formStructure, processedFields, currentSection = null) {
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
        const fieldInfo = getFieldInfo(input, label.textContent.trim());
        if (currentSection) {
            currentSection.fields.push(fieldInfo);
        } else {
            formStructure.push({ title: 'General', fields: [fieldInfo] });
        }
        processedFields.add(label.textContent.trim());
    }

    // Recursively process child elements
    for (const child of element.children) {
        traverseDOM(child, formStructure, processedFields, currentSection);
    }
}

function getFieldInfo(input, label) {
    const type = getInputType(input);
    const value = getInputValue(input);
    const required = label.includes('*');
    const fieldInfo = { label, type, value, required };

    if (type === 'dropdown' || type === 'select-one') {
        fieldInfo.options = getDropdownOptions(input);
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

function getDropdownOptions(input) {
    const options = [];
    const optionElements = input.querySelectorAll('option') || 
                           input.querySelectorAll('[role="option"]');
    optionElements.forEach(option => {
        options.push(option.textContent.trim());
    });
    return options;
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

// Send the form fields to the popup when requested
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message in content script:', request);
    if (request.action === 'getFormFields') {
        console.log('Getting form fields');
        const fields = scanFormFields();
        console.log('Sending form fields to popup:', fields);
        sendResponse(fields);
    } else if (request.action === 'updateField') {
        updateField(request.label, request.value);
        sendResponse({success: true});
    }
    return true;  // Indicates that the response will be sent asynchronously
});

// Scan form fields immediately when the content script loads
console.log('Performing initial form field scan');
const initialFormFields = scanFormFields();
console.log('Sending initial form fields to popup');
chrome.runtime.sendMessage({
    action: 'initialFormFields',
    data: initialFormFields
}, response => {
    if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);
    } else {
        console.log('Response from popup:', response);
    }
});

console.log('Content script setup complete');