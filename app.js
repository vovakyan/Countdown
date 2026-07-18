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
let app, database, countdownsRef, auth;
let isFirebaseConfigured = false;

try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
        app = firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        auth = firebase.auth();
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

// Auth DOM
const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const userProfile = document.getElementById('userProfile');
const userName = document.getElementById('userName');
const familyAlbumBtn = document.getElementById('familyAlbumBtn');
const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');

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
let currentUser = null;
let editingEventId = null; // Track which event we are editing
let currentFilter = 'all';
let searchQuery = '';

// ==========================================
// SECURITY: ALLOWED EMAILS
// ==========================================
// Add the Gmail addresses of family members allowed to add/delete dates here.
const ALLOWED_EMAILS = [
    'vovakyan@gmail.com',
    'natalie.ovakyan@gmail.com',
    'scarlett.ovakyan@gmail.com',
    'brendamorelosmichel@gmail.com'
];

// ==========================================
// BACKGROUND SLIDESHOW
// ==========================================
// To change the background pictures, place images in an "images" folder
// and list their filenames here.
const bgImages = [
    'images/1067_hcl699184_1_01.jpg',
    'images/3612352859113301506.jpg',
    'images/DSC_0398.JPG',
    'images/IMG951568.jpg',
    'images/PXL_20240404_134742046.MP.jpg',
    'images/PXL_20240524_142058096.jpg',
    'images/PXL_20241211_031532916.jpg'
];
let currentSlideIndex = 0;

function initSlideshow() {
    const slideshowContainer = document.getElementById('bgSlideshow');
    if (!slideshowContainer) return;

    bgImages.forEach((src, index) => {
        const slide = document.createElement('div');
        slide.className = `bg-slide ${index === 0 ? 'active' : ''}`;
        
        if (index === 0) {
            slide.style.backgroundImage = `url('${src}')`;
            slide.dataset.loaded = "true";
        } else {
            slide.dataset.loaded = "false";
        }
        
        slideshowContainer.appendChild(slide);
    });

    if (bgImages.length > 1) {
        setInterval(() => {
            const slides = document.querySelectorAll('.bg-slide');
            if(slides.length === 0) return;
            
            slides[currentSlideIndex].classList.remove('active');
            
            currentSlideIndex = (currentSlideIndex + 1) % slides.length;
            
            if (slides[currentSlideIndex].dataset.loaded === "false") {
                slides[currentSlideIndex].style.backgroundImage = `url('${bgImages[currentSlideIndex]}')`;
                slides[currentSlideIndex].dataset.loaded = "true";
            }
            
            slides[currentSlideIndex].classList.add('active');
        }, 8000); // Rotate every 8 seconds
    }
}

// ==========================================
// INITIALIZATION
// ==========================================
function init() {
    if (!isFirebaseConfigured) {
        showSetupInstructions();
        return;
    }

    initSlideshow();
    initNotifications();

    // Setup Auth Listener
    auth.onAuthStateChanged(user => {
        currentUser = user;
        updateAuthUI();
        renderCountdowns(); // Re-render to show/hide delete buttons
    });

    // Listen for real-time updates from Firebase
    countdownsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        countdowns = data || {};
        renderCountdowns();
    });

    // Start the interval to update timers every second
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        updateTimers();
        updateGlobalTimeline();
    }, 1000);
    
    // Initial call
    updateGlobalTimeline();
}

// ==========================================
// AUTH & UI LOGIC
// ==========================================
function isUserAdmin() {
    return currentUser && currentUser.email && ALLOWED_EMAILS.includes(currentUser.email.toLowerCase());
}

function updateAuthUI() {
    if (currentUser) {
        signInBtn.style.display = 'none';
        userProfile.style.display = 'flex';
        familyAlbumBtn.style.display = 'flex';
        userName.innerText = currentUser.displayName || currentUser.email;

        if (isUserAdmin()) {
            addEventBtn.style.display = 'flex';
        } else {
            addEventBtn.style.display = 'none';
        }
    } else {
        signInBtn.style.display = 'block';
        userProfile.style.display = 'none';
        familyAlbumBtn.style.display = 'none';
        addEventBtn.style.display = 'none';
    }
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

    // Apply search filter
    let filteredKeys = keys.filter(key => {
        if (searchQuery) {
            const name = countdowns[key].name || "";
            if (!name.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false;
            }
        }
        return true;
    });

    const now = new Date().getTime();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    // Helper to calculate distance logic for sorting
    const getDistance = (item) => {
        const timestamp = item.timestamp || new Date(item.date).getTime();
        const isDateOnly = item.isDateOnly !== undefined ? item.isDateOnly : !item.date.includes('T');
        if (isDateOnly) {
            const targetMidnight = new Date(timestamp).setHours(0,0,0,0);
            const currentMidnight = new Date(now).setHours(0,0,0,0);
            return targetMidnight - currentMidnight;
        }
        return timestamp - now;
    };

    // Apply status filter
    filteredKeys = filteredKeys.filter(key => {
        const item = countdowns[key];
        const dist = getDistance(item);
        if (currentFilter === 'active' && dist <= 0) return false;
        if (currentFilter === 'completed' && dist > 0) return false;
        return true;
    });

    // Smart Sorting
    filteredKeys.sort((a, b) => {
        const t1 = countdowns[a].timestamp || new Date(countdowns[a].date).getTime();
        const t2 = countdowns[b].timestamp || new Date(countdowns[b].date).getTime();
        
        const dist1 = getDistance(countdowns[a]);
        const dist2 = getDistance(countdowns[b]);

        const isOld1 = dist1 <= -ONE_DAY_MS;
        const isOld2 = dist2 <= -ONE_DAY_MS;

        if (isOld1 && !isOld2) return 1; // 1 goes to bottom
        if (!isOld1 && isOld2) return -1; // 2 goes to bottom
        
        // If both are old, sort newest old first (descending)
        if (isOld1 && isOld2) return t2 - t1;

        // Otherwise sort ascending (closest first)
        return t1 - t2;
    });

    if (filteredKeys.length === 0) {
        container.innerHTML = '<div class="empty-state">No matching countdowns found.</div>';
        return;
    }

    filteredKeys.forEach(key => {
        const item = countdowns[key];
        const card = createCountdownCard(key, item);
        
        // Apply faded aesthetic for events > 1 day old
        const dist = getDistance(item);
        if (dist <= -ONE_DAY_MS) {
            card.classList.add('faded-card');
        }

        container.appendChild(card);
    });

    // Do an immediate update to prevent 1-second lag on render
    updateTimers();
}

function createCountdownCard(id, item) {
    const card = document.createElement('div');
    card.className = 'countdown-card';

    const timestamp = item.timestamp || new Date(item.date).getTime();
    // Force all progress bars to calculate based on 07/14/2026
    const createdAt = new Date('2026-07-14T00:00:00').getTime(); 
    card.dataset.targetTimestamp = timestamp;
    card.dataset.createdAt = createdAt;
    card.dataset.completed = "false";
    card.dataset.isDateOnly = item.isDateOnly ? 'true' : 'false';
    card.id = id;
    card.dataset.eventName = item.name;

    // Format the date nicely for display
    const options = {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    };
    if (!item.isDateOnly) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }
    const formattedDate = new Date(timestamp).toLocaleDateString(undefined, options);

    const deleteBtnHTML = isUserAdmin() ? 
        `<div style="display: flex; gap: 0.5rem;">
            <button class="edit-btn" onclick="editCountdown('${id}')" title="Edit">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="delete-btn" onclick="deleteCountdown('${id}')" title="Delete">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        </div>` : '';

    card.innerHTML = `
        <div class="card-header">
            <h3>${item.name}</h3>
            ${deleteBtnHTML}
        </div>
        <div class="card-date">${formattedDate}</div>
        <div class="timer">
            <div class="time-box">
                <span class="time-value days">00</span>
                <span class="time-label">Days</span>
            </div>
            ${!item.isDateOnly ? `
            <div class="time-box">
                <span class="time-value hours">00</span>
                <span class="time-label">Hrs</span>
            </div>
            <div class="time-box">
                <span class="time-value minutes">00</span>
                <span class="time-label">Min</span>
            </div>` : ''}
        </div>
        <div class="progress-container">
            <div class="progress-bar"></div>
        </div>
    `;
    return card;
}

function updateTimers() {
    const cards = document.querySelectorAll('.countdown-card');
    const now = new Date().getTime();

    cards.forEach(card => {
        const targetDate = parseInt(card.dataset.targetTimestamp, 10);
        const createdAt = parseInt(card.dataset.createdAt, 10);
        const isDateOnly = card.dataset.isDateOnly === 'true';
        
        let distance;
        if (isDateOnly) {
            const targetMidnight = new Date(targetDate).setHours(0,0,0,0);
            const currentMidnight = new Date(now).setHours(0,0,0,0);
            distance = targetMidnight - currentMidnight;
        } else {
            distance = targetDate - now;
        }

        checkAndFireNotifications(card.id, card.dataset.eventName, distance);

        const daysEl = card.querySelector('.days');
        const hoursEl = card.querySelector('.hours');
        const minutesEl = card.querySelector('.minutes');
        const progressBar = card.querySelector('.progress-bar');

        if (distance <= 0) {
            // Event has passed
            daysEl.innerText = "00";
            if (hoursEl) hoursEl.innerText = "00";
            if (minutesEl) minutesEl.innerText = "00";
            card.classList.add('completed');
            if (progressBar) progressBar.style.width = '100%';
            
            if (card.dataset.completed === "false") {
                card.dataset.completed = "true";
                // Trigger confetti if we just caught it hitting zero
                if (Math.abs(distance) < 60000 && window.confetti) { // Only if passed within the last minute
                    confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: { y: 0.6 }
                    });
                }
            }
            return;
        }

        // Calculate progress percentage
        const totalDuration = targetDate - createdAt;
        const elapsed = now - createdAt;
        let progressPercent = (elapsed / totalDuration) * 100;
        if (progressPercent < 0) progressPercent = 0;
        if (progressPercent > 100) progressPercent = 100;
        if (progressBar) progressBar.style.width = `${progressPercent}%`;

        // Time calculations
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

        // Update UI with leading zeros
        daysEl.innerText = days.toString().padStart(2, '0');
        if (hoursEl) hoursEl.innerText = hours.toString().padStart(2, '0');
        if (minutesEl) minutesEl.innerText = minutes.toString().padStart(2, '0');
    });
}

function updateGlobalTimeline() {
    const marker = document.getElementById('timelineTodayMarker');
    if (!marker) return;

    const start = new Date('2026-07-14T00:00:00').getTime();
    const end = new Date('2027-05-20T00:00:00').getTime();
    const now = new Date().getTime();

    const totalDuration = end - start;
    let elapsed = now - start;

    let percent = (elapsed / totalDuration) * 100;
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;

    marker.style.top = `${percent}%`;
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

// Auth Events
signInBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => {
        console.error("Login failed:", error);
        alert("Could not sign in: " + error.message);
    });
});

signOutBtn.addEventListener('click', () => {
    auth.signOut();
});

// Search & Filter Events
document.getElementById('searchInput').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderCountdowns();
});

document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        // Update active class
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        // Update state and render
        currentFilter = e.target.dataset.filter;
        renderCountdowns();
    });
});

// ==========================================
// NOTIFICATIONS
// ==========================================
function initNotifications() {
    const btn = document.getElementById('enableNotificationsBtn');
    if (!btn) return;

    btn.style.display = 'flex';

    if (!('Notification' in window)) {
        btn.title = "Push notifications not supported on this device";
        btn.style.opacity = '0.5';
        btn.addEventListener('click', () => {
            alert("Push notifications are not supported on this browser or device. On iOS, you may need to add the app to your Home Screen first.");
        });
        return;
    }

    const updateIcon = () => {
        const browserGranted = Notification.permission === 'granted';
        const userEnabled = localStorage.getItem('notificationsToggle') !== 'false';
        const isEnabled = browserGranted && userEnabled;

        if (isEnabled) {
            // Action to Disable
            btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><path d="M18.63 13A17.89 17.89 0 0 1 18 8"></path><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path><path d="M18 8a6 6 0 0 0-9.33-5"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
            btn.classList.remove('outline');
            btn.style.background = '';
            btn.title = "Disable Push Notifications";
        } else {
            // Action to Enable
            btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>';
            btn.classList.add('outline');
            btn.style.background = '';
            btn.title = "Enable Push Notifications";
        }
    };

    updateIcon();

    btn.addEventListener('click', () => {
        const browserGranted = Notification.permission === 'granted';
        const userEnabled = localStorage.getItem('notificationsToggle') !== 'false';
        const isEnabled = browserGranted && userEnabled;

        if (isEnabled) {
            // Turn off
            localStorage.setItem('notificationsToggle', 'false');
            updateIcon();
        } else {
            // Turn on
            if (Notification.permission === 'default') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        localStorage.setItem('notificationsToggle', 'true');
                        updateIcon();
                        new Notification("Notifications Enabled!", {
                            body: "You will now be notified for upcoming events."
                        });
                    } else {
                        alert("Please allow notifications in your browser settings to use this feature.");
                    }
                });
            } else if (Notification.permission === 'denied') {
                alert("Notifications are blocked by your browser. Please enable them in your browser settings.");
            } else {
                localStorage.setItem('notificationsToggle', 'true');
                updateIcon();
                new Notification("Notifications Re-enabled!", {
                    body: "You will now be notified for upcoming events."
                });
            }
        }
    });
}

function checkAndFireNotifications(id, eventName, distance) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (localStorage.getItem('notificationsToggle') !== 'true') return;
    
    // Check 0 distance (event completed)
    if (distance <= 0 && distance > -60000) {
        if (!localStorage.getItem(`notif_${id}_completed`)) {
            new Notification(`It's time!`, { body: `${eventName} is happening now!` });
            localStorage.setItem(`notif_${id}_completed`, 'true');
        }
    }
    
    // Check 2 hour warning
    // 2 hours = 7200000 ms. We fire if we are between 1h59m and 2h away.
    if (distance > 7140000 && distance <= 7200000) {
        if (!localStorage.getItem(`notif_${id}_2hour`)) {
            new Notification(`Almost there!`, { body: `${eventName} is happening in 2 hours!` });
            localStorage.setItem(`notif_${id}_2hour`, 'true');
        }
    }
}

// Open Modal
addEventBtn.addEventListener('click', () => {
    editingEventId = null;
    document.getElementById('modalTitle').innerText = "New Countdown";
    document.getElementById('submitBtn').innerText = "Create Countdown";
    addEventModal.classList.add('show');
    document.getElementById('eventName').focus();
});

// Close Modal
const closeModal = () => {
    addEventModal.classList.remove('show');
    addEventForm.reset();
    editingEventId = null;

    // Reset default date/time toggle state
    eventDateOnly.style.display = 'block';
    eventDateOnly.required = true;
    eventDateTime.style.display = 'none';
    eventDateTime.required = false;
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

    if (!isUserAdmin()) {
        alert("You do not have permission to add dates.");
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

    const payload = {
        name: name,
        date: dateStr,
        timestamp: timestamp,
        isDateOnly: isDateOnly
    };

    if (editingEventId) {
        // Update existing date
        countdownsRef.child(editingEventId).update(payload).then(() => {
            closeModal();
        }).catch((error) => {
            console.error("Error updating document: ", error);
            alert("Error updating countdown.");
        });
    } else {
        // Push new date to Firebase
        payload.createdAt = firebase.database.ServerValue.TIMESTAMP;
        const newRef = countdownsRef.push();
        newRef.set(payload).then(() => {
            closeModal();
        }).catch((error) => {
            console.error("Error adding document: ", error);
            alert("Error adding countdown.");
        });
    }
});

// Edit countdown (Attached to window so inline onclick works)
window.editCountdown = function(id) {
    const item = countdowns[id];
    if (!item) return;

    editingEventId = id;
    document.getElementById('modalTitle').innerText = "Edit Countdown";
    document.getElementById('submitBtn').innerText = "Save Changes";
    document.getElementById('eventName').value = item.name;

    // Determine correct input based on isDateOnly
    const dStr = item.date || ""; 
    // Fallback: If it's an old item without isDateOnly, assume specific time if it has 'T'
    const isDateOnly = item.isDateOnly !== undefined ? item.isDateOnly : !dStr.includes('T');
    
    if (isDateOnly) {
        document.querySelector('input[name="dateType"][value="date"]').checked = true;
        eventDateOnly.style.display = 'block';
        eventDateOnly.required = true;
        eventDateTime.style.display = 'none';
        eventDateTime.required = false;
        
        // Ensure format is YYYY-MM-DD
        eventDateOnly.value = dStr.split('T')[0];
    } else {
        document.querySelector('input[name="dateType"][value="datetime"]').checked = true;
        eventDateOnly.style.display = 'none';
        eventDateOnly.required = false;
        eventDateTime.style.display = 'block';
        eventDateTime.required = true;
        
        eventDateTime.value = dStr;
    }

    addEventModal.classList.add('show');
};

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
