// Function to autofill the form with provided data
function autofillForm(formData) {
    for (const [fieldName, value] of Object.entries(formData)) {
        const field = document.querySelector(`input[name="${fieldName}"], textarea[name="${fieldName}"], select[name="${fieldName}"]`);
        if (field) {
            field.value = value;
            field.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
}

// Function to get form field names
function getFormFields() {
    const fields = document.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select');
    return Array.from(fields).map(field => field.name).filter(name => name);
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message in content script:', request);

    if (request.action === "getFormFields") {
        const formFields = getFormFields();
        console.log('Sending form fields to popup:', formFields);
        sendResponse(formFields);
    } else if (request.action === "autofillForm") {
        console.log('Autofilling form with data:', request.formData);
        autofillForm(request.formData);
        sendResponse({success: true});
    }

    // Return true to indicate that the response will be sent asynchronously
    return true;
});

console.log('Content script loaded and ready');