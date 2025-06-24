import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Lightbulb, Plus, Check, X, Trash2, ShieldCheck, Flag, Loader, User } from 'lucide-react'; // Importing icons

// Ensure __app_id, __firebase_config, __initial_auth_token are available from the environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [quests, setQuests] = useState([]);
    const [newQuestTitle, setNewQuestTitle] = useState('');
    const [newQuestDescription, setNewQuestDescription] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [ioMessage, setIoMessage] = useState("Io: Initializing Starship Valindra Quest Log systems...");
    const messageBoxRef = useRef(null); // Ref for message box for auto-hide

    // Function to show custom message box
    const showMessageBox = (message) => {
        setIoMessage(message);
        // Clear any previous timeout
        if (messageBoxRef.current) {
            clearTimeout(messageBoxRef.current);
        }
        // Set a new timeout to clear the message after 5 seconds
        messageBoxRef.current = setTimeout(() => {
            setIoMessage("Io: Awaiting your next directive, Captain.");
        }, 5000);
    };

    // Firebase Initialization and Authentication
    useEffect(() => {
        let app;
        try {
            app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestoreDb);
            setAuth(firebaseAuth);

            // Sign in anonymously or with custom token if available
            const initialSignIn = async () => {
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(firebaseAuth, __initial_auth_token);
                        showMessageBox("Io: Authentication established. Welcome back, Captain Odelis.");
                    } else {
                        await signInAnonymously(firebaseAuth);
                        showMessageBox("Io: Anonymous access granted. Commencing mission protocols.");
                    }
                } catch (error) {
                    console.error("Firebase Auth Error:", error);
                    showMessageBox(`Io: Authentication failed. Error: ${error.message}. Please restart the simulation.`);
                } finally {
                    setIsLoading(false);
                }
            };

            onAuthStateChanged(firebaseAuth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    showMessageBox("Io: User identified. Accessing personal quest logs.");
                } else {
                    // If user logs out or session expires, reset userId and show initial message
                    setUserId(null);
                    showMessageBox("Io: Awaiting Captain's presence. Please re-authenticate.");
                }
                setIsLoading(false); // Authentication state is ready
            });

            initialSignIn();

        } catch (e) {
            console.error("Firebase initialization failed:", e);
            showMessageBox(`Io: Critical system failure. Firebase initialization failed: ${e.message}`);
            setIsLoading(false);
        }
    }, []); // Run once on component mount

    // Fetch quests when userId and db are ready
    useEffect(() => {
        if (db && userId) {
            const questsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/quests`);
            // Note: orderBy is commented out due to a known issue with Canvas's Firestore emulator
            // In a real production environment, you would typically use orderBy for sorting.
            const q = query(questsCollectionRef /*, orderBy('createdAt', 'desc')*/);

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedQuests = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setQuests(fetchedQuests.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))); // Client-side sort
                setIsLoading(false);
                showMessageBox("Io: Quest logs synchronized, Captain.");
            }, (error) => {
                console.error("Error fetching quests:", error);
                showMessageBox(`Io: Data synchronization error: ${error.message}.`);
                setIsLoading(false);
            });

            // Cleanup listener on unmount
            return () => unsubscribe();
        }
    }, [db, userId]); // Re-run if db or userId changes

    // Add a new quest
    const handleAddQuest = async () => {
        if (!newQuestTitle.trim()) {
            showMessageBox("Io: Quest title cannot be empty, Captain.");
            return;
        }
        if (!db || !userId) {
            showMessageBox("Io: Systems not ready. Please wait for initialization.");
            return;
        }

        try {
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/quests`), {
                title: newQuestTitle.trim(),
                description: newQuestDescription.trim(),
                completed: false,
                createdAt: serverTimestamp() // Use server timestamp for consistent ordering
            });
            setNewQuestTitle('');
            setNewQuestDescription('');
            showMessageBox("Io: New quest added to the log. Objective initiated.");
        } catch (e) {
            console.error("Error adding document: ", e);
            showMessageBox(`Io: Failed to add quest: ${e.message}.`);
        }
    };

    // Toggle quest completion status
    const handleToggleComplete = async (id, currentStatus) => {
        if (!db || !userId) {
            showMessageBox("Io: Systems not ready. Please wait for initialization.");
            return;
        }
        try {
            const questRef = doc(db, `artifacts/${appId}/users/${userId}/quests`, id);
            await updateDoc(questRef, {
                completed: !currentStatus
            });
            showMessageBox(`Io: Quest status updated: ${!currentStatus ? 'Completed' : 'Reactivated'}.`);
        } catch (e) {
            console.error("Error updating document: ", e);
            showMessageBox(`Io: Failed to update quest status: ${e.message}.`);
        }
    };

    // Delete a quest
    const handleDeleteQuest = async (id) => {
        if (!db || !userId) {
            showMessageBox("Io: Systems not ready. Please wait for initialization.");
            return;
        }
        // Custom confirmation modal (replaces window.confirm)
        const confirmDelete = async () => {
            const confirmation = window.confirm("Io: Captain, are you certain you wish to purge this quest from the log? This action cannot be undone.");
            if (confirmation) {
                try {
                    await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/quests`, id));
                    showMessageBox("Io: Quest purged from the log. Memory de-fragmented.");
                } catch (e) {
                    console.error("Error deleting document: ", e);
                    showMessageBox(`Io: Failed to purge quest: ${e.message}.`);
                }
            }
        };
        confirmDelete();
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-blue-300">
                <Loader className="animate-spin mr-2" size={24} />
                <p>Io: Initiating systems. Please await synchronization...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 to-blue-950 text-blue-100 p-4 sm:p-6 lg:p-8 flex flex-col items-center">
            {/* Io's Message Box */}
            <div className="w-full max-w-2xl bg-blue-900/40 border border-blue-700/50 rounded-xl p-4 mb-6 shadow-lg text-center text-lg relative z-10">
                <p>{ioMessage}</p>
            </div>

            {/* Main Game Container - Matches Valindra Idle style */}
            <div className="game-container bg-gray-800/60 backdrop-blur-sm rounded-2xl shadow-xl border border-blue-600/50 p-6 sm:p-8 lg:p-10 w-full max-w-4xl flex flex-col gap-6">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-center section-title mb-4">
                    <Flag className="inline-block mr-3 mb-1" size={48} />
                    Valindra Quest Log
                </h1>

                {userId && (
                    <div className="text-center text-sm text-blue-300 flex items-center justify-center gap-2">
                        <User size={16} /> User ID: <span className="font-mono bg-blue-900/30 px-2 py-1 rounded-md text-xs sm:text-sm">{userId}</span>
                    </div>
                )}

                {/* Add New Quest Section */}
                <div className="bg-gray-700/50 border border-gray-600 rounded-xl p-5 flex flex-col gap-4">
                    <h2 className="text-2xl font-bold text-blue-300 flex items-center">
                        <Plus className="mr-2" /> New Objective
                    </h2>
                    <input
                        type="text"
                        placeholder="Quest Title: e.g., 'Calibrate Inter-Reality Drive'"
                        value={newQuestTitle}
                        onChange={(e) => setNewQuestTitle(e.target.value)}
                        className="w-full p-3 rounded-lg bg-gray-900 border border-blue-500 text-blue-100 placeholder-blue-300/70 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <textarea
                        placeholder="Quest Description: Detail the parameters of this mission."
                        value={newQuestDescription}
                        onChange={(e) => setNewQuestDescription(e.target.value)}
                        rows="3"
                        className="w-full p-3 rounded-lg bg-gray-900 border border-blue-500 text-blue-100 placeholder-blue-300/70 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
                    ></textarea>
                    <button
                        onClick={handleAddQuest}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!userId || !newQuestTitle.trim()}
                    >
                        <Flag size={20} /> Add Objective
                    </button>
                </div>

                {/* Quest List Section */}
                <div className="bg-gray-700/50 border border-gray-600 rounded-xl p-5">
                    <h2 className="text-2xl font-bold text-blue-300 flex items-center mb-4">
                        <Lightbulb className="mr-2" /> Current Directives ({quests.length})
                    </h2>
                    {quests.length === 0 ? (
                        <p className="text-gray-400 text-center py-4">Io: No active directives, Captain. Awaiting new objectives.</p>
                    ) : (
                        <ul className="space-y-4">
                            {quests.map((quest) => (
                                <li
                                    key={quest.id}
                                    className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg shadow-sm transition-all duration-300 ${
                                        quest.completed
                                            ? 'bg-green-900/30 border border-green-700/50 text-gray-400 line-through'
                                            : 'bg-gray-900/70 border border-blue-700/50'
                                    }`}
                                >
                                    <div className="flex-1 mb-3 sm:mb-0">
                                        <h3 className="text-xl font-semibold">{quest.title}</h3>
                                        {quest.description && (
                                            <p className={`text-sm mt-1 ${quest.completed ? 'text-gray-500' : 'text-blue-200/80'}`}>
                                                {quest.description}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => handleToggleComplete(quest.id, quest.completed)}
                                            className={`p-2 rounded-full transition-colors ${
                                                quest.completed ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'
                                            } text-white`}
                                            title={quest.completed ? 'Mark as Incomplete' : 'Mark as Complete'}
                                        >
                                            {quest.completed ? <X size={20} /> : <Check size={20} />}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteQuest(quest.id)}
                                            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
                                            title="Delete Quest"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
             {/* Styling for .game-container, .section-title etc. */}
            <style jsx>{`
                .game-container {
                    box-shadow: 0 0 50px rgba(0, 200, 255, 0.7); /* Stronger blue glow */
                    animation: fadeIn 1s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .section-title {
                    background: -webkit-linear-gradient(45deg, #00aaff, #00e0ff);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                body {
                    font-family: 'Inter', sans-serif;
                }
            `}</style>
        </div>
    );
}

export default App;
