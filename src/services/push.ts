import webpush from "web-push";
import dotenv from "dotenv";

dotenv.config();

const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (!publicVapidKey || !privateVapidKey) {
    console.error("⚠️ VAPID keys not found!");
} else {
    webpush.setVapidDetails(
        "mailto:example@yourdomain.org",
        publicVapidKey,
        privateVapidKey
    );
}

export const sendPushNotification = async (subscription: any, payload: any) => {
    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        console.log("✅ Push enviado com sucesso!");
    } catch (error) {
        console.error("❌ Erro ao enviar push:", error);
    }
};

export const getPublicVapidKey = () => {
    return publicVapidKey;
};
