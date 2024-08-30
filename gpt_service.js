import config from './config.js';

const GPTService = {
    API_KEY: config.openAIKey,
    API_URL: 'https://api.openai.com/v1',
    ASSISTANT_ID: 'asst_auGRoJqaRVySWahymKlPW90Q', 

    async createThread() {
        const response = await fetch(`${this.API_URL}/threads`, {
            method: 'POST',
            headers: this.getHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Failed to create thread: ${response.status}`);
        }
        return await response.json();
    },

    async addMessageToThread(threadId, content) {
        const response = await fetch(`${this.API_URL}/threads/${threadId}/messages`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                role: 'user',
                content: content
            })
        });
        if (!response.ok) {
            throw new Error(`Failed to add message: ${response.status}`);
        }
        return await response.json();
    },

    async runAssistant(threadId) {
        console.log('Request body:', JSON.stringify({
            assistant_id: this.ASSISTANT_ID
        }));
        try {
            const response = await fetch(`${this.API_URL}/threads/${threadId}/runs`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    assistant_id: this.ASSISTANT_ID
                })
            });
            if (!response.ok) {
                const errorBody = await response.text();
                console.error('Full error response:', errorBody);
                throw new Error(`Failed to run assistant: ${response.status}. Body: ${errorBody}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error in runAssistant:', error);
            throw error;
        }
    },

    async checkRunStatus(threadId, runId) {
        const response = await fetch(`${this.API_URL}/threads/${threadId}/runs/${runId}`, {
            method: 'GET',
            headers: this.getHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Failed to check run status: ${response.status}`);
        }
        return await response.json();
    },

    async getMessages(threadId) {
        const response = await fetch(`${this.API_URL}/threads/${threadId}/messages`, {
            method: 'GET',
            headers: this.getHeaders(),
        });
        if (!response.ok) {
            throw new Error(`Failed to get messages: ${response.status}`);
        }
        return await response.json();
    },

    getHeaders() {
        return {
            'Authorization': `Bearer ${this.API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v1'
        };
    },

    async getFormCompletion(prompt, formFields) {
        try {
            console.log('Starting form completion process...');
            
            // Step 1: Create a thread
            const thread = await this.createThread();
            console.log('Thread created:', thread.id);

            // Step 2: Add a user's message to the thread
            await this.addMessageToThread(thread.id, prompt);
            console.log('Message added to thread');

            // Step 3: Run the assistant
            const run = await this.runAssistant(thread.id);
            console.log('Assistant run started:', run.id);

            // Step 4: Periodically check the run status
            let runStatus;
            do {
                await new Promise(resolve => setTimeout(resolve, 1000));
                runStatus = await this.checkRunStatus(thread.id, run.id);
                console.log('Current run status:', runStatus.status);
            } while (runStatus.status !== 'completed');

            // Step 5: Retrieve the assistant's response
            const messages = await this.getMessages(thread.id);
            console.log('Retrieved messages');

            const assistantMessage = messages.data.find(m => m.role === 'assistant');
            if (!assistantMessage) {
                throw new Error('No assistant message found');
            }

            console.log('Assistant response:', assistantMessage.content[0].text.value);
            return this.parseGPTResponse(assistantMessage.content[0].text.value, formFields);
        } catch (error) {
            console.error('Error in getFormCompletion:', error);
            throw error;
        }
    },

    parseGPTResponse(response, formFields) {
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

export default GPTService;