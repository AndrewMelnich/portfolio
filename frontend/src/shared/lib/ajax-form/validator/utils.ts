export function clearMessages(form: Element) {
    const messageElements = Array.from(form.querySelectorAll('.js-app-message'));

    messageElements.forEach((messageElement) => {
        messageElement.textContent = '';
    });
}

export function getLang() {
    return document.documentElement.lang.toLowerCase();
}
