import GPTService from './gpt_service.js';

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM content loaded');

    const authenticateButton = document.getElementById('authenticate');
    const emailList = document.getElementById('email-list');
    const emailContentView = document.getElementById('email-content-view');
    const emailSubject = document.getElementById('email-subject');
    const emailFrom = document.getElementById('email-from');
    const emailBody = document.getElementById('email-body');
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
        .then(response => response.json())
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
            const body = getEmailBody(data.payload);
            addEmailToList(messageId, subject, from, body);
        })
        .catch(error => {
            console.error(`Error fetching email details for ${messageId}:`, error);
        });
    }

    function getEmailBody(payload) {
        if (payload.parts) {
            for (let part of payload.parts) {
                if (part.mimeType === 'text/html') {
                    return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                } else if (part.mimeType === 'text/plain') {
                    return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/')).replace(/\n/g, '<br>');
                }
            }
        } else if (payload.body.data) {
            return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/')).replace(/\n/g, '<br>');
        }
        return '';
    }§

    function addEmailToList(id, subject, from, body) {
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
            showEmailContent(subject, from, body);
            if (formFieldsContainer) {
                formFieldsContainer.style.display = 'block';
            }
        });

        emailList.appendChild(emailItem);
        console.log('Email added to list');
    }

    function showEmailContent(subject, from, body) {
        emailSubject.textContent = subject;
        emailFrom.textContent = from;
        emailBody.innerHTML = body;
        emailContentView.style.display = 'block';
        //emailList.style.display = 'none';
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

    function requestFormFields() {
        console.log('Requesting form fields from content script via background');
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({action: "getFormFields"}, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Error:', chrome.runtime.lastError);
                    resolve([]);
                } else {
                    console.log('Received form fields:', response);
                    resolve(response || []);
                }
            });
        });
    }

    async function fillFormWithGPT(emailBody) {
        try {
            const formFields = await requestFormFields();
            console.log('Form fields for GPT analysis:', formFields);

            if (formFields.length === 0) {
                console.log('No form fields available. Skipping GPT analysis.');
                alert('No form fields detected on the current page. Please make sure you are on the correct page with the form.');
                return;
            }

            const completedFields = await GPTService.getFormCompletion(emailBody, formFields);
            console.log('GPT analysis result:', completedFields);

            chrome.runtime.sendMessage({
                action: "autofillForm",
                formData: completedFields
            }, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Error autofilling form:', chrome.runtime.lastError);
                    alert('An error occurred while autofilling the form. Please try again or fill the form manually.');
                } else if (response && response.success) {
                    console.log('Form autofilled:', response);
                    alert('Form has been autofilled based on the email content.');
                } else {
                    console.error('Autofill response not successful:', response);
                    alert('Unable to autofill the form. Please try again or fill the form manually.');
                }
            });
        } catch (error) {
            console.error('Error in fillFormWithGPT:', error);
            alert('An error occurred while processing the email. Please try again or fill the form manually.');
        }
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
    }

    init();
});