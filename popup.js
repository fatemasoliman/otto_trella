console.log('Popup script loaded');

import GPTService from './gpt_service.js';

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
    const fillFormButton = document.getElementById('fill-form-with-otto');

    function showAuthButton() {
        authenticateButton.style.display = 'block';
        emailList.innerHTML = '<p>Please sign in to view your emails.</p>';
    }

    function hideAuthButton() {
        authenticateButton.style.display = 'none';
    }

    fillFormButton.addEventListener('click', function() {
        const selectedEmail = document.querySelector('.email-item.selected');
        if (selectedEmail) {
            const emailBody = selectedEmail.getAttribute('data-body');
            fillFormWithGPT(emailBody);
        } else {
            console.log('No email selected');
            alert('Please select an email first.');
        }
    });

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

        const query = 'to:ports-requests@trella.app';
        fetch(`https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`, {
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
                    fetchEmailDetails(token, message.id, true);
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

    function fetchEmailDetails(token, messageId, isFirstInThread) {
        console.log(`Fetching details for email ${messageId}`);
        fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        })
        .then(response => response.json())
        .then(data => {
            console.log(`Received details for email ${messageId}:`, data);

            if (isFirstInThread) {
                const subject = data.payload.headers.find(header => header.name === 'Subject').value;
                const from = data.payload.headers.find(header => header.name === 'From').value;
                const snippet = data.snippet || 'No preview available';
                const body = getEmailBody(data.payload);
                addEmailToList(messageId, subject, from, snippet, body);
            }
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
        emailItem.setAttribute('data-body', body);
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

    async function fillFormWithGPT(emailBody) {
        try {
            const formFields = await requestFormFields();
            console.log('Form fields for GPT analysis:', formFields);

            const completedFields = await GPTService.getFormCompletion(emailBody, formFields);
            console.log('GPT analysis result:', completedFields);

            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "autofillForm",
                    formData: completedFields
                }, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('Error autofilling form:', chrome.runtime.lastError);
                    } else {
                        console.log('Form autofilled:', response);
                        alert('Form has been autofilled based on the email content.');
                    }
                });
            });
        } catch (error) {
            console.error('Error in fillFormWithGPT:', error);
            alert('An error occurred while processing the email. Please try again.');
        }
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

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Popup received message:', request);
        if (request.action === 'initialFormFields') {
            console.log('Received initial form fields:', request.data);
            sendResponse({status: 'Form fields received'});
        }
        return true;
    });

    function requestFormFields() {
        console.log('Requesting form fields from content script');
        return new Promise((resolve, reject) => {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "getFormFields"}, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('Error:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                    } else {
                        if (response) {
                            console.log('Received form fields from content script:', response);
                            resolve(response);
                        } else {
                            console.log('No form fields received from content script');
                            resolve([]);
                        }
                    }
                });
            });
        });
    }

    function setupFormFieldsListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'formFieldsReady') {
                console.log('Form fields are ready, requesting them now');
                requestFormFields();
            }
        });
    }

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

        requestFormFields().catch(error => {
            console.error('Error requesting form fields:', error);
        });
    }

    init();

    if (document.querySelector('.content')) {
        document.querySelector('.content').style.maxHeight = '400px';
    } else {
        console.error('.content element not found');
    }

    setupFormFieldsListener();
    setupEventListeners();
});