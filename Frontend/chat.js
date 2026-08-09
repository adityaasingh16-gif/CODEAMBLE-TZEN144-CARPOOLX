(() => {
  const form = document.getElementById('chatForm');
  const input = document.getElementById('messageInput');
  const messages = document.getElementById('messages');
  const sendButton = document.getElementById('sendButton');
  const status = document.getElementById('status');
  const rideId = new URLSearchParams(window.location.search).get('rideId') ||
    localStorage.getItem('activeRideId');

  if (!localStorage.getItem('token')) {
    window.location.href = 'login.html';
    return;
  }

  function addMessage(message) {
    const element = document.createElement('div');
    const senderId = message.sender?._id || message.sender;
    const session = JSON.parse(localStorage.getItem('activeSession') || '{}');
    element.className = `message ${senderId === session.userId ? 'user' : 'assistant'}`;
    element.textContent = message.content;
    element.title = message.sender?.name || '';
    messages.appendChild(element);
    messages.scrollTop = messages.scrollHeight;
  }

  async function loadMessages() {
    if (!rideId) {
      status.textContent = 'Open chat from an active ride.';
      return;
    }
    try {
      const loaded = await apiGetRideMessages(rideId);
      messages.innerHTML = '';
      loaded.forEach(addMessage);
      await apiMarkRideMessagesRead(rideId);
      status.textContent = `${loaded.length} message${loaded.length === 1 ? '' : 's'}`;
    } catch (error) {
      status.textContent = error.message || 'Chat is unavailable.';
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content || !rideId) return;
    sendButton.disabled = true;
    try {
      const result = await apiSendRideMessage(rideId, content);
      input.value = '';
      addMessage(result.message);
    } catch (error) {
      status.textContent = error.message || 'Message could not be sent.';
    } finally {
      sendButton.disabled = false;
      input.focus();
    }
  });

  loadMessages();
  window.setInterval(loadMessages, 5000);
})();