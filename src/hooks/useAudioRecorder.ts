import { useState, useRef, useCallback } from 'react';

export const useAudioRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Error accessing microphone:", error);
        }
    }, []);

    const stopRecording = useCallback((): Promise<Blob> => {
        return new Promise((resolve) => {
            if (mediaRecorderRef.current && isRecording) {
                mediaRecorderRef.current.onstop = () => {
                    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                    chunksRef.current = [];
                    resolve(blob);
                };
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                setIsRecording(false);
            } else {
                resolve(new Blob());
            }
        });
    }, [isRecording]);

    return { isRecording, startRecording, stopRecording };
};
