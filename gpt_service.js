import config from './config.js';

const GPTService = {
    API_KEY: config.openAIKey, 
    API_URL: 'https://api.openai.com/v1/chat/completions',

    getFormCompletion: async function(emailBody, formFields) {
        const prompt = this.createPrompt(emailBody, formFields);
        
        const response = await fetch(this.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    {"role": "system", "content": "You are a helpful assistant that fills out forms based on email content."},
                    {"role": "user", "content": prompt}
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return this.parseGPTResponse(data.choices[0].message.content, formFields);
    },

    createPrompt: function(emailBody, formFields) {
        const fieldDescriptions = formFields.map(field => 
            `${field.label} (${field.type})`
        ).join(', ');

        return `Based on the following email content, please fill out the form fields: ${fieldDescriptions}. 
                If a field can't be filled based on the email content, leave it blank.

                Email content:
                ${emailBody}

                Please provide your response in a JSON format where the keys are the field labels and the values are the filled content.`;
    },

    parseGPTResponse: function(response, formFields) {
        try {
            const parsed = JSON.parse(response);
            return formFields.map(field => ({
                ...field,
                value: parsed[field.label] || field.value
            }));
        } catch (error) {
            console.error('Error parsing GPT response:', error);
            return formFields;
        }
    }
};