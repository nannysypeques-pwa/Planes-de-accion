const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * Escucha la creación de nuevas notificaciones en Firestore y envía un Push via FCM.
 */
exports.sendPushNotification = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snapshot, context) => {
        const data = snapshot.data();
        const userId = data.userId;

        if (!userId) {
            console.log('No hay userId en la notificación.');
            return null;
        }

        try {
            // 1. Obtener los tokens FCM del usuario
            const userDoc = await admin.firestore().collection('users').doc(userId).get();
            
            if (!userDoc.exists) {
                console.log(`El usuario ${userId} no existe.`);
                return null;
            }

            const userData = userDoc.data();
            const tokens = userData.fcm_tokens || [];

            if (tokens.length === 0) {
                console.log(`El usuario ${userId} no tiene tokens registrados.`);
                return null;
            }

            // 2. Construir el mensaje
            const message = {
                notification: {
                    title: data.title || 'Nueva notificación',
                    body: data.body || 'Tienes una nueva actualización en la plataforma.'
                },
                data: {
                    url: data.link || '/',
                },
                tokens: tokens
            };

            // 3. Enviar multicast
            const response = await admin.messaging().sendEachForMulticast(message);
            
            console.log(`Notificación enviada con éxito (${response.successCount} éxitos, ${response.failureCount} fallos)`);

            // Limpiar tokens inválidos (opcional pero recomendado)
            if (response.failureCount > 0) {
                const invalidTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const error = resp.error;
                        if (error && (error.code === 'messaging/invalid-registration-token' ||
                            error.code === 'messaging/registration-token-not-registered')) {
                            invalidTokens.push(tokens[idx]);
                        }
                    }
                });

                if (invalidTokens.length > 0) {
                    await admin.firestore().collection('users').doc(userId).update({
                        fcm_tokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens)
                    });
                    console.log(`Tokens inválidos eliminados: ${invalidTokens.length}`);
                }
            }

            return null;
        } catch (error) {
            console.error('Error enviando notificación Push:', error);
            return null;
        }
    });
