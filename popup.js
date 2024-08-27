console.log('Popup script loaded');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM content loaded');

    const authenticateButton = document.getElementById('authenticate');
    console.log('Authenticate button:', authenticateButton);
    const emailList = document.getElementById('email-list');
    const snippetView = document.getElementById('snippet-view');
    const snippetSubject = document.getElementById('snippet-subject');
    const snippetFrom = document.getElementById('snippet-from');
    const snippetContent = document.getElementById('snippet-content');
    const formFieldsList = document.getElementById('form-fields-list');
    const formFieldsContainer = document.getElementById('form-fields-container');

    function showAuthButton() {
        authenticateButton.style.display = 'block';
        emailList.innerHTML = '<p>Please sign in to view your emails.</p>';
    }

    function hideAuthButton() {
        authenticateButton.style.display = 'none';
    }

    function getAuthToken() {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({action: 'getToken'}, function(response) {
                if (response && response.token) {
                    resolve(response.token);
                } else {
                    reject(response ? response.error : 'Failed to get token');
                }
            });
        });
    }

    function fetchEmails(token) {
        console.log('Fetching emails...');
        if (!emailList) {
            console.error('Email list element not found');
            return;
        }

        emailList.innerHTML = '<p>Loading emails...</p>';
        console.log('Sending request to Gmail API...');
        fetch('https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=10', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        })
        .then(response => {
            console.log('Received response from Gmail API');
            return response.json();
        })
        .then(data => {
            console.log('Parsed Gmail API response:', data);
            emailList.innerHTML = '';
            if (data.messages && data.messages.length > 0) {
                console.log(`Found ${data.messages.length} emails`);
                data.messages.forEach(message => {
                    console.log('Fetching details for message:', message.id);
                    fetchEmailDetails(token, message.id);
                });
            } else {
                console.log('No emails found');
                emailList.innerHTML = '<p>No emails found.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching emails:', error);
            emailList.innerHTML = `<p>Error fetching emails: ${error.message}</p>`;
        });
    }

    function fetchEmailDetails(token, messageId) {
        console.log(`Fetching details for email ${messageId}`);
        fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        })
        .then(response => response.json())
        .then(data => {
            console.log(`Received details for email ${messageId}:`, data);
            const subject = data.payload.headers.find(header => header.name === 'Subject').value;
            const from = data.payload.headers.find(header => header.name === 'From').value;
            const snippet = data.snippet || 'No preview available';
            const body = getEmailBody(data.payload);
            addEmailToList(messageId, subject, from, snippet, body);
        })
        .catch(error => {
            console.error(`Error fetching email details for ${messageId}:`, error);
        });
    }

    function getEmailBody(payload) {
        if (payload.parts) {
            for (let part of payload.parts) {
                if (part.mimeType === 'text/plain') {
                    return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                }
            }
        } else if (payload.body.data) {
            return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
        return '';
    }

    function addEmailToList(id, subject, from, snippet, body) {
        console.log(`Adding email to list: ${subject}`);
        const emailItem = document.createElement('div');
        emailItem.className = 'email-item';
        emailItem.innerHTML = `
            <strong>${subject}</strong><br>
            <span class="email-from">${from}</span>
        `;

        emailItem.addEventListener('click', function() {
            document.querySelectorAll('.email-item').forEach(item => item.classList.remove('selected'));
            this.classList.add('selected');
            showSnippet(subject, from, snippet);
            if (formFieldsContainer) {
                formFieldsContainer.style.display = 'block';
            }
            fillFormWithGPT(body);
        });

        emailList.appendChild(emailItem);
        console.log('Email added to list');
    }

    function showSnippet(subject, from, snippet) {
        snippetSubject.textContent = subject;
        snippetFrom.textContent = from;
        snippetContent.textContent = snippet;
        snippetView.style.display = 'block';
    }

    function displayFormFields(formStructure) {
        console.log('Displaying form fields:', formStructure);
        if (!formFieldsList) {
            console.error('Form fields list element not found');
            return;
        }
        formFieldsList.innerHTML = '';

        if (formStructure && formStructure.length > 0) {
            formStructure.forEach(section => {
                const sectionElement = createSectionElement(section.title);
                
                section.fields.forEach(field => {
                    const fieldItem = createFieldElement(field);
                    sectionElement.appendChild(fieldItem);
                });

                formFieldsList.appendChild(sectionElement);
            });

            console.log('Form structure added to DOM');
        } else {
            console.log('No form structure to display');
            formFieldsList.innerHTML = '<p>No form fields found on this page.</p>';
        }

        if (formFieldsContainer) {
            formFieldsContainer.style.display = 'block';
        } else {
            console.error('Form fields container not found');
        }
    }

    function createSectionElement(title) {
        const sectionElement = document.createElement('div');
        sectionElement.className = 'form-section';
        const titleElement = document.createElement('h3');
        titleElement.textContent = title;
        sectionElement.appendChild(titleElement);
        return sectionElement;
    }

    function createFieldElement(field) {
        const fieldItem = document.createElement('div');
        fieldItem.className = 'form-field-item';

        const labelElement = document.createElement('label');
        labelElement.textContent = `${field.label}${field.required ? ' *' : ''}`;
        fieldItem.appendChild(labelElement);

        const inputElement = createInputElement(field);
        fieldItem.appendChild(inputElement);

        return fieldItem;
    }

    function createInputElement(field) {
        let input;
        switch (field.type) {
            case 'dropdown':
            case 'select-one':
                input = document.createElement('select');
                if (field.options) {
                    field.options.forEach(option => {
                        const optionElement = document.createElement('option');
                        optionElement.value = option;
                        optionElement.textContent = option;
                        input.appendChild(optionElement);
                    });
                }
                break;
            case 'textarea':
                input = document.createElement('textarea');
                break;
            case 'date':
                input = document.createElement('input');
                input.type = 'date';
                break;
            case 'checkbox':
            case 'radio':
                input = document.createElement('input');
                input.type = field.type;
                input.checked = field.value === 'on' || field.value === 'true';
                break;
            default:
                input = document.createElement('input');
                input.type = field.type || 'text';
        }

        input.value = field.value || '';
        input.name = field.label.toLowerCase().replace(/\s+/g, '-');
        input.required = field.required;
        input.addEventListener('change', (e) => updateField(field.label, getInputValue(e.target)));

        return input;
    }

    function getInputValue(input) {
        if (input.type === 'checkbox' || input.type === 'radio') {
            return input.checked;
        }
        return input.value;
    }

    function updateField(label, value) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "updateField",
                label: label,
                value: value
            }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Error updating field:', chrome.runtime.lastError);
                } else {
                    console.log('Field updated:', response);
                }
            });
        });
    }

    function fillFormWithGPT(emailBody) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "getFormFields"}, function(formFields) {
                if (chrome.runtime.lastError) {
                    console.error('Error:', chrome.runtime.lastError);
                    return;
                }
                if (formFields) {
                    console.log('Received form fields from content script:', formFields);
                    GPTService.getFormCompletion(emailBody, formFields)
                        .then(completedFields => {
                            chrome.tabs.sendMessage(tabs[0].id, {
                                action: "fillFormFields",
                                fields: completedFields
                            });
                            displayFormFields(completedFields);
                        })
                        .catch(error => {
                            console.error('Error getting GPT form completion:', error);
                        });
                } else {
                    console.log('No form fields received from content script');
                    displayFormFields([]);
                }
            });
        });
    }
    // Collapsible functionality
    const coll = document.getElementsByClassName("collapsible");
    for (let i = 0; i < coll.length; i++) {
        coll[i].addEventListener("click", function() {
            this.classList.toggle("active");
            const content = this.nextElementSibling;
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });
    }

    authenticateButton.addEventListener('click', function() {
        console.log('Authenticate button clicked');
        chrome.runtime.sendMessage({action: 'authenticate'}, function(response) {
            console.log('Received authentication response:', response);
            if (chrome.runtime.lastError) {
                console.error('Runtime error:', chrome.runtime.lastError);
            }
            if (response && response.token) {
                console.log('Authentication successful, hiding button and fetching emails');
                hideAuthButton();
                fetchEmails(response.token);
            } else {
                console.error('Authentication failed:', response ? response.error : 'Unknown error');
                emailList.innerHTML = `<p>Authentication failed: ${response ? response.error : 'Unknown error'}</p>`;
            }
        });
    });

    // Listen for messages from the content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Popup received message:', request);
        if (request.action === 'initialFormFields') {
            console.log('Received initial form fields:', request.data);
            displayFormFields(request.data);
            sendResponse({status: 'Form fields received and displayed'});
        }
        return true;  // Indicates that the response will be sent asynchronously
    });

    function init() {
        console.log('Initializing popup');
        getAuthToken()
            .then(token => {
                console.log('Got auth token:', token ? 'Yes' : 'No');
                if (token) {
                    if (authenticateButton) authenticateButton.style.display = 'none';
                    fetchEmails(token);
                } else {
                    if (authenticateButton) authenticateButton.style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Error getting token:', error);
                if (authenticateButton) authenticateButton.style.display = 'block';
            });

        // Initially show the form fields container
        if (formFieldsContainer) {
            formFieldsContainer.style.display = 'block';
            console.log('Initial formFieldsContainer display:', formFieldsContainer.style.display);
        } else {
            console.error('formFieldsContainer not found');
        }

        // Request initial form fields
        requestFormFields();
    }

    function requestFormFields() {
        console.log('Requesting initial form fields from content script');
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: "getFormFields"}, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Error:', chrome.runtime.lastError);
                    return;
                }
                if (response) {
                    console.log('Received initial form fields from content script:', response);
                    displayFormFields(response);
                } else {
                    console.log('No initial form fields received from content script');
                    displayFormFields([]);
                }
            });
        });
    }

    init();

    // Set max height for content
    if (document.querySelector('.content')) {
        document.querySelector('.content').style.maxHeight = '400px';
    } else {
        console.error('.content element not found');
    }
});