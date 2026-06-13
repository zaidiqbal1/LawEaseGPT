import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, getDocs, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB6QUhVcYAiKCKuTetlTLpAJ2zTCy_579I",
  authDomain: "laweasechatbot.firebaseapp.com",
  projectId: "laweasechatbot",
  storageBucket: "laweasechatbot.firebasestorage.app",
  messagingSenderId: "324737073308",
  appId: "1:324737073308:web:3140583290fc236db8ad59",
  measurementId: "G-Z4VTYTT88L"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const googleLoginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const authError = document.getElementById('auth-error');
const userEmailDisplay = document.getElementById('user-email-display');
const historyList = document.getElementById('history-list');
const clearChatBtn = document.getElementById('clear-chat-btn');

const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const loading = document.getElementById('loading');

// Local Dataset state
let chatHistory = [];
let localDataset = [];
let isDatasetLoaded = false;

// Load dataset
fetch('dataset.json')
    .then(response => response.json())
    .then(data => {
        localDataset = data;
        isDatasetLoaded = true;
    })
    .catch(err => console.error("Error loading dataset:", err));

// Auth State Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        userEmailDisplay.innerText = user.email;
        loadChatHistory(user.uid);
    } else {
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
        userEmailDisplay.innerText = '';
        chatBox.innerHTML = '';
        historyList.innerHTML = '';
        chatHistory = [];
        // Add initial bot greeting
        addMessage('Hello! I am your Pakistan Law Assistant. How can I help you today?', 'bot', false);
    }
});

// Auth Handlers
const provider = new GoogleAuthProvider();

googleLoginBtn.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
        authError.innerText = '';
    } catch (error) {
        authError.innerText = error.message;
    }
});

logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
});

clearChatBtn.addEventListener('click', async () => {
    if (!auth.currentUser) return;
    const confirmDelete = window.confirm("Are you sure you want to delete your entire chat history? This action cannot be undone.");
    if (!confirmDelete) return;

    try {
        const q = query(collection(db, "users", auth.currentUser.uid, "messages"));
        const querySnapshot = await getDocs(q);
        
        const deletePromises = [];
        querySnapshot.forEach((doc) => {
            deletePromises.push(deleteDoc(doc.ref));
        });
        
        await Promise.all(deletePromises);
        
        chatBox.innerHTML = '';
        historyList.innerHTML = '';
        chatHistory = [];
        addMessage('Hello! I am your Pakistan Law Assistant. How can I help you today?', 'bot', false);
        
    } catch (e) {
        console.error("Error deleting chat history: ", e);
        alert("Failed to delete chat history. Please try again.");
    }
});

// UI Event Listeners
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight < 100 ? this.scrollHeight : 100) + 'px';
});

userInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
sendBtn.addEventListener('click', sendMessage);

function searchDataset(queryText) {
    if (!isDatasetLoaded || !localDataset.length) return null;
    
    const words = queryText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return null;
    
    let bestMatch = null;
    let maxScore = 0;

    for (let item of localDataset) {
        let score = 0;
        for (let keyword of item.keywords) {
            if (words.some(w => keyword.includes(w) || w.includes(keyword))) {
                score++;
            }
        }
        if (score > maxScore) {
            maxScore = score;
            bestMatch = item;
        }
    }
    
    if (bestMatch && maxScore >= 1) {
        return bestMatch.answer;
    }
    return null;
}

async function callFreeAPI(userText) {
    chatHistory.push(`User: ${userText}`);
    if (chatHistory.length > 4) {
        chatHistory = chatHistory.slice(chatHistory.length - 4);
    }

    const systemPrompt = "System Instruction: You are a strict Pakistan law assistant. You must ONLY answer questions related to Pakistan law. If the user asks about general topics (e.g., coding, recipes, general chat), you must politely decline and state that you can only provide legal answers. Give clear, simple, and accurate answers.";
    
    const fullPrompt = systemPrompt + "\n\n" + chatHistory.join("\n") + "\nAssistant:";
    const encodedPrompt = encodeURIComponent(fullPrompt);
    const apiKey = "sk_BXbcGBoLCK3YwdsN4A60meVJocrYGCek";
    const url = `https://gen.pollinations.ai/text/${encodedPrompt}?model=openai&key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    const modelAnswer = await response.text();
    chatHistory.push(`Assistant: ${modelAnswer}`);
    return modelAnswer;
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    userInput.value = '';
    userInput.style.height = 'auto';

    addMessage(text, 'user', true);
    loading.style.display = 'flex';

    const datasetAnswer = searchDataset(text);
    if (datasetAnswer) {
        setTimeout(() => { 
            loading.style.display = 'none';
            addMessage(datasetAnswer, 'bot', true);
        }, 500);
        return;
    }

    try {
        const aiAnswer = await callFreeAPI(text);
        loading.style.display = 'none';
        addMessage(aiAnswer, 'bot', true);
    } catch (error) {
        loading.style.display = 'none';
        addMessage('Sorry, there was an error connecting to the Free AI. ' + error.message, 'bot', false);
        console.error('API Error:', error);
    }
}

function addMessage(text, sender, saveToDb = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    
    // Add Bootstrap classes for flex alignment if needed
    if(sender === 'bot') {
        messageDiv.classList.add('d-flex');
    }

    if (sender === 'bot') {
        const avatarDiv = document.createElement('div');
        avatarDiv.classList.add('bot-avatar', 'me-2', 'flex-shrink-0');
        avatarDiv.innerHTML = '<i class="bi bi-scales"></i>';
        messageDiv.appendChild(avatarDiv);
    }

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    
    let formattedText = text.replace(/\n/g, '<br>');
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    contentDiv.innerHTML = formattedText;
    messageDiv.appendChild(contentDiv);

    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (saveToDb && auth.currentUser) {
        saveMessageToDB(text, sender);
    }
}

async function saveMessageToDB(text, sender) {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await addDoc(collection(db, "users", user.uid, "messages"), {
            text: text,
            sender: sender,
            timestamp: serverTimestamp()
        });
        addToSidebar(text, sender, new Date());
    } catch (e) {
        console.error("Error adding document: ", e);
    }
}

function addToSidebar(text, sender, date) {
    const item = document.createElement('div');
    item.classList.add('history-item', sender);
    
    const textSnippet = text.length > 50 ? text.substring(0, 50) + '...' : text;
    item.innerText = (sender === 'user' ? 'You: ' : 'Bot: ') + textSnippet;
    
    const timeSpan = document.createElement('span');
    timeSpan.classList.add('timestamp');
    timeSpan.innerText = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    item.appendChild(timeSpan);
    
    historyList.prepend(item);
}

async function loadChatHistory(uid) {
    historyList.innerHTML = '<p style="color:#aaa;font-size:12px;text-align:center;">Loading history...</p>';
    chatHistory = [];
    try {
        const q = query(collection(db, "users", uid, "messages"), orderBy("timestamp", "asc"));
        const querySnapshot = await getDocs(q);
        historyList.innerHTML = '';
        chatBox.innerHTML = '';
        
        if (querySnapshot.empty) {
            addMessage('Hello! I am your Pakistan Law Assistant. How can I help you today?', 'bot', false);
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            addMessage(data.text, data.sender, false);
            addToSidebar(data.text, data.sender, data.timestamp?.toDate() || new Date());
            
            if (data.sender === 'user') {
                chatHistory.push(`User: ${data.text}`);
            } else {
                chatHistory.push(`Assistant: ${data.text}`);
            }
        });
        
        if (chatHistory.length > 4) {
            chatHistory = chatHistory.slice(chatHistory.length - 4);
        }
        
    } catch (error) {
        console.error("Error loading history:", error);
        historyList.innerHTML = '<p style="color:#e74c3c;font-size:12px;text-align:center;">Failed to load history. Please try again later.</p>';
    }
}
