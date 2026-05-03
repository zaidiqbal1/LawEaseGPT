import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDgFl4mmc9Q8jTeY5twOrgfmIGK_hni9x8",
  authDomain: "laweasepakistan.firebaseapp.com",
  projectId: "laweasepakistan",
  storageBucket: "laweasepakistan.firebasestorage.app",
  messagingSenderId: "1095576124285",
  appId: "1:1095576124285:web:d8a3da75f3edf91f1c6a14",
  measurementId: "G-MDYKRMQ6SX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authError = document.getElementById('auth-error');
const userEmailDisplay = document.getElementById('user-email-display');
const historyList = document.getElementById('history-list');

const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const loading = document.getElementById('loading');

// Local Dataset state
let chatHistory = [];
let isDatasetLoaded = true;

// Self-made hardcoded dataset
let hfDataset = [
    {
        file_name: "Pakistan Penal Code (PPC) Basics",
        text: "An FIR (First Information Report) is the initial document recorded by the police when they are informed about a cognizable offense. Under Section 154 of the Code of Criminal Procedure (CrPC), the police are bound to register an FIR if a cognizable offense has occurred."
    },
    {
        file_name: "Bail Provisions in Pakistan",
        text: "Bail in Pakistan is primarily governed by the Code of Criminal Procedure (CrPC). Pre-arrest bail (bail before arrest) can be granted by a Sessions Court or High Court under Section 498 CrPC to protect an innocent person from malicious arrest. Post-arrest bail is handled under Section 497 CrPC."
    },
    {
        file_name: "Family Law & Divorce (Khula)",
        text: "In Pakistan, under the Muslim Family Laws Ordinance 1961, a woman has the right to seek divorce (Khula) through the family courts. She must relinquish her dower (Haq Mehr) in most cases to obtain Khula if the husband does not consent to the divorce."
    },
    {
        file_name: "Cybercrime Law (PECA 2016)",
        text: "The Prevention of Electronic Crimes Act (PECA) 2016 is the primary legislation regarding cybercrimes in Pakistan. It covers offenses like unauthorized access, cyber-stalking, blackmail, and online fraud. The FIA (Federal Investigation Agency) handles PECA violations."
    },
    {
        file_name: "Consumer Protection Act",
        text: "Consumer Protection Councils in Pakistan deal with defective products and faulty services. A consumer must first send a legal notice to the manufacturer or service provider giving them 15 days to resolve the issue before filing a claim in the Consumer Court."
    }
];

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
        addMessage('Hello! I am your Pakistan Law Assistant. How can I help you today?', 'bot', null, false);
    }
});

// Auth Handlers
loginBtn.addEventListener('click', async () => {
    try {
        await signInWithEmailAndPassword(auth, authEmail.value, authPassword.value);
        authError.innerText = '';
    } catch (error) {
        authError.innerText = error.message;
    }
});

signupBtn.addEventListener('click', async () => {
    try {
        await createUserWithEmailAndPassword(auth, authEmail.value, authPassword.value);
        authError.innerText = '';
    } catch (error) {
        authError.innerText = error.message;
    }
});

logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
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
    if (!isDatasetLoaded || !hfDataset.length) return null;
    
    const words = queryText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (words.length === 0) return null;
    
    for (let item of hfDataset) {
        const textLow = (item.text || "").toLowerCase();
        const matchWords = words.filter(w => textLow.includes(w));
        
        if (matchWords.length >= Math.min(words.length, 2) && matchWords.length > 0) {
            const matchWord = matchWords[0];
            const index = textLow.indexOf(matchWord);
            
            const start = Math.max(0, index - 100);
            const end = Math.min(item.text.length, index + 300);
            let snippet = item.text.substring(start, end).trim();
            
            return `Found in "${item.file_name}":\n...${snippet}...`;
        }
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
    const url = `https://text.pollinations.ai/${encodedPrompt}?model=openai`;

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

    addMessage(text, 'user', null, true);
    loading.style.display = 'flex';

    const datasetAnswer = searchDataset(text);
    if (datasetAnswer) {
        setTimeout(() => { 
            loading.style.display = 'none';
            addMessage(datasetAnswer, 'bot', 'Dataset', true);
        }, 500);
        return;
    }

    try {
        const aiAnswer = await callFreeAPI(text);
        loading.style.display = 'none';
        addMessage(aiAnswer, 'bot', 'Free AI', true);
    } catch (error) {
        loading.style.display = 'none';
        addMessage('Sorry, there was an error connecting to the Free AI. ' + error.message, 'bot', 'Error', false);
        console.error('API Error:', error);
    }
}

function addMessage(text, sender, source = null, saveToDb = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    
    let formattedText = text.replace(/\n/g, '<br>');
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    contentDiv.innerHTML = formattedText;
    messageDiv.appendChild(contentDiv);

    if (source) {
        const badge = document.createElement('div');
        badge.classList.add('source-badge');
        if (source === 'Dataset') {
            badge.classList.add('source-dataset');
            badge.innerText = '⚡ Local Dataset';
        } else if (source === 'Free AI') {
            badge.classList.add('source-ai');
            badge.innerText = '🤖 Free AI';
        } else {
            badge.innerText = source;
            badge.style.color = '#e74c3c';
        }
        messageDiv.appendChild(badge);
    }

    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    if (saveToDb && auth.currentUser) {
        saveMessageToDB(text, sender, source);
    }
}

async function saveMessageToDB(text, sender, source) {
    const user = auth.currentUser;
    if (!user) return;
    try {
        await addDoc(collection(db, "users", user.uid, "messages"), {
            text: text,
            sender: sender,
            source: source,
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
            addMessage('Hello! I am your Pakistan Law Assistant. How can I help you today?', 'bot', null, false);
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            addMessage(data.text, data.sender, data.source, false);
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
