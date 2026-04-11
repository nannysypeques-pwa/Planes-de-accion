/**
 * Firebase Firestore Service Wrapper (v9+ Compat)
 * Proporciona métodos para interactuar con la base de datos de la agencia.
 */

export const FirebaseService = {
    // USUARIOS Y ROLES
    async getCurrentUserProfile(uid) {
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                return doc.data();
            }
            return null;
        } catch (error) {
            console.error("Error al obtener perfil:", error);
            throw error;
        }
    },

    async getAllMembers() {
        try {
            const snapshot = await db.collection('users').get();
            return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error al obtener miembros:", error);
            return [];
        }
    },

    async getUserNamesByIds(uids) {
        if (!uids || uids.length === 0) return {};
        try {
            const snapshot = await db.collection('users').where(firebase.firestore.FieldPath.documentId(), 'in', uids).get();
            const names = {};
            snapshot.docs.forEach(doc => {
                names[doc.id] = doc.data().name;
            });
            return names;
        } catch (error) {
            console.error("Error al obtener nombres:", error);
            return {};
        }
    },

    // PLANES DE ACCIÓN
    async createActionPlan(planData) {
        try {
            const res = await db.collection('action_plans').add({
                ...planData,
                status: 'pendiente',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                progress: 0,
                risk: 'green'
            });
            return res.id;
        } catch (error) {
            console.error("Error al crear plan:", error);
            throw error;
        }
    },

    async getPlansByRole(user) {
        try {
            if (user.role === 'gerente') {
                const snapshot = await db.collection('action_plans').orderBy('createdAt', 'desc').get();
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }

            // Para coordinadores y miembros, traemos los de su área O donde participen
            const [areaSnap, leadSnap] = await Promise.all([
                db.collection('action_plans').where('area', '==', user.area || '').get(),
                db.collection('action_plans').where('lead_id', '==', user.uid).get()
            ]);

            // Combinar y eliminar duplicados por ID
            const plansMap = new Map();
            areaSnap.docs.forEach(doc => plansMap.set(doc.id, { id: doc.id, ...doc.data() }));
            leadSnap.docs.forEach(doc => plansMap.set(doc.id, { id: doc.id, ...doc.data() }));

            let plans = Array.from(plansMap.values());
            
            // Ordenar por fecha
            plans.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
            
            return plans;
        } catch (error) {
            console.error("Error al obtener planes:", error);
            return [];
        }
    },

    // TAREAS
    async createTask(taskData) {
        return await db.collection('tasks').add({
            ...taskData,
            status: 'pendiente',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    async getTasksByPlanIds(planIds) {
        if (!planIds || planIds.length === 0) return [];
        try {
            // Firestore tiene un límite de 30 en consultas 'in'
            const chunks = [];
            for (let i = 0; i < planIds.length; i += 30) {
                chunks.push(planIds.slice(i, i + 30));
            }

            const results = await Promise.all(chunks.map(chunk =>
                db.collection('tasks').where('plan_id', 'in', chunk).get()
            ));

            const allTasks = [];
            results.forEach(snap => {
                snap.docs.forEach(doc => allTasks.push({ id: doc.id, ...doc.data() }));
            });
            return allTasks;
        } catch (error) {
            console.error("Error al obtener tareas por planes:", error);
            return [];
        }
    },

    async getTasksByUserId(userId) {
        try {
            const snapshot = await db.collection('tasks')
                .where('assigned_id', '==', userId)
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error al obtener tareas por usuario:", error);
            return [];
        }
    },

    // TAREAS PERSONALES (PENDIENTES LIBRES)
    async createPersonalTask(userId, title, dueDate, dueTime) {
        try {
            return await db.collection('personal_tasks').add({
                userId,
                title,
                due_date: dueDate || null,
                due_time: dueTime || null,
                status: 'pendiente',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error("Error al crear tarea personal:", error);
            throw error;
        }
    },

    async getPersonalTasks(userId) {
        try {
            const snapshot = await db.collection('personal_tasks')
                .where('userId', '==', userId)
                .get();
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Ordenar en el cliente: pendientes primero, luego por fecha+hora, completados al final
            tasks.sort((a, b) => {
                const aDone = a.status === 'completado';
                const bDone = b.status === 'completado';
                if (aDone !== bDone) return aDone ? 1 : -1;
                // Por fecha y hora
                const aStr = (a.due_date || '9999') + (a.due_time || '99:99');
                const bStr = (b.due_date || '9999') + (b.due_time || '99:99');
                return aStr.localeCompare(bStr);
            });
            return tasks;
        } catch (error) {
            console.error("Error al obtener tareas personales:", error);
            return [];
        }
    },

    async deletePersonalTask(taskId) {
        try {
            await db.collection('personal_tasks').doc(taskId).delete();
        } catch (error) {
            console.error("Error al eliminar tarea personal:", error);
            throw error;
        }
    },

    // NOTIFICACIONES
    async sendNotification(userId, title, body, link) {
        return await db.collection('notifications').add({
            userId,
            title,
            body,
            link,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    async sendPasswordResetEmail(email) {
        try {
            await auth.sendPasswordResetEmail(email);
        } catch (error) {
            console.error("Error al enviar reset password:", error);
            throw error;
        }
    },

    // VACACIONES (LFT México)
    calculateLFTVacations(hireDateStr) {
        if (!hireDateStr) return 0;
        const hireDate = new Date(hireDateStr + 'T00:00:00');
        const now = new Date();
        const years = (now - hireDate) / (1000 * 60 * 60 * 24 * 365.25);
        const completeYears = Math.floor(years);

        if (completeYears < 1) return 0;
        if (completeYears === 1) return 12;
        if (completeYears === 2) return 14;
        if (completeYears === 3) return 16;
        if (completeYears === 4) return 18;
        if (completeYears === 5) return 20;

        // A partir del 6to año, aumentan 2 días por cada 5 años.
        const periodsOfFive = Math.floor((completeYears - 6) / 5);
        return 22 + (periodsOfFive * 2);
    },

    async getUserVacationStats(user) {
        const baseTotal = this.calculateLFTVacations(user.hire_date);
        const manualAdj = user.manual_vacation_adjustment || 0;
        const total = baseTotal + manualAdj;
        
        const snap = await db.collection('vacation_requests')
            .where('uid', '==', user.uid)
            .get();
        
        let used = 0;
        let pending = 0;
        
        snap.docs.forEach(doc => {
            const data = doc.data();
            const status = data.status;
            if (status === 'aprobado_gerencia' || status === 'aprobado') {
                used += (data.days_requested || 0);
            } else if (status === 'pendiente' || status === 'aprobado_coordinador') {
                pending += (data.days_requested || 0);
            }
        });

        return { total, baseTotal, manualAdj, used, pending, available: total - used - pending };
    },

    async updateManualVacationAdjustment(uid, amount) {
        try {
            await db.collection('users').doc(uid).update({
                manual_vacation_adjustment: firebase.firestore.FieldValue.increment(amount)
            });
            return true;
        } catch (e) {
            console.error("Error updating manual vacation adjustment", e);
            throw e;
        }
    },

    async setManualVacationAdjustment(uid, amount) {
        try {
            await db.collection('users').doc(uid).update({
                manual_vacation_adjustment: amount
            });
            return true;
        } catch (e) {
            console.error("Error setting manual vacation adjustment", e);
            throw e;
        }
    },

    async requestVacation(data) {
        return await db.collection('vacation_requests').add({
            ...data,
            status: 'pendiente', // pendiente -> aprobado_coordinador -> aprobado_gerencia -> rechazado
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    async getVacationRequests(user) {
        let results = [];
        if (user.role === 'miembro') {
            const snap = await db.collection('vacation_requests').where('uid', '==', user.uid).get();
            results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else if (user.role === 'coordinador' || user.role === 'coordinadora') {
            const snap = await db.collection('vacation_requests').where('area', '==', user.area).get();
            results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else if (user.role === 'gerente') {
            const snap = await db.collection('vacation_requests').get();
            results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        
        // Sort en memoria para no depender de índices combinados de Firebase
        results.sort((a, b) => {
            const dateA = a.createdAt?.toDate() || new Date(0);
            const dateB = b.createdAt?.toDate() || new Date(0);
            return dateB - dateA;
        });

        return results;
    }
};
