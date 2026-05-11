const firebaseConfig = {
    apiKey: "AIzaSyD3NEXunS2PQPVQ3nDS27Nk4JIG3xajyVM",
    authDomain: "messendger-71e53.firebaseapp.com",
    databaseURL: "https://messendger-71e53-default-rtdb.firebaseio.com",
    projectId: "messendger-71e53",
    storageBucket: "messendger-71e53.firebasestorage.app",
    messagingSenderId: "1010287168963",
    appId: "1:1010287168963:web:15868f94480bb833414176"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();

const state = {
    user: null,
    profile: null,
    activeChatId: null,
    activePartner: null,
    editingMessageId: null,
    dialogsListener: null,
    messagesListener: null,
    typingListener: null,
    typingTimer: null,
    searchTimer: null,
    selectedAvatarDataUrl: null,
    isAtBottom: true
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
    bindElements();
    bindEvents();
    updateCharCounter();
    auth.onAuthStateChanged(handleAuthState);
});

function bindElements() {
    [
        "loginScreen", "registerScreen", "mainAppScreen", "loginEmail", "loginPassword",
        "doLoginBtn", "showRegisterBtn", "regEmail", "regUsername", "regNickname",
        "regPassword", "doRegisterBtn", "showLoginFromRegBtn", "globalLogoutBtn",
        "openProfileBtn", "themeToggleBtn", "sidebarAvatar", "sidebarName", "sidebarUsername",
        "searchUserInput", "searchUserBtn", "searchResults", "dialogsList",
        "dialogsCount", "chatArea", "backToDialogsBtn", "chatAvatar", "currentChatTitle",
        "currentChatSubtitle", "deleteDialogBtn", "messagesContainer", "typingIndicatorContainer",
        "typingText", "scrollBottomBtn", "messageInput", "sendBtn", "charCounter", "editBanner",
        "cancelEditBtn", "profileModal", "closeProfileBtn", "profileAvatarPreview",
        "profilePreviewName", "profilePreviewUsername", "profileNickname",
        "profileUsername", "profileAvatarFile", "removeAvatarBtn", "profileBio", "saveProfileBtn"
    ].forEach(id => els[id] = document.getElementById(id));
}

function bindEvents() {
    initTheme();
    els.doLoginBtn.addEventListener("click", loginUser);
    els.doRegisterBtn.addEventListener("click", registerUser);
    els.showRegisterBtn.addEventListener("click", () => showAuthScreen("register"));
    els.showLoginFromRegBtn.addEventListener("click", () => showAuthScreen("login"));
    els.globalLogoutBtn.addEventListener("click", logout);
    els.openProfileBtn.addEventListener("click", openProfileModal);
    els.themeToggleBtn.addEventListener("click", toggleTheme);
    els.closeProfileBtn.addEventListener("click", closeProfileModal);
    els.saveProfileBtn.addEventListener("click", saveProfile);
    els.profileAvatarFile.addEventListener("change", handleAvatarFileSelect);
    els.removeAvatarBtn.addEventListener("click", removeSelectedAvatar);
    els.profileModal.addEventListener("click", event => {
        if (event.target === els.profileModal) closeProfileModal();
    });

    els.searchUserBtn.addEventListener("click", () => searchUserByUsername(els.searchUserInput.value));
    els.searchUserInput.addEventListener("keydown", event => {
        if (event.key === "Enter") searchUserByUsername(els.searchUserInput.value);
    });
    els.searchUserInput.addEventListener("input", () => {
        clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(() => {
            if (els.searchUserInput.value.trim().length >= 3) searchUserByUsername(els.searchUserInput.value);
        }, 350);
    });

    els.sendBtn.addEventListener("click", sendOrUpdateMessage);
    els.cancelEditBtn.addEventListener("click", cancelEditMessage);
    els.deleteDialogBtn.addEventListener("click", deleteCurrentDialog);
    els.scrollBottomBtn.addEventListener("click", () => scrollMessagesToBottom(true));
    els.backToDialogsBtn.addEventListener("click", () => els.chatArea.classList.remove("open"));

    els.messageInput.addEventListener("input", () => {
        updateCharCounter();
        updateTyping(true);
        clearTimeout(state.typingTimer);
        state.typingTimer = setTimeout(() => updateTyping(false), 1200);
    });
    els.messageInput.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendOrUpdateMessage();
        }
    });
    els.messageInput.addEventListener("blur", () => updateTyping(false));
    els.messagesContainer.addEventListener("scroll", () => {
        updateScrollState();
    });
}

async function handleAuthState(user) {
    if (!user) {
        resetSession();
        showAuthScreen("login");
        return;
    }

    state.user = user;
    const snap = await db.ref(`users/${user.uid}`).once("value");
    state.profile = snap.val();

    if (!state.profile) {
        alert("Профиль пользователя не найден.");
        await auth.signOut();
        return;
    }

    showMainApp();
}

function showAuthScreen(screen) {
    els.loginScreen.classList.toggle("hidden", screen !== "login");
    els.registerScreen.classList.toggle("hidden", screen !== "register");
    els.mainAppScreen.classList.add("hidden");
}

function showMainApp() {
    els.loginScreen.classList.add("hidden");
    els.registerScreen.classList.add("hidden");
    els.mainAppScreen.classList.remove("hidden");
    renderCurrentProfile();
    renderEmptyChat();
    listenDialogs();
}

function resetSession() {
    detachListeners();
    state.user = null;
    state.profile = null;
    state.activeChatId = null;
    state.activePartner = null;
    state.editingMessageId = null;
    state.selectedAvatarDataUrl = null;
    els.mainAppScreen.classList.add("hidden");
}

function detachListeners() {
    if (state.dialogsListener) state.dialogsListener.ref.off("value", state.dialogsListener.callback);
    if (state.messagesListener) state.messagesListener.ref.off("value", state.messagesListener.callback);
    if (state.typingListener) state.typingListener.ref.off("value", state.typingListener.callback);
    state.dialogsListener = null;
    state.messagesListener = null;
    state.typingListener = null;
}

async function registerUser() {
    const email = els.regEmail.value.trim();
    const username = normalizeUsername(els.regUsername.value);
    const nickname = els.regNickname.value.trim();
    const password = els.regPassword.value;

    if (!email || !username || !nickname || password.length < 6) {
        alert("Заполните все поля. Пароль должен быть не короче 6 символов.");
        return;
    }
    if (!isValidUsername(username)) {
        alert("Username может содержать только латиницу, цифры и нижнее подчеркивание.");
        return;
    }
    try {
        const existingUid = await findUidByUsername(username);
        if (existingUid) {
            alert("Этот username уже занят.");
            return;
        }

        const { user } = await auth.createUserWithEmailAndPassword(email, password);
        const profile = { email, username, nickname, avatarUrl: "", bio: "", createdAt: Date.now(), updatedAt: Date.now() };
        await db.ref(`users/${user.uid}`).set(profile);
        await setUsernameIndex(username, user.uid);
        alert("Аккаунт создан. Можно входить.");
        await auth.signOut();
        showAuthScreen("login");
    } catch (error) {
        alert(`Ошибка регистрации: ${error.message}`);
    }
}

async function loginUser() {
    const email = els.loginEmail.value.trim();
    const password = els.loginPassword.value;

    if (!email || !password) {
        alert("Введите email и пароль.");
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        alert(`Ошибка входа: ${error.message}`);
    }
}

async function logout() {
    await clearTypingIndicator();
    await auth.signOut();
}

function renderCurrentProfile() {
    const profile = state.profile || {};
    setAvatar(els.sidebarAvatar, profile.nickname || profile.username, profile.avatarUrl);
    els.sidebarName.textContent = profile.nickname || "Профиль";
    els.sidebarUsername.textContent = `@${profile.username || "username"}`;
}

function openProfileModal() {
    const profile = state.profile || {};
    els.profileNickname.value = profile.nickname || "";
    els.profileUsername.value = profile.username || "";
    els.profileAvatarFile.value = "";
    state.selectedAvatarDataUrl = profile.avatarUrl || "";
    els.profileBio.value = profile.bio || "";
    updateProfilePreview();
    els.profileModal.classList.remove("hidden");
}

function closeProfileModal() {
    els.profileModal.classList.add("hidden");
}

async function saveProfile() {
    const nickname = els.profileNickname.value.trim();
    const username = normalizeUsername(els.profileUsername.value);
    const avatarUrl = state.selectedAvatarDataUrl || "";
    const bio = els.profileBio.value.trim();

    if (!nickname || !username) {
        alert("Имя и username обязательны.");
        return;
    }
    if (!isValidUsername(username)) {
        alert("Username может содержать только латиницу, цифры и нижнее подчеркивание.");
        return;
    }
    try {
        const oldUsername = state.profile.username;
        const foundUid = await findUidByUsername(username);
        if (foundUid && foundUid !== state.user.uid) {
            alert("Этот username уже занят.");
            return;
        }

        const updates = { nickname, username, avatarUrl, bio, updatedAt: Date.now() };
        await db.ref(`users/${state.user.uid}`).update(updates);

        if (username !== oldUsername) {
            await removeUsernameIndex(oldUsername, state.user.uid);
            await setUsernameIndex(username, state.user.uid);
        }

        state.profile = { ...state.profile, ...updates };
        renderCurrentProfile();
        await refreshOwnDialogCards();
        closeProfileModal();
    } catch (error) {
        alert(`Не удалось сохранить профиль: ${error.message}`);
    }
}

function updateProfilePreview() {
    const nickname = els.profileNickname.value.trim() || "Имя";
    const username = normalizeUsername(els.profileUsername.value) || "username";
    setAvatar(els.profileAvatarPreview, nickname, state.selectedAvatarDataUrl);
    els.profilePreviewName.textContent = nickname;
    els.profilePreviewUsername.textContent = `@${username}`;
}

async function handleAvatarFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Выберите файл изображения.");
        els.profileAvatarFile.value = "";
        return;
    }

    try {
        state.selectedAvatarDataUrl = await compressAvatar(file);
        updateProfilePreview();
    } catch (error) {
        alert(`Не удалось обработать аватарку: ${error.message}`);
        els.profileAvatarFile.value = "";
    }
}

function removeSelectedAvatar() {
    state.selectedAvatarDataUrl = "";
    els.profileAvatarFile.value = "";
    updateProfilePreview();
}

["profileNickname", "profileUsername"].forEach(id => {
    document.addEventListener("input", event => {
        if (event.target && event.target.id === id) updateProfilePreview();
    });
});

function listenDialogs() {
    if (state.dialogsListener) state.dialogsListener.ref.off("value", state.dialogsListener.callback);

    const ref = db.ref(`user_chats/${state.user.uid}`);
    const callback = snap => renderDialogs(snap.val() || {});
    ref.on("value", callback);
    state.dialogsListener = { ref, callback };
}

function renderDialogs(chats) {
    const entries = Object.entries(chats).sort((a, b) => (b[1].lastTimestamp || 0) - (a[1].lastTimestamp || 0));
    els.dialogsList.replaceChildren();
    els.dialogsCount.textContent = entries.length;

    if (!entries.length) {
        els.dialogsList.appendChild(emptyBlock("Диалогов пока нет", "Найдите человека по username и начните переписку."));
        return;
    }

    entries.forEach(([chatId, info]) => {
        const item = document.createElement("button");
        item.className = `dialog-item ${chatId === state.activeChatId ? "active" : ""}`;
        item.type = "button";
        item.addEventListener("click", () => openChat(chatId, {
            uid: info.partnerId,
            nickname: info.partnerName || info.partnerUsername,
            username: info.partnerUsername,
            avatarUrl: info.partnerAvatarUrl || "",
            bio: info.partnerBio || ""
        }));

        const avatar = document.createElement("span");
        avatar.className = "avatar";
        setAvatar(avatar, info.partnerName || info.partnerUsername, info.partnerAvatarUrl);

        const content = document.createElement("span");
        content.className = "dialog-content";

        const name = document.createElement("strong");
        name.textContent = info.partnerName || `@${info.partnerUsername}`;

        const last = document.createElement("small");
        last.textContent = info.lastMessage || "Диалог создан";

        const meta = document.createElement("time");
        meta.textContent = info.lastTimestamp ? formatShortTime(info.lastTimestamp) : "";

        content.append(name, last);
        item.append(avatar, content, meta);
        els.dialogsList.appendChild(item);
    });
}

async function searchUserByUsername(rawUsername) {
    const username = normalizeUsername(rawUsername);
    els.searchResults.classList.remove("hidden");
    els.searchResults.replaceChildren();

    if (!username) {
        els.searchResults.appendChild(searchMessage("Введите username для поиска."));
        return;
    }

    try {
        const uid = await findUidByUsername(username);
        if (!uid || uid === state.user.uid) {
            els.searchResults.appendChild(searchMessage("Пользователь не найден."));
            return;
        }

        const userData = (await db.ref(`users/${uid}`).once("value")).val();
        if (!userData) {
            els.searchResults.appendChild(searchMessage("Профиль пользователя недоступен."));
            return;
        }

        const item = document.createElement("div");
        item.className = "search-result-item";

        const avatar = document.createElement("span");
        avatar.className = "avatar";
        setAvatar(avatar, userData.nickname || userData.username, userData.avatarUrl);

        const text = document.createElement("span");
        text.className = "search-result-text";
        text.innerHTML = `<strong></strong><small></small>`;
        text.querySelector("strong").textContent = userData.nickname;
        text.querySelector("small").textContent = `@${userData.username}`;

        const button = document.createElement("button");
        button.className = "small-btn";
        button.textContent = "Написать";
        button.addEventListener("click", () => startDialogWith(uid, userData));

        item.append(avatar, text, button);
        els.searchResults.appendChild(item);
    } catch (error) {
        els.searchResults.appendChild(searchMessage(`Ошибка поиска: ${error.message}`));
    }
}

async function startDialogWith(uid, userData) {
    const chatId = [state.user.uid, uid].sort().join("_");
    const now = Date.now();
    const ownRef = db.ref(`user_chats/${state.user.uid}/${chatId}`);
    const exists = (await ownRef.once("value")).exists();

    if (!exists) {
        await ownRef.set({
            partnerId: uid,
            partnerName: userData.nickname,
            partnerUsername: userData.username,
            partnerAvatarUrl: userData.avatarUrl || "",
            partnerBio: userData.bio || "",
            lastMessage: "",
            lastTimestamp: now
        });
        await db.ref(`user_chats/${uid}/${chatId}`).set({
            partnerId: state.user.uid,
            partnerName: state.profile.nickname,
            partnerUsername: state.profile.username,
            partnerAvatarUrl: state.profile.avatarUrl || "",
            partnerBio: state.profile.bio || "",
            lastMessage: "",
            lastTimestamp: now
        });
    }

    els.searchUserInput.value = "";
    els.searchResults.classList.add("hidden");
    openChat(chatId, { uid, nickname: userData.nickname, username: userData.username, avatarUrl: userData.avatarUrl || "", bio: userData.bio || "" });
}

function openChat(chatId, partner) {
    state.activeChatId = chatId;
    state.activePartner = partner;
    state.editingMessageId = null;
    cancelEditMessage();

    els.currentChatTitle.textContent = partner.nickname || `@${partner.username}`;
    els.currentChatSubtitle.textContent = partner.bio || `@${partner.username}`;
    setAvatar(els.chatAvatar, partner.nickname || partner.username, partner.avatarUrl);
    els.chatAvatar.classList.remove("muted");
    els.deleteDialogBtn.classList.remove("hidden");
    els.messageInput.disabled = false;
    els.sendBtn.disabled = false;

    renderLoadingMessages();
    listenMessages(chatId);
    listenTyping(chatId);

    if (window.innerWidth <= 768) els.chatArea.classList.add("open");
}

function listenMessages(chatId) {
    if (state.messagesListener) state.messagesListener.ref.off("value", state.messagesListener.callback);

    const ref = db.ref(`private_messages/${chatId}`).orderByChild("timestamp").limitToLast(100);
    const callback = snap => {
        const data = snap.val() || {};
        const messages = Object.entries(data)
            .map(([id, message]) => ({ id, ...message }))
            .filter(message => !message.deletedFor || !message.deletedFor[state.user.uid])
            .sort((a, b) => a.timestamp - b.timestamp);
        renderMessages(messages);
    };

    ref.on("value", callback);
    state.messagesListener = { ref, callback };
}

function renderMessages(messages) {
    const wasAtBottom = state.isAtBottom;

    if (!messages.length) {
        els.messagesContainer.replaceChildren(emptyBlock("Сообщений пока нет", "Напишите первым и начните диалог."));
        return;
    }

    const fragment = document.createDocumentFragment();
    let lastDate = "";
    messages.forEach(message => {
        const date = formatDateGroup(message.timestamp);
        if (date !== lastDate) {
            const divider = document.createElement("div");
            divider.className = "date-divider";
            divider.textContent = date;
            fragment.appendChild(divider);
            lastDate = date;
        }

        fragment.appendChild(createMessageNode(message));
    });

    els.messagesContainer.replaceChildren(fragment);
    if (wasAtBottom) scrollMessagesToBottom(false);
    requestAnimationFrame(updateScrollState);
}

function createMessageNode(message) {
    const isOwn = message.senderId === state.user.uid;
    const item = document.createElement("article");
    item.className = `message-item ${isOwn ? "own-message" : ""}`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    const text = document.createElement("p");
    text.className = "message-text";
    text.textContent = message.deleted ? "Сообщение удалено" : message.text;
    if (message.deleted) text.classList.add("muted-text");

    const meta = document.createElement("div");
    meta.className = "message-meta";

    const time = document.createElement("time");
    time.textContent = `${formatShortTime(message.timestamp)}${message.editedAt ? " · изменено" : ""}`;
    meta.appendChild(time);

    if (isOwn && !message.deleted) {
        const actions = document.createElement("span");
        actions.className = "message-actions";

        const editBtn = messageAction("Изменить", "edit");
        editBtn.addEventListener("click", () => beginEditMessage(message));

        const deleteBtn = messageAction("Удалить", "delete");
        deleteBtn.addEventListener("click", () => deleteMessage(message.id));

        actions.append(editBtn, deleteBtn);
        meta.appendChild(actions);
    }

    bubble.append(text, meta);
    item.appendChild(bubble);
    return item;
}

async function sendOrUpdateMessage() {
    if (!state.activeChatId || !state.activePartner) return;
    const text = els.messageInput.value.trim();
    if (!text) return;

    try {
        if (state.editingMessageId) {
            await db.ref(`private_messages/${state.activeChatId}/${state.editingMessageId}`).update({
                text,
                editedAt: Date.now()
            });
            await updateChatLastMessage(text);
            cancelEditMessage();
            return;
        }

        await db.ref(`private_messages/${state.activeChatId}`).push({
            senderId: state.user.uid,
            text,
            timestamp: Date.now(),
            editedAt: null,
            deleted: false
        });
        await updateChatLastMessage(text);
        els.messageInput.value = "";
        updateCharCounter();
        await clearTypingIndicator();
    } catch (error) {
        alert(`Не удалось отправить сообщение: ${error.message}`);
    }
}

async function updateChatLastMessage(text, timestamp = Date.now()) {
    await db.ref(`user_chats/${state.user.uid}/${state.activeChatId}`).update({
        lastMessage: text,
        lastTimestamp: timestamp,
        partnerId: state.activePartner.uid,
        partnerName: state.activePartner.nickname,
        partnerUsername: state.activePartner.username,
        partnerAvatarUrl: state.activePartner.avatarUrl || "",
        partnerBio: state.activePartner.bio || ""
    });
    await db.ref(`user_chats/${state.activePartner.uid}/${state.activeChatId}`).update({
        lastMessage: text,
        lastTimestamp: timestamp,
        partnerId: state.user.uid,
        partnerName: state.profile.nickname,
        partnerUsername: state.profile.username,
        partnerAvatarUrl: state.profile.avatarUrl || "",
        partnerBio: state.profile.bio || ""
    });
}

function beginEditMessage(message) {
    state.editingMessageId = message.id;
    els.messageInput.value = message.text;
    els.messageInput.focus();
    els.editBanner.classList.remove("hidden");
    updateCharCounter();
}

function cancelEditMessage() {
    state.editingMessageId = null;
    els.editBanner.classList.add("hidden");
    if (els.messageInput) {
        els.messageInput.value = "";
        updateCharCounter();
    }
}

async function deleteMessage(messageId) {
    if (!confirm("Удалить сообщение?")) return;
    await db.ref(`private_messages/${state.activeChatId}/${messageId}`).update({
        deleted: true,
        text: "",
        deletedAt: Date.now()
    });
    await syncLastMessageAfterDelete();
}

async function syncLastMessageAfterDelete() {
    if (!state.activeChatId || !state.activePartner) return;
    const snap = await db.ref(`private_messages/${state.activeChatId}`).orderByChild("timestamp").limitToLast(30).once("value");
    const messages = Object.values(snap.val() || {})
        .filter(message => !message.deleted)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const latest = messages[0];
    await updateChatLastMessage(latest ? latest.text : "Сообщений нет", latest ? latest.timestamp : Date.now());
}

async function deleteCurrentDialog() {
    if (!state.activeChatId || !confirm("Удалить диалог из списка? Сообщения у собеседника останутся.")) return;
    await db.ref(`user_chats/${state.user.uid}/${state.activeChatId}`).remove();
    renderEmptyChat();
}

function renderEmptyChat() {
    state.activeChatId = null;
    state.activePartner = null;
    els.currentChatTitle.textContent = "Выберите диалог";
    els.currentChatSubtitle.textContent = "Сообщения появятся здесь";
    els.chatAvatar.textContent = "sM";
    els.chatAvatar.style.backgroundImage = "";
    els.chatAvatar.classList.add("muted");
    els.deleteDialogBtn.classList.add("hidden");
    els.messageInput.disabled = true;
    els.sendBtn.disabled = true;
    els.messagesContainer.replaceChildren(emptyBlock("Добро пожаловать", "Найдите пользователя по username или откройте существующий диалог."));
    updateScrollState();
    if (state.messagesListener) state.messagesListener.ref.off("value", state.messagesListener.callback);
    if (state.typingListener) state.typingListener.ref.off("value", state.typingListener.callback);
}

function renderLoadingMessages() {
    els.messagesContainer.replaceChildren(emptyBlock("Загрузка", "Получаем историю сообщений."));
}

function listenTyping(chatId) {
    if (state.typingListener) state.typingListener.ref.off("value", state.typingListener.callback);

    const ref = db.ref(`typing/${chatId}`);
    const callback = snap => {
        const data = snap.val() || {};
        const typingUsers = Object.entries(data).filter(([uid]) => uid !== state.user.uid);
        els.typingIndicatorContainer.classList.toggle("hidden", typingUsers.length === 0);
        if (typingUsers.length) {
            els.typingText.textContent = `${typingUsers[0][1].name || "Собеседник"} печатает...`;
        }
    };
    ref.on("value", callback);
    state.typingListener = { ref, callback };
}

function updateTyping(isTyping) {
    if (!state.activeChatId || !state.user || state.editingMessageId) return;
    const ref = db.ref(`typing/${state.activeChatId}/${state.user.uid}`);
    if (isTyping) {
        ref.set({ name: state.profile.nickname, timestamp: Date.now() });
    } else {
        ref.remove();
    }
}

function clearTypingIndicator() {
    if (!state.activeChatId || !state.user) return Promise.resolve();
    return db.ref(`typing/${state.activeChatId}/${state.user.uid}`).remove();
}

async function refreshOwnDialogCards() {
    const snap = await db.ref(`user_chats/${state.user.uid}`).once("value");
    const chats = snap.val() || {};
    const updates = {};

    Object.entries(chats).forEach(([chatId, info]) => {
        if (!info.partnerId) return;
        updates[`user_chats/${info.partnerId}/${chatId}/partnerName`] = state.profile.nickname;
        updates[`user_chats/${info.partnerId}/${chatId}/partnerUsername`] = state.profile.username;
        updates[`user_chats/${info.partnerId}/${chatId}/partnerAvatarUrl`] = state.profile.avatarUrl || "";
        updates[`user_chats/${info.partnerId}/${chatId}/partnerBio`] = state.profile.bio || "";
    });

    if (Object.keys(updates).length) await db.ref().update(updates);
}

async function findUidByUsername(username) {
    const clean = normalizeUsername(username);
    const direct = (await db.ref(`usernames/${clean}`).once("value")).val();
    if (typeof direct === "string") return direct;

    const legacyMap = (await db.ref("usernames").once("value")).val() || {};
    for (const [key, value] of Object.entries(legacyMap)) {
        if (value === clean) return key;
    }
    return null;
}

async function setUsernameIndex(username, uid) {
    await db.ref(`usernames/${username}`).set(uid);
}

async function removeUsernameIndex(username, uid) {
    if (!username) return;
    const current = await db.ref(`usernames/${username}`).once("value");
    if (current.val() === uid) await db.ref(`usernames/${username}`).remove();
    const legacy = await db.ref(`usernames/${uid}`).once("value");
    if (legacy.val() === username) await db.ref(`usernames/${uid}`).remove();
}

function initTheme() {
    const saved = localStorage.getItem("skam-theme");
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
}

function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem("skam-theme", nextTheme);
}

function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    els.themeToggleBtn?.classList.toggle("active", theme === "dark");
}

function setAvatar(element, label, avatarUrl) {
    element.textContent = "";
    element.style.backgroundImage = "";
    element.classList.remove("has-image");

    if (avatarUrl && (/^https?:\/\//i.test(avatarUrl) || /^data:image\//i.test(avatarUrl))) {
        const image = document.createElement("img");
        image.src = avatarUrl;
        image.alt = label || "avatar";
        image.loading = "lazy";
        image.referrerPolicy = "no-referrer";
        image.addEventListener("error", () => {
            element.classList.remove("has-image");
            element.replaceChildren(document.createTextNode(getInitials(label)));
        }, { once: true });
        element.classList.add("has-image");
        element.appendChild(image);
        return;
    }

    element.textContent = getInitials(label);
}

function compressAvatar(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("не удалось прочитать файл"));
        reader.onload = () => {
            const image = new Image();
            image.onerror = () => reject(new Error("файл не похож на картинку"));
            image.onload = () => {
                const size = 256;
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                const sourceSize = Math.min(image.width, image.height);
                const sourceX = Math.floor((image.width - sourceSize) / 2);
                const sourceY = Math.floor((image.height - sourceSize) / 2);

                canvas.width = size;
                canvas.height = size;
                context.imageSmoothingQuality = "high";
                context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
                resolve(canvas.toDataURL("image/jpeg", 0.78));
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function scrollMessagesDebug(){
        window.scrollTo(x, y)
        requestAnimationFrame(() => {
        els.messagesContainer.scrollTo({
            top: els.messagesContainer.scrollHeight,
            behavior: "smooth"
        });
        state.isAtBottom = true;
        window.setTimeout(updateScrollState, 220);
    });
}

function scrollMessagesToBottom(smooth) {
    requestAnimationFrame(() => {
        els.messagesContainer.scrollTo({
            top: els.messagesContainer.scrollHeight,
            behavior: smooth ? "smooth" : "auto"
        });
        state.isAtBottom = true;
        window.setTimeout(updateScrollState, smooth ? 220 : 0);
    });
}

function updateScrollState() {
    if (!state.activeChatId) {
        els.scrollBottomBtn.classList.add("hidden");
        return;
    }

    const { scrollTop, scrollHeight, clientHeight } = els.messagesContainer;
    const hasOverflow = scrollHeight > clientHeight + 24;
    state.isAtBottom = scrollHeight - scrollTop - clientHeight < 96;
    els.scrollBottomBtn.classList.toggle("hidden", !hasOverflow);
    els.scrollBottomBtn.classList.toggle("at-bottom", state.isAtBottom);
}

function normalizeUsername(value) {
    return String(value || "").trim().replace(/^@/, "").toLowerCase();
}

function isValidUsername(username) {
    return /^[a-z0-9_]{3,24}$/.test(username);
}

function updateCharCounter() {
    els.charCounter.textContent = `${els.messageInput.value.length}/500`;
}

function getInitials(value) {
    const clean = String(value || "sM").trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return clean.slice(0, 2).toUpperCase();
}

function formatShortTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatDateGroup(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Сегодня";
    if (date.toDateString() === yesterday.toDateString()) return "Вчера";
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function emptyBlock(title, text) {
    const block = document.createElement("div");
    block.className = "empty-state";
    const logo = document.createElement("div");
    logo.className = "empty-logo";
    logo.textContent = "sM";
    const heading = document.createElement("h2");
    heading.textContent = title;
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    block.append(logo, heading, paragraph);
    return block;
}

function searchMessage(text) {
    const item = document.createElement("div");
    item.className = "search-result-item muted-result";
    item.textContent = text;
    return item;
}

function messageAction(label, type) {
    const button = document.createElement("button");
    button.className = `message-action ${type}`;
    button.type = "button";
    button.textContent = label;
    return button;
}
