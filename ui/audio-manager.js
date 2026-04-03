/**
 * AudioManager - Unified audio playback for BodumCare
 */
const AudioManager = {
    audioPath: '/ui/sound/',
    currentAudio: null,
    
    /**
     * Plays a voice file by ID.
     * @param {string} id - The sound ID (e.g., 'sys_welcome')
     * @param {boolean} force - If true, stops current audio and plays the new one immediately.
     */
    playVoice(id, force = true) {
        if (!id) return;
        
        const fileName = `${id}.mp3`;
        const fullPath = this.audioPath + fileName;
        console.log(`[AudioManager] Attempting to play: ${id} (${fullPath})`);
        
        if (force && this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
        }
        
        try {
            const audio = new Audio(fullPath);
            this.currentAudio = audio;
            audio.play().then(() => {
                console.log(`[AudioManager] Successfully playing: ${id}`);
            }).catch(err => {
                if (err.name === 'NotAllowedError') {
                    console.warn(`[AudioManager] Blocked by browser policy: ${id}. Ensure page interaction first.`);
                } else {
                    console.error(`[AudioManager] Playback failed for ${id}:`, err);
                }
            });
            return audio;
        } catch (err) {
            console.error(`[AudioManager] Initialization failed for ${id}:`, err);
        }
    },

    /**
     * Stops currently playing audio.
     */
    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
    }
};

window.AudioManager = AudioManager;
