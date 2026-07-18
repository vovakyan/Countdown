// app.js

// ==========================================
// FIREBASE CONFIGURATION (ACTION REQUIRED)
// ==========================================
// Replace the values below with your Firebase project configuration.
const firebaseConfig = {
    apiKey: "AIzaSyAc9wAdXduzE4kWPQOWU7NrJKLDbpKn2OQ",
    authDomain: "countdown-d7ddf.firebaseapp.com",
    databaseURL: "https://countdown-d7ddf-default-rtdb.firebaseio.com",
    projectId: "countdown-d7ddf",
    storageBucket: "countdown-d7ddf.firebasestorage.app",
    messagingSenderId: "936651981008",
    appId: "1:936651981008:web:55b7af03cca125e6401ed5",
    measurementId: "G-7JRST3BMT2"
};

// Initialize Firebase
let app, database, countdownsRef;
let isFirebaseConfigured = false;

try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
        app = firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        countdownsRef = database.ref('countdowns');
        isFirebaseConfigured = true;
    }
} catch (error) {
    console.error("Firebase initialization error:", error);
}

// ==========================================
// DOM ELEMENTS
// ==========================================
const container = document.getElementById('countdownsContainer');
const addEventBtn = document.getElementById('addEventBtn');
const addEventModal = document.getElementById('addEventModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const addEventForm = document.getElementById('addEventForm');
const dateTypeRadios = document.getElementsByName('dateType');
const eventDateOnly = document.getElementById('eventDateOnly');
const eventDateTime = document.getElementById('eventDateTime');

dateTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'date') {
            eventDateOnly.style.display = 'block';
            eventDateOnly.required = true;
            eventDateTime.style.display = 'none';
            eventDateTime.required = false;
        } else {
            eventDateOnly.style.display = 'none';
            eventDateOnly.required = false;
            eventDateTime.style.display = 'block';
            eventDateTime.required = true;
        }
    });
});

// State
let countdowns = {};
let timerInterval;

// ==========================================
// INITIALIZATION
// ==========================================
function init() {
    if (!isFirebaseConfigured) {
        showSetupInstructions();
        return;
    }

    // Listen for real-time updates from Firebase
    countdownsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        countdowns = data || {};
        renderCountdowns();
    });

    // Start the interval to update timers every second
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimers, 1000);
}

// ==========================================
// UI RENDERING
// ==========================================
function renderCountdowns() {
    container.innerHTML = '';

    const keys = Object.keys(countdowns);
    if (keys.length === 0) {
        container.innerHTML = '<div class="empty-state">No countdowns yet. Click "Add Date" to start!</div>';
        return;
    }

    // Sort by target timestamp (closest first)
    keys.sort((a, b) => {
        const t1 = countdowns[a].timestamp || new Date(countdowns[a].date).getTime();
        const t2 = countdowns[b].timestamp || new Date(countdowns[b].date).getTime();
        return t1 - t2;
    });

    keys.forEach(key => {
        const item = countdowns[key];
        const card = createCountdownCard(key, item);
        container.appendChild(card);
    });

    // Do an immediate update to prevent 1-second lag on render
    updateTimers();
}

function createCountdownCard(id, item) {
    const card = document.createElement('div');
    card.className = 'countdown-card';

    const timestamp = item.timestamp || new Date(item.date).getTime();
    card.dataset.targetTimestamp = timestamp;

    // Format the date nicely for display
    const options = {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    };
    if (!item.isDateOnly) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }
    const formattedDate = new Date(timestamp).toLocaleDateString(undefined, options);

    card.innerHTML = `
        <div class="card-header">
            <h3>${item.name}</h3>
            <button class="delete-btn" onclick="deleteCountdown('${id}')" title="Delete">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        </div>
        <div class="card-date">${formattedDate}</div>
        <div class="timer">
            <div class="time-box">
                <span class="time-value days">00</span>
                <span class="time-label">Days</span>
            </div>
            <div class="time-box">
                <span class="time-value hours">00</span>
                <span class="time-label">Hrs</span>
            </div>
            <div class="time-box">
                <span class="time-value minutes">00</span>
                <span class="time-label">Min</span>
            </div>
            <div class="time-box">
                <span class="time-value seconds">00</span>
                <span class="time-label">Sec</span>
            </div>
        </div>
    `;
    return card;
}

function updateTimers() {
    const cards = document.querySelectorAll('.countdown-card');
    const now = new Date().getTime();

    cards.forEach(card => {
        const targetDate = parseInt(card.dataset.targetTimestamp, 10);
        const distance = targetDate - now;

        const daysEl = card.querySelector('.days');
        const hoursEl = card.querySelector('.hours');
        const minutesEl = card.querySelector('.minutes');
        const secondsEl = card.querySelector('.seconds');

        if (distance < 0) {
            // Event has passed
            daysEl.innerText = "00";
            hoursEl.innerText = "00";
            minutesEl.innerText = "00";
            secondsEl.innerText = "00";
            card.style.borderColor = "var(--primary)";
            return;
        }

        // Time calculations
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // Update UI with leading zeros
        daysEl.innerText = days.toString().padStart(2, '0');
        hoursEl.innerText = hours.toString().padStart(2, '0');
        minutesEl.innerText = minutes.toString().padStart(2, '0');
        secondsEl.innerText = seconds.toString().padStart(2, '0');
    });
}

function showSetupInstructions() {
    container.innerHTML = `
        <div class="countdown-card" style="grid-column: 1 / -1;">
            <div class="card-header">
                <h3>⚠️ Firebase Configuration Required</h3>
            </div>
            <p style="color: var(--text-muted); line-height: 1.6; margin-bottom: 1rem;">
                The app is ready, but it needs a database to store the dates so everyone can see them.
            </p>
            <ol style="color: var(--text-muted); padding-left: 1.5rem; line-height: 1.6;">
                <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" style="color: var(--primary);">Firebase Console</a> and create a new project.</li>
                <li>Add a web app to the project to get your <code>firebaseConfig</code> object.</li>
                <li>Go to <b>Realtime Database</b> in the Firebase menu and create a database (start in test mode so reads/writes are allowed).</li>
                <li>Open <code>app.js</code> in this project and replace the placeholder <code>firebaseConfig</code> with your actual keys.</li>
                <li>Refresh this page.</li>
            </ol>
        </div>
    `;
}

// ==========================================
// EVENT LISTENERS & ACTIONS
// ==========================================

// Open Modal
addEventBtn.addEventListener('click', () => {
    addEventModal.classList.add('show');
    document.getElementById('eventName').focus();
});

// Close Modal
const closeModal = () => {
    addEventModal.classList.remove('show');
    addEventForm.reset();
};
closeModalBtn.addEventListener('click', closeModal);

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === addEventModal) closeModal();
});

// Handle Form Submission
addEventForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!isFirebaseConfigured) {
        alert("Please configure Firebase first (see instructions on screen).");
        return;
    }

    const name = document.getElementById('eventName').value.trim();
    const isDateOnly = document.querySelector('input[name="dateType"]:checked').value === 'date';

    let dateStr, timestamp;
    if (isDateOnly) {
        dateStr = eventDateOnly.value;
        if (!dateStr) return;
        timestamp = new Date(dateStr + "T00:00:00").getTime();
    } else {
        dateStr = eventDateTime.value;
        if (!dateStr) return;
        timestamp = new Date(dateStr).getTime();
    }

    if (!name) return;

    // Push new date to Firebase
    const newRef = countdownsRef.push();
    newRef.set({
        name: name,
        date: dateStr,
        timestamp: timestamp,
        isDateOnly: isDateOnly,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        closeModal();
    }).catch((error) => {
        console.error("Error adding document: ", error);
        alert("Error adding countdown.");
    });
});

// Delete countdown (Attached to window so inline onclick works)
window.deleteCountdown = function (id) {
    if (confirm("Are you sure you want to delete this countdown?")) {
        countdownsRef.child(id).remove().catch((error) => {
            console.error("Error removing document: ", error);
            alert("Error removing countdown.");
        });
    }
};

// Boot the app
init();
