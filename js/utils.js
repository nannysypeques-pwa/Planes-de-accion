/**
 * Utilidades globales de sanitización y validación
 */
export const SecurityUtils = {
    /**
     * Limpia un texto de etiquetas HTML y limita su longitud
     * @param {string} text - El texto a sanitizar
     * @param {number} maxLength - Longitud máxima permitida
     * @returns {string} Texto limpio y recortado
     */
    sanitizeText(text, maxLength = 255) {
        if (!text) return '';
        
        // 1. Eliminar etiquetas HTML completamente
        let clean = text.replace(/<[^>]*>?/gm, '');
        
        // 2. Eliminar caracteres que podrían usarse para inyecciones básicas si se escapara el HTML
        // (Aunque ya tenemos escapeHTML en las vistas, esto es defensa en profundidad)
        clean = clean.replace(/[<>\"\'&]/g, '');
        
        // 3. Recortar espacios y limitar longitud
        return clean.trim().substring(0, maxLength);
    },

    /**
     * Valida si un email tiene un formato básico correcto
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
};
