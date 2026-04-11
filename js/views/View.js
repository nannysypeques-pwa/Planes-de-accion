/**
 * Base Class for Application Views
 */
export class View {
    constructor(app) {
        this.app = app;
    }

    createEl(tag, className, content) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (content) el.innerHTML = content;
        return el;
    }

    async render() {
        throw new Error("Render method not implemented");
    }

    /**
     * Sanitiza texto proporcionado por usuarios para prevenir Inyección XSS
     * Convierte caracteres peligrosos en entidades HTML seguras.
     */
    escapeHTML(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }
}
