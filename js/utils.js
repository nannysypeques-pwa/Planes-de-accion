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

export const TaskUtils = {
    /**
     * Calcula dinámicamente los estados de las tareas padre basadas en sus subtareas.
     * @param {Array} tasks - Listado de tareas con sus campos id, parent_id y status.
     * @returns {Array} Listado de tareas con sus estados actualizados dinámicamente.
     */
    computeDynamicStatuses(tasks) {
        if (!tasks || !Array.isArray(tasks)) return [];

        const parents = tasks.filter(t => !t.parent_id);
        const subtasks = tasks.filter(t => t.parent_id);
        const subtasksByParent = {};
        
        subtasks.forEach(s => {
            if (!subtasksByParent[s.parent_id]) subtasksByParent[s.parent_id] = [];
            subtasksByParent[s.parent_id].push(s);
        });

        return tasks.map(t => {
            if (t.parent_id) {
                // Las subtareas conservan su propio estado directamente de la DB
                return { ...t };
            }
            const children = subtasksByParent[t.id] || [];
            if (children.length === 0) {
                // Si la tarea padre no tiene subtareas, conserva su estado de la DB
                return { ...t };
            }

            // Si tiene subtareas, calculamos su estado dinámico
            const total = children.length;
            const counts = children.reduce((acc, s) => {
                acc[s.status] = (acc[s.status] || 0) + 1;
                return acc;
            }, {});

            const completadas = counts['completado'] || 0;
            const enProceso = counts['en_proceso'] || 0;
            const pendientes = counts['pendiente'] || 0;
            const canceladas = counts['cancelada'] || 0;

            let dynamicStatus;
            if (completadas === total) {
                dynamicStatus = 'completado';
            } else {
                // Excluimos 'completado' porque no todas las subtareas están completadas
                const stats = [
                    { s: 'en_proceso', c: enProceso },
                    { s: 'pendiente', c: pendientes },
                    { s: 'cancelada', c: canceladas }
                ];
                stats.sort((a, b) => b.c - a.c);
                dynamicStatus = stats[0].s;
            }

            return { ...t, status: dynamicStatus };
        });
    }
};
