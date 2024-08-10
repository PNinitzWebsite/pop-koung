import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import { getFirestore, doc, collection, setDoc, getDoc, onSnapshot, serverTimestamp, query, orderBy, limit, updateDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCVCVQH42XxhHQAK1Lj4wWpZLZFVMfy33w",
    authDomain: "pop-koung.firebaseapp.com",
    projectId: "pop-koung",
    storageBucket: "pop-koung.appspot.com",
    messagingSenderId: "717319598468",
    appId: "1:717319598468:web:cda33788dd6e4252486dd1",
    measurementId: "G-H2K0C1QD7W"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const cat = document.getElementById('cat');
const sound = document.getElementById('popSound');
const scoreElement = document.getElementById('score');
const onigiriElement = document.getElementById('onigiri');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const leaderboardList = document.getElementById('leaderboardList');

let score = 0;
let isSoundPlaying = false;
let user = null; // Store the current user

// Handle login
loginBtn.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).then(async result => {
        user = result.user;
        console.log('User logged in:', user);
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline';

        // Get visitor score and update Firestore
        const guestScore = localStorage.getItem('guestScore') || 0;
        await mergeVisitorScore(user.uid, user.displayName, parseInt(guestScore, 10));
        localStorage.removeItem('guestScore'); // Remove guest score after login
        scoreElement.textContent = '0'; // Reset visitor score display

        // Update the score display
        await updateScoreDisplay(user.uid);
    }).catch(error => {
        console.error('Login error:', error);
    });
});

// Handle logout
logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        console.log('User logged out');
        loginBtn.style.display = 'inline';
        logoutBtn.style.display = 'none';
        scoreElement.textContent = localStorage.getItem('guestScore') || '0'; // Show guest score on logout
        user = null; // Clear current user
        score = 0; // Reset local score
        loadLeaderboard(); // Reload leaderboard to show guest score
    }).catch(error => {
        console.error('Logout error:', error);
    });
});

// Function to handle cat click
function popCat() {
    if (!isSoundPlaying) {
        isSoundPlaying = true;

        // Change to open2 mouth image
        cat.src = 'open2.png';
        sound.play();

        setTimeout(() => {
            cat.src = 'closed2.png';
        }, 300);

        sound.onended = function() {
            // Update score
            score++;
            updateScoreDisplayAndAnimate();

            if (user) {
                // Update Firestore score for logged-in user
                updateFirestoreScore(user.uid, score); // Update the user's score
            } else {
                // Update guest score in localStorage
                let guestScore = localStorage.getItem('guestScore') || 0;
                guestScore = parseInt(guestScore, 10) + 1;
                localStorage.setItem('guestScore', guestScore);
                updateScoreDisplayAndAnimate();
            }

            isSoundPlaying = false;
        };
    }
}

// Function to update score display and apply animation
function updateScoreDisplayAndAnimate() {
    scoreElement.textContent = score;

    // Add bounce class to score element
    scoreElement.classList.add('bounce');
    onigiriElement.classList.add('up');

    // Remove bounce class after animation duration
    setTimeout(() => {
        scoreElement.classList.remove('bounce');
        onigiriElement.classList.remove('up');
    }, 150); // Match this duration to your CSS animation duration
}


// Function to handle score update or creation
async function mergeVisitorScore(userId, displayName, guestScore) {
    const userScoreRef = doc(db, 'scores', userId);

    try {
        const docSnap = await getDoc(userScoreRef);
        if (docSnap.exists()) {
            const existingScore = docSnap.data().score || 0;
            score = existingScore + guestScore; // Set local score
            await updateDoc(userScoreRef, {
                score: existingScore + guestScore,
                timestamp: serverTimestamp()
            });
        } else {
            score = guestScore; // Set local score
            await setDoc(userScoreRef, {
                uid: userId,
                displayName: displayName,
                score: guestScore,
                timestamp: serverTimestamp()
            });
        }
        scoreElement.textContent = score; // Update score display
    } catch (error) {
        console.error("Error merging visitor score:", error);
    }
}

// Function to update score display from Firestore
async function updateScoreDisplay(userId) {
    const userScoreRef = doc(db, 'scores', userId);

    try {
        const docSnap = await getDoc(userScoreRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            score = data.score || 0; // Update local score variable
            scoreElement.textContent = score;
        } else {
            scoreElement.textContent = '0'; // User has no score in Firestore
        }
    } catch (error) {
        console.error("Error getting user score:", error);
        scoreElement.textContent = '0'; // Error occurred
    }
}

// Function to update Firestore score incrementally
async function updateFirestoreScore(userId, newScore) {
    const userScoreRef = doc(db, 'scores', userId);

    try {
        await updateDoc(userScoreRef, {
            score: newScore,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error updating Firestore score:", error);
    }
}

// Load leaderboard from Firestore
function loadLeaderboard() {
    const scoresRef = collection(db, 'scores');
    const q = query(scoresRef, orderBy('score', 'desc'), limit(10));

    onSnapshot(q, (snapshot) => {
        leaderboardList.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const listItem = document.createElement('li');
            listItem.innerHTML = `<i class="trophy fas fa-trophy"></i><span>${data.displayName}</span><span>${data.score}</span>`;
            leaderboardList.appendChild(listItem);
        });

        // Display guest score if no user is logged in
        if (!user) {
            const guestScore = localStorage.getItem('guestScore');
            if (guestScore) {
                const guestListItem = document.createElement('li');
                guestListItem.innerHTML = `<span>Visitor</span><span>${guestScore}</span>`;
                leaderboardList.appendChild(guestListItem);
            }
        }
    }, (error) => {
        console.error('Error loading leaderboard:', error);
    });
}

// Initialize and load leaderboard on page load
document.addEventListener('DOMContentLoaded', () => {
    loadLeaderboard();

    onAuthStateChanged(auth, async (loggedInUser) => {
        if (loggedInUser) {
            user = loggedInUser;
            loginBtn.style.display = 'none';
            logoutBtn.style.display = 'inline';
            await updateScoreDisplay(user.uid); // Show user's score after login
        } else {
            loginBtn.style.display = 'inline';
            logoutBtn.style.display = 'none';
            scoreElement.textContent = localStorage.getItem('guestScore') || '0'; // Show guest score on logout
        }
    });

    if (cat) {
        cat.addEventListener('click', popCat);
    }
});
