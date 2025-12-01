import { useEffect, useState } from 'react';
import { ref as dbRef, onChildAdded, push, serverTimestamp, query, limitToLast } from 'firebase/database';
import { rtdb } from '../services/firebase';
import { useAuth } from './useAuth';

export function useChat() {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const messagesRef = dbRef(rtdb, 'messages');
        const recentMessagesQuery = query(messagesRef, limitToLast(50));

        const unsubscribe = onChildAdded(recentMessagesQuery, (snapshot) => {
            const message = snapshot.val();
            setMessages((prev) => [...prev, { id: snapshot.key, ...message }]);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const sendMessage = async (text) => {
        if (!user || !text.trim()) return;

        const messagesRef = dbRef(rtdb, 'messages');
        await push(messagesRef, {
            text: text.trim(),
            type: 'text',
            uid: user.uid,
            displayName: user.displayName || 'Anonymous',
            photoURL: user.photoURL || null,
            timestamp: serverTimestamp(),
        });
    };

    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG with 0.7 quality
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl);
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const sendImage = async (file) => {
        if (!user || !file) return;

        try {
            setUploading(true);

            // Validate file type
            const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                alert('Please upload a valid image (JPEG, PNG, GIF, or WebP)');
                return;
            }

            // Compress and convert to Base64
            const base64Image = await compressImage(file);

            // Send message with image data directly
            const messagesRef = dbRef(rtdb, 'messages');
            await push(messagesRef, {
                type: 'image',
                imageUrl: base64Image, // Storing data URL directly
                uid: user.uid,
                displayName: user.displayName || 'Anonymous',
                photoURL: user.photoURL || null,
                timestamp: serverTimestamp(),
            });
        } catch (error) {
            console.error('Error sending image:', error);
            alert('Failed to send image. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return { messages, sendMessage, sendImage, uploading };
}
